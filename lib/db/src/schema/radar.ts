import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const instant = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const tokensTable = pgTable(
  "tokens",
  {
    id: serial("id").primaryKey(),
    chain: text("chain").notNull(),
    address: text("address").notNull(),
    name: text("name"),
    symbol: text("symbol"),
    source: text("source").notNull(),
    createdAt: instant("created_at"),
    detectedAt: instant("detected_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
    priceUsd: doublePrecision("price_usd"),
    marketCapUsd: doublePrecision("market_cap_usd"),
    fdvUsd: doublePrecision("fdv_usd"),
    liquidityUsd: doublePrecision("liquidity_usd"),
    volume5mUsd: doublePrecision("volume_5m_usd"),
    volume1hUsd: doublePrecision("volume_1h_usd"),
    volume24hUsd: doublePrecision("volume_24h_usd"),
    buys5m: integer("buys_5m"),
    sells5m: integer("sells_5m"),
    pairAddress: text("pair_address"),
    dex: text("dex"),
    website: text("website"),
    twitter: text("twitter"),
    telegram: text("telegram"),
    discord: text("discord"),
    logoUrl: text("logo_url"),
    chartUrl: text("chart_url"),
    posted: boolean("posted").notNull().default(false),
  },
  (table) => ({
    identity: uniqueIndex("tokens_chain_address_idx").on(
      table.chain,
      table.address,
    ),
    detectedAtIdx: index("tokens_detected_at_idx").on(table.detectedAt),
    sourceIdx: index("tokens_source_idx").on(table.source),
  }),
);

export const tokenSourcesTable = pgTable(
  "token_sources",
  {
    id: serial("id").primaryKey(),
    tokenId: integer("token_id")
      .notNull()
      .references(() => tokensTable.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    firstSeenAt: instant("first_seen_at").notNull().defaultNow(),
    lastSeenAt: instant("last_seen_at").notNull().defaultNow(),
  },
  (table) => ({
    identity: uniqueIndex("token_sources_token_provider_idx").on(
      table.tokenId,
      table.provider,
    ),
  }),
);

export const tokenPairsTable = pgTable(
  "token_pairs",
  {
    id: serial("id").primaryKey(),
    tokenId: integer("token_id")
      .notNull()
      .references(() => tokensTable.id, { onDelete: "cascade" }),
    pairAddress: text("pair_address").notNull(),
    dex: text("dex"),
    url: text("url"),
    createdAt: instant("created_at"),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    pairIdx: uniqueIndex("token_pairs_token_pair_idx").on(
      table.tokenId,
      table.pairAddress,
    ),
  }),
);

export const tokenSocialsTable = pgTable(
  "token_socials",
  {
    id: serial("id").primaryKey(),
    tokenId: integer("token_id")
      .notNull()
      .references(() => tokensTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    url: text("url").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (table) => ({
    socialIdx: uniqueIndex("token_socials_token_kind_url_idx").on(
      table.tokenId,
      table.kind,
      table.url,
    ),
  }),
);

export const tokenEventsTable = pgTable(
  "token_events",
  {
    id: serial("id").primaryKey(),
    tokenId: integer("token_id").references(() => tokensTable.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    source: text("source").notNull(),
    occurredAt: instant("occurred_at").notNull().defaultNow(),
    message: text("message").notNull(),
  },
  (table) => ({
    occurredAtIdx: index("token_events_occurred_at_idx").on(table.occurredAt),
  }),
);

export const telegramPostsTable = pgTable(
  "telegram_posts",
  {
    id: serial("id").primaryKey(),
    tokenId: integer("token_id")
      .notNull()
      .references(() => tokensTable.id, { onDelete: "cascade" }),
    messageId: text("message_id"),
    status: text("status").notNull(),
    error: text("error"),
    postedAt: instant("posted_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (table) => ({
    tokenStatusIdx: index("telegram_posts_token_status_idx").on(
      table.tokenId,
      table.status,
    ),
  }),
);

export const settingsTable = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  paused: boolean("paused").notNull().default(false),
  filterMode: boolean("filter_mode").notNull().default(false),
  minLiquidityUsd: doublePrecision("min_liquidity_usd"),
  maxMarketCapUsd: doublePrecision("max_market_cap_usd"),
  minVolumeUsd: doublePrecision("min_volume_usd"),
  maxTokenAgeMinutes: integer("max_token_age_minutes"),
  minTransactions: integer("min_transactions"),
  selectedChains: text("selected_chains").array().notNull().default([]),
  selectedProviders: text("selected_providers").array().notNull().default([]),
  updatedAt: instant("updated_at").notNull().defaultNow(),
});

export type Token = typeof tokensTable.$inferSelect;
export type TokenEvent = typeof tokenEventsTable.$inferSelect;
export type RadarSettings = typeof settingsTable.$inferSelect;