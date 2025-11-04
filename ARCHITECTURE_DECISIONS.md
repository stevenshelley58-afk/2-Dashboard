# Architecture Decision Records (ADR)

**Version:** 1.0.0
**Last Updated:** 2025-01-04
**Purpose:** Document key technical decisions, rationale, and trade-offs

---

## What is an ADR?

An Architecture Decision Record (ADR) captures an important architectural decision made during the project, along with:
- **Context** - The circumstances requiring the decision
- **Decision** - What we decided to do
- **Rationale** - Why we made this decision
- **Consequences** - Trade-offs and implications
- **Alternatives Considered** - Other options evaluated

---

## ADR-001: ELT Architecture (not ETL)

**Status:** Accepted
**Date:** 2025-01-04
**Deciders:** Project team

### Context

Need to process data from multiple external APIs (Shopify, Meta, GA4, Klaviyo) into a unified analytics database.

Two primary approaches:
1. **ETL (Extract, Transform, Load):** Transform data in application code before loading to DB
2. **ELT (Extract, Load, Transform):** Load raw data to DB, transform in-database with SQL

### Decision

Use **ELT architecture** with raw staging tables and in-database SQL transforms.

### Rationale

1. **Auditability:** Raw data preserved in `staging_ingest` for debugging and reprocessing
2. **Performance:** SQL transforms in Postgres are faster than application-level transforms at scale
3. **Simplicity:** SQL is declarative and easier to reason about than complex application logic
4. **Idempotency:** `ON CONFLICT DO UPDATE` ensures safe retries without duplicates
5. **Separation of Concerns:** Worker only handles API calls and raw inserts; transforms are pure SQL

### Consequences

**Positive:**
- Easy to debug transform logic (just run SQL queries)
- Can reprocess data without re-fetching from APIs
- Transforms can be optimized independently (indexes, materialized views)

**Negative:**
- Requires more database storage (staging + warehouse)
- Staging tables can grow large and need periodic cleanup

### Alternatives Considered

**ETL with application-level transforms:**
- Pros: Less database storage, transforms in TypeScript
- Cons: Harder to debug, slower at scale, tightly coupled to worker code

---

## ADR-002: Monorepo Structure

**Status:** Accepted
**Date:** 2025-01-04
**Deciders:** Project team

### Context

Need to organize code for:
- Frontend (Next.js)
- Worker (Node.js ETL)
- Edge Functions (Deno)
- Shared types/utilities

Options:
1. **Monorepo** - Single repo with multiple apps/packages
2. **Polyrepo** - Separate repo for each service

### Decision

Use **monorepo** with workspace structure (`apps/`, `packages/`, `supabase/`).

### Rationale

1. **Shared Types:** Single source of truth for enums (RunStatus, JobType, Platform) shared across all apps
2. **Atomic Changes:** Single commit can update types + frontend + worker simultaneously
3. **Simplified CI/CD:** One repo to configure for GitHub Actions
4. **Easier Local Development:** Run frontend and worker together with single `pnpm dev`

### Consequences

**Positive:**
- No version drift between apps (all use same types)
- Easier to refactor (IDE finds all usages across apps)
- Single PR can span multiple apps

**Negative:**
- Larger repo size (not a concern at this scale)
- Need to configure workspace tooling (pnpm workspaces)

### Alternatives Considered

**Polyrepo:**
- Pros: Each service independently versioned and deployed
- Cons: Type sharing requires publishing to npm registry; harder to keep in sync

---

## ADR-003: Supabase for Database + Auth + Edge Functions

**Status:** Accepted
**Date:** 2025-01-04
**Deciders:** Project team

### Context

Need to host:
- PostgreSQL database (for warehouse)
- Authentication (for frontend users)
- Lightweight APIs (for job triggers)

Options:
1. **Supabase** - All-in-one (DB, Auth, Edge Functions, Realtime)
2. **Self-hosted Postgres + Auth0 + Vercel Functions**
3. **AWS RDS + Cognito + Lambda**

### Decision

Use **Supabase** for database, authentication, Edge Functions, and API layer.

### Rationale

