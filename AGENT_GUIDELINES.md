# Agent Guidelines

**Version:** 1.0.0
**Last Updated:** 2025-01-04
**Purpose:** Behavioral rules and quality standards for all development sessions

---

## Core Principles

1. **Be concise.** Do not get stuck making endless plans. Plan → Execute → Verify → Commit.
2. **Break large jobs into small steps.** Each step should be testable and committable.
3. **Commit after each working feature,** not at project end.
4. **Verify tooling before execution.** Check all required CLIs are installed and working.
5. **Always reference official documentation.** Do not assume; verify against latest docs.
6. **Maintain context across sessions.** Read relevant docs at session start; update at session end.

---

## Session Start Protocol

At the beginning of EVERY session, read these files in order:

1. **PROJECT_SPEC.md** - Understand the architecture, schemas, API contracts
2. **AGENT_GUIDELINES.md** - This file (behavioral rules)
3. **TOOLS_AND_EXTENSIONS.md** - Verify all tools are available
4. **PROGRESS.md** - Understand current phase and completed work
5. **ARCHITECTURE_DECISIONS.md** - Review past technical decisions

**Checklist:**

- [ ] Read PROJECT_SPEC.md
- [ ] Read AGENT_GUIDELINES.md
- [ ] Verify tools from TOOLS_AND_EXTENSIONS.md
- [ ] Check PROGRESS.md for current phase
- [ ] Review ARCHITECTURE_DECISIONS.md for context

---

## Session End Protocol

At the end of EVERY session, update these files:

1. **CHANGELOG.md** - Add entry for completed work
2. **PROGRESS.md** - Update phase status and next steps
3. **Commit changes** with descriptive message

**Checklist:**

- [ ] Update CHANGELOG.md with session summary
- [ ] Update PROGRESS.md with current status
- [ ] Commit all working code
- [ ] Push to remote if appropriate

---

## Code Quality Standards

### 1. No AI Slop

**Definition:** AI slop includes:
- Over-commented code with obvious explanations
- Excessive whitespace or formatting inconsistencies
- Placeholder comments like "// TODO: implement this" without context
- Copy-pasted code with no adaptation to the specific use case
- Overly verbose variable names that don't add clarity

**Rules:**
- Write clean, self-documenting code with meaningful names
- Comment only when logic is non-obvious or requires context
- Remove all placeholder comments before committing
- Follow consistent formatting (Prettier, ESLint, etc.)

### 2. TypeScript Standards

- **Strict mode enabled** in all `tsconfig.json` files
- **No `any` types** unless absolutely necessary (document why)
- **Prefer interfaces over types** for object shapes
- **Use enums for fixed sets** (e.g., RunStatus, JobType, Platform)
- **Export types from `packages/config`** for sharing across apps

### 3. Database Standards

- **Always use parameterized queries** (prevent SQL injection)
- **All transforms must be idempotent** (use `ON CONFLICT DO UPDATE`)
- **Index all foreign keys** and frequently queried columns
- **Never hardcode connection strings** (use environment variables)
- **Test migrations locally** before applying to production

### 4. API Standards

- **Validate all inputs** before processing
- **Return appropriate HTTP status codes** (200, 202, 400, 401, 403, 500)
- **Use consistent error response format** (see ErrorPayload in PROJECT_SPEC.md)
- **Log all errors** with context (shop_id, run_id, task, etc.)
- **Implement rate limiting** for external API calls (respect provider limits)

### 5. Frontend Standards

- **Use server components by default** (Next.js App Router)
- **Client components only when needed** (interactivity, hooks)
- **Fetch data server-side** (avoid client-side data fetching for initial load)
- **Use environment variables** (`NEXT_PUBLIC_*` for client, plain for server)
- **Implement loading states** (Suspense, skeleton screens)
- **Handle errors gracefully** (error boundaries, toast notifications)

---

## Git Workflow Standards

### Branch Naming

- `main` - Production-ready code
- `develop` - Staging/integration branch
- `feature/*` - New features (e.g., `feature/shopify-sync`)
- `fix/*` - Bug fixes (e.g., `fix/order-upsert-conflict`)
- `docs/*` - Documentation updates (e.g., `docs/update-api-contract`)

### Commit Message Format

```
<type>: <short description>

<optional detailed description>

<optional footer: references, breaking changes>
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code restructuring without behavior change
- `docs:` - Documentation only
- `test:` - Adding or updating tests
- `chore:` - Tooling, dependencies, non-code changes

**Examples:**

```
feat: implement Shopify orders sync

- Add Shopify client for Bulk Operations API
- Create staging table for orders raw data
- Implement upsert transform to core_warehouse.orders

