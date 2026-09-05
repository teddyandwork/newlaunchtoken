export type ProviderHealth =
  | "connected"
  | "disconnected"
  | "rate_limited"
  | "error"
  | "disabled"
  | "starting";

export type ProviderMode = "websocket" | "polling" | "webhook" | "disabled";

export type NormalizedToken = {
  chain: string;
  address: string;
  name?: string | null;
  symbol?: string | null;
  source: string;
  createdAt?: Date | null;
  detectedAt: Date;
  priceUsd?: number | null;
  marketCapUsd?: number | null;
  fdvUsd?: number | null;
  liquidityUsd?: number | null;
  volume5mUsd?: number | null;
  volume1hUsd?: number | null;
  volume24hUsd?: number | null;
  buys5m?: number | null;
  sells5m?: number | null;
  pairAddress?: string | null;
  dex?: string | null;
  website?: string | null;
  twitter?: string | null;
  telegram?: string | null;
  discord?: string | null;
  logoUrl?: string | null;
  chartUrl?: string | null;
};

export type ProviderSnapshot = {
  id: string;
  displayName: string;
  status: ProviderHealth;
  mode: ProviderMode;
  chains: string[];
  description: string;
  lastEventAt: Date | null;
  error: string | null;
  eventsSeen: number;
};

export type TokenHandler = (token: NormalizedToken) => Promise<void>;