1. **Unified Platform:** Single platform for DB, Auth, API reduces integration complexity
2. **Developer Experience:** Excellent CLI (`supabase start` for local stack), migration tooling, TypeScript support
3. **Auto-generated REST API:** Read-only views in `reporting` schema automatically exposed via REST
4. **Edge Functions:** Deno-based Edge Functions for fast, lightweight APIs (e.g., `/sync`)
5. **Realtime:** Built-in for future live sync status updates
6. **Connection Pooling:** PgBouncer included for high-concurrency access

### Consequences

**Positive:**
- Fast setup (no infrastructure wrangling)
- Local development stack (`supabase start`)
- Row Level Security (RLS) for fine-grained access control
- Auto-syncs env vars with Vercel integration

**Negative:**
- Vendor lock-in (mitigated by standard Postgres + open-source stack)
- Edge Functions use Deno (different from Node.js worker)

### Alternatives Considered

**Self-hosted Postgres + Auth0:**
- Pros: More control over infra
- Cons: More maintenance, no auto-generated API, complex setup

**AWS RDS + Cognito + Lambda:**
- Pros: Enterprise-grade, scalable
- Cons: Complex configuration, higher cost, slower dev velocity

---

## ADR-004: Railway for Worker (not Lambda/Cloud Functions)

**Status:** Accepted
**Date:** 2025-01-04
**Deciders:** Project team

### Context

Worker needs to:
- Run long-lived ETL jobs (Shopify bulk operations can take minutes)
- Poll database for queued jobs
- Run on schedule (cron)

Options:
1. **Railway** - Long-running service with cron
2. **AWS Lambda** - Serverless functions (15-minute timeout)
3. **Vercel Cron** - Scheduled Vercel functions (10-second timeout)
4. **GitHub Actions** - Scheduled workflows

### Decision

Use **Railway** to host the worker as a long-running service with cron scheduling.

### Rationale

1. **No Timeout Limits:** Railway supports long-running processes (Shopify bulk ops can take >5 minutes)
2. **Native Cron:** Built-in cron scheduling (no external orchestrator needed)
3. **GitHub Integration:** Auto-deploys from Git pushes to `main`
4. **Persistent Connections:** Can maintain database connection pool (more efficient than cold starts)
5. **Simple Logs:** Stdout/stderr logs accessible via CLI (`railway logs`)

### Consequences

**Positive:**
- No cold starts (always warm)
- Can handle long-running jobs
- Simple deployment (`railway up`)

**Negative:**
- Always-on service (slightly higher cost than serverless, but negligible at this scale)
- Not auto-scaling (fine for single-shop initially; can add concurrency later)

### Alternatives Considered

**AWS Lambda:**
- Pros: Serverless, auto-scaling
- Cons: 15-minute timeout (may not be enough for large backfills), cold starts, complex setup

**Vercel Cron:**
- Pros: Integrated with frontend deployment
- Cons: 10-second timeout (too short for ETL), stateless (no persistent connections)

**GitHub Actions:**
- Pros: Free for public repos, easy to configure
- Cons: Not designed for production workloads, no persistent state, slow cold starts

---

## ADR-005: Job Queue in Database (not Redis/SQS)

**Status:** Accepted
**Date:** 2025-01-04
**Deciders:** Project team

### Context

Need a queue to manage ETL jobs:
- Edge Function inserts jobs (producer)
- Worker polls and processes jobs (consumer)

Options:
1. **Database table** (`core_warehouse.etl_runs`) with status column
2. **Redis** (e.g., Bull queue)
3. **AWS SQS** (managed queue)
4. **RabbitMQ** (self-hosted message broker)

### Decision

Use **database table** (`core_warehouse.etl_runs`) as job queue.

### Rationale

1. **Simplicity:** No additional infrastructure (DB already exists)
2. **Auditability:** Job history naturally preserved (no need for separate dead-letter queue)
3. **Atomic Updates:** Worker claims job with `UPDATE ... WHERE status='QUEUED'` (optimistic locking)
4. **Single Source of Truth:** Job status visible to frontend via `reporting.sync_status` view
5. **Transaction Safety:** Job updates and data writes in same transaction

### Consequences

