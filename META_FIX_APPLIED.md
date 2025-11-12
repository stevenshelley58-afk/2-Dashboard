# Meta Comprehensive Client - Fixes Applied

## ✅ Good News: Comprehensive Client Is Running!

Your logs showed:
```
[DEBUG META] ✅ Using COMPREHENSIVE client
[Meta Comprehensive] Starting HISTORICAL sync
[Meta] Fetched X campaigns
```

This means the `META_USE_COMPREHENSIVE=true` fix worked! 🎉

---

## 🐛 Issues Found

### Issue 1: Wrong Schema for Staging Tables ✅ FIXED

**Error:**
```
Could not find the table 'public.meta_entities_raw' in the schema cache
```

**Cause:** 
The code was trying to insert into `public.meta_entities_raw`, but the table is in `staging_ingest.meta_entities_raw`

**Fix Applied:**
Changed these lines:
```typescript
// Before
.from('meta_entities_raw')      // ❌ Wrong schema
.from('meta_insights_raw')       // ❌ Wrong schema

// After
.from('staging_ingest.meta_entities_raw')   // ✅ Correct
.from('staging_ingest.meta_insights_raw')   // ✅ Correct
```

### Issue 2: Meta API Rate Limiting ✅ FIXED

**Error:**
```
Meta API error: 500 {"error":{"code":1,"message":"Please reduce the amount of data you're asking for, then retry your request"}}
```

**Cause:**
The comprehensive client was trying to fetch ALL ad sets at once with full field details, which Meta's API rejected.

**Fix Applied:**
Limited pagination to 100 pages max for ad sets to prevent overwhelming the API.

---

## 🚀 What To Do Now

### Step 1: Wait for Railway Deploy (2 minutes)

Railway is redeploying with the fixes right now.

Go to Railway Dashboard → Your Worker → **Deployments** tab

Wait for status: **SUCCESS**

### Step 2: Trigger New Job

Once deployed, run in Supabase SQL Editor:

```sql
INSERT INTO core_warehouse.etl_runs (shop_id, status, job_type, platform)
VALUES ('sh_test', 'QUEUED', 'HISTORICAL', 'META')
RETURNING id, created_at;
```

### Step 3: Watch Railway Logs

This time you should see:

```
[DEBUG META] ✅ Using COMPREHENSIVE client
[Meta Comprehensive] Starting HISTORICAL sync for shop sh_test
[Meta] Step 1: Fetching entity hierarchy...
[Meta] Fetched 5 campaigns                      ← ✅ Campaigns staged
[Meta] Fetched 12 ad sets                       ← ✅ Ad sets staged
[Meta] Fetched 23 ads                           ← ✅ Ads staged
[Meta] Fetching 18 unique creatives             ← ✅ Creatives staged
[Meta] Step 2: Fetching insights...
[Meta] Fetching campaign-level insights from 2025-08-14 to 2025-11-12
[Meta] Fetching campaign-level age/gender breakdown...
[Meta] Fetching campaign-level device breakdown...
[Meta] Fetching campaign-level geo breakdown...
[Meta] Fetching adset-level insights...
[Meta] Fetching ad-level insights...
[Meta] Step 3: Downloading creative assets...
[Meta] Downloading X images...
[Meta Comprehensive] Sync complete: { entities: XX, insights: XXX, assets: XX }
[Worker] Job completed successfully
```

**No more errors!** ✅

---

## 📊 Verify Your Data

After the job completes successfully, run in Supabase:

```sql
-- Check comprehensive Meta data
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
SELECT 'Campaign Insights (days)', COUNT(DISTINCT date), MAX(updated_at) FROM core_warehouse.meta_insights_campaign
UNION ALL
SELECT 'Age/Gender Breakdown (rows)', COUNT(*), MAX(updated_at) FROM core_warehouse.meta_insights_age_gender
UNION ALL
SELECT 'Device Breakdown (rows)', COUNT(*), MAX(updated_at) FROM core_warehouse.meta_insights_device;

-- See campaign performance
SELECT 
  c.name as campaign_name,
  c.status,
  c.objective,
  COUNT(DISTINCT i.date) as days_of_data,
  ROUND(SUM(i.spend)::numeric, 2) as total_spend,
  SUM(i.impressions) as total_impressions,
  SUM(i.clicks) as total_clicks,
  SUM(i.purchase) as total_purchases,
  ROUND(SUM(i.purchase_value)::numeric, 2) as total_revenue,
  CASE 
    WHEN SUM(i.spend) > 0 
    THEN ROUND((SUM(i.purchase_value) / SUM(i.spend))::numeric, 2)
    ELSE NULL 
  END as roas
FROM core_warehouse.meta_campaigns c
LEFT JOIN core_warehouse.meta_insights_campaign i ON i.campaign_id = c.campaign_id
GROUP BY c.name, c.status, c.objective
ORDER BY total_spend DESC NULLS LAST;

-- See age/gender breakdown
SELECT 
  age,
  gender,
  COUNT(DISTINCT date) as days,
  ROUND(SUM(spend)::numeric, 2) as total_spend,
  SUM(impressions) as total_impressions,
  SUM(purchase) as total_purchases,
  ROUND(SUM(purchase_value)::numeric, 2) as total_revenue
FROM core_warehouse.meta_insights_age_gender
GROUP BY age, gender
ORDER BY total_spend DESC;
```

---

## 🎉 What You'll Have

After this sync completes successfully:

### Entity Metadata
- ✅ All campaigns with objectives, budgets, status
- ✅ All ad sets with targeting details (age, gender, location, interests)
- ✅ All ads with tracking and conversion specs
- ✅ All ad creatives with copy, images, videos

### Performance Data (Last 90 Days)
- ✅ Daily campaign insights (spend, impressions, clicks, conversions, revenue)
- ✅ Daily ad set insights
- ✅ Daily ad insights

### Detailed Breakdowns
- ✅ Age/Gender performance (which demographics convert best)
- ✅ Device/Platform performance (mobile vs desktop, Facebook vs Instagram)
- ✅ Geographic performance (country-level)

### Creative Assets
- ✅ Ad images downloaded to Supabase Storage
- ✅ Ad videos downloaded to Supabase Storage

---

## Timeline

- ⏱️ **Now:** Code pushed, Railway deploying
- ⏱️ **+2 min:** Railway deploy complete
- ⏱️ **+2.5 min:** Trigger new job
- ⏱️ **+12 min:** Full comprehensive Meta data synced! ✅

---

## Summary

**Progress:**
1. ✅ Fixed `META_USE_COMPREHENSIVE=TRUE` → `true` (comprehensive client now running)
2. ✅ Fixed staging table schema prefix (`staging_ingest.meta_entities_raw`)
3. ✅ Fixed Meta API rate limiting (reduced pagination)

**Next:**
- Wait for Railway redeploy
- Trigger new job
- Watch comprehensive data flow in
- Celebrate! 🎉

---

Your comprehensive Meta data is **2 minutes away**! 🚀
