# Deployment Guide

## Prerequisites

1. **Supabase CLI** installed and logged in: `supabase login`
2. **Supabase project linked**: `supabase link --project-ref <your-project-ref>`
3. **Railway CLI** installed (for worker deployment)
4. **Vercel CLI** installed (for frontend deployment)

## Step 1: Apply Database Migrations

### Option A: Via Supabase Dashboard (Recommended if CLI fails)

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the migrations in order:
   - Copy contents of `supabase/migrations/20260101000000_reset_for_rebuild.sql`
   - Copy contents of `supabase/migrations/20260101010000_core_schema.sql`
4. Execute each migration

### Option B: Via CLI

```bash
supabase db push
```

## Step 2: Deploy Edge Functions

### Windows (PowerShell)

```powershell
.\scripts\deploy-edge-functions.ps1
```

### Linux/Mac

```bash
chmod +x scripts/deploy-edge-functions.sh
./scripts/deploy-edge-functions.sh
```

### Manual (All Platforms)

```bash
supabase functions deploy shops
supabase functions deploy "shops/[shopId]/sync-status"
supabase functions deploy "shops/[shopId]/metrics"
supabase functions deploy "shops/[shopId]/sync"
supabase functions deploy "shops/[shopId]/platforms/META/connect"
```

## Step 3: Deploy Worker to Railway

### Initial Setup

1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Link to project: `railway link` (or create new: `railway init`)

### Set Environment Variables

```bash
railway variables set SUPABASE_URL=<your-supabase-url>
railway variables set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
railway variables set SUPABASE_DB_URL=<your-db-connection-string>
railway variables set SHOPIFY_API_VERSION=2026-01
railway variables set MAX_STALENESS_MINUTES=15
```

### Deploy

```bash
cd apps/worker
railway up
```

Or use Railway dashboard to connect your GitHub repo and auto-deploy.

## Step 4: Deploy Frontend to Vercel

### Via CLI

```bash
cd apps/web
vercel
```

Follow prompts to link project or create new.

### Set Environment Variables in Vercel Dashboard

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key

### Via GitHub Integration

1. Push code to GitHub
2. Import project in Vercel dashboard
3. Set environment variables
4. Deploy

## Step 5: Seed Credentials (One-time)

Create a `.env` file in `apps/worker`:

```env
SHOP_ID=your-shop-id
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_...
SHOPIFY_SHOP_DOMAIN=yourstore.myshopify.com
META_ACCESS_TOKEN=EAAG...
META_AD_ACCOUNT_ID=act_1234567890
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Then run:

```bash
cd apps/worker
pnpm tsx src/scripts/seed-credentials.ts
```

## Verification Checklist

- [ ] Database migrations applied (check Supabase dashboard)
- [ ] Edge Functions deployed (check Supabase Functions dashboard)
- [ ] Worker deployed and running (check Railway logs)
- [ ] Frontend deployed (visit Vercel URL)
- [ ] Credentials seeded (check `shop_credentials` table)
- [ ] Test sync job created (check `sync_jobs` table)

## Troubleshooting

### Edge Functions not deploying

- Ensure you're logged in: `supabase login`
- Check project is linked: `supabase projects list`
- Verify function paths match directory structure

### Worker not connecting to database

- Verify `SUPABASE_DB_URL` uses connection pooler format
- Check Railway logs: `railway logs`
- Ensure service role key has correct permissions

### Frontend auth issues

- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
- Check browser console for auth errors
- Ensure RLS policies allow user access to `user_shops` table

