# 🚀 Trigger Meta Data Fetch RIGHT NOW

## Current Status

✅ You have these Railway variables:
- `META_ACCESS_TOKEN` - ✅ Set
- `META_AD_ACCOUNT_ID` - ✅ Set (correct format without `act_` prefix)
- `META_API_VERSION` - ✅ Set to v18.0

❌ **MISSING:** `META_USE_COMPREHENSIVE=true`

Without this variable, your worker uses the old basic Meta client (just spend data), not the comprehensive client (all metadata, breakdowns, assets).

---

## Step 1: Add Missing Variable (30 seconds)

Railway Dashboard → Your Worker → Variables → Add:

```
Variable Name: META_USE_COMPREHENSIVE
Value: true
```

Railway will auto-redeploy (takes ~2 minutes).

---

## Step 2: Trigger Meta Job (30 seconds)

Supabase Dashboard → SQL Editor → Paste and Run:

```sql
-- Trigger comprehensive Meta data fetch (last 90 days)
INSERT INTO core_warehouse.etl_runs (shop_id, status, job_type, platform)
VALUES ('sh_test', 'QUEUED', 'HISTORICAL', 'META')
RETURNING id, platform, job_type, status, created_at;
```

Copy the job ID from the result.

---

## Step 3: Watch Railway Logs (5-10 minutes)

Railway → Worker → Deployments → Latest → View Logs

**Expected output:**

```
[Worker] Polling for queued jobs...
[Worker] Processing job <uuid>: META HISTORICAL
[Meta Comprehensive] Starting HISTORICAL sync for shop sh_test
[Meta] Step 1: Fetching entity hierarchy...
[Meta] Fetched X campaigns
[Meta] Fetched X ad sets
[Meta] Fetched X ads
[Meta] Fetching X unique creatives
[Meta] Step 2: Fetching insights...
[Meta] Fetching campaign-level insights from YYYY-MM-DD to YYYY-MM-DD
[Meta] Fetching campaign-level age/gender breakdown...
[Meta] Fetching campaign-level device breakdown...
[Meta] Fetching campaign-level geo breakdown...
[Meta] Fetching adset-level insights...
[Meta] Fetching ad-level insights...
[Meta] Step 3: Downloading creative assets...
[Meta Comprehensive] Sync complete: { entities: X, insights: X, assets: X }
[Worker] Job <uuid> completed successfully
```

**If you see errors:**
- "Invalid OAuth token" → Token expired, regenerate at https://developers.facebook.com/tools/explorer
- "Unsupported get request" → Account ID issue, verify in Meta Ads Manager
- Other error → Copy full error message and check troubleshooting section

---

## Step 4: Verify Your Data (30 seconds)

Supabase SQL Editor:

```sql
-- Quick status check
SELECT 
  'Campaigns' as entity, 
  COUNT(*) as count,
  MAX(updated_at) as last_updated
FROM core_warehouse.meta_campaigns
UNION ALL
SELECT 'Ad Sets', COUNT(*), MAX(updated_at) FROM core_warehouse.meta_adsets
UNION ALL
SELECT 'Ads', COUNT(*), MAX(updated_at) FROM core_warehouse.meta_ads
UNION ALL
SELECT 'Creatives', COUNT(*), MAX(updated_at) FROM core_warehouse.meta_adcreatives
UNION ALL
SELECT 'Campaign Insights (days)', COUNT(DISTINCT date), MAX(updated_at) FROM core_warehouse.meta_insights_campaign;

-- See your campaign performance
SELECT 
  c.name as campaign,
  c.status,
  c.objective,
  COUNT(DISTINCT i.date) as days_of_data,
  SUM(i.spend) as total_spend,
  SUM(i.impressions) as total_impressions,
  SUM(i.clicks) as total_clicks,
  SUM(i.purchase) as total_purchases,
  SUM(i.purchase_value) as total_revenue,
  CASE 
    WHEN SUM(i.spend) > 0 
    THEN ROUND((SUM(i.purchase_value) / SUM(i.spend))::numeric, 2)
    ELSE NULL 
  END as roas
FROM core_warehouse.meta_campaigns c
LEFT JOIN core_warehouse.meta_insights_campaign i ON i.campaign_id = c.campaign_id
GROUP BY c.name, c.status, c.objective
ORDER BY total_spend DESC NULLS LAST;

-- Check age/gender breakdown
SELECT 
  age,
  gender,
  COUNT(*) as days,
  SUM(spend) as total_spend,
  SUM(impressions) as impressions,
  SUM(purchase) as purchases,
  SUM(purchase_value) as revenue
FROM core_warehouse.meta_insights_age_gender
GROUP BY age, gender
ORDER BY total_spend DESC;

-- Check device breakdown
SELECT 
  device_platform,
  publisher_platform,
  COUNT(*) as days,
  SUM(spend) as total_spend,
  SUM(impressions) as impressions,
  SUM(purchase) as purchases
FROM core_warehouse.meta_insights_device
GROUP BY device_platform, publisher_platform
ORDER BY total_spend DESC;
```

