# Deploy to Railway Right Now

## Step 1: Create Railway Project (2 minutes)

1. Go to https://railway.app/new
2. Click **"Deploy from GitHub repo"**
3. Select **`stevenshelley58-afk/2-Dashboard`**
4. Railway will auto-detect the monorepo

## Step 2: Configure Service (1 minute)

In the Railway dashboard:

**Build Settings:**
- Click on your service
- Go to **Settings** tab
- Set **Root Directory**: `.` (just a dot, or leave blank)
- Set **Dockerfile Path**: `apps/worker/Dockerfile`

**Deploy Settings:**
- Builder should auto-detect as **DOCKERFILE** ✅

## Step 3: Add Environment Variables (1 minute)

Click **Variables** tab and add these:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | `https://yxbthgncjpimkslputso.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Get from Supabase Dashboard → Settings → API |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | Get from `.env` file locally |
| `SHOPIFY_SHOP_DOMAIN` | Get from `.env` file locally |
| `SHOPIFY_API_VERSION` | `2025-01` |

**Tip:** Copy values from your local `apps/worker/.env` file

## Step 4: Deploy (2 minutes)

Click **Deploy** (or it may auto-deploy after adding variables)

Watch the **Deployments** tab:
- Build logs should show Docker steps
- Should complete in ~2 minutes

## Step 5: Verify Worker Started (30 seconds)

Go to **Deployments** → Click latest deployment → View Logs

Should see:
```
[Worker] Starting ETL worker...
[Worker] Polling for queued jobs...
[Worker] No queued jobs found
[Worker] Exiting
```

✅ **If you see this, deployment succeeded!**

## Step 6: Test with Real Job (1 minute)

Open Supabase Dashboard → SQL Editor → Run:

```sql
INSERT INTO core_warehouse.etl_runs (shop_id, status, job_type, platform)
VALUES ('sh_test', 'QUEUED', 'INCREMENTAL', 'SHOPIFY');
```

## Step 7: Watch Railway Logs (5-10 minutes)

Railway will auto-detect the new job and process it:

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

## Step 8: Verify Data in Supabase (30 seconds)

Back in Supabase SQL Editor:

```sql
-- Check job completed
SELECT * FROM core_warehouse.etl_runs
ORDER BY created_at DESC LIMIT 5;

-- Count orders synced
SELECT COUNT(*) FROM core_warehouse.orders
WHERE shop_id = 'sh_test';
```

---

## Expected Results

✅ Railway build succeeds
✅ Worker starts and polls for jobs
✅ Job status changes: QUEUED → IN_PROGRESS → SUCCEEDED
✅ Orders appear in `core_warehouse.orders` table

---

## If Something Goes Wrong

**Build fails:**
- Check Dockerfile path is correct: `apps/worker/Dockerfile`
- Check root directory is `.` or blank
- View build logs for error details

**Worker crashes:**
- Check all environment variables are set
- Check Railway deployment logs for error message
- Most likely: Missing environment variable

**Job stays QUEUED:**
- Railway may have stopped after first run
- Manually trigger: Insert another QUEUED job
- Or set up cron (see DEPLOYMENT_CHECKLIST.md)

---

## Why RPC Will Work

✅ Already tested locally with 2,994 orders
✅ Uses Supabase HTTP API (no direct database connection)
✅ No IPv4/IPv6 issues
✅ No PG* environment variable conflicts
✅ All RPC functions deployed and working

**The architecture is solid. Deploy with confidence!**

---

Total time: ~7-15 minutes (including Shopify sync)
