import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import {
  db,
  settingsTable,
  telegramPostsTable,
  tokenEventsTable,
  tokenPairsTable,
  tokenSocialsTable,
  tokenSourcesTable,
  tokensTable,
  type Token,
} from "@workspace/db";
import { logger } from "../lib/logger";
import { getProviderSnapshots } from "../providers/manager";
import type { NormalizedToken } from "../providers/types";
import {
  isValidTelegramLink,
  requireTelegramLink,
  sendTelegramAlert,
} from "./telegram";

export async function ensureSettings(): Promise<void> {
  const [settings] = await db
    .select({ id: settingsTable.id })
    .from(settingsTable)
    .where(eq(settingsTable.id, 1))
    .limit(1);
  if (!settings) {
    await db.insert(settingsTable).values({ id: 1 });
  }
}

function nullableNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function tokenValues(token: NormalizedToken) {
  return {
    chain: token.chain,
    address: token.address,
    name: token.name ?? null,
    symbol: token.symbol ?? null,
    source: token.source,
    createdAt: token.createdAt ?? null,
    detectedAt: token.detectedAt,
    updatedAt: token.detectedAt,
    priceUsd: nullableNumber(token.priceUsd),
    marketCapUsd: nullableNumber(token.marketCapUsd),
    fdvUsd: nullableNumber(token.fdvUsd),
    liquidityUsd: nullableNumber(token.liquidityUsd),
    volume5mUsd: nullableNumber(token.volume5mUsd),
    volume1hUsd: nullableNumber(token.volume1hUsd),
    volume24hUsd: nullableNumber(token.volume24hUsd),
    buys5m: token.buys5m ?? null,
    sells5m: token.sells5m ?? null,
    pairAddress: token.pairAddress ?? null,
    dex: token.dex ?? null,
    website: token.website ?? null,
    twitter: token.twitter ?? null,
    telegram: token.telegram ?? null,
    discord: token.discord ?? null,
    logoUrl: token.logoUrl ?? null,
    chartUrl: token.chartUrl ?? null,
  };
}

function socialEntries(token: NormalizedToken): Array<{ kind: string; url: string }> {
  return [
    ["website", token.website],
    ["twitter", token.twitter],
    ["telegram", token.telegram],
    ["discord", token.discord],
  ].flatMap(([kind, url]) => (url ? [{ kind, url }] : [])) as Array<{
    kind: string;
    url: string;
  }>;
}

async function filterAllows(token: NormalizedToken): Promise<boolean> {
  const [settings] = await db.select().from(settingsTable).where(eq(settingsTable.id, 1));
  if (!settings?.filterMode) return true;
  if (settings.selectedChains.length && !settings.selectedChains.includes(token.chain)) {
    return false;
  }
  if (
    settings.selectedProviders.length &&
    !settings.selectedProviders.includes(token.source)
  ) {
    return false;
  }
  if (
    settings.minLiquidityUsd !== null &&
    (token.liquidityUsd ?? 0) < settings.minLiquidityUsd
  ) {
    return false;
  }
  if (
    settings.maxMarketCapUsd !== null &&
    token.marketCapUsd !== null &&
    (token.marketCapUsd ?? Number.POSITIVE_INFINITY) > settings.maxMarketCapUsd
  ) {
    return false;
  }
  if (
    settings.minVolumeUsd !== null &&
    (token.volume24hUsd ?? 0) < settings.minVolumeUsd
  ) {
    return false;
  }
  if (settings.minTransactions !== null) {
    const transactions = (token.buys5m ?? 0) + (token.sells5m ?? 0);
    if (transactions < settings.minTransactions) return false;
  }
  if (settings.maxTokenAgeMinutes !== null && token.createdAt) {
    const ageMinutes = (Date.now() - token.createdAt.getTime()) / 60_000;
    if (ageMinutes > settings.maxTokenAgeMinutes) return false;
  }
  return true;
}

async function saveSocials(tokenId: number, token: NormalizedToken): Promise<void> {
  for (const social of socialEntries(token)) {
    await db
      .insert(tokenSocialsTable)
      .values({ tokenId, kind: social.kind, url: social.url })
      .onConflictDoNothing({
        target: [
          tokenSocialsTable.tokenId,
          tokenSocialsTable.kind,
          tokenSocialsTable.url,
        ],
      });
  }
}

async function savePair(tokenId: number, token: NormalizedToken): Promise<void> {
  if (!token.pairAddress) return;
  await db
    .insert(tokenPairsTable)
    .values({
      tokenId,
      pairAddress: token.pairAddress,
      dex: token.dex ?? null,
      url: token.chartUrl ?? null,
      createdAt: token.createdAt ?? null,
      updatedAt: token.detectedAt,
    })
    .onConflictDoUpdate({
      target: [tokenPairsTable.tokenId, tokenPairsTable.pairAddress],
      set: {
        dex: token.dex ?? null,
        url: token.chartUrl ?? null,
        updatedAt: token.detectedAt,
      },
    });
}

