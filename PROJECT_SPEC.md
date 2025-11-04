# E-Commerce Dashboard - Project Specification

**Version:** 1.0.0
**Last Updated:** 2025-01-04
**Status:** Foundation Phase

---

## Purpose

Single source of truth for building an ELT data pipeline and analytics dashboard for e-commerce stores. This document defines schemas, data flow, transformation rules, API contracts, and technology stack.

**Core Principle:** This specification is authoritative. All implementation decisions must align with this document. When in doubt, refer here first.

---

## 1. Overall Data Flow (ELT Model)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────┐
│  External   │────▶│ apps/worker      │────▶│ staging_ingest  │────▶│              │
│  APIs       │     │ (Railway)        │     │ (Raw JSONB)     │     │ core_        │
│             │     │                  │     │                 │     │ warehouse    │
│ - Shopify   │     │ Extract & Load   │     │                 │     │ (Typed,      │
│ - Meta      │     │                  │     └─────────────────┘     │  Cleaned)    │
│ - GA4       │     │                  │                             │              │
│ - Klaviyo   │     │                  │     ┌─────────────────┐     │              │
└─────────────┘     │                  │────▶│ SQL Transforms  │────▶│              │
                    │                  │     │ (In-Database)   │     └──────┬───────┘
                    └──────────────────┘     └─────────────────┘            │
                                                                             │
                    ┌──────────────────┐     ┌─────────────────┐            │
                    │  apps/web        │◀────│ reporting       │◀───────────┘
                    │  (Vercel)        │     │ (Views)         │
                    │  Next.js         │     │                 │
                    └──────────────────┘     └─────────────────┘
