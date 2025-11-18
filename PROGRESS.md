# Project Progress

**Last Updated:** 2025-11-18
**Current Phase:** Phase 6 - Frontend Dashboard (Shopify section)
**Overall Status:** 🟢 Phase 4 Complete - Shopify Integration Working • 🟡 Phase 6 underway

---

## Quick Status

| Phase | Status | Completion % | Notes |
|-------|--------|-------------|-------|
| Phase 0: Foundation | 🟢 Complete | 100% | Monorepo, docs, Git setup |
| Phase 1: Database Schema | 🟢 Complete | 100% | All schemas, tables, indexes deployed |
| Phase 2: Edge Function | 🟢 Complete | 100% | /sync API with RPC functions |
| Phase 3: Worker Foundation | 🟢 Complete | 100% | Job polling with Supabase RPC |
| Phase 4: Shopify Integration | 🟢 Complete | 100% | Bulk Operations, 2994 orders synced |
| Phase 5: Marketing Integrations | 🟡 In Progress | 0% | Awaiting platform credentials before implementation |
| Phase 6: Frontend Dashboard | 🟡 In Progress | 40% | Overview dashboard polished with live metrics, charts, and channel insights |
| Phase 7: Deployment & CI/CD | ⚪ Not Started | 0% | |
| Phase 8: Production Hardening | ⚪ Not Started | 0% | |

**Legend:**
- ⚪ Not Started
- 🟡 In Progress
- 🟢 Complete
- 🔴 Blocked

---

## Phase 0-4: COMPLETED ✅

### What We Built

**Phase 0: Foundation**
- ✅ Complete documentation (8 files)
- ✅ Monorepo with pnpm workspaces
- ✅ Git repository initialized and pushed to GitHub
- ✅ Supabase project created and linked

**Phase 1: Database Schema**
- ✅ 4 schemas: staging_ingest, core_warehouse, reporting, app_dashboard
- ✅ 20+ tables with proper constraints and indexes
- ✅ RPC functions for worker operations
- ✅ All migrations applied to remote Supabase

**Phase 2: Edge Function**
- ✅ `/sync` API endpoint as Supabase Edge Function
- ✅ Job enqueue via RPC (bypasses schema restrictions)
- ✅ Request validation and error handling

**Phase 3: Worker Foundation**
- ✅ Job polling with Supabase client (no direct DB connection)
- ✅ Optimistic locking via RPC
- ✅ Platform dispatcher (routes to Shopify, Meta, GA4, Klaviyo)
- ✅ Tested locally and working

**Phase 4: Shopify Integration**
- ✅ Shopify Bulk Operations client
- ✅ Download and parse JSONL payloads (orders, line items, transactions, payouts, customers)
- ✅ Insert to staging via RPC with per-entity batching
- ✅ Transform to warehouse via RPC (orders, line items, transactions, payouts, customers)
- ✅ ShopifyQL analytics ingestion powering `core_warehouse.shopify_analytics_daily` and `reporting.shopify_dashboard_daily`
- ✅ **Successfully synced 2,994 real orders** from bohoem58.myshopify.com
- ✅ Incremental sync with cursor management

**Key Architecture Decision:**
- Uses Supabase RPC functions instead of direct PostgreSQL connections
- Avoids IPv4/IPv6 and Railway PG* environment variable issues
- More secure: DB credentials never exposed

---

## Phase 6: Frontend Dashboard (In Progress)

### What We Built

- Shopify dashboard route (`/shopify`) that mirrors Shopify Analytics with:
  - Shared date picker and comparison-ready layout
  - Revenue and orders charts powered by reporting RPC functions
  - Channel performance cards sourced from marketing fact tables
  - Recent orders table hydrated from the `public.orders` view
- Overview landing experience upgraded:
  - `useActiveShop` determines the active shop and currency for all dashboards
  - Dashboard metrics hook coerces RPC payloads into typed, null-safe data structures
  - KPI tiles, charts, and channel cards now stream real data with resilience to partial results
  - Loading states preserve the previous data while refreshes run and surface the last refresh timestamp

### Next Focus

- Extend dashboard to cover Meta, GA4, and Klaviyo views once Phase 5 integrations land
- Add saved filters and comparison mode toggle after multi-platform data is available

---

## Current Phase: Phase 5 - Marketing Integrations

### Objective

Extract marketing data from Meta Ads, GA4, and Klaviyo to compute MER/ROAS.

### Tasks

Meta Ads Integration:
- [ ] Create Meta Ads client for Marketing API
- [ ] Implement authentication (access token)
- [ ] Fetch daily ad insights (spend, impressions, clicks, conversions)
- [ ] Insert to staging_ingest.meta_ads_raw
- [ ] Transform to core_warehouse.fact_marketing_daily
- [ ] Test with test ad account

GA4 Integration:
- [ ] Create GA4 client for Data API v1
- [ ] Implement authentication (service account JSON)
- [ ] Fetch daily report (sessions, users, revenue, transactions)
- [ ] Insert to staging_ingest.ga4_raw
- [ ] Transform to core_warehouse.fact_ga4_daily
- [ ] Test with test property

