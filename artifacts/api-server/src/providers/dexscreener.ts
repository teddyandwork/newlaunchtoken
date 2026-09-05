import { logger } from "../lib/logger";
import { noteProviderEvent, updateProvider } from "./manager";
import type { NormalizedToken, TokenHandler } from "./types";

const API_BASE = "https://api.dexscreener.com";
const POLL_INTERVAL_MS = 20_000;

type TokenProfile = {
  url?: string;
  chainId?: string;
  tokenAddress?: string;
  icon?: string;
  links?: Array<{ type?: string | null; label?: string | null; url?: string }>;
};

type DexPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  pairCreatedAt?: number;
  baseToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  volume?: { m5?: number; h1?: number; h24?: number };
  txns?: { m5?: { buys?: number; sells?: number } };
  info?: {
    websites?: Array<{ url?: string }>;
    socials?: Array<{ type?: string; url?: string }>;
  };
};

function asProfiles(payload: unknown): TokenProfile[] {
  if (Array.isArray(payload)) return payload as TokenProfile[];
  if (payload && typeof payload === "object") return [payload as TokenProfile];
  return [];
}

function asPairs(payload: unknown): DexPair[] {
  if (!payload || typeof payload !== "object") return [];
  const pairs = (payload as { pairs?: unknown }).pairs;
  return Array.isArray(pairs) ? (pairs as DexPair[]) : [];
}

function normalizeChain(chainId: string | undefined): string {
  const map: Record<string, string> = {
    solana: "SOLANA",
    ethereum: "ETHEREUM",
    bsc: "BNB CHAIN",
    base: "BASE",
    arbitrum: "ARBITRUM",
    polygon: "POLYGON",
    avalanche: "AVALANCHE",
  };
  return map[chainId ?? ""] ?? (chainId ? chainId.toUpperCase() : "UNKNOWN");
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

function linkFor(
  links: TokenProfile["links"],
  type: string,
): string | null {
  const match = links?.find(
    (link) => link.type?.toLowerCase() === type || link.label?.toLowerCase() === type,
  );
  return validUrl(match?.url);
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 429) {
    const error = new Error("DEX Screener rate limit reached");
    error.name = "RateLimitError";
    throw error;
  }
  if (!response.ok) {
    throw new Error(`DEX Screener responded with ${response.status}`);
  }
  return response.json();
}

function pairForProfile(profile: TokenProfile, pairs: DexPair[]): DexPair | null {
  const matchingChain = pairs.find((pair) => pair.chainId === profile.chainId);
  return matchingChain ?? pairs[0] ?? null;
}

function normalize(
  profile: TokenProfile,
  pair: DexPair | null,
): NormalizedToken | null {
  if (!profile.tokenAddress || !profile.chainId) return null;
  const websites = pair?.info?.websites ?? [];
  const socials = pair?.info?.socials ?? [];
  const website =
    validUrl(websites[0]?.url) ?? linkFor(profile.links, "website");
  const twitter =
    validUrl(socials.find((social) => social.type?.toLowerCase() === "twitter")?.url) ??
    linkFor(profile.links, "twitter") ??
    linkFor(profile.links, "x");
  const telegram =
    validUrl(socials.find((social) => social.type?.toLowerCase() === "telegram")?.url) ??
    linkFor(profile.links, "telegram");
  const discord =
    validUrl(socials.find((social) => social.type?.toLowerCase() === "discord")?.url) ??
    linkFor(profile.links, "discord");
  const parsedPrice = pair?.priceUsd ? Number(pair.priceUsd) : null;

  return {
    chain: normalizeChain(profile.chainId),
    address: profile.tokenAddress,
    name: pair?.baseToken?.name ?? null,
    symbol: pair?.baseToken?.symbol ?? null,
    source: "dexscreener",
    createdAt: pair?.pairCreatedAt ? new Date(pair.pairCreatedAt) : null,
    detectedAt: new Date(),
    priceUsd: Number.isFinite(parsedPrice) ? parsedPrice : null,
    marketCapUsd: pair?.marketCap ?? null,
    fdvUsd: pair?.fdv ?? null,
    liquidityUsd: pair?.liquidity?.usd ?? null,
    volume5mUsd: pair?.volume?.m5 ?? null,
    volume1hUsd: pair?.volume?.h1 ?? null,
    volume24hUsd: pair?.volume?.h24 ?? null,
    buys5m: pair?.txns?.m5?.buys ?? null,
    sells5m: pair?.txns?.m5?.sells ?? null,
    pairAddress: pair?.pairAddress ?? null,
    dex: pair?.dexId ?? null,
    website,
    twitter,
    telegram,
    discord,
    logoUrl: validUrl(profile.icon),
    chartUrl: validUrl(pair?.url) ?? validUrl(profile.url),
  };
}

async function pollOnce(onToken: TokenHandler): Promise<void> {
  const profiles = asProfiles(
    await getJson(`${API_BASE}/token-profiles/latest/v1`),
  );
  for (const profile of profiles.slice(0, 25)) {
    if (!profile.tokenAddress || !profile.chainId) continue;
    const payload = await getJson(
      `${API_BASE}/latest/dex/tokens/${encodeURIComponent(profile.tokenAddress)}`,
    );
    const token = normalize(profile, pairForProfile(profile, asPairs(payload)));
    if (!token) continue;
    await onToken(token);
    noteProviderEvent("dexscreener", token.chain);
  }
}

export function startDexScreener(onToken: TokenHandler): void {
  let running = false;
  updateProvider("dexscreener", { status: "starting", error: null });

  const run = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      await pollOnce(onToken);
      updateProvider("dexscreener", { status: "connected", error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider error";
      updateProvider("dexscreener", {
        status: error instanceof Error && error.name === "RateLimitError" ? "rate_limited" : "error",
        error: message,
      });
      logger.warn({ err: error }, "DEX Screener poll failed");
    } finally {
      running = false;
    }
  };

  void run();
  setInterval(() => void run(), POLL_INTERVAL_MS);
}