**Positive:**
- Zero additional infrastructure
- Easy to debug (just query `etl_runs` table)
- Job history persisted forever

**Negative:**
- Not as fast as Redis (but adequate for low-throughput use case: ~1 job per 15 minutes)
- Requires polling (not push-based), but Railway cron handles this

### Alternatives Considered

**Redis with Bull:**
- Pros: Fast, push-based, robust retry logic
- Cons: Extra infrastructure, no built-in persistence (need separate DB for history)

**AWS SQS:**
- Pros: Fully managed, scalable
- Cons: Not integrated with Supabase, requires AWS SDK, visibility timeout complexity

---

## ADR-006: Shopify Bulk Operations (not REST API polling)

**Status:** Accepted
**Date:** 2025-01-04
**Deciders:** Project team

### Context

Need to fetch orders, line items, transactions, payouts from Shopify.

Options:
1. **REST Admin API** - Paginated requests (e.g., `/admin/api/2025-01/orders.json`)
2. **GraphQL Admin API with Bulk Operations** - Async JSONL export

### Decision

Use **Shopify GraphQL Admin API with Bulk Operations** for all backfills and large syncs.

### Rationale

1. **Rate Limits:** REST API has strict rate limits (40 req/sec). Bulk Operations bypass this for large datasets.
2. **Efficiency:** Single bulk query returns entire dataset as JSONL file (no pagination logic).
3. **Official Recommendation:** Shopify recommends Bulk Operations for data sync use cases.
4. **One Operation Per Type:** Shopify enforces one bulk op of each type per shop at a time (prevents conflicts).

### Consequences

**Positive:**
- Faster for large datasets (>1000 orders)
- No pagination complexity
- Lower risk of hitting rate limits

**Negative:**
- Async workflow (initiate → poll for completion → download JSONL)
- Requires polling Shopify for job status (adds latency)
- Cannot use for real-time updates (fallback to webhooks for that)

### Alternatives Considered

**REST API:**
- Pros: Simpler request/response model
- Cons: Pagination complexity, rate limit issues, slower for large datasets

**GraphQL Admin API (single queries):**
- Pros: Flexible queries
- Cons: Still subject to rate limits, not designed for bulk export

---

## ADR-007: Cursor-Based Incremental Syncs

**Status:** Accepted
**Date:** 2025-01-04
**Deciders:** Project team

### Context

Need to sync only new/updated data after initial backfill (incremental syncs).

Options:
1. **Cursor-based** (track `updated_at` watermark per shop/platform)
2. **Timestamp-based** (always fetch last 24 hours)
3. **Full resync** (always pull all data)

### Decision

Use **cursor-based incremental syncs** with `sync_cursors` table tracking `last_success_at` per shop/platform.

### Rationale

1. **Efficiency:** Only fetch data modified since last successful sync (minimizes API calls)
2. **Fault Tolerance:** If sync fails, watermark is NOT advanced (safe to retry from same position)
3. **Platform-Specific:** Each platform (SHOPIFY, META, GA4, KLAVIYO) has its own cursor
4. **Auditability:** `sync_cursors` table provides clear view of sync state

### Consequences

**Positive:**
- Minimal API usage (only fetch deltas)
- Scales well as data grows (initial backfill is one-time)

