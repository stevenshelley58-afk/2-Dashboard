# Meta Client Comparison - What You Just Got vs What You Should Get

## ❌ What Just Ran (Basic Client)

Your Railway logs show:
```
[Meta] Starting HISTORICAL sync for shop sh_test
[Meta] Fetching insights from 2025-08-14 to 2025-11-12
[Meta] Fetched 25 days of insights
[Meta] Transformed 25 records to warehouse
[Worker] Job completed successfully (25 records)
```

**This is the OLD basic Meta client.** It only fetches:
- Daily aggregated spend/impressions/clicks
- No campaign names
- No ad sets
- No ads
- No creatives
- No breakdowns

---

## ✅ What SHOULD Run (Comprehensive Client)

When `META_USE_COMPREHENSIVE=true` is set, logs should look like:

```
[Meta Comprehensive] Starting HISTORICAL sync for shop sh_test
[Meta] Step 1: Fetching entity hierarchy...
[Meta] Fetched 5 campaigns
[Meta] Fetched 12 ad sets
[Meta] Fetched 23 ads
[Meta] Fetching 18 unique creatives
[Meta] Step 2: Fetching insights...
[Meta] Fetching campaign-level insights from 2025-08-14 to 2025-11-12
[Meta] Fetching campaign-level age/gender breakdown...
[Meta] Fetching campaign-level device breakdown...
[Meta] Fetching campaign-level geo breakdown...
[Meta] Fetching adset-level insights...
[Meta] Fetching ad-level insights...
[Meta] Step 3: Downloading creative assets...
[Meta] Downloading 15 images...
[Meta Comprehensive] Sync complete: { entities: 58, insights: 234, assets: 15 }
[Worker] Job completed successfully (307 records)
```

**Notice the differences:**
- ✅ Says "[Meta Comprehensive]" not "[Meta]"
- ✅ Shows "Step 1", "Step 2", "Step 3"
- ✅ Lists campaigns, ad sets, ads, creatives
- ✅ Shows breakdown types
- ✅ Much higher record count (307 vs 25)

---

## 🔍 Why It Used the Basic Client

**Reason:** `META_USE_COMPREHENSIVE=true` is either:
1. Not added to Railway yet
2. Added but Railway hasn't redeployed yet
3. Added but with wrong syntax (must be lowercase `true`, not `True` or `TRUE`)

---

## 🚀 Fix It Now

### Step 1: Verify Railway Variable

Go to Railway Dashboard → Your Worker Service → **Variables** tab

Check if you see:
```
META_USE_COMPREHENSIVE = true
```

**If missing:** Add it now
**If present:** Check the value is exactly `true` (lowercase)

### Step 2: Force Redeploy

After adding/verifying the variable:
- Railway → Your Worker Service → **Deployments** tab
- Click **Redeploy** on the latest deployment
- OR just wait 30 seconds, Railway should auto-redeploy

### Step 3: Wait for Deployment

Watch the deployment status. When it says "Deployed", check the logs to confirm worker restarted:
```
[Worker] Starting ETL worker...
[Worker] Polling every 30 seconds...
```

### Step 4: Trigger New Job

Supabase SQL Editor:

```sql
-- Delete the old basic data first (optional but recommended)
DELETE FROM core_warehouse.fact_marketing_daily WHERE platform = 'META';

-- Trigger new comprehensive job
INSERT INTO core_warehouse.etl_runs (shop_id, status, job_type, platform)
VALUES ('sh_test', 'QUEUED', 'HISTORICAL', 'META')
RETURNING id, created_at;
```

### Step 5: Watch for Comprehensive Logs

Railway logs should now show:
```
[Meta Comprehensive] Starting HISTORICAL sync  ← KEY INDICATOR
[Meta] Step 1: Fetching entity hierarchy...    ← NEW
[Meta] Fetched X campaigns                      ← NEW
[Meta] Fetched X ad sets                        ← NEW
```

---

## 🔬 How to Check What Data You Currently Have

Run in Supabase SQL Editor:

```sql
-- Check basic data (from old client)
SELECT 
  'fact_marketing_daily' as table_name,
  COUNT(*) as records,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM core_warehouse.fact_marketing_daily
WHERE platform = 'META';

-- Check comprehensive data (from new client)
SELECT 
  'meta_campaigns' as table_name,
  COUNT(*) as records
FROM core_warehouse.meta_campaigns
UNION ALL
SELECT 'meta_adsets', COUNT(*) FROM core_warehouse.meta_adsets
UNION ALL
SELECT 'meta_ads', COUNT(*) FROM core_warehouse.meta_ads
UNION ALL
SELECT 'meta_adcreatives', COUNT(*) FROM core_warehouse.meta_adcreatives
UNION ALL
SELECT 'meta_insights_campaign', COUNT(*) FROM core_warehouse.meta_insights_campaign
UNION ALL
SELECT 'meta_insights_age_gender', COUNT(*) FROM core_warehouse.meta_insights_age_gender
UNION ALL
SELECT 'meta_insights_device', COUNT(*) FROM core_warehouse.meta_insights_device;
```

**Current state (basic client):**
- `fact_marketing_daily`: 25 records ✅
- All comprehensive tables: 0 records ❌

**After comprehensive client runs:**
- `meta_campaigns`: 5+ records ✅
- `meta_adsets`: 10+ records ✅
- `meta_ads`: 20+ records ✅
- `meta_insights_campaign`: 100+ records ✅
- `meta_insights_age_gender`: 200+ records ✅
- And more...

---

## 📊 Data Comparison

| Feature | Basic Client | Comprehensive Client |
|---------|-------------|---------------------|
| Daily spend/impressions/clicks | ✅ | ✅ |
| Campaign names | ❌ | ✅ |
| Campaign objectives | ❌ | ✅ |
| Ad sets with targeting | ❌ | ✅ |
| Individual ads | ❌ | ✅ |
| Ad creatives (copy, images) | ❌ | ✅ |
| Age/gender breakdown | ❌ | ✅ |
| Device breakdown | ❌ | ✅ |
| Geographic breakdown | ❌ | ✅ |
| Campaign-level insights | ❌ | ✅ |
| Ad set-level insights | ❌ | ✅ |
| Ad-level insights | ❌ | ✅ |

---

## Summary

**You successfully triggered a Meta job, but:**
- ❌ It used the basic client (only 25 records, no metadata)
- ❌ `META_USE_COMPREHENSIVE=true` not active yet

**Next steps:**
1. ✅ Verify Railway has `META_USE_COMPREHENSIVE=true`
2. ✅ Wait for Railway redeploy
3. ✅ Trigger new job
4. ✅ Watch for "[Meta Comprehensive]" in logs
5. ✅ Verify comprehensive tables populated

**Timeline:** 5 minutes to full comprehensive Meta data
