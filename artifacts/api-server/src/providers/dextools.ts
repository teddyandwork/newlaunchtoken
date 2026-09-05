import { logger } from "../lib/logger";
import { noteProviderEvent, updateProvider } from "./manager";
import type { NormalizedToken, TokenHandler } from "./types";

const API_BASE = "https://api.dextools.io";
const POLL_INTERVAL_MS = 120_000;
const MAX_POOLS_PER_RANKING = 3;
const MAX_TOKENS_PER_CHAIN = 5;

// These are chain ids shown in DEXTools' official API examples and product
// documentation. Operators can narrow the feed with DEXTOOLS_CHAINS.
const DEFAULT_CHAINS = [
  "ether",
  "bsc",
  "solana",
  "base",
  "arbitrum",
  "polygon",
  "avalanche",
];

type PoolToken = {
  address?: string;
  symbol?: string;
  name?: string;
};

type RankedPool = {
  address?: string;
  exchangeName?: string;
  creationTime?: string;
  mainToken?: PoolToken;
  price?: number;
  price24h?: number;
};

type TokenDescription = {
  address?: string;
  name?: string;
  symbol?: string;
  logo?: string;
  socialInfo?: {
    telegram?: string;
    twitter?: string;
    website?: string;
    discord?: string;
  };
  creationTime?: string;
};

function configuredChains(): string[] {
  const configured = process.env["DEXTOOLS_CHAINS"]
    ?.split(",")
    .map((chain) => chain.trim().toLowerCase())
    .filter(Boolean);
  return configured?.length ? configured : DEFAULT_CHAINS;
}

function normalizeChain(chain: string): string {
  const labels: Record<string, string> = {
    ether: "ETHEREUM",
    ethereum: "ETHEREUM",
    bsc: "BNB CHAIN",
    solana: "SOLANA",
    base: "BASE",
    arbitrum: "ARBITRUM",
    polygon: "POLYGON",
    avalanche: "AVALANCHE",
  };
  return labels[chain] ?? chain.replace(/[-_]/g, " ").toUpperCase();
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

function asPools(payload: unknown): RankedPool[] {
  return Array.isArray(payload) ? (payload as RankedPool[]) : [];
}

function asToken(payload: unknown): TokenDescription | null {
  if (!payload || typeof payload !== "object") return null;
  return payload as TokenDescription;
}

async function getJson(url: string, apiKey: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "X-API-Key": apiKey,
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (response.status === 429) {
    const error = new Error("DEXTools rate limit reached");
    error.name = "RateLimitError";
    throw error;
  }
  if (response.status === 401 || response.status === 403) {
    const error = new Error(`DEXTools authorization failed (${response.status})`);
    error.name = "AuthorizationError";
    throw error;
  }
  if (!response.ok) {
    throw new Error(`DEXTools responded with ${response.status}`);
  }
  return response.json();
}

function normalize(
  chain: string,
  pool: RankedPool,
  details: TokenDescription | null,
): NormalizedToken | null {
  const address = pool.mainToken?.address ?? details?.address;
  if (!address) return null;

  const socialInfo = details?.socialInfo;
  const parsedPrice = typeof pool.price === "number" ? pool.price : null;

  return {
    chain: normalizeChain(chain),
    address,
    name: details?.name ?? pool.mainToken?.name ?? null,
    symbol: details?.symbol ?? pool.mainToken?.symbol ?? null,
    source: "dextools",
    createdAt: details?.creationTime
      ? new Date(details.creationTime)
      : pool.creationTime
        ? new Date(pool.creationTime)
        : null,
    detectedAt: new Date(),
    priceUsd: Number.isFinite(parsedPrice) ? parsedPrice : null,
    marketCapUsd: null,
    fdvUsd: null,
    liquidityUsd: null,
    volume5mUsd: null,
    volume1hUsd: null,
    volume24hUsd: null,
    buys5m: null,
    sells5m: null,
    pairAddress: pool.address ?? null,
    dex: pool.exchangeName ?? null,
    website: validUrl(socialInfo?.website),
    twitter: validUrl(socialInfo?.twitter),
    telegram: validUrl(socialInfo?.telegram),
    discord: validUrl(socialInfo?.discord),
    logoUrl: validUrl(details?.logo),
    chartUrl: null,
  };
}

async function pollChain(
  chain: string,
  apiKey: string,
  onToken: TokenHandler,
): Promise<number> {
  const [hotPoolsPayload, gainersPayload] = await Promise.all([
    getJson(`${API_BASE}/v2/ranking/${encodeURIComponent(chain)}/hotpools`, apiKey),
    getJson(`${API_BASE}/v2/ranking/${encodeURIComponent(chain)}/gainers`, apiKey),
  ]);

  const pools = [...asPools(hotPoolsPayload), ...asPools(gainersPayload)]
    .filter((pool) => pool.mainToken?.address)
    .slice(0, MAX_POOLS_PER_RANKING * 2);
  const uniquePools = Array.from(
    new Map(pools.map((pool) => [pool.mainToken?.address, pool])).values(),
  ).slice(0, MAX_TOKENS_PER_CHAIN);

  let emitted = 0;
  for (const pool of uniquePools) {
    const address = pool.mainToken?.address;
    if (!address) continue;

    let details: TokenDescription | null = null;
    try {
      details = asToken(
        await getJson(
          `${API_BASE}/v2/token/${encodeURIComponent(chain)}/${encodeURIComponent(address)}`,
          apiKey,
        ),
      );
    } catch (error) {
      logger.warn({ err: error, chain, address }, "DEXTools token enrichment failed");
    }

    const token = normalize(chain, pool, details);
    if (!token) continue;
    await onToken(token);
    noteProviderEvent("dextools", token.chain);
    emitted += 1;
  }
  return emitted;
}

export function startDexTools(onToken: TokenHandler): void {
  const apiKey = process.env["DEXTOOLS_API_KEY"];
  if (!apiKey) {
    updateProvider("dextools", {
      status: "disabled",
      error: "DEXTOOLS_API_KEY is not configured",
    });
    logger.warn("DEXTools provider disabled: DEXTOOLS_API_KEY is not configured");
    return;
  }

  const chains = configuredChains();
  let running = false;
  updateProvider("dextools", {
    status: "starting",
    error: null,
    chains: chains.map(normalizeChain),
  });

  const run = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const results = await Promise.allSettled(
        chains.map((chain) => pollChain(chain, apiKey, onToken)),
      );
      const failures = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      if (failures.length === results.length && failures[0]) {
        throw failures[0].reason;
      }
      updateProvider("dextools", {
        status: failures.length ? "error" : "connected",
        error: failures.length
          ? `${failures.length} chain poll(s) failed`
          : null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider error";
      updateProvider("dextools", {
        status:
          error instanceof Error && error.name === "RateLimitError"
            ? "rate_limited"
            : "error",
        error: message,
      });
      logger.warn({ err: error }, "DEXTools poll failed");
    } finally {
      running = false;
    }
  };

  void run();
  setInterval(() => void run(), POLL_INTERVAL_MS);
}