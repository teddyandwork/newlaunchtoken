import { logger } from "../lib/logger";
import { noteProviderEvent, updateProvider } from "./manager";
import type { NormalizedToken, TokenHandler } from "./types";

const DEFAULT_RPC_URLS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
];
const PUMP_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const POLL_INTERVAL_MS = 30_000;
const SIGNATURE_LIMIT = 50;
const MAX_SEEN_SIGNATURES = 500;

const CREATE_DISCRIMINATOR = [24, 30, 200, 40, 5, 28, 7, 119];
const CREATE_V2_DISCRIMINATOR = [214, 144, 76, 236, 95, 139, 49, 180];
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

type RpcResponse<T> = {
  result?: T;
  error?: { code?: number; message?: string };
};

type SignatureInfo = {
  signature: string;
  blockTime?: number | null;
  err?: unknown;
};

type RawInstruction = {
  programId?: string;
  accounts?: Array<string | { pubkey?: string }>;
  data?: string;
};

type TransactionResponse = {
  blockTime?: number | null;
  meta?: { err?: unknown };
  transaction?: {
    message?: {
      instructions?: RawInstruction[];
    };
  };
};

type CreateInstruction = {
  accounts: string[];
  name: string;
  symbol: string;
  uri: string;
};

type TokenMetadata = {
  image?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  extensions?: {
    twitter?: string;
    telegram?: string;
    website?: string;
  };
};

function isDiscriminator(value: number[], expected: number[]): boolean {
  return expected.every((byte, index) => value[index] === byte);
}

function base58Decode(value: string): Uint8Array {
  const bytes = [0];
  for (const character of value) {
    const digit = BASE58_ALPHABET.indexOf(character);
    if (digit < 0) throw new Error("Invalid base58 instruction data");
    let carry = digit;
    for (let index = 0; index < bytes.length; index += 1) {
      const next = bytes[index] * 58 + carry;
      bytes[index] = next & 0xff;
      carry = next >> 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  for (const character of value) {
    if (character !== "1") break;
    bytes.push(0);
  }
  return Uint8Array.from(bytes.reverse());
}

function readAnchorString(
  bytes: Uint8Array,
  offset: number,
): { value: string; nextOffset: number } | null {
  if (offset + 4 > bytes.length) return null;
  const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);
  const nextOffset = offset + 4 + length;
  if (length > 10_000 || nextOffset > bytes.length) return null;
  return {
    value: new TextDecoder().decode(bytes.slice(offset + 4, nextOffset)),
    nextOffset,
  };
}

function instructionAccounts(instruction: RawInstruction): string[] {
  return (instruction.accounts ?? [])
    .map((account) => (typeof account === "string" ? account : account.pubkey))
    .filter((account): account is string => Boolean(account));
}

function decodeCreateInstruction(instruction: RawInstruction): CreateInstruction | null {
  if (instruction.programId !== PUMP_PROGRAM_ID || !instruction.data) return null;

  let bytes: Uint8Array;
  try {
    bytes = base58Decode(instruction.data);
  } catch {
    return null;
  }

  const discriminator = Array.from(bytes.slice(0, 8));
  if (
    !isDiscriminator(discriminator, CREATE_DISCRIMINATOR) &&
    !isDiscriminator(discriminator, CREATE_V2_DISCRIMINATOR)
  ) {
    return null;
  }

  let offset = 8;
  const name = readAnchorString(bytes, offset);
  if (!name) return null;
  offset = name.nextOffset;
  const symbol = readAnchorString(bytes, offset);
  if (!symbol) return null;
  offset = symbol.nextOffset;
  const uri = readAnchorString(bytes, offset);
  if (!uri) return null;

  return {
    accounts: instructionAccounts(instruction),
    name: name.value,
    symbol: symbol.value,
    uri: uri.value,
  };
}

function validUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function asMetadata(value: unknown): TokenMetadata | null {
  if (!value || typeof value !== "object") return null;
  return value as TokenMetadata;
}

async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  const configuredUrl = process.env["SOLANA_RPC_URL"];
  const rpcUrls = configuredUrl
    ? [configuredUrl, ...DEFAULT_RPC_URLS.filter((url) => url !== configuredUrl)]
    : DEFAULT_RPC_URLS;
  let lastError: unknown = null;

  for (const rpcUrl of rpcUrls) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method,
          params,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (response.status === 429) {
        const error = new Error(`Public Solana RPC rate limit reached at ${rpcUrl}`);
        error.name = "RateLimitError";
        lastError = error;
        continue;
      }
      if (!response.ok) {
        lastError = new Error(`Public Solana RPC responded with ${response.status}`);
        continue;
      }

      const payload = (await response.json()) as RpcResponse<T>;
      if (payload.error) {
        lastError = new Error(
          `Solana RPC ${method} failed: ${payload.error.message ?? "unknown error"}`,
        );
        continue;
      }
      return payload.result as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All public Solana RPC endpoints failed");
}

