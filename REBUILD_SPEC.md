# REBUILD_SPEC.md – Multi-Store Shopify + Meta Analytics Dashboard

## 1. Purpose & Goals

Rebuild the dashboard from scratch so it is simple, reliable, and multi-store ready for an agency owner.

The rebuilt system MUST:

- Support unlimited Shopify stores per agency user, with future ability to invite store-specific users.
- Capture **every practical field** from Shopify and Meta that affects revenue, fulfillment, attribution, or marketing performance.
- Run a guaranteed historical backfill the moment a platform is connected, then keep data fresh automatically (≤ 15 min stale).
- Provide crystal-clear sync status and error visibility per shop + platform.
- Use a single database (Supabase Postgres), a single worker (Railway), a small API/Edge layer, and a Next.js frontend—no extra services.
- Be wipe-and-rebuild friendly: schemas/data can be reset without redeploying Supabase/Vercel/Railway projects.

## 2. Architecture Overview

```
Shopify Admin API (GraphQL 2026-01)  ┐
Meta Marketing API (latest ads_insights) ┤--> apps/worker (Railway) --> staging_ingest schema
                                       ┘                                   │
                                                                         SQL transforms
                                                                         │
                                             reporting schema (views) <--┘--> apps/web (Vercel)
                                                                 |
                                                                 └--> API / Edge Functions (Supabase) for shops, credentials, jobs, metrics
```

- **Database:** Supabase Postgres with schemas `staging_ingest`, `core_warehouse`, `reporting`, `app_dashboard`.
- **Worker:** Long-running Node service on Railway; polls `sync_jobs`, fetches API data, writes raw + typed tables, updates cursors.
- **API:** Supabase Edge Function(s) or lightweight API server; handles auth, CRUD for shops/credentials, enqueues jobs, exposes metrics.
- **Frontend:** Next.js App Router on Vercel; consumes only API + Supabase views (never external APIs directly).

Everything is keyed by **`shop_id`**.

## 3. Domain Model

### 3.1 Users & Shops

| Table | Columns (key fields) | Notes |
|-------|----------------------|-------|
| `users` | `id (uuid, Supabase auth)`, `email`, `name`, `role` (`AGENCY_OWNER`, `AGENCY_STAFF`, `STORE_USER`), timestamps | Start with agency owner only. |
| `shops` | `id` (canonical `shop_id`, e.g. normalized Shopify domain), `name`, `shopify_domain`, `currency`, `timezone`, `created_at`, `updated_at` | Multi-store from day one. |
| `user_shops` | `user_id`, `shop_id`, `is_default`, timestamps | Who can see which shop; set `is_default` when a user has many shops. Enforce unique `(user_id, shop_id)`. |

### 3.2 Credentials

| Table | Key Fields | Notes |
|-------|------------|-------|
| `shop_credentials` | `id`, `shop_id`, `platform` (`SHOPIFY`, `META`), `access_token`, `refresh_token` (nullable), `expires_at` (nullable), `metadata` JSONB (e.g. Meta ad account IDs), timestamps | Unique `(shop_id, platform)`. Tokens inserted via seed script, then worker reads only from DB. |

### 3.3 Sync Orchestration

| Table | Fields | Notes |
|-------|--------|-------|
| `sync_jobs` | `id (uuid)`, `shop_id`, `platform` (`SHOPIFY`, `META`), `job_type` (`HISTORICAL_INIT`, `HISTORICAL_REBUILD`, `INCREMENTAL`), `status` (`QUEUED`, `IN_PROGRESS`, `SUCCEEDED`, `FAILED`), `records_synced`, `error` JSONB, `created_at`, `started_at`, `completed_at` | Partial unique index to ensure one in-flight job per `(shop_id, platform)`. |
| `sync_cursors` | `id`, `shop_id`, `platform`, `watermark` (JSONB / timestamp), `last_success_at`, timestamps | Watermark semantics are platform-specific (Shopify `updated_at`, Meta date). |