Klaviyo Integration:
- [ ] Create Klaviyo client for Metrics API
- [ ] Implement authentication (private API key)
- [ ] Fetch daily metrics (emails sent, opens, clicks, revenue)
- [ ] Insert to staging_ingest.klaviyo_raw
- [ ] Transform to core_warehouse.fact_email_daily
- [ ] Test with test account

Reporting:
- [ ] Create reporting.mer_roas view
- [ ] Verify MER/ROAS calculations with real data

### Blockers

- **Need credentials:**
  - Meta Ads: Ad Account ID + Access Token
  - GA4: Property ID + Service Account JSON
  - Klaviyo: Private API Key
- All three platforms required to compute MER/ROAS

### Next Steps

1. **Get credentials** from user for Meta, GA4, Klaviyo
2. **Start with Meta Ads** (usually easiest to set up)
3. **Then GA4** (requires service account setup)
4. **Then Klaviyo** (straightforward API key)
5. **Build reporting view** once all data sources available

### Estimated Completion

- **Target:** 2025-01-10 (4-5 days)
- **Confidence:** Medium - Three separate API integrations

---

## Session Log

### Session 1 - 2025-01-04
**Completed:** Documentation foundation (8 files)

### Session 2 - 2025-01-04
**Completed:**
- Monorepo structure with pnpm workspaces
- packages/config with shared TypeScript types
- Database schema with 4 schemas, 20+ tables
- Supabase migrations applied to remote

### Session 3 - 2025-01-05
**Completed:**
- Edge Function `/sync` with RPC job enqueue
- Worker foundation with Supabase RPC architecture
- Shopify Bulk Operations integration
- **Successfully synced 2,994 orders from Shopify store**
- Refactored to use Supabase RPC (no direct DB connections)
- Railway deployment documentation
- All code committed and pushed to GitHub

**Key Achievement:** End-to-end working pipeline from Shopify → Supabase

**Next Session:** Phase 5 - Marketing Integrations (Meta, GA4, Klaviyo)

### Session 4 - 2025-11-11
**Completed:**
- Added dedicated Shopify dashboard page with live Supabase metrics, charts, channel insights, and recent orders
- Introduced `useActiveShop` hook to share shop resolution and currency across pages
- Refined dashboard metrics hook with typed RPC mapping, numeric coercion, and null-safe handling
- Rebuilt overview dashboard UI: currency-aware KPI tiles, persistent loading states, refreshed charts/tables, and friendlier empty states
- Re-authored dashboard metrics RPC to compute accurate averages and deltas from aggregated totals

**Next Session:** Blocked on marketing credentials; continue Phase 5 integrations while extending frontend coverage once data is available

### Session 5 - 2025-11-11
**Completed:**
- Expanded Shopify worker bulk sync to ingest line items, transactions, payouts, customers, and ShopifyQL analytics in one pass
- Added Supabase staging tables, transforms, and schema enrichment (orders, customers, shopify_analytics_daily) via migration `20251111123000_expand_shopify_ingestion.sql`
- Introduced `reporting.shopify_dashboard_daily` view and updated cursors for incremental Shopify bulk operations
- Shopify worker now materialises ShopifyQL sales/traffic/customer metrics and preserves watermarks for historical backfills
**Next Session:** Validate end-to-end sync with live Shopify credentials and hydrate frontend charts with the new reporting view

### Session 6 - 2025-11-12
**Completed:**
- Added `core_warehouse.shop_credentials` table with service-role RLS enforcement and automatic timestamp management
- Replaced worker env-based secrets with a credential manager that caches per-shop tokens and validates platform configuration
- Delivered `apps/worker/src/scripts/seed-credentials.ts` to migrate environment secrets into the database and refresh shop metadata
**Next Session:** Migrate outstanding credentials, then resume marketing platform integrations once access keys are available

### Session 7 - 2025-11-18
**Completed:**
- Enforced canonical Shopify shop identifiers end-to-end via migration `20251115090000_enforce_canonical_shop_id.sql` (normalisation helpers, constraints, foreign keys, and `app_dashboard.user_shops`)
- Published shared helper `normalizeShopifyDomainToShopId` from `@dashboard/config` for reuse across worker, edge, and frontend code
- Updated worker scheduler, credential manager, seed scripts, and historical sync to reject non-canonical shop IDs and remove production env fallbacks
- Hardened Supabase `/sync` edge function and Next.js `useActiveShop` hook to consume canonical shop IDs backed by the new user mapping table
- Added accessibility fixes (heading content, labelled inputs) uncovered by lint regression
**Next Session:** Verify canonical enforcement in production by seeding credentials, running syncs, and propagating the change to deployment targets

---

## Outstanding Questions

- [x] Which Shopify store? **bohoem58.myshopify.com**
- [ ] What Meta Ad Account ID should be used?
- [ ] What GA4 Property ID should be used?
- [ ] What Klaviyo account should be used?
- [ ] What domain for production deployment?
- [ ] Dashboard authentication? (internal tool vs public)

---

## References

- [PROJECT_SPEC.md](./PROJECT_SPEC.md) - Architecture and specifications
- [AGENT_GUIDELINES.md](./AGENT_GUIDELINES.md) - Development rules
- [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md) - Deployment instructions
- [CHANGELOG.md](./CHANGELOG.md) - Completed work history

---

**End of PROGRESS.md**
