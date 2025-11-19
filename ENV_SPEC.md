# ENV_SPEC.md – Environment Variables (Single Source of Truth)

| Name | Used In | Description | Example | Secret? |
|------|---------|-------------|---------|---------|
| `SUPABASE_URL` | worker, edge, web (server) | Supabase project URL | `https://xyzcompany.supabase.co` | Yes |
| `SUPABASE_ANON_KEY` | web (client + server) | Public anon key for frontend | `eyJhbGciOiJI...` | Yes (public scope, still protect) |
| `SUPABASE_SERVICE_ROLE_KEY` | worker, edge | Service-role key for DB access + RLS bypass | `eyJhbGciOiJIUzI1NiIsInR5cCI...` | Yes |
| `SUPABASE_DB_URL` | worker | Direct Postgres connection string with `?sslmode=require` | `postgresql://postgres...supabase.co:5432/postgres?sslmode=require` | Yes |
| `SUPABASE_JWT_SECRET` | worker, edge | JWT secret for verifying Supabase auth tokens if needed | `super-secret` | Yes |
| `SHOPIFY_API_VERSION` | worker | Shopify Admin GraphQL version lock | `2026-01` | No |
| `SHOPIFY_ADMIN_ACCESS_TOKEN_<SHOP_ID>` | local seed script only | Temporary env var to seed per-shop tokens into DB | `shpat_...` | Yes |
| `META_ACCESS_TOKEN_<SHOP_ID>` | local seed script only | Temporary env var for Meta marketing API token before seeding into DB | `EAAG...` | Yes |
| `META_AD_ACCOUNT_ID_<SHOP_ID>` | worker seed script metadata | Meta ad account id for given shop (stored in `shop_credentials.metadata`) | `act_1234567890` | No |
| `MAX_STALENESS_MINUTES` | worker, api | Maximum allowed time since `last_success_at` before auto-enqueuing incremental job | `15` | No |
| `NEXT_PUBLIC_SUPABASE_URL` | web client | Mirrors `SUPABASE_URL` for frontend | `https://xyzcompany.supabase.co` | No (but keep consistent) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web client | Mirrors `SUPABASE_ANON_KEY` for frontend | `eyJhbGciOiJI...` | Yes (public scope) |

### Management Rules

1. **Authoritative copy:** this file. Update it first when adding/removing variables.
2. **Templates:** maintain `.env.local.example` (root + `apps/web/`, `apps/worker/`) mirroring this table with placeholder values. No real secrets committed.
3. **Real secrets live only in:**
   - Supabase project settings.
   - Vercel project env vars (frontend-safe only).
   - Railway service env vars (server-only secrets).
4. **Per-shop tokens:** never stay in env vars. Use the seed script to insert tokens into `shop_credentials`, then remove local env entries.
5. **Rotation:** when rotating keys, update Supabase/Vercel/Railway first, then refresh local `.env` files, then update this spec if names change.***

