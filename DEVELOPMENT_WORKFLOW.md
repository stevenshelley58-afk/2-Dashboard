# Development Workflow

**Version:** 1.0.0
**Last Updated:** 2025-01-04
**Purpose:** Git branching strategy, commit standards, deployment procedures, and testing requirements

---

## Git Branching Strategy

### Branch Structure

```
main (production)
  └── develop (staging)
        └── feature/shopify-sync
        └── feature/dashboard-ui
        └── fix/cursor-not-advancing
```

### Branch Types

| Branch | Purpose | Deploy Target | Lifespan |
|--------|---------|---------------|----------|
| `main` | Production-ready code | Vercel Production, Railway Production | Permanent |
| `develop` | Integration/staging | Vercel Preview, Railway Staging | Permanent |
| `feature/*` | New features | Local, Vercel Preview (PR) | Temporary (delete after merge) |
| `fix/*` | Bug fixes | Local, Vercel Preview (PR) | Temporary (delete after merge) |
| `docs/*` | Documentation updates | N/A | Temporary (delete after merge) |
| `refactor/*` | Code refactoring (no behavior change) | Local, Vercel Preview (PR) | Temporary (delete after merge) |

### Branch Naming Convention

```
feature/<short-description>
fix/<short-description>
docs/<short-description>
refactor/<short-description>
```

**Examples:**
- `feature/shopify-orders-sync`
- `fix/etl-runs-duplicate-index`
- `docs/add-api-examples`
- `refactor/extract-transform-utils`

---

## Development Workflow

### 1. Starting New Work

```bash
# Update develop branch
git checkout develop
git pull origin develop

# Create feature branch
git checkout -b feature/my-new-feature

# Make changes, test locally
# ...

# Stage and commit
git add .
git commit -m "feat: add Shopify orders sync"

# Push to remote
git push -u origin feature/my-new-feature
```

### 2. Creating Pull Request

```bash
# Option 1: Using GitHub CLI
gh pr create --base develop --title "Add Shopify orders sync" --body "Implements orders sync with Bulk Operations API"

# Option 2: Via GitHub web UI
# Navigate to repo, click "Compare & pull request"
```

**PR Guidelines:**
- Target `develop` branch (not `main`)
- Provide clear description of changes
- Link to related issues (`Closes #123`)
- Add screenshots for UI changes
- Request review from team member (if applicable)

### 3. Code Review & Merge

**Before merging:**
- [ ] All CI checks pass (lint, typecheck, tests)
- [ ] Code review approved (if applicable)
- [ ] Locally tested and verified working
- [ ] Documentation updated (if applicable)

**Merge strategy:** Squash and merge (keeps `develop` history clean)

```bash
# After PR approved, merge via GitHub UI (squash and merge)
# Then delete feature branch

# Update local develop
git checkout develop
git pull origin develop

# Delete local feature branch
git branch -d feature/my-new-feature
```

### 4. Deploying to Production

**Only merge to `main` when ready for production release.**

```bash
# From develop branch
git checkout main
git pull origin main
git merge develop --no-ff -m "Release: Shopify sync v1.0"
git push origin main

# This triggers:
# - Vercel production deploy (apps/web)
# - Railway production deploy (apps/worker)
```

---

## Commit Message Standards

### Format (Conventional Commits)

```
<type>(<scope>): <short description>

<optional body>

<optional footer>
```

### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(worker): add Shopify bulk operations client` |
| `fix` | Bug fix | `fix(etl): prevent cursor advancement on failure` |
| `refactor` | Code restructuring (no behavior change) | `refactor(transform): extract upsert logic to helper` |
| `docs` | Documentation only | `docs(readme): add setup instructions` |
| `test` | Adding or updating tests | `test(worker): add unit tests for transform logic` |
| `chore` | Tooling, dependencies, non-code | `chore(deps): upgrade Supabase CLI to v1.50` |
| `style` | Code formatting (no logic change) | `style: fix indentation in orders.sql` |
| `perf` | Performance improvement | `perf(query): add index on orders.created_at` |

### Scope (Optional)

Indicates which part of codebase is affected:
- `worker` - apps/worker
- `web` - apps/web
- `edge` - supabase/functions
- `db` - database schema/migrations
- `config` - packages/config

### Examples

**Good commits:**

```
feat(db): add core_warehouse.etl_runs table

Creates orchestration table for job queue with status tracking.
Includes partial unique index to prevent duplicate in-flight jobs.

Refs: PROJECT_SPEC.md section 10.3
```

```
fix(worker): do not advance cursor on sync failure

Previously, cursor was advanced even if etl_runs.status was FAILED.
Now only advances on SUCCEEDED status.

Closes #23
```

```
docs: update ARCHITECTURE_DECISIONS.md with ADR-006

Documents decision to use Shopify Bulk Operations API instead of
REST API for large data syncs.
```