export async function ingestToken(token: NormalizedToken): Promise<void> {
  await ensureSettings();
  const [existing] = await db
    .select()
    .from(tokensTable)
    .where(and(eq(tokensTable.chain, token.chain), eq(tokensTable.address, token.address)))
    .limit(1);

  let stored: Token;
  let isNew = false;
  let isNewSource = false;

  if (!existing) {
    const [created] = await db.insert(tokensTable).values(tokenValues(token)).returning();
    if (!created) throw new Error("Token insert returned no row");
    stored = created;
    isNew = true;
    isNewSource = true;
    await db.insert(tokenEventsTable).values({
      tokenId: created.id,
      type: "discovered",
      source: token.source,
      message: `Discovered on ${token.source}`,
      occurredAt: token.detectedAt,
    });
  } else {
    const [source] = await db
      .select({ id: tokenSourcesTable.id })
      .from(tokenSourcesTable)
      .where(
        and(
          eq(tokenSourcesTable.tokenId, existing.id),
          eq(tokenSourcesTable.provider, token.source),
        ),
      )
      .limit(1);
    isNewSource = !source;
    const [updated] = await db
      .update(tokensTable)
      .set({
        ...tokenValues(token),
        telegram: token.telegram ?? existing.telegram,
        detectedAt: existing.detectedAt,
        updatedAt: token.detectedAt,
      })
      .where(eq(tokensTable.id, existing.id))
      .returning();
    if (!updated) throw new Error("Token update returned no row");
    stored = updated;
    if (isNewSource) {
      await db.insert(tokenEventsTable).values({
        tokenId: stored.id,
        type: "duplicate",
        source: token.source,
        message: `Duplicate identity also detected by ${token.source}`,
        occurredAt: token.detectedAt,
      });
    }
  }

  await db
    .insert(tokenSourcesTable)
    .values({
      tokenId: stored.id,
      provider: token.source,
      firstSeenAt: token.detectedAt,
      lastSeenAt: token.detectedAt,
    })
    .onConflictDoUpdate({
      target: [tokenSourcesTable.tokenId, tokenSourcesTable.provider],
      set: { lastSeenAt: token.detectedAt },
    });
  await savePair(stored.id, token);
  await saveSocials(stored.id, token);

  const [settings] = await db.select().from(settingsTable).where(eq(settingsTable.id, 1));
  const [postedAlready] = await db
    .select({ id: telegramPostsTable.id })
    .from(telegramPostsTable)
    .where(
      and(
        eq(telegramPostsTable.tokenId, stored.id),
        eq(telegramPostsTable.status, "posted"),
      ),
    )
    .limit(1);
  if ((!isNew && !isNewSource) || postedAlready) return;
  if (settings?.paused || !(await filterAllows(token))) return;

  const deliveryToken: NormalizedToken = {
    ...token,
    telegram: token.telegram ?? stored.telegram,
  };
  if (requireTelegramLink() && !isValidTelegramLink(deliveryToken.telegram)) {
    const skipStatus = deliveryToken.telegram
      ? "skipped_invalid_telegram"
      : "skipped_no_telegram";
    const skipMessage = deliveryToken.telegram
      ? "SKIPPED — INVALID TELEGRAM LINK"
      : "SKIPPED — NO VALID TELEGRAM LINK";
    await db.insert(telegramPostsTable).values({
      tokenId: stored.id,
      status: skipStatus,
      error: skipMessage,
    });
    await db.insert(tokenEventsTable).values({
      tokenId: stored.id,
      type: skipStatus,
      source: "telegram",
      message: skipMessage,
    });
    return;
  }

  try {
    const result = await sendTelegramAlert(deliveryToken);
    await db
      .update(tokensTable)
      .set({ posted: true, updatedAt: new Date() })
      .where(eq(tokensTable.id, stored.id));
    await db.insert(telegramPostsTable).values({
      tokenId: stored.id,
      messageId: result.messageId,
      status: "posted",
      postedAt: new Date(),
    });
    await db.insert(tokenEventsTable).values({
      tokenId: stored.id,
      type: "posted",
      source: token.source,
      message: "Telegram alert posted",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telegram post failed";
    logger.warn({ err: error, tokenId: stored.id }, "Telegram alert failed");
    await db.insert(telegramPostsTable).values({
      tokenId: stored.id,
      status: "failed",
      error: message,
    });
    await db.insert(tokenEventsTable).values({
      tokenId: stored.id,
      type: "provider_error",
      source: "telegram",
      message,
    });
  }
}

export async function listTokens(params: {
  limit: number;
  chain?: string;
  provider?: string;
  search?: string;
  posted?: boolean;
}) {
  const filters = [];
  if (params.chain) filters.push(eq(tokensTable.chain, params.chain));
  if (params.posted !== undefined) filters.push(eq(tokensTable.posted, params.posted));
  if (params.search) {
    filters.push(
      or(
        ilike(tokensTable.name, `%${params.search}%`),
        ilike(tokensTable.symbol, `%${params.search}%`),
        ilike(tokensTable.address, `%${params.search}%`),
      ),
    );
  }
  if (params.provider) {
    const providerTokens = await db
      .select({ tokenId: tokenSourcesTable.tokenId })
      .from(tokenSourcesTable)
      .where(eq(tokenSourcesTable.provider, params.provider));
    filters.push(
      providerTokens.length
        ? inArray(
            tokensTable.id,
            providerTokens.map((row) => row.tokenId),
          )
        : eq(tokensTable.id, -1),
    );
  }
  const rows = await db
    .select()
    .from(tokensTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(tokensTable.detectedAt))
    .limit(params.limit);
  if (!rows.length) return [];
  const sources = await db
    .select()
    .from(tokenSourcesTable)
    .where(inArray(tokenSourcesTable.tokenId, rows.map((row) => row.id)));
  const sourceMap = new Map<number, string[]>();
  for (const source of sources) {
    sourceMap.set(source.tokenId, [
      ...(sourceMap.get(source.tokenId) ?? []),
      source.provider,
    ]);
  }
  return rows.map((row) => ({
    ...row,
    sources: sourceMap.get(row.id) ?? [row.source],
    telegramValid: isValidTelegramLink(row.telegram),
    posted:
      row.posted &&
      (!requireTelegramLink() || isValidTelegramLink(row.telegram)),
  }));
}

export async function listEvents(limit: number) {
  return db
    .select()
    .from(tokenEventsTable)
    .orderBy(desc(tokenEventsTable.occurredAt))
    .limit(limit);
}

export async function getSummary() {
  const [tokens, duplicates, noTelegram, invalidTelegram, events] =
    await Promise.all([
    db
      .select({
        id: tokensTable.id,
        telegram: tokensTable.telegram,
        posted: tokensTable.posted,
      })
      .from(tokensTable),
    db
      .select({ tokenId: tokenEventsTable.tokenId })
      .from(tokenEventsTable)
      .where(eq(tokenEventsTable.type, "duplicate")),
    db
      .select({ tokenId: telegramPostsTable.tokenId })
      .from(telegramPostsTable)
      .where(eq(telegramPostsTable.status, "skipped_no_telegram")),
    db
      .select({ tokenId: telegramPostsTable.tokenId })
      .from(telegramPostsTable)
      .where(eq(telegramPostsTable.status, "skipped_invalid_telegram")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(tokenEventsTable)
      .where(gte(tokenEventsTable.occurredAt, new Date(Date.now() - 86_400_000))),
    ]);
  const snapshots = getProviderSnapshots();
  const [latest] = await db
    .select({ occurredAt: tokenEventsTable.occurredAt })
    .from(tokenEventsTable)
    .orderBy(desc(tokenEventsTable.occurredAt))
    .limit(1);
  const topChains = await db
    .select({ chain: tokensTable.chain, count: sql<number>`count(*)` })
    .from(tokensTable)
    .groupBy(tokensTable.chain)
    .orderBy(desc(sql`count(*)`))
    .limit(6);
  return {
    tokensDiscovered: tokens.length,
    tokensWithValidTelegram: tokens.filter((token) => isValidTelegramLink(token.telegram)).length,
    alertsPosted: tokens.filter(
      (token) =>
        token.posted &&
        (!requireTelegramLink() || isValidTelegramLink(token.telegram)),
    ).length,
    skippedNoTelegram: new Set(noTelegram.map((row) => row.tokenId)).size,
    skippedInvalidTelegram: new Set(invalidTelegram.map((row) => row.tokenId)).size,
    duplicatesIgnored: new Set(duplicates.map((row) => row.tokenId)).size,
    activeProviders: snapshots.filter((provider) => provider.status === "connected").length,
    totalProviders: snapshots.length,
    eventsLast24h: Number(events[0]?.count ?? 0),
    lastEventAt: latest?.occurredAt ?? null,
    topChains: topChains.map((row) => ({ chain: row.chain, count: Number(row.count) })),
  };
}

export async function getSettings() {
  await ensureSettings();
  const [settings] = await db.select().from(settingsTable).where(eq(settingsTable.id, 1));
  if (!settings) throw new Error("Settings row unavailable");
  return {
    ...settings,
    requireTelegram: requireTelegramLink(),
    telegramConfigured: Boolean(
      process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNEL_ID,
    ),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
  };
}

export async function updateSettings(values: {
  paused?: boolean;
  filterMode?: boolean;
  minLiquidityUsd?: number | null;
  maxMarketCapUsd?: number | null;
  minVolumeUsd?: number | null;
  maxTokenAgeMinutes?: number | null;
  minTransactions?: number | null;
  selectedChains?: string[];
  selectedProviders?: string[];
}) {
  await ensureSettings();
  const [updated] = await db
    .update(settingsTable)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(settingsTable.id, 1))
    .returning();
  if (!updated) throw new Error("Settings update returned no row");
  return {
    ...updated,
    requireTelegram: requireTelegramLink(),
    telegramConfigured: Boolean(
      process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNEL_ID,
    ),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
  };
}