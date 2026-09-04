# Multi-Chain Token Radar

A real-time monitoring console that discovers provider-exposed tokens, deduplicates them by network and address, enriches trusted metadata, and sends concise Telegram alerts.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/token-radar run dev` — run the radar console
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/token-radar` — web console for the live radar, provider health, events, tokens, and settings
- `artifacts/api-server/src/providers` — provider adapters and provider health state
- `artifacts/api-server/src/services` — ingestion, deduplication, filters, and Telegram delivery
- `artifacts/api-server/src/routes` — API route handlers
- `lib/db/src/schema/radar.ts` — PostgreSQL tables for tokens, sources, pairs, socials, events, posts, and settings
- `lib/api-spec/openapi.yaml` — source of truth for the API contract

## Architecture decisions

- DEX Screener is the first live provider. Its documented token profile feed is polled conservatively and enriched through its documented token lookup endpoint.
- Token identity is `chain + address`; provider sightings are stored separately so duplicate alerts can be suppressed without losing source attribution.
- Telegram delivery is server-side only, uses secure environment secrets, retries transient failures, and omits missing social buttons or logos.
- `REQUIRE_TELEGRAM` defaults to `true`; a token must have a provider-supplied `t.me`, `telegram.me`, `telegram.dog`, or `www.t.me` link before it can enter Telegram delivery.
- Unsupported discovery feeds are represented as disabled provider modules with an explicit reason rather than simulated events or guessed endpoints.
- Filters are off by default so the radar accepts all provider-exposed signals until the operator enables eligibility rules.

## Product

The console shows provider health, live discovery totals, recent token events, token metadata, chain coverage, duplicate suppression, and Telegram delivery state. Settings support pause/resume and optional filters. Pump.fun and direct Solana discovery remain visibly disabled until a reliable current feed is configured.

## User preferences

- Do not invent provider endpoints or pretend an integration works when it does not.
- Keep Telegram messages short, source-labeled, scan-friendly, and limited to verified links and metadata.
- Telegram token alerts use the provider logo as the photo when available, a compact caption, and inline buttons for Telegram, X, website, and chart links.

## Gotchas

- Provider coverage is limited to what the connected source exposes; a connected DEX Screener status does not mean every chain or every new token is discoverable.
- The app needs both Telegram secrets and the bot must be an administrator of the target channel before delivery can succeed.
- The Telegram-link gate is enforced both before queueing and again inside the final delivery function. Missing links are recorded as skipped; invalid links are never fabricated or repaired.
- Schema changes belong in `lib/db/src/schema` and are applied with the database push script during development.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