**Negative:**
- Requires tracking state per shop/platform
- Must handle clock drift (use platform's `updated_at`, not local time)

### Alternatives Considered

**Timestamp-based (last 24 hours):**
- Pros: Simple, no state to track
- Cons: May miss data if sync skipped for >24 hours; fetches overlapping data

**Full resync:**
- Pros: No state, guaranteed consistency
- Cons: Wasteful (re-fetches unchanged data), slow, hits rate limits

---

## ADR-008: Read-Only Reporting Views (not direct table access)

**Status:** Accepted
**Date:** 2025-01-04
**Deciders:** Project team

### Context

Frontend needs to read aggregated data (revenue, orders, MER/ROAS).

Options:
1. **Direct table access** (frontend queries `core_warehouse.orders` directly)
2. **Reporting views** (frontend queries `reporting.daily_revenue` view)
3. **API endpoints** (custom Next.js API routes)

### Decision

Use **read-only reporting views** in `reporting` schema, exposed via Supabase REST API.

### Rationale

1. **Abstraction:** Views hide warehouse schema complexity from frontend
2. **Performance:** Views can pre-aggregate data (or use materialized views if slow)
3. **Security:** RLS policies on views restrict access (frontend cannot write to warehouse)
4. **Flexibility:** Views can be updated without changing frontend code

### Consequences

**Positive:**
- Frontend code is simple (just fetch from view)
- Can optimize views independently (indexes, materialization)
- Clear separation of concerns (warehouse vs. reporting)

**Negative:**
- Extra layer of abstraction (debugging requires checking both table + view)
- Views must be refreshed if materialized (adds complexity)

### Alternatives Considered

**Direct table access:**
- Pros: No abstraction, direct queries
- Cons: Exposes schema details, harder to optimize, security risk

**API endpoints:**
- Pros: Full control over logic
- Cons: More code to maintain, slower (extra network hop), no auto-generated docs

---

## ADR-009: TypeScript Strict Mode Everywhere

**Status:** Accepted
**Date:** 2025-01-04
**Deciders:** Project team

### Context

Need to decide on TypeScript configuration for all apps.

Options:
1. **Strict mode** (`"strict": true` in tsconfig.json)
2. **Loose mode** (individual strict flags disabled)

### Decision

Enable **strict mode** in all `tsconfig.json` files.

### Rationale

1. **Type Safety:** Catches bugs at compile time (e.g., null checks, uninitialized variables)
2. **Better IDE Support:** Autocomplete and refactoring tools work better with strict types
3. **Future-Proof:** Code written in strict mode is easier to maintain and refactor
4. **Best Practice:** TypeScript team recommends strict mode for all new projects

### Consequences

**Positive:**
- Fewer runtime errors (caught at compile time)
- Better developer experience (autocomplete, refactoring)

**Negative:**
- Slightly more verbose code (need explicit null checks)
- Requires upfront typing (no `any` escapes)

### Alternatives Considered

**Loose mode:**
- Pros: Faster initial development (less type wrangling)
- Cons: More runtime errors, harder to refactor later

---

## ADR-010: Conventional Commits

**Status:** Accepted
**Date:** 2025-01-04
**Deciders:** Project team

### Context

Need standard commit message format for readability and automation (e.g., changelog generation).

Options:
1. **Conventional Commits** (`feat:`, `fix:`, `docs:`, etc.)
2. **Free-form messages**

### Decision

Use **Conventional Commits** format for all commit messages.

### Rationale

1. **Clarity:** Structured format makes commit history scannable
2. **Automation:** Enables auto-generation of CHANGELOG.md
3. **Semantic Versioning:** Commit types map to semver (feat → minor, fix → patch, BREAKING CHANGE → major)
4. **Industry Standard:** Widely adopted (Angular, ESLint, many open-source projects)

### Consequences

**Positive:**
- Clear commit history
- Can auto-generate changelogs
- Easy to filter commits by type (e.g., all `feat:` commits)

**Negative:**
- Requires discipline to follow format
- Slightly more verbose than free-form

### Format

```
<type>: <short description>

<optional body>

<optional footer>
```

**Types:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

### Alternatives Considered

**Free-form messages:**
- Pros: No constraints
- Cons: Inconsistent history, harder to automate

---

## Future ADRs

As the project evolves, document new decisions here:

- ADR-011: Choice of frontend UI library (shadcn/ui, Material-UI, etc.)
- ADR-012: Testing strategy (Jest, Playwright, etc.)
- ADR-013: Error monitoring service (Sentry, LogRocket, etc.)
- ADR-014: Multi-tenancy approach (RLS vs. schema-per-tenant)
- ADR-015: Real-time updates (Supabase Realtime vs. polling)

---

## References

- [Architecture Decision Records (ADRs)](https://adr.github.io/)
- [PROJECT_SPEC.md](./PROJECT_SPEC.md) - Technical specification
- [AGENT_GUIDELINES.md](./AGENT_GUIDELINES.md) - Development guidelines

---

**End of ARCHITECTURE_DECISIONS.md**
