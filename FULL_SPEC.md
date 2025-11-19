# FULL_SPEC.md – Multi-Store Shopify + Meta Analytics Dashboard

## 1. Purpose & Goals
Rebuild the dashboard to be simple, reliable, and multi-store ready.

The system MUST:
- Support unlimited Shopify stores per agency user.
- Capture every practical field from Shopify and Meta.
- Run a guaranteed historical backfill on connection.
- Provide crystal-clear sync status and error visibility.
- Use a SvelteKit frontend for maximum performance and simplicity.
- Use a Node.js Worker for robust background data processing.

## 2. Architecture Overview
```mermaid
graph TD
    Shopify[Shopify Admin API] --> Worker
    Meta[Meta Marketing API] --> Worker
    Worker[Node.js Worker (Railway)] --> DB[(Supabase Postgres)]
    DB --> Web[SvelteKit App (Vercel)]
    Web --> DB
```
- **Database**: Supabase Postgres (`staging_ingest`, `core_warehouse`, `reporting`, `app_dashboard`).
- **Worker**: Long-running Node service (Railway); polls `sync_jobs`, fetches API data, writes raw + typed tables.
- **Frontend**: SvelteKit (Vercel); connects directly to Supabase via `@supabase/ssr`.

## 3. Domain Model

### 3.1 Users & Shops
- `users`: Managed via Supabase Auth.
- `shops`: `id`, `shopify_domain`, `currency`, `timezone`.
- `user_shops`: Link table for access control.

### 3.2 Credentials
- `shop_credentials`: Stores encrypted tokens for Shopify/Meta.

### 3.3 Sync Orchestration
- `sync_jobs`: Queue for background tasks (`HISTORICAL_INIT`, `INCREMENTAL`).
- `sync_cursors`: Tracks last sync timestamps/watermarks.

## 4. Data Schemas

### 4.1 Warehouse (`core_warehouse`)
- **Shopify**: `orders` (wide table), `order_line_items`, `transactions`.
- **Meta**: `fact_marketing_daily`, `fact_marketing_campaign_daily`.

### 4.2 Reporting (`reporting`)
- Views for `daily_revenue`, `marketing_daily`, `mer_roas`.

## 5. Implementation Details

### 5.1 Worker (Node.js)
- **Location**: `apps/worker`
- **Tech**: TypeScript, `pg` (or Supabase client), `dotenv`.
- **Responsibility**:
    - Poll `sync_jobs`.
    - Execute Shopify Bulk Operations (GraphQL 2026-01).
    - Execute Meta Marketing API calls.
    - Handle rate limits and retries.

### 5.2 Frontend (SvelteKit)
- **Location**: `apps/web-svelte`
- **Tech**: SvelteKit, TailwindCSS, bits-ui / shadcn-svelte.
- **Deployment**: Vercel (Adapter Auto).
- **Key Features**:
    - Server-Side Rendering (SSR) for initial dashboard load.
    - Supabase Auth Helpers for seamless session management.
    - Shop Selector: Global context available in root layout.
    - Real-time: Optional subscription to `sync_jobs` for progress bars.

## 6. API & Security
- **RLS (Row Level Security)**:
    - `user_shops` table dictates access.
    - All queries from SvelteKit (client or server) use the user's JWT.
- **Service Role**:
    - Only the Worker uses the Service Role Key to write data.

## 7. Deliverables
- **Database**: Supabase migrations (keep existing `core_schema.sql`).
- **Worker**: Existing `apps/worker` (keep and refine).
- **Frontend**: NEW `apps/web-svelte` (SvelteKit).
- **Docs**: This `FULL_SPEC.md`.
