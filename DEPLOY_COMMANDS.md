# Quick Deployment Commands

## One-Line Commands

### Deploy Everything (Edge Functions)

**Windows (PowerShell):**
```powershell
pnpm deploy:edge
```

**Linux/Mac:**
```bash
pnpm deploy:edge
```

**Or use scripts:**
```bash
# Windows
.\scripts\deploy-edge-functions.ps1

# Linux/Mac
chmod +x scripts/deploy-edge-functions.sh
./scripts/deploy-edge-functions.sh
```

### Deploy Worker to Railway

```bash
cd apps/worker
railway up
```

Or from root:
```bash
pnpm deploy:worker
```

### Deploy Frontend to Vercel

```bash
cd apps/web
vercel --prod
```

Or from root:
```bash
pnpm deploy:web
```

## Step-by-Step Deployment

### 1. Database Migrations

**Via Supabase Dashboard (Recommended):**
- Go to SQL Editor
- Run `supabase/migrations/20260101000000_reset_for_rebuild.sql`
- Run `supabase/migrations/20260101010000_core_schema.sql`

**Via CLI:**
```bash
supabase db push
```

### 2. Edge Functions

```bash
# All at once
pnpm deploy:edge

# Or individually
supabase functions deploy shops
supabase functions deploy "shops/[shopId]/sync-status"
supabase functions deploy "shops/[shopId]/metrics"
supabase functions deploy "shops/[shopId]/sync"
supabase functions deploy "shops/[shopId]/platforms/META/connect"
```

### 3. Worker (Railway)

**First time setup:**
```bash
railway login
railway link  # or railway init
```

**Set environment variables:**
```bash
railway variables set SUPABASE_URL=https://xxx.supabase.co
railway variables set SUPABASE_SERVICE_ROLE_KEY=eyJ...
railway variables set SUPABASE_DB_URL=postgresql://...
railway variables set SHOPIFY_API_VERSION=2026-01
railway variables set MAX_STALENESS_MINUTES=15
```

**Deploy:**
```bash
cd apps/worker
railway up
```

### 4. Frontend (Vercel)

**First time setup:**
```bash
cd apps/web
vercel login
vercel link  # or vercel
```

**Set environment variables in Vercel dashboard:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Deploy:**
```bash
vercel --prod
```

### 5. Seed Credentials

Create `apps/worker/.env`:
```env
SHOP_ID=your-shop-id
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_...
SHOPIFY_SHOP_DOMAIN=yourstore.myshopify.com
META_ACCESS_TOKEN=EAAG...
META_AD_ACCOUNT_ID=act_1234567890
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Run:
```bash
cd apps/worker
pnpm tsx src/scripts/seed-credentials.ts
```

## Verify Deployment

1. **Database:** Check Supabase dashboard → Table Editor
2. **Edge Functions:** Check Supabase dashboard → Edge Functions
3. **Worker:** Check Railway dashboard → Logs
4. **Frontend:** Visit Vercel deployment URL
5. **Sync Jobs:** Check `core_warehouse.sync_jobs` table

## Troubleshooting

### Edge Functions 404
- Verify function names match directory structure
- Check `supabase/config.toml` has function configs

### Worker not starting
- Check Railway logs: `railway logs`
- Verify all env vars are set
- Check `SUPABASE_DB_URL` format (use pooler URL)

### Frontend auth errors
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Check browser console
- Ensure RLS policies allow access