Job lifecycle:

1. API enqueues `sync_jobs` row with `status='QUEUED'`.
2. Worker claims job via optimistic locking (`UPDATE ... WHERE status='QUEUED'`).
3. Worker loads credentials, runs platform sync.
4. On success: set `status='SUCCEEDED'`, record `records_synced`, update `sync_cursors`.
5. On failure: set `status='FAILED'`, populate `error` payload (`code`, `message`, `task`, optional stack), NEVER advance cursor.

## 4. Data Schemas

### 4.1 Staging (`staging_ingest`)

- `shopify_orders_raw`: `id`, `shop_id`, `shopify_gid`, `payload` JSONB, `received_at`. Stores full JSONL rows from Shopify Bulk Operations (GraphQL Admin API **2026-01**). Add more raw tables if needed, but orders payload already includes line items & transactions.
- `meta_insights_raw`: `id`, `shop_id`, `date_start`, `date_stop`, `level`, `payload` JSONB, `received_at`. Stores full ads_insights responses (latest Marketing API version).

### 4.2 Warehouse (`core_warehouse`)

#### Shopify tables (all include `raw_*` JSON to guarantee zero data loss)

- `orders`: wide table covering EVERY relevant field from Admin API 2026-01 (IDs, names, customer info, financial + fulfillment status, amounts, discounts, taxes, shipping/billing addresses, source data, tags, metadata, timestamps).
- `order_line_items`: line-level quantity, pricing, variant/product IDs, SKU, vendor, tax/discount allocations, fulfillments.
- `transactions`: payment events (sale/refund/capture/void), gateway, status, amount, currency, processed timestamp, etc.

Primary keys: `bigserial id`, unique `(shop_id, shopify_gid)` for each table.

#### Meta tables

- `fact_marketing_daily`: aggregated per `(shop_id, date, platform='META')` with spend, impressions, clicks, reach, inline link clicks, CPC/CPM/CTR, conversions, purchases, purchase_value, leads, add_to_cart, view_content, `actions` JSON, `action_values` JSON, objective, buying_type, account info, currency.
- `fact_marketing_campaign_daily`: optional but recommended; same metrics plus IDs/names for campaign/adset/ad to power “top campaigns” views.

### 4.3 Reporting (`reporting`)

- `daily_revenue`: sums revenue/order_count/AOV per shop per day from `orders`.
- `marketing_daily`: exposes marketing spend + metrics per shop/date/platform.
- `mer_roas`: joins revenue + marketing to compute MER (total revenue / total spend) and ROAS (revenue / spend per platform).
- `sync_status`: exposes recent jobs + errors per shop/platform (join `sync_jobs`, `shops`, `sync_cursors`).

Views start as plain `VIEW`s; promote to materialized if perf requires.

## 5. Platform Requirements

### 5.1 Shopify (GraphQL Admin API 2026-01)