---

## What You'll See

### If Job Succeeds ✅

**In Railway Logs:**
- "Sync complete: { entities: X, insights: Y, assets: Z }"
- "Job completed successfully"

**In Supabase:**
- Campaigns, ad sets, ads, creatives populated
- Daily insights with spend, impressions, clicks, conversions
- Breakdowns by age/gender, device, geography

### If Job Fails ❌

**Check Railway logs for error message:**

| Error | Solution |
|-------|----------|
| "Invalid OAuth access token" | Token expired. Regenerate at [Graph API Explorer](https://developers.facebook.com/tools/explorer) with `ads_read` + `read_insights` permissions |
| "Unsupported get request" | Account ID issue. Verify at Meta Ads Manager URL |
| "(#100) Permissions error" | Token missing permissions. Regenerate with correct scopes |
| "ENOTFOUND graph.facebook.com" | Network issue, retry |
| Transformation error | Check Supabase RPC functions are deployed |

---

## After Success

### Set Up Daily Automatic Sync

Run this ONCE in Supabase SQL Editor:

```sql
-- Schedule daily Meta sync at 6 AM UTC
SELECT cron.schedule(
  'meta-daily-sync',
  '0 6 * * *',
  $$
  INSERT INTO core_warehouse.etl_runs (shop_id, status, job_type, platform)
  VALUES ('sh_test', 'QUEUED', 'INCREMENTAL', 'META');
  $$
);

-- Verify cron job created
SELECT * FROM cron.job WHERE jobname = 'meta-daily-sync';
```

**INCREMENTAL** syncs fetch last 7 days (to catch delayed conversions).

---

## Debug Commands

```sql
-- Check job status
SELECT 
  id,
  platform,
  job_type,
  status,
  records_synced,
  created_at,
  started_at,
  completed_at,
  error->>'message' as error_message
FROM core_warehouse.etl_runs
WHERE platform = 'META'
ORDER BY created_at DESC
LIMIT 5;

-- Check staging data (raw API responses)
SELECT 
  entity_type,
  COUNT(*) as count,
  MAX(created_at) as last_received
FROM staging_ingest.meta_entities_raw
GROUP BY entity_type;

-- Check if transformations ran
SELECT COUNT(*) FROM core_warehouse.meta_campaigns;
SELECT COUNT(*) FROM staging_ingest.meta_entities_raw WHERE entity_type = 'campaign';
-- If staging has data but warehouse doesn't, transformation failed
```

---

## Timeline

- **Add variable:** 30 seconds
- **Railway redeploy:** 2 minutes
- **Trigger job:** 30 seconds
- **Meta API fetch:** 5-10 minutes (depends on data volume)
- **Total:** ~8-13 minutes

---

## Ready?

1. ✅ Add `META_USE_COMPREHENSIVE=true` to Railway
2. ✅ Wait for redeploy (watch Railway dashboard)
3. ✅ Run the SQL to trigger the job
4. ✅ Watch logs and verify data

**Your comprehensive Meta data is 1 environment variable away!** 🚀
