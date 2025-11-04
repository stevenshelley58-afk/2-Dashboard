# E-Commerce Dashboard

Analytics dashboard for e-commerce stores (Shopify, Meta, GA4, Klaviyo).

## Quick Start

```bash
# Install dependencies
pnpm install

# Start Supabase local
supabase start

# Run frontend
cd apps/web && pnpm dev

# Run worker
cd apps/worker && pnpm dev
```

## Documentation

- [PROJECT_SPEC.md](./PROJECT_SPEC.md) - Architecture
- [PROGRESS.md](./PROGRESS.md) - Current status
- [DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md) - Git workflow

## Stack

- Frontend: Next.js 14+ (Vercel)
- Worker: Node.js (Railway)
- Database: Supabase (Postgres)
- APIs: Shopify, Meta, GA4, Klaviyo