**Bad commits (avoid):**

```
Update code
```
(Too vague)

```
WIP
```
(Not descriptive; use `feat(worker): WIP - implementing orders sync` if must commit WIP)

```
Fixed bug
```
(No context; what bug? where?)

---

## Testing Requirements

### Per-Phase Testing

Each phase has specific testing requirements before merging to `develop`.

#### Phase 0: Foundation & Infrastructure

- [ ] All tools verified (`TOOLS_AND_EXTENSIONS.md` checklist)
- [ ] Monorepo workspaces configured (can install dependencies)
- [ ] Supabase project created and linked (`supabase status` works)

#### Phase 1: Database Schema & Migrations

- [ ] Migrations apply cleanly (`supabase db push`)
- [ ] All tables created (`psql` or Supabase dashboard)
- [ ] Indexes and constraints verified (`\d+ table_name` in psql)
- [ ] Can insert and query sample data

#### Phase 2: Edge Function - /sync API

- [ ] Function deploys successfully (`supabase functions deploy sync`)
- [ ] Returns 202 for valid request (`curl` test)
- [ ] Returns 400 for invalid request (bad job_type)
- [ ] Returns 401 for missing auth header
- [ ] Row inserted in `etl_runs` table with status='QUEUED'

#### Phase 3: Worker Foundation

- [ ] Worker starts locally (`npm run start`)
- [ ] Connects to Supabase DB
- [ ] Polls `etl_runs` for QUEUED jobs
- [ ] Claims job (sets status='IN_PROGRESS')
- [ ] Completes job (sets status='SUCCEEDED')

#### Phase 4: Shopify Integration

- [ ] Shopify client authenticates (valid access token)
- [ ] Bulk operation initiates successfully
- [ ] Polls for completion (status='COMPLETED')
- [ ] Downloads and parses JSONL
- [ ] Inserts raw data to `staging_ingest.shopify_orders_raw`
- [ ] Transform upserts to `core_warehouse.orders`
- [ ] Cursor advances in `sync_cursors` table

#### Phase 5: Marketing Integrations

- [ ] Meta client fetches insights (valid access token)
- [ ] GA4 client fetches report (valid service account)
- [ ] Klaviyo client fetches metrics (valid API key)
- [ ] All data normalized to canonical currency
- [ ] `reporting.mer_roas` view returns correct calculations

#### Phase 6: Frontend - Next.js Dashboard

- [ ] App runs locally (`npm run dev`)
- [ ] Supabase client authenticates
- [ ] Data loads from `reporting` views
- [ ] Charts render correctly
- [ ] Sync button triggers `/sync` Edge Function
- [ ] Sync status updates in UI

#### Phase 7: Deployment & CI/CD

- [ ] Frontend deploys to Vercel (production + preview)
- [ ] Worker deploys to Railway (production + staging)
- [ ] Cron job runs on schedule
- [ ] Environment variables set correctly

#### Phase 8: Polish & Production Hardening

- [ ] Security audit complete (RLS policies, secrets)
- [ ] Performance optimized (indexes, materialized views)
- [ ] Error handling tested (invalid inputs, API failures)
- [ ] Documentation complete (README, API docs)

---

## Deployment Procedures

### Deploying Database Migrations

**NEVER auto-run migrations on deploy. Always apply intentionally.**

```bash
# 1. Test locally first
supabase start
supabase db reset  # applies all migrations fresh
# Verify tables/views created correctly

# 2. Apply to remote
supabase link --project-ref <project-ref>
supabase db push

# 3. Verify in Supabase dashboard
# Check tables, indexes, RLS policies
```

### Deploying Edge Functions

```bash
# Deploy single function
supabase functions deploy sync

# Deploy all functions
supabase functions deploy

# Set secrets (if needed)
supabase secrets set MY_SECRET=value

# Verify deployment
curl -X POST https://<project-ref>.supabase.co/functions/v1/sync \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"shop_id":"sh_test","job_type":"INCREMENTAL","platform":"SHOPIFY"}'
```

### Deploying Frontend (Vercel)

**Automatic deployment via Git push:**

```bash
# Push to develop → triggers preview deploy
git push origin develop

# Merge to main → triggers production deploy
git push origin main
```

**Manual deployment via CLI:**

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

**Verify deployment:**

```bash
# View logs
vercel logs <deployment-url>

# Check environment variables
vercel env ls
```

### Deploying Worker (Railway)

**Automatic deployment via Git push:**

```bash
# Push to main → triggers production deploy
git push origin main
```

**Manual deployment via CLI:**

```bash
# Deploy current directory
railway up

# Check status
railway status

# View logs
railway logs
```

**Verify cron schedule:**

