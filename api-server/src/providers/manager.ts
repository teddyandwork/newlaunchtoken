import type { ProviderSnapshot } from "./types";

const snapshots = new Map<string, ProviderSnapshot>([
  [
    "dexscreener",
    {
      id: "dexscreener",
      displayName: "DEX Screener",
      status: "starting",
      mode: "polling",
      chains: [],
      description:
        "Official token profile polling with pair enrichment. Coverage follows the data DEX Screener exposes.",
      lastEventAt: null,
      error: null,
      eventsSeen: 0,
    },
  ],
  [
    "pumpfun",
    {
      id: "pumpfun",
      displayName: "Pump.fun",
      status: "disabled",
      mode: "disabled",
      chains: ["SOLANA"],
      description:
        "Disabled until a current official Pump.fun discovery feed is verified. No undocumented endpoint is used.",
      lastEventAt: null,
      error: "No verified official discovery API configured",
      eventsSeen: 0,
    },
  ],
  [
    "solana",
    {
      id: "solana",
      displayName: "Solana direct",
      status: "disabled",
      mode: "disabled",
      chains: ["SOLANA"],
      description:
        "Disabled until a supported RPC or indexer feed is configured for reliable new-token discovery.",
      lastEventAt: null,
      error: "No direct Solana discovery feed configured",
      eventsSeen: 0,
    },
  ],
]);

export function getProviderSnapshots(): ProviderSnapshot[] {
  return Array.from(snapshots.values()).map((snapshot) => ({
    ...snapshot,
    chains: [...snapshot.chains],
  }));
}

export function updateProvider(
  id: string,
  patch: Partial<Omit<ProviderSnapshot, "id">>,
): void {
  const current = snapshots.get(id);
  if (!current) return;
  snapshots.set(id, { ...current, ...patch });
}

export function noteProviderEvent(id: string, chain: string): void {
  const current = snapshots.get(id);
  if (!current) return;
  const chains = current.chains.includes(chain)
    ? current.chains
    : [...current.chains, chain];
  snapshots.set(id, {
    ...current,
    chains,
    status: "connected",
    lastEventAt: new Date(),
    error: null,
    eventsSeen: current.eventsSeen + 1,
  });
}