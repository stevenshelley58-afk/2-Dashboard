# Railway Deployment Instructions

## Prerequisites

- Railway account (https://railway.app)
- GitHub repo: `stevenshelley58-afk/2-Dashboard`
- Supabase project ID: `yxbthgncjpimkslputso`

## Step 1: Create Railway Project

1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Select `stevenshelley58-afk/2-Dashboard`
4. Railway will detect the monorepo structure

## Step 2: Configure Service

**Build Configuration:**
- Root Directory: `.` (monorepo root)
- Dockerfile Path: `apps/worker/Dockerfile`
- Builder: DOCKERFILE

**Deploy Configuration:**
- Start Command: `node dist/index.js` (defined in Dockerfile)
- Region: Choose closest to `ap-southeast-2` (Sydney) for lowest latency to Supabase

## Step 3: Set Environment Variables

In Railway Dashboard → Service → Variables, add:

```
SUPABASE_URL=https://yxbthgncjpimkslputso.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your_supabase_service_role_key>
SHOPIFY_ADMIN_ACCESS_TOKEN=<your_shopify_access_token>
SHOPIFY_SHOP_DOMAIN=<your_store>.myshopify.com
SHOPIFY_API_VERSION=2025-01
```

**Get these values from:**
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Dashboard → Project Settings → API → service_role key
- `SHOPIFY_ADMIN_ACCESS_TOKEN`: Shopify Admin → Apps → Your app → API credentials
- `SHOPIFY_SHOP_DOMAIN`: Your Shopify store domain (e.g., `yourstore.myshopify.com`)

## Step 4: Deploy

1. Click "Deploy" in Railway Dashboard
2. Watch build logs for any errors
3. Once deployed, check deployment logs for:
   - `[Worker] Starting ETL worker...`
   - `[Worker] Polling for queued jobs...`

## Step 5: Test End-to-End

### Trigger a sync job via Supabase Edge Function:

```bash
curl -X POST https://yxbthgncjpimkslputso.supabase.co/functions/v1/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "shop_id": "sh_test",
    "job_type": "INCREMENTAL",
    "platform": "SHOPIFY"
  }'
```

**Expected response:**
```json
{
  "run_id": "uuid-here"
}
```

### Check Railway logs:
- Should see worker pick up the job
- Process Shopify bulk operation
- Transform records to warehouse
- Complete successfully

### Verify in Supabase:
```sql
-- Check job status
SELECT * FROM core_warehouse.etl_runs ORDER BY created_at DESC LIMIT 5;

-- Check synced orders
SELECT COUNT(*) FROM core_warehouse.orders WHERE shop_id = 'sh_test';
```

## Architecture Notes

**Why this works without connection string issues:**

1. **No direct database connections** - Worker uses `@supabase/supabase-js` HTTP API
2. **RPC functions** - All database operations via Supabase RPC functions
3. **No PG* environment variables** - No Railway PostgreSQL service to inject variables
4. **Security** - DB credentials never exposed, all access via RPC with `SECURITY DEFINER`

**Performance:**
- HTTP API adds ~10-50ms overhead per RPC call
- Bulk operations (insert/transform) handle thousands of records in single call
- For this use case (batch ETL jobs), HTTP API is fine
- For high-frequency operations, consider direct connection with PG* cleanup

## Troubleshooting

### Build fails
- Check Dockerfile copies workspace files correctly
- Verify `pnpm-workspace.yaml` is in root
- Check build logs for TypeScript errors

### Worker can't connect to Supabase
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- Check Railway region is not blocking Supabase
- Review deployment logs for connection errors

### Worker doesn't process jobs
- Check if RPC functions exist: Run migration `20251105000000_add_worker_rpc_functions.sql`
- Verify job is in `QUEUED` status in `core_warehouse.etl_runs`
- Check Railway logs for polling errors

### Shopify API errors
- Verify `SHOPIFY_ADMIN_ACCESS_TOKEN` has correct scopes
- Check `SHOPIFY_SHOP_DOMAIN` is correct format (no https://)
- Review Shopify API rate limits

## Next Steps

1. **Set up cron trigger** - Schedule automatic syncs (Phase 7)
2. **Add other platforms** - Meta, GA4, Klaviyo integrations (Phase 5)
3. **Build frontend dashboard** - Next.js app on Vercel (Phase 6)
4. **Production hardening** - Error handling, monitoring, retries (Phase 8)

## Success Indicators

✅ Railway build succeeds
✅ Worker starts without errors
✅ Worker polls for jobs
✅ Shopify sync completes successfully
✅ Data appears in `core_warehouse.orders` table
✅ Job status changes from `QUEUED` → `IN_PROGRESS` → `SUCCEEDED`

---

**Deployment completed:** [Date]
**Worker version:** 0.0.1
**Architecture:** Supabase RPC + HTTP API