```bash
# Check cron jobs in Railway dashboard
# Or via CLI (if supported)
railway variables
```

---

## Rollback Procedures

### Frontend Rollback (Vercel)

```bash
# List recent deployments
vercel ls

# Rollback to previous deployment
vercel rollback <deployment-url>
```

**Via Vercel dashboard:**
1. Navigate to project → Deployments
2. Find previous working deployment
3. Click "..." → "Promote to Production"

### Worker Rollback (Railway)

**Via Railway dashboard:**
1. Navigate to service → Deployments
2. Find previous working deployment
3. Click "Redeploy"

**Via Git:**
```bash
# Revert to previous commit
git revert <commit-hash>
git push origin main
```

### Database Rollback

**WARNING: Database rollbacks are risky. Always test migrations locally first.**

```bash
# Create down migration
supabase migration new rollback_feature_x

# Write SQL to undo previous migration
# Example: DROP TABLE IF EXISTS core_warehouse.new_table;

# Apply rollback
supabase db push
```

**Best practice:** Don't rollback; create forward migration to fix issue.

---

## CI/CD Pipeline (Future)

### GitHub Actions Workflow

**`.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
    branches: [develop, main]
  push:
    branches: [develop, main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test
```

---

## Hotfix Workflow

For critical production bugs that need immediate fix:

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b fix/critical-bug

# 2. Make fix and commit
git add .
git commit -m "fix: resolve critical auth bug"

# 3. Push and create PR targeting main
git push -u origin fix/critical-bug
gh pr create --base main --title "Hotfix: Resolve critical auth bug"

# 4. After PR approved, merge to main
# This triggers production deploy

# 5. Merge back to develop
git checkout develop
git merge main
git push origin develop
```

---

## Environment Management

### Local Environment

**Setup:**

```bash
# Copy example env file
cp .env.example .env.local

# Fill in values from Supabase dashboard
# SUPABASE_URL, SUPABASE_ANON_KEY, etc.

# Start Supabase local stack
supabase start

# Run frontend
cd apps/web
pnpm dev

# Run worker (separate terminal)
cd apps/worker
pnpm dev
```

### Preview Environment (Vercel)

- **Triggered by:** PR to `develop` or `main`
- **Endpoint:** Auto-generated URL (e.g., `<pr-name>-<project>.vercel.app`)
- **Environment:** Uses preview environment variables (configure in Vercel dashboard)

### Staging Environment (develop branch)

- **Triggered by:** Push to `develop`
- **Endpoint:** `staging.yourdomain.com` (configure via Vercel domains)
- **Environment:** Uses staging environment variables

### Production Environment (main branch)

- **Triggered by:** Push to `main`
- **Endpoint:** `yourdomain.com`
- **Environment:** Uses production environment variables

---

## Code Review Checklist

**Before approving PR:**

- [ ] Code follows TypeScript standards (strict mode, no `any`)
- [ ] Commit messages follow Conventional Commits format
- [ ] No hardcoded secrets or credentials
- [ ] Database queries use parameterized inputs (no SQL injection)
- [ ] Error handling implemented (try/catch, proper status codes)
- [ ] Tests added/updated (if applicable)
- [ ] Documentation updated (if applicable)
- [ ] PR description is clear and references related issues
- [ ] No merge conflicts with target branch
- [ ] CI checks pass (lint, typecheck, tests)

---

## Troubleshooting Common Issues

### Merge Conflicts

```bash
# Update your branch with latest develop
git checkout feature/my-feature
git fetch origin
git merge origin/develop

# Resolve conflicts in editor
# Stage resolved files
git add <resolved-files>
git commit -m "chore: resolve merge conflicts"
git push
```

### Failed Deployment

**Vercel:**
1. Check build logs in Vercel dashboard
2. Verify environment variables set correctly
3. Test build locally: `vercel build`

**Railway:**
1. Check logs: `railway logs`
2. Verify environment variables: `railway variables`
3. Check Docker build logs in Railway dashboard

### Migration Conflicts

**Problem:** Migration fails because table already exists

**Solution:**
```sql
-- Use IF NOT EXISTS in migration
CREATE TABLE IF NOT EXISTS core_warehouse.my_table (...);

-- Or add conditional logic
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='my_table') THEN
    CREATE TABLE core_warehouse.my_table (...);
  END IF;
END $$;
```

---

## References

- [PROJECT_SPEC.md](./PROJECT_SPEC.md) - Technical specification
- [AGENT_GUIDELINES.md](./AGENT_GUIDELINES.md) - Behavioral rules
- [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md) - Technical decisions
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Vercel Deployment Docs](https://vercel.com/docs/deployments)
- [Railway Deployment Docs](https://docs.railway.app/deploy/deployments)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)

---

**End of DEVELOPMENT_WORKFLOW.md**
