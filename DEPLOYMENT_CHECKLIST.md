# Deployment Checklist

## Phase 1: Railway Worker Deployment

### Prerequisites
- [x] GitHub repo: `stevenshelley58-afk/2-Dashboard`
- [x] Railway account
- [x] Shopify credentials saved

### Steps

**1. Create Railway Project**
- [ ] Go to https://railway.app/new
- [ ] Click "Deploy from GitHub repo"
- [ ] Select `stevenshelley58-afk/2-Dashboard`
- [ ] Railway detects monorepo

**2. Configure Build Settings**
- [ ] Root Directory: `.` (leave blank for monorepo root)
- [ ] Dockerfile Path: `apps/worker/Dockerfile`
- [ ] Builder: DOCKERFILE (not NIXPACKS)

**3. Set Environment Variables**
```
SUPABASE_URL=https://yxbthgncjpimkslputso.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<from_supabase_dashboard>
SHOPIFY_ADMIN_ACCESS_TOKEN=<your_shopify_token>
SHOPIFY_SHOP_DOMAIN=<yourstore>.myshopify.com
SHOPIFY_API_VERSION=2025-01
```

**4. Deploy**
- [ ] Click "Deploy"
- [ ] Watch build logs (should see Docker build steps)
- [ ] Check deployment logs for startup messages

**5. Verify Worker**
Check logs for:
```
[Worker] Starting ETL worker...
[Worker] Polling for queued jobs...
[Worker] No queued jobs found
[Worker] Exiting
```

---

## Phase 2: Test End-to-End Pipeline

### Trigger a Sync Job

**Option A: Via Supabase Dashboard SQL Editor**
```sql
-- Insert a QUEUED job
INSERT INTO core_warehouse.etl_runs (shop_id, status, job_type, platform)
VALUES ('sh_test', 'QUEUED', 'INCREMENTAL', 'SHOPIFY');
```

**Option B: Via Edge Function (once deployed)**
```bash
curl -X POST https://yxbthgncjpimkslputso.supabase.co/functions/v1/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -d '{
    "shop_id": "sh_test",
    "job_type": "INCREMENTAL",
    "platform": "SHOPIFY"
  }'
```

### Watch Railway Logs

Should see:
```
[Worker] Starting ETL worker...
[Worker] Polling for queued jobs...
[Worker] Processing job <uuid>: SHOPIFY INCREMENTAL
[Shopify] Starting INCREMENTAL sync for shop sh_test
[Shopify] Bulk operation created: gid://shopify/BulkOperation/...
[Shopify] Bulk operation status: RUNNING
[Shopify] Bulk operation status: COMPLETED
[Shopify] Bulk operation complete, downloading...
[Shopify] Downloaded X records
[Shopify] Transformed X records to warehouse
[Worker] Job <uuid> completed successfully (X records)
[Worker] Exiting
```

### Verify in Supabase

```sql
-- Check job completed successfully
SELECT * FROM core_warehouse.etl_runs
WHERE shop_id = 'sh_test'
ORDER BY created_at DESC
LIMIT 5;

-- Check orders synced
SELECT COUNT(*) FROM core_warehouse.orders
WHERE shop_id = 'sh_test';

-- Check latest orders
SELECT * FROM core_warehouse.orders
WHERE shop_id = 'sh_test'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Phase 3: Vercel Frontend (Next.js)

**Not started yet - will do after Railway worker is verified**

---

## Phase 4: Set Up Cron Schedule

**Option A: Railway Cron (Built-in)**
- Railway doesn't have native cron
- Need external trigger

**Option B: Supabase pg_cron Extension**
```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule sync every 15 minutes
SELECT cron.schedule(
  'shopify-incremental-sync',
  '*/15 * * * *',
  $$
  INSERT INTO core_warehouse.etl_runs (shop_id, status, job_type, platform)
  VALUES ('sh_test', 'QUEUED', 'INCREMENTAL', 'SHOPIFY');
  $$
);
```

**Option C: External Cron Service**
- Use cron-job.org or EasyCron
- Hit `/sync` Edge Function every 15 minutes

---

## Troubleshooting

### Worker Not Processing Jobs

**Check:**
1. Railway logs - is worker starting?
2. Environment variables - are they set correctly?
3. Supabase connection - can worker connect?
4. Job status - is job actually QUEUED in database?

**Common Issues:**
- Missing environment variables → Check Railway Variables tab
- Connection timeout → Supabase IPv4 add-on enabled?
- Build failed → Check Dockerfile paths

### Shopify Sync Fails

**Check:**
1. Shopify credentials valid?
2. Access token has correct scopes (read_orders, read_products)?
3. Shop domain correct format (no https://)?
4. Shopify API rate limits?

**Common Issues:**
- 401 Unauthorized → Invalid access token
- 403 Forbidden → Missing API scopes
- 429 Too Many Requests → Rate limited, wait and retry

### RPC Function Errors

**Check:**
1. Migrations applied? `supabase db push`
2. Function exists? Check Supabase Dashboard → Database → Functions
3. Correct parameters? Check function signature

**Common Issues:**
- "function does not exist" → Migration not applied
- "permission denied" → RLS policy blocking (shouldn't happen with service_role key)

---

## Current Status

- [x] Phase 0-4: Backend complete (Shopify working locally)
- [ ] Phase 1: Railway worker deployment
- [ ] Phase 2: End-to-end test
- [ ] Phase 3: Vercel frontend
- [ ] Phase 4: Cron schedule

**Next Action:** Deploy worker to Railway following Phase 1 steps above.