- Use **Bulk Operations** exclusively for historical + large incremental loads.
- Lock `SHOPIFY_API_VERSION=2026-01`.
- GraphQL bulk query must request every field relevant to orders/line items/transactions per latest docs [`shopify.dev/docs/api/admin-graphql/2026-01`](https://shopify.dev/docs/api/admin-graphql/2026-01).
- HISTORICAL_INIT:
  - Trigger automatically when Shopify credentials saved.
  - Run a full bulk export of orders (and nested data).
  - Insert into `shopify_orders_raw`, transform into warehouse tables via SQL `INSERT ... ON CONFLICT DO UPDATE`.
- INCREMENTAL:
  - Use `updated_at > watermark` filter.
  - Continue storing raw payloads + updating typed tables.

### 5.2 Meta (Marketing API ads_insights)

- Use the latest stable Marketing API version when coding (document the version string in env spec).
- Request all relevant metrics and breakdowns (account, campaign, adset, ad as needed).
- HISTORICAL_INIT:
  - Fetch entire historical daily range allowed for each ad account in `metadata`.
- INCREMENTAL:
  - Use `date > watermark` or last changed timestamp.
- Persist full payload in `meta_insights_raw` plus typed metrics in both fact tables.

## 6. API / Edge Layer

Endpoints (Edge function(s) or small API service):

| Endpoint | Purpose |
|----------|---------|
| `POST /api/shops` | Create shop record, store Shopify credentials, enqueue Shopify `HISTORICAL_INIT`, link shop to current user. |
| `POST /api/shops/:shop_id/platforms/META/connect` | Store Meta credentials (access token + ad account info), enqueue Meta `HISTORICAL_INIT`. |
| `POST /api/shops/:shop_id/sync` | Body `{ platforms: [...], job_type: 'INCREMENTAL' | 'HISTORICAL_REBUILD' }`; enqueues jobs respecting unique-in-flight constraint. |
| `GET /api/shops` | List shops accessible to current user via `user_shops`. |
| `GET /api/shops/:shop_id/sync-status` | Returns latest jobs/errors + `last_success_at`. |
| `GET /api/shops/:shop_id/metrics?from=YYYY-MM-DD&to=YYYY-MM-DD` | Returns KPIs, daily revenue, daily spend/ROAS, top campaigns, etc. Pulls from `reporting` views and fact tables. |

Auth/Access:

- Use Supabase auth JWT.
- Enforce RLS via `user_shops`: agency owner gets rows for every shop; future store logins only get their own shop rows.

## 7. Frontend (Next.js App Router)

### Global UX

- Shop selector (from `GET /api/shops`); default determined via `user_shops.is_default`.
- Date range selector (Today, Yesterday, Last 7/30 days, custom).
- Freshness indicator showing `last_success_at` across platforms + spinner when job running.

### Per-shop Dashboard

- KPIs: Revenue, Orders, AOV, Meta Spend, MER, ROAS.
- Charts: Revenue over time; Spend vs Revenue.
- Tables: Recent orders, top campaigns/adsets.
- Sync tab: show job history + errors per platform.

### Optional All-Shops View

- Compare shops (Revenue, Spend, MER, ROAS, stale status).

All data fetches are server components / server actions by default; no client-side data fetching for initial load.

## 8. Freshness & Scheduling

- Config `MAX_STALENESS_MINUTES` (default 15).
- Worker cron (e.g. every 5 minutes) checks each `(shop_id, platform)`:
  - If `now - last_success_at > MAX_STALENESS_MINUTES` and no job running → enqueue `INCREMENTAL`.
- Frontend never blocks on job completion; it shows stored metrics + the “Last updated” timestamp, optionally triggering extra incremental jobs asynchronously.

## 9. Non-Functional Requirements

- **Reliability:** worker catches all errors, writes structured `error` payload, never leaves job stuck in `IN_PROGRESS`.
- **Performance:** API read endpoints < 500 ms; dashboard initial load < 2s using cached DB data.
- **Security:** Service role key only in worker/API; frontend uses anon key. Secrets managed via env vars + `shop_credentials`. Shopify/Meta tokens never shipped to client.
- **Reset Capability:** Running `supabase db push` with the reset migration must drop/recreate schemas cleanly.

## 10. Deliverables Checklist

1. **Database:** reset migration + new schema migration(s) creating all tables/views listed above.
2. **Worker:** fresh implementation with Shopify 2026-01 bulk sync + Meta insights ingestion, raw + typed inserts, cursors, error handling, seed script for credentials.
3. **API:** endpoints for shops, credentials, jobs, metrics with Supabase auth + RLS-ready queries.
4. **Frontend:** Next.js routes for per-shop dashboard + sync view, pulling from new API/reporting views.
5. **Docs:** this `REBUILD_SPEC.md`, `ENV_SPEC.md`, `PROGRESS_REBUILD.md`, `CHANGELOG_REBUILD.md`.

This document is the SINGLE source of truth for the rebuild. Any new code, schema, or docs must align with the requirements above.***