Closes #12
```

```
fix: prevent duplicate in-flight ETL jobs

Add partial unique index on etl_runs table to prevent
multiple QUEUED/IN_PROGRESS jobs for same shop+platform.

Refs: PROJECT_SPEC.md section 10.3
```

### Commit Frequency

- **Commit after each working feature** (e.g., one table migration, one API endpoint)
- **Do NOT wait until end of day** or end of phase
- **Commits should be atomic** (one logical change per commit)
- **Push to remote after major milestones** (e.g., phase completion)

### When to NOT Commit

- Code doesn't compile or has syntax errors
- Tests are failing (if tests exist for that code)
- Code has hardcoded secrets or credentials
- Work is incomplete and will break existing functionality

**Exception:** Use feature flags or WIP branches for long-running features.

---

## Testing Standards

### When to Test

- **Before committing** - Ensure code works as expected
- **After migrations** - Verify schema changes in local DB
- **Before deploying** - Run full test suite (if exists)
- **After API changes** - Test with curl/Postman/Thunder Client

### Testing Levels

1. **Unit Tests** - Test individual functions (transforms, utilities)
2. **Integration Tests** - Test API endpoints, database queries
3. **E2E Tests** - Test full sync workflow (seed → trigger → verify)

### Manual Testing Checklist

- [ ] Local environment works (`npm run dev`, `supabase start`)
- [ ] API returns expected responses (test with sample data)
- [ ] Database constraints work (try inserting invalid data)
- [ ] Error handling works (test with invalid inputs)
- [ ] Environment variables load correctly

---

## Documentation Standards

### When to Document

- **New architectural decisions** → Add to ARCHITECTURE_DECISIONS.md
- **New API endpoints** → Update PROJECT_SPEC.md section 10
- **New database tables** → Update PROJECT_SPEC.md section 4
- **Completed features** → Add to CHANGELOG.md
- **Phase changes** → Update PROGRESS.md

### Documentation Format

- Use clear, scannable headings (## Level 2, ### Level 3)
- Use tables for structured data (env vars, API endpoints, etc.)
- Use code blocks with language tags (```typescript, ```sql, ```bash)
- Link to official documentation where applicable
- Keep documentation up-to-date (do NOT let it drift from code)

### What NOT to Document

- Obvious implementation details (code should be self-documenting)
- Temporary decisions that will change soon
- Personal notes or TODOs (use GitHub Issues instead)

---

## Tool Usage Standards

### CLI Tools

- **Verify tools are installed** before starting work (see TOOLS_AND_EXTENSIONS.md)
- **Use CLIs for automation** (Vercel CLI, Supabase CLI, Railway CLI)
- **Do NOT manually click through dashboards** for repeatable tasks
- **Document CLI commands** for future reference

### Development Tools

- **Use TypeScript** for all new code
- **Use Prettier** for consistent formatting
- **Use ESLint** for code quality checks
- **Use Git hooks** (Husky) for pre-commit checks (if configured)

### External APIs

- **Always check rate limits** before making bulk requests
- **Implement exponential backoff** for retries
- **Log all API errors** with request context
- **Use test accounts** during development (not production data)

---

## Error Handling Standards

### Worker Errors

- **Catch all errors** at job level
- **Log error with context** (shop_id, run_id, platform, task)
- **Update etl_runs.error** with ErrorPayload JSON
- **Do NOT advance cursor** on failure
- **Do NOT retry automatically** (let cron re-trigger after investigation)

### API Errors

- **Return appropriate HTTP status** (400, 401, 403, 500)
- **Return consistent error format:**

```json
{
  "error": "Human-readable message",
  "code": "ERROR_CODE",
  "details": { /* optional */ }
}
```

- **Log errors server-side** (do NOT expose stack traces to client)

### Frontend Errors

- **Use error boundaries** (React)
- **Show user-friendly messages** (not raw error text)
- **Provide actionable next steps** (e.g., "Please try again" or "Contact support")
- **Log errors to monitoring service** (Sentry, LogRocket, etc.)

---

## Security Standards

### Secrets Management

- **NEVER commit secrets** to Git (use .env.local, .gitignore)
- **Use environment variables** for all secrets
- **Rotate secrets regularly** (at least quarterly)
- **Use different secrets** for dev, staging, production

### Authentication

- **Verify JWT in Edge Functions** (default behavior)
- **Use service role key only in worker** (never expose to client)
- **Validate user access to shop_id** before processing requests
- **Implement Row Level Security (RLS)** on sensitive tables

### SQL Injection Prevention

- **Always use parameterized queries** (e.g., `$1`, `$2` in Postgres)
- **NEVER concatenate user input** into SQL strings
- **Use ORMs/query builders** where appropriate (e.g., Kysely, Drizzle)