async function fetchMetadata(uri: string): Promise<TokenMetadata | null> {
  const url = validUrl(uri);
  if (!url) return null;

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    return asMetadata(await response.json());
  } catch (error) {
    logger.warn({ err: error, uri }, "Pump.fun metadata fetch failed");
    return null;
  }
}

function normalize(
  instruction: CreateInstruction,
  blockTime: number | null | undefined,
  metadata: TokenMetadata | null,
): NormalizedToken | null {
  const address = instruction.accounts[0];
  if (!address) return null;

  const extensions = metadata?.extensions;
  return {
    chain: "SOLANA",
    address,
    name: instruction.name || null,
    symbol: instruction.symbol || null,
    source: "pumpfun",
    createdAt: typeof blockTime === "number" ? new Date(blockTime * 1_000) : null,
    detectedAt: new Date(),
    priceUsd: null,
    marketCapUsd: null,
    fdvUsd: null,
    liquidityUsd: null,
    volume5mUsd: null,
    volume1hUsd: null,
    volume24hUsd: null,
    buys5m: null,
    sells5m: null,
    pairAddress: null,
    dex: "Pump.fun",
    website: validUrl(metadata?.website ?? extensions?.website),
    twitter: validUrl(metadata?.twitter ?? extensions?.twitter),
    telegram: validUrl(metadata?.telegram ?? extensions?.telegram),
    discord: null,
    logoUrl: validUrl(metadata?.image),
    chartUrl: null,
  };
}

async function pollOnce(
  seenSignatures: Set<string>,
  onToken: TokenHandler,
): Promise<void> {
  const signatures = await rpcCall<SignatureInfo[]>("getSignaturesForAddress", [
    PUMP_PROGRAM_ID,
    { commitment: "confirmed", limit: SIGNATURE_LIMIT },
  ]);

  for (const signatureInfo of [...(signatures ?? [])].reverse()) {
    if (!signatureInfo.signature || seenSignatures.has(signatureInfo.signature)) continue;
    seenSignatures.add(signatureInfo.signature);
    if (seenSignatures.size > MAX_SEEN_SIGNATURES) {
      const oldest = seenSignatures.values().next().value;
      if (oldest) seenSignatures.delete(oldest);
    }
    if (signatureInfo.err) continue;

    const transaction = await rpcCall<TransactionResponse | null>("getTransaction", [
      signatureInfo.signature,
      {
        commitment: "confirmed",
        encoding: "jsonParsed",
        maxSupportedTransactionVersion: 0,
      },
    ]);
    const instructions = transaction?.transaction?.message?.instructions ?? [];
    const createInstruction = instructions
      .map(decodeCreateInstruction)
      .find((instruction): instruction is CreateInstruction => Boolean(instruction));
    if (!createInstruction) continue;

    const metadata = await fetchMetadata(createInstruction.uri);
    const token = normalize(
      createInstruction,
      transaction?.blockTime ?? signatureInfo.blockTime,
      metadata,
    );
    if (!token) continue;

    await onToken(token);
    noteProviderEvent("pumpfun", token.chain);
  }
}

export function startPumpFun(onToken: TokenHandler): void {
  const seenSignatures = new Set<string>();
  let running = false;
  updateProvider("pumpfun", { status: "starting", error: null });

  const run = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      await pollOnce(seenSignatures, onToken);
      updateProvider("pumpfun", { status: "connected", error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider error";
      updateProvider("pumpfun", {
        status:
          error instanceof Error && error.name === "RateLimitError"
            ? "rate_limited"
            : "error",
        error: message,
      });
      logger.warn({ err: error }, "Experimental Pump.fun watcher failed");
    } finally {
      running = false;
    }
  };

  void run();
  setInterval(() => void run(), POLL_INTERVAL_MS);
}