# Changelog

**Purpose:** Track completed features, bug fixes, and changes across all development sessions.

**Format:** Follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- Initial project documentation structure
  - PROJECT_SPEC.md - Complete architecture specification
  - AGENT_GUIDELINES.md - Behavioral rules and quality standards
  - TOOLS_AND_EXTENSIONS.md - Required tooling and verification
  - ARCHITECTURE_DECISIONS.md - Technical decision records (10 ADRs)
  - DEVELOPMENT_WORKFLOW.md - Git workflow and deployment procedures
  - CHANGELOG.md - This file
  - PROGRESS.md - Phase tracking and status
  - .cursorrules - Cursor IDE configuration
- Shopify performance dashboard at `/shopify` with live Supabase metrics, charts, channel insights, and recent orders table
- Supabase RPC `get_dashboard_metrics` rewritten to compute averages and deltas from aggregated totals with safe division handling (migration `20251111090000_fix_dashboard_metrics_aggregation.sql`)
- `useActiveShop` hook to resolve the active shop and currency, keeping dashboards environment-agnostic
- Shopify worker bulk ingestion upgraded to load orders, line items, transactions, payouts, customers, and ShopifyQL analytics (migration `20251111123000_expand_shopify_ingestion.sql`)
  - New Supabase staging tables (`shopify_customers_raw`, `shopify_analytics_raw`) and transforms for customers, analytics, and expanded Shopify metrics
  - Added `core_warehouse.shopify_analytics_daily` table and `reporting.shopify_dashboard_daily` view for dashboard readiness
  - Worker Shopify client now batches JSONL payloads by `__typename`, maintains cursors, and persists ShopifyQL insights
- **Canonical shop_id registration and enqueue validation RPCs** (migration `20251113092000_canonical_shop_registration_and_validation.sql`)
  - Added `list_known_shop_ids()` RPC to list all registered shops with shop_id, shopify_domain, and currency
  - Added `register_shop(shopify_domain, currency, timezone)` RPC to register/update shops with automatic shop_id derivation from Shopify domain
  - Enhanced `enqueue_etl_job(shop_id, job_type, platform)` RPC with validation:
    - Validates shop_id exists in registered shops (returns 400 on invalid)
    - Validates job_type enum (HISTORICAL, INCREMENTAL)
    - Validates platform enum (SHOPIFY, META, GA4, KLAVIYO)
    - Prevents duplicate in-flight jobs with proper error handling
  - Updated `/sync` Edge Function to return 400 for validation errors vs 500 for server errors
  - Added comprehensive RPC documentation in `supabase/RPC_DOCUMENTATION.md`
  - Added test script `test_shop_registration.sql` for acceptance testing
- `core_warehouse.shop_credentials` table with RLS limited to the service role for storing per-shop platform secrets (migration `20251114094500_create_shop_credentials.sql`)
- Worker `CredentialManager` with credential caching, expiry validation, and graceful error handling across Shopify, Meta, GA4, and Klaviyo integrations
- One-time seed script `apps/worker/src/scripts/seed-credentials.ts` to migrate environment secrets into the database and update shop metadata
- Canonical shop enforcement suite (migration `20251115090000_enforce_canonical_shop_id.sql`)
  - Shared `normalizeShopifyDomainToShopId` helper exported from `@dashboard/config`
  - Database-level constraints, helper functions, and foreign keys guaranteeing `shop_id` uniqueness and lowercase subdomain format
  - New `app_dashboard.user_shops` mapping table with RLS + policies for per-user tenancy

### Changed
- Dashboard auto-detects the active shop from existing orders instead of relying on `NEXT_PUBLIC_SHOP_ID`.
- Shared `useActiveShop` hook powers both the overview and Shopify dashboards and surfaces currency alongside shop resolution
- Overview dashboard now retains data while refreshing, shows last refresh timestamps, honors shop currency, and replaces mock sections with live metrics, charts, product, and channel summaries
- `useDashboardMetrics` normalises RPC responses, providing typed, null-safe chart, product, and channel datasets
- Extended `core_warehouse.orders` schema with subtotal, discount, shipping, tax, status, and customer enrichment to support Shopify analytics cards
- Shopify sync cursors now track updated-at watermarks for incremental bulk exports and reuse ShopifyQL lookbacks
- Worker now sources platform credentials from Supabase instead of process environment variables, falling back to env only during migration
- Worker, edge function, and frontend now reject dotted or mixed-case shop identifiers, sourcing all configuration from Supabase rather than environment fallbacks (`apps/worker`, `supabase/functions/sync`, `apps/web/hooks/use-active-shop.ts`)

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- Overview KPIs now report correct 7-day Shopify performance by deriving AOV/ROAS/MER from daily totals and guarding against missing data

### Security
- Platform credentials moved from process environment variables to `core_warehouse.shop_credentials` with service-role-only access

---

## How to Update This File

At the end of every development session, add your changes under the `[Unreleased]` section using these categories:

### Categories

- **Added** - New features, files, or capabilities
- **Changed** - Changes to existing functionality
- **Deprecated** - Features that will be removed in future versions
- **Removed** - Removed features or files
- **Fixed** - Bug fixes
- **Security** - Security improvements or vulnerability fixes

### Format

```markdown
### Added
- Description of what was added (with references if applicable)

### Fixed
- Description of bug fix (Closes #issue-number)
```

### Example Entry

```markdown
## [Unreleased]

### Added
- Shopify orders sync via Bulk Operations API (refs: PROJECT_SPEC.md section 6)
  - Implemented `apps/worker/src/integrations/shopify.ts`
  - Added `staging_ingest.shopify_orders_raw` table
  - Added transform to `core_warehouse.orders`

### Fixed
- ETL cursor not advancing on successful sync (Closes #23)
  - Updated `apps/worker/src/jobs/complete.ts` to only advance cursor on SUCCEEDED status
```

---

## Version Release Process

When releasing a version (e.g., after completing a phase):

1. Move items from `[Unreleased]` to a new version section:

```markdown
## [0.1.0] - 2025-01-10

### Added
- Database schema (Phase 1 complete)
- All staging_ingest, core_warehouse, and reporting tables
- Migrations applied to production

[Link to release](https://github.com/yourorg/yourrepo/releases/tag/v0.1.0)
```

2. Update version number in relevant files:
   - `apps/web/package.json`
   - `apps/worker/package.json`
   - `PROJECT_SPEC.md` (version at top)

3. Create Git tag:
```bash
git tag -a v0.1.0 -m "Release: Phase 1 - Database Schema Complete"
git push origin v0.1.0
```

---

## Version History

(Versions will be added here as phases complete)

### Phase Completion Milestones

- **v0.1.0** - Phase 1: Database Schema & Migrations (Target: TBD)
- **v0.2.0** - Phase 2: Edge Function - /sync API (Target: TBD)
- **v0.3.0** - Phase 3: Worker Foundation (Target: TBD)
- **v0.4.0** - Phase 4: Shopify Integration (Target: TBD)
- **v0.5.0** - Phase 5: Marketing Integrations (Target: TBD)
- **v0.6.0** - Phase 6: Frontend - Next.js Dashboard (Target: TBD)
- **v0.7.0** - Phase 7: Deployment & CI/CD (Target: TBD)
- **v1.0.0** - Phase 8: Production Hardening (Target: TBD)

---

## References

- [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
- [Semantic Versioning](https://semver.org/)
- [PROJECT_SPEC.md](./PROJECT_SPEC.md)
- [PROGRESS.md](./PROGRESS.md)

---

**End of CHANGELOG.md**