### XSS Prevention

- **Sanitize user input** before displaying
- **Use Content Security Policy (CSP)** headers
- **Use framework protections** (Next.js auto-escapes in JSX)

---

## Performance Standards

### Database

- **Index foreign keys** and frequently queried columns
- **Use EXPLAIN ANALYZE** to verify query plans
- **Promote views to MATERIALIZED VIEW** if slow (>1s)
- **Batch inserts** where possible (use `COPY` or multi-row `INSERT`)

### API

- **Keep Edge Functions fast** (<1s response time)
- **Offload heavy work to worker** (do NOT do transforms in Edge Functions)
- **Use caching** where appropriate (Redis, CDN)

### Frontend

- **Use server components** for data fetching (Next.js)
- **Implement pagination** for large datasets
- **Lazy load components** (React.lazy, dynamic imports)
- **Optimize images** (Next.js Image component)

---

## Communication Standards

### With User

- **Be clear and concise** (no fluff)
- **Provide actionable next steps** (do NOT leave user hanging)
- **Ask clarifying questions** if requirements are ambiguous
- **Confirm major decisions** before implementing (e.g., schema changes)

### In Code

- **Write self-documenting code** (clear variable/function names)
- **Comment non-obvious logic** (e.g., complex transforms, edge cases)
- **Link to PROJECT_SPEC.md** in code comments when implementing spec

### In Commits

- **Reference spec sections** (e.g., "Refs: PROJECT_SPEC.md section 4.2")
- **Link to issues** (e.g., "Closes #12")
- **Explain why, not what** (code shows what; commit message explains why)

---

## Anti-Patterns to Avoid

### 1. Endless Planning

- **Problem:** Spending hours planning without writing code
- **Solution:** Plan one phase at a time; execute; iterate

### 2. Premature Optimization

- **Problem:** Optimizing before knowing where bottlenecks are
- **Solution:** Build first, measure performance, then optimize

### 3. Over-Engineering

- **Problem:** Building complex abstractions for simple problems
- **Solution:** Start simple; refactor when patterns emerge

### 4. Copy-Paste Without Understanding

- **Problem:** Copying code from Stack Overflow without adapting
- **Solution:** Understand what the code does; adapt to your use case

### 5. Ignoring Official Documentation

- **Problem:** Making assumptions about API behavior
- **Solution:** Always check official docs first

### 6. Hardcoding Values

- **Problem:** Hardcoding URLs, secrets, configuration
- **Solution:** Use environment variables and configuration files

### 7. Not Testing Locally

- **Problem:** Deploying without testing
- **Solution:** Test locally first; deploy when confident

### 8. Letting Documentation Drift

- **Problem:** Code changes but docs don't
- **Solution:** Update docs in the same commit as code changes

---

## Troubleshooting Guide

### When Stuck

1. **Re-read PROJECT_SPEC.md** - Ensure you understand requirements
2. **Check official documentation** - Verify API usage
3. **Search error message** - Look for known issues
4. **Ask user for clarification** - If requirements are unclear
5. **Break problem into smaller steps** - Tackle one piece at a time

### Common Issues

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| `ECONNREFUSED` | Database not running | Start Supabase: `supabase start` |
| `401 Unauthorized` | Invalid JWT or missing auth | Check JWT is valid; verify header format |
| `ON CONFLICT` not working | Missing unique constraint | Add unique index on conflict column(s) |
| Slow queries | Missing indexes | Add indexes on foreign keys and WHERE clauses |
| Edge Function timeout | Too much work in function | Move heavy work to worker |

---

## Quality Checklist

Before marking any feature as complete:

- [ ] Code compiles without errors
- [ ] Code follows TypeScript standards (strict mode, no `any`)
- [ ] Database queries use parameterized inputs (no SQL injection)
- [ ] Environment variables used (no hardcoded secrets)
- [ ] Error handling implemented (try/catch, proper status codes)
- [ ] Tested locally (manual or automated tests)
- [ ] Documentation updated (if applicable)
- [ ] Committed with descriptive message
- [ ] CHANGELOG.md updated
- [ ] PROGRESS.md updated

---

## References

- [PROJECT_SPEC.md](./PROJECT_SPEC.md) - Technical specification
- [TOOLS_AND_EXTENSIONS.md](./TOOLS_AND_EXTENSIONS.md) - Required tooling
- [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md) - Technical decisions
- [DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md) - Git and deployment processes
- [CHANGELOG.md](./CHANGELOG.md) - Completed work history
- [PROGRESS.md](./PROGRESS.md) - Current phase and status

---

**End of AGENT_GUIDELINES.md**