```

### Flow Steps

1. **Extract & Load:** `apps/worker` (Railway) runs on schedule, pulls raw data via APIs, loads into `staging_ingest` schema
2. **Transform:** Worker executes SQL transforms in-database, cleans/types data, upserts into `core_warehouse`
3. **Present:** `reporting` schema exposes read-only views for frontend consumption via Supabase REST API

### Key Constraints

- **Shopify Bulk Operations:** Only ONE bulk operation of each type per shop at a time ([Shopify Docs](https://shopify.dev/docs/api/usage/bulk-operations))
- **Idempotency:** All transforms use `ON CONFLICT` clauses for safe retries
- **Cursor Management:** Incremental syncs track watermarks in `sync_cursors`; never advance on failure

---

## 2. Version Control & Git Workflow

### Repository Structure

```
monorepo/
├── apps/
│   ├── web/           # Next.js frontend (Vercel)
│   ├── worker/        # ETL worker (Railway)
│   └── edge/          # (Future: Edge functions if not in supabase/)
├── packages/
│   └── config/        # Shared TypeScript types/enums
├── supabase/
│   ├── migrations/    # Database schema migrations
│   ├── functions/     # Edge Functions (e.g., /sync)
│   └── config.toml    # Supabase configuration
├── PROJECT_SPEC.md    # This file
├── AGENT_GUIDELINES.md
├── TOOLS_AND_EXTENSIONS.md
├── ARCHITECTURE_DECISIONS.md
├── DEVELOPMENT_WORKFLOW.md
├── CHANGELOG.md
├── PROGRESS.md
└── .cursorrules
```

### Branching Strategy

- `main` → Production (Vercel, Railway auto-deploy)
- `develop` → Staging/preview
- `feature/*` → Feature branches (merge to develop via PR)

### Migration Policy

- Migrations are **NOT** auto-run on deploy
- Apply intentionally: `supabase link` then `supabase db push`
- Test in local environment first (`supabase start`)

---

## 3. Technology Stack

| Component | Tool/Platform | Purpose | Key CLI/Integrations |
|-----------|---------------|---------|---------------------|
| **Frontend** | Vercel + Next.js 14+ | Web UI | Vercel ↔ Supabase integration auto-syncs env vars |
| **Worker** | Railway | Background ETL jobs | Connects via `SUPABASE_DB_URL` with TLS, GitHub deploy integration |
| **Database** | Supabase (Postgres) | Data warehouse, auth, API | Supabase CLI for migrations, Edge Functions |
| **Edge Functions** | Supabase Edge | Lightweight APIs (e.g., /sync) | Deno runtime, auto-injected secrets |

### Development Tools

| Tool | Purpose | Installation Check |
|------|---------|-------------------|
| Vercel CLI | Deploy, env vars, logs | `vercel --version` |
| Supabase CLI | Migrations, functions, local stack | `supabase --version` |
| Railway CLI | Worker logs, cron schedules | `railway --version` |
| Git CLI | Version control | `git --version` |
| GitHub CLI (optional) | PR management | `gh --version` |
| Node.js | Runtime | `node --version` (v18+) |
| pnpm/yarn/npm | Package manager | `pnpm --version` |

### Key Integrations

1. **Vercel ↔ Supabase:** Keeps `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in sync
2. **Railway ↔ GitHub:** Auto-builds and deploys worker on Git push to main
3. **Supabase Edge Functions:** Auto-inject `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc. Only add custom secrets.

---

## 4. Schema Definitions

| Schema | Purpose | Access |
|--------|---------|--------|
| `staging_ingest` | Raw, temporary JSONB data. Drop/truncate acceptable. | Worker: R/W |
| `core_warehouse` | Clean, typed, relational source of truth. | Worker: R/W |
| `reporting` | Read-optimized views. Exposed via API for frontend. | Worker: R/W (refresh) · Frontend: Read-only |
| `app_dashboard` | App-specific tables (user prefs, saved reports). | Frontend: R/W |

### 4.1 staging_ingest Tables

All tables store raw API responses as JSONB. Minimal typing, no FKs.

- `shopify_shops_raw`
- `shopify_orders_raw`
- `shopify_line_items_raw`
- `shopify_transactions_raw`
- `shopify_payouts_raw`
- `meta_insights_raw`
- `ga4_report_raw`
- `klaviyo_metrics_raw`

### 4.2 core_warehouse Tables

#### Shopify Core Tables

| Table | Columns | Unique Key | Notes |
|-------|---------|------------|-------|
| `shops` | `shop_id` (PK), `shopify_domain`, `currency`, `timezone`, `metadata` (JSONB) | `shop_id` | Shop master data |
| `orders` | `id` (PK), `shop_id`, `shopify_gid`, `order_number`, `total_price`, `currency`, `created_at`, `updated_at`, etc. | `(shop_id, shopify_gid)` | ON CONFLICT DO UPDATE |
| `order_line_items` | `id` (PK), `shop_id`, `shopify_gid`, `order_id` (FK), `product_id`, `variant_id`, `quantity`, `price`, etc. | `(shop_id, shopify_gid)` | ON CONFLICT DO UPDATE |
| `transactions` | `id` (PK), `shop_id`, `shopify_gid`, `order_id` (FK), `amount`, `kind`, `status`, `processed_at`, etc. | `(shop_id, shopify_gid)` | ON CONFLICT DO UPDATE |
| `payouts` | `id` (PK), `shop_id`, `shopify_gid`, `amount`, `currency`, `status`, `date`, etc. | `(shop_id, shopify_gid)` | ON CONFLICT DO UPDATE |

#### Marketing Fact Tables

| Table | Columns | Unique Key | Notes |
|-------|---------|------------|-------|
| `fact_marketing_daily` | `id` (PK), `shop_id`, `date`, `platform`, `spend`, `impressions`, `clicks`, `conversions`, `revenue`, `currency` | `(shop_id, date, platform)` | ON CONFLICT DO UPDATE |
| `fact_ga4_daily` | `id` (PK), `shop_id`, `date`, `sessions`, `users`, `conversions`, `revenue` | `(shop_id, date)` | ON CONFLICT DO UPDATE |
| `fact_email_daily` | `id` (PK), `shop_id`, `date`, `sent`, `opened`, `clicked`, `revenue` | `(shop_id, date)` | ON CONFLICT DO UPDATE |

#### Orchestration Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| `etl_runs` | `id` (PK, uuid), `shop_id`, `status`, `job_type`, `platform`, `error` (JSONB), `records_synced`, `created_at`, `started_at`, `completed_at` | Job queue and history |
| `sync_cursors` | `id` (PK), `shop_id`, `platform`, `last_success_at`, `watermark` (JSONB) | Incremental sync watermarks |

**Important:** Add partial unique index on `etl_runs`:
```sql
CREATE UNIQUE INDEX idx_etl_runs_inflight ON etl_runs (shop_id, platform)
WHERE status IN ('QUEUED', 'IN_PROGRESS');
```

### 4.3 reporting Views

Start as `VIEW`, promote to `MATERIALIZED VIEW` if performance requires.

| View | Sources | Purpose |
|------|---------|---------|
| `sync_status` | `etl_runs`, `shops` | UI sync history and current status |
| `daily_revenue` | `orders`, `transactions` | Daily revenue, orders, AOV |
| `orders_daily` | `orders` | Daily order counts |
| `cash_to_bank` | `payouts`, `transactions` | Payout reconciliation |
| `mer_roas` | `fact_marketing_daily`, `daily_revenue` | MER/ROAS with currency normalization |

**Supabase API Exposure:** Ensure `reporting` schema is exposed in Supabase API settings for frontend REST access.

### 4.4 app_dashboard Schema

- `user_preferences` (user settings)
- `saved_reports` (saved queries/filters)
- Future: expand as needed

---

## 5. Pipeline Job Types

Worker polls `core_warehouse.etl_runs` for `status='QUEUED'` jobs. External triggers (Cron or `/sync` Edge Function) insert rows.

| Job Type | Trigger | Description |
|----------|---------|-------------|
| **HISTORICAL** | Manual (via `/sync` API) | Full backfill ignoring cursors. Pulls all available historical data. |
| **INCREMENTAL** | Scheduled (Railway cron) or Manual | Fetch data since last successful watermark in `sync_cursors`. |

### Success Behavior

- Update `etl_runs.status='SUCCEEDED'`, set `completed_at`, `records_synced`
- Advance `sync_cursors.watermark` to latest fetched timestamp

### Failure Behavior

- Update `etl_runs.status='FAILED'`, set `error` (ErrorPayload JSON), set `completed_at`
- **DO NOT** advance cursor
- Worker logs detailed error for investigation

---

## 6. Core Transforms (Shopify)

### API Details

- **API:** Shopify Admin GraphQL API with Bulk Operations ([Docs](https://shopify.dev/docs/api/admin-graphql))
- **Auth:** `SHOPIFY_ADMIN_ACCESS_TOKEN` (per shop)
- **API Version:** Locked to `SHOPIFY_API_VERSION=2025-01`
- **Constraint:** One bulk operation of each type per shop at a time

### Transform Mapping

| Source (Staging) | Target (Warehouse) | Idempotency Key |
|------------------|-------------------|----------------|
| `staging_ingest.shopify_shops_raw` | `core_warehouse.shops` | `(shop_id)` |
| `staging_ingest.shopify_orders_raw` | `core_warehouse.orders` | `(shop_id, shopify_gid)` |
| `staging_ingest.shopify_line_items_raw` | `core_warehouse.order_line_items` | `(shop_id, shopify_gid)` |
| `staging_ingest.shopify_transactions_raw` | `core_warehouse.transactions` | `(shop_id, shopify_gid)` |
| `staging_ingest.shopify_payouts_raw` | `core_warehouse.payouts` | `(shop_id, shopify_gid)` |

### Transform Process

1. Parse JSONB from staging
2. Extract and type fields (e.g., `raw_data->>'id'`, `CAST(raw_data->>'total_price' AS NUMERIC)`)
3. `INSERT ... ON CONFLICT (shop_id, shopify_gid) DO UPDATE SET ...`

---

## 7. Marketing Transforms

### Platform Requirements

| Platform | Auth Method | Required Secrets | Docs |
|----------|-------------|-----------------|------|
| **Meta** | Business System User Token | `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` | [Meta Marketing API](https://developers.facebook.com/docs/marketing-apis) |
| **GA4** | Service Account JSON | `GA4_PROPERTY_ID`, `GA4_CREDENTIALS_JSON` | [GA4 Data API](https://developers.google.com/analytics/devguides/reporting/data/v1) |
| **Klaviyo** | Private API Key | `KLAVIYO_API_KEY` | [Klaviyo API](https://developers.klaviyo.com/en/reference/api_overview) |

### Data Normalization

- Normalize all data to **canonical currency** per shop (stored in `core_warehouse.shops.currency`)
- Normalize to **shop timezone** for date calculations
- Use `(shop_id, date)` grain for all marketing tables to enable joins

### Transform Mapping

| Source (Staging) | Target (Warehouse) | Idempotency Key |
|------------------|-------------------|----------------|
| `staging_ingest.meta_insights_raw` | `core_warehouse.fact_marketing_daily` | `(shop_id, date, platform='META')` |
| `staging_ingest.ga4_report_raw` | `core_warehouse.fact_ga4_daily` | `(shop_id, date)` |
| `staging_ingest.klaviyo_metrics_raw` | `core_warehouse.fact_email_daily` | `(shop_id, date)` |

### MER/ROAS Calculation

```sql
-- reporting.mer_roas view
SELECT
  r.shop_id,
  r.date,
  r.revenue,
  m.total_spend,
  r.revenue / NULLIF(m.total_spend, 0) AS mer,
  r.revenue / NULLIF(m.spend_by_platform, 0) AS roas_by_platform
FROM reporting.daily_revenue r
LEFT JOIN core_warehouse.fact_marketing_daily m USING (shop_id, date);
```

---

## 8. Reporting Layer (Views)

Views provide read-optimized, aggregated data for the frontend.

### Implementation Strategy

1. Start with standard `VIEW`
2. If query performance degrades (>1s), promote to `MATERIALIZED VIEW`
3. Add refresh logic in worker after ETL completes: `REFRESH MATERIALIZED VIEW reporting.view_name;`

### View Definitions

#### reporting.sync_status

```sql
CREATE VIEW reporting.sync_status AS
SELECT
  e.id AS run_id,
  e.shop_id,
  s.shopify_domain,
  e.platform,
  e.job_type,
  e.status,
  e.records_synced,
  e.error,
  e.created_at,
  e.started_at,
  e.completed_at
FROM core_warehouse.etl_runs e
LEFT JOIN core_warehouse.shops s USING (shop_id)
ORDER BY e.created_at DESC;
```

#### reporting.daily_revenue

```sql
CREATE VIEW reporting.daily_revenue AS
SELECT
  shop_id,
  DATE(created_at) AS date,
  COUNT(*) AS order_count,
  SUM(total_price) AS revenue,
  AVG(total_price) AS aov
FROM core_warehouse.orders
GROUP BY shop_id, DATE(created_at);
```

#### reporting.orders_daily

```sql
CREATE VIEW reporting.orders_daily AS
SELECT
  shop_id,
  DATE(created_at) AS date,
  COUNT(*) AS order_count
FROM core_warehouse.orders
GROUP BY shop_id, DATE(created_at);
```

#### reporting.cash_to_bank

```sql
CREATE VIEW reporting.cash_to_bank AS
SELECT
  p.shop_id,
  p.date AS payout_date,
  p.amount AS payout_amount,
  p.status AS payout_status,
  SUM(t.amount) AS transaction_total
FROM core_warehouse.payouts p
LEFT JOIN core_warehouse.transactions t ON t.shop_id = p.shop_id
  AND DATE(t.processed_at) = p.date
GROUP BY p.shop_id, p.date, p.amount, p.status;
```

#### reporting.mer_roas

```sql
CREATE VIEW reporting.mer_roas AS
SELECT
  r.shop_id,
  r.date,
  r.revenue,
  m.spend AS total_spend,
  m.platform,
  r.revenue / NULLIF(m.spend, 0) AS mer,
  r.revenue / NULLIF(m.spend, 0) AS roas
FROM reporting.daily_revenue r
LEFT JOIN core_warehouse.fact_marketing_daily m USING (shop_id, date);
```

---

## 9. Environment Contract

### Supabase Variable Names (Authoritative)

Use ONLY these keys across all environments:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL` (direct Postgres connection, includes `?sslmode=require`)
- `SUPABASE_JWT_SECRET`

**Important:**
- Edge Functions receive these auto-injected. Only add custom secrets (e.g., `SHOPIFY_ADMIN_ACCESS_TOKEN`).
- Frontend uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Vercel ↔ Supabase integration).
- Worker connects via `SUPABASE_DB_URL` with TLS.

### Environment Variable Mapping

#### 1. Supabase Project

Source: Supabase Dashboard → Project Settings → API

```env
SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_ANON_KEY="<public-anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
SUPABASE_DB_URL="postgresql://postgres.<region>.supabase.co:5432/postgres?sslmode=require"
SUPABASE_JWT_SECRET="<project-jwt-secret>"
```

#### 2. Vercel (Frontend)

Source: Vercel Project Settings → Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL="${SUPABASE_URL}"
NEXT_PUBLIC_SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}"
```

#### 3. Railway (Worker)

Source: Railway Service → Variables

```env
# Supabase Connection
SUPABASE_URL="${SUPABASE_URL}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"
SUPABASE_DB_URL="${SUPABASE_DB_URL}"
SUPABASE_JWT_SECRET="${SUPABASE_JWT_SECRET}"

# Shopify
SHOPIFY_ADMIN_ACCESS_TOKEN="<admin-access-token>"
SHOPIFY_SHOP_DOMAIN="my-store.myshopify.com"
SHOPIFY_API_VERSION="2025-01"

# Meta
META_ACCESS_TOKEN="<business-system-user-token>"
META_AD_ACCOUNT_ID="act_1234567890"

# Google Analytics 4
GA4_PROPERTY_ID="<ga4-property-id>"
GA4_CREDENTIALS_JSON='<service-account-json>'

# Klaviyo
KLAVIYO_API_KEY="<private-api-key>"
```

#### 4. Local Development (.env.local)

```env
SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_ANON_KEY="<public-anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
SUPABASE_DB_URL="postgresql://postgres.<region>.supabase.co:5432/postgres?sslmode=require"
SUPABASE_JWT_SECRET="<project-jwt-secret>"

SHOPIFY_ADMIN_ACCESS_TOKEN="<admin-access-token>"
SHOPIFY_SHOP_DOMAIN="my-store.myshopify.com"
SHOPIFY_API_VERSION="2025-01"

META_ACCESS_TOKEN="<business-system-user-token>"
META_AD_ACCOUNT_ID="act_1234567890"

GA4_PROPERTY_ID="<ga4-property-id>"
GA4_CREDENTIALS_JSON='<service-account-json>'

KLAVIYO_API_KEY="<private-api-key>"
```

---

## 10. API & Job Lifecycle Contract

Types live in `packages/config` for sharing across `apps/web`, `apps/worker`, and Edge Functions.

### 10.1 Job Lifecycle Enums

#### RunStatus

```typescript
enum RunStatus {
  QUEUED = 'QUEUED',           // Created by /sync, awaiting worker
  IN_PROGRESS = 'IN_PROGRESS', // Claimed by worker, running
  SUCCEEDED = 'SUCCEEDED',     // Completed without errors
  FAILED = 'FAILED',           // Terminated with error
  PARTIAL = 'PARTIAL',         // Optional: some tasks succeeded, at least one failed
}
```

#### JobType

```typescript
enum JobType {
  HISTORICAL = 'HISTORICAL',   // Full backfill
  INCREMENTAL = 'INCREMENTAL', // Fetch since last watermark
}
```

#### Platform

```typescript
enum Platform {
  SHOPIFY = 'SHOPIFY',
  META = 'META',
  GA4 = 'GA4',
  KLAVIYO = 'KLAVIYO',
}
```

### 10.2 API Contract: /sync

Edge Function that enqueues an ETL job.

**Endpoint:** `POST /functions/v1/sync`
**Auth:** `Authorization: Bearer <Supabase Auth JWT>`
**Latency Target:** Sub-1 second

#### Request Body

```json
{
  "shop_id": "sh_123abc",
  "job_type": "INCREMENTAL",
  "platform": "SHOPIFY"
}
```

#### Responses

**202 Accepted**
```json
{ "run_id": "run_9a8b7c" }
```

**400 Bad Request**
```json
{ "error": "Invalid job_type. Must be HISTORICAL or INCREMENTAL." }
```

**401 Unauthorized / 403 Forbidden**
```json
{ "error": "Not authenticated or no access to this shop." }
```

#### Behavior

1. Validate JWT and user access to `shop_id`
2. Validate `job_type` and `platform` against enums
3. `INSERT INTO core_warehouse.etl_runs (shop_id, status, job_type, platform) VALUES (..., 'QUEUED', ...)`
4. Return `run_id` immediately
5. Railway cron or manual worker run picks up the job

### 10.3 Database Table: core_warehouse.etl_runs

Central handoff between Edge Function and Worker.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | `gen_random_uuid()`, returned as `run_id` |
| `shop_id` | `text` | Indexed |
| `status` | `text` | RunStatus enum |
| `job_type` | `text` | JobType enum |
| `platform` | `text` | Platform enum |
| `error` | `jsonb` nullable | ErrorPayload when FAILED/PARTIAL |
| `records_synced` | `integer` nullable | Count of primary entity synced |
| `created_at` | `timestamptz` | Default `now()` |
| `started_at` | `timestamptz` nullable | Set when worker claims job |
| `completed_at` | `timestamptz` nullable | Set on terminal state |

#### Operational Notes

- Worker polls: `SELECT * FROM etl_runs WHERE status='QUEUED' ORDER BY created_at LIMIT 1`
- Claim: `UPDATE etl_runs SET status='IN_PROGRESS', started_at=now() WHERE id=? AND status='QUEUED'`
- Partial unique index prevents duplicate in-flight jobs per shop/platform

### 10.4 ErrorPayload Shape

Stored in `etl_runs.error` for `FAILED` or `PARTIAL` jobs.

```typescript
interface ErrorPayload {
  code: string;           // Error code (see below)
  message: string;        // Human-readable message
  service: string;        // 'apps/worker' or 'apps/edge'
  task: string;           // Specific task that failed (e.g., 'shopify_bulk_download')
  stack_trace?: string;   // Optional stack trace
}
```

#### Suggested Error Codes

- `SHOPIFY_AUTH_ERROR`, `SHOPIFY_RATE_LIMIT`, `SHOPIFY_BULK_NOT_READY`
- `META_AUTH_ERROR`, `META_RATE_LIMIT`
- `GA4_PERMISSION_DENIED`
- `KLAVIYO_AUTH_ERROR`
- `DB_WRITE_ERROR`, `SCHEMA_MISMATCH`, `UNKNOWN`

---

## 11. Implementation Phases

Reference `PROGRESS.md` for current phase and completion status.

### Phase 0: Foundation & Infrastructure Setup
- Monorepo, Git, Supabase project, shared types package

### Phase 1: Database Schema & Migrations
- Complete schema, migrations applied

### Phase 2: Edge Function - /sync API
- Job enqueue API deployed

### Phase 3: Worker Foundation
- Job polling and orchestration

### Phase 4: Shopify Integration
- Orders, line items, transactions, payouts

### Phase 5: Marketing Integrations
- Meta, GA4, Klaviyo + MER/ROAS

### Phase 6: Frontend - Next.js Dashboard
- UI, sync status, visualizations

### Phase 7: Deployment & CI/CD
- Production deploys, cron schedules

### Phase 8: Polish & Production Hardening
- Security, performance, docs, testing

---

## 12. Verification Checklist

Before starting any phase, verify:

- [ ] All tools installed (see `TOOLS_AND_EXTENSIONS.md`)
- [ ] Read `AGENT_GUIDELINES.md` for behavioral rules
- [ ] Check `PROGRESS.md` for current phase
- [ ] Supabase project created and linked
- [ ] Environment variables documented

During work:

- [ ] Reference `ARCHITECTURE_DECISIONS.md` for technical alignment
- [ ] Follow `DEVELOPMENT_WORKFLOW.md` for git and commits
- [ ] Test locally before deploying

After completing feature:

- [ ] Update `CHANGELOG.md` with completed work
- [ ] Update `PROGRESS.md` with next steps
- [ ] Commit with descriptive message

---

## 13. Official Documentation Links

- [Supabase Docs](https://supabase.com/docs)
- [Shopify Admin API](https://shopify.dev/docs/api/admin-graphql)
- [Meta Marketing API](https://developers.facebook.com/docs/marketing-apis)
- [GA4 Data API](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [Klaviyo API](https://developers.klaviyo.com/en/reference/api_overview)
- [Vercel Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app)

---

## 14. Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2025-01-04 | 1.0.0 | Initial specification created |

---

**End of PROJECT_SPEC.md**
