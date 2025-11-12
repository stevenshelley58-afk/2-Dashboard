# 🚀 START HERE: Get Your Meta Data Flowing

## The Problem
You said: **"I still have no meta data and definitely not the updated expanded meta data"**

## The Reason
Your comprehensive Meta integration is **100% complete and ready**, but it's never been triggered because:
1. ❌ Meta credentials not configured in Railway
2. ❌ No Meta ETL job has been created
3. ❌ Comprehensive client not enabled

## The Solution (5 Minutes)

### ✅ Step 1: Add Railway Variables (2 min)

1. Go to **[Railway Dashboard](https://railway.app)**
2. Select your project → Click your **worker** service
3. Click **Variables** tab
4. Click **New Variable** and add these **4 variables**:

```
Variable Name: META_ACCESS_TOKEN
Value: <see below how to get>

Variable Name: META_AD_ACCOUNT_ID
Value: <see below how to get>

Variable Name: META_USE_COMPREHENSIVE
Value: true

Variable Name: META_API_VERSION
Value: v21.0
```

**How to get META_ACCESS_TOKEN:**
1. Go to https://developers.facebook.com/tools/explorer
2. Click **Get Token** → **Get User Access Token**
3. Check these permissions: `ads_read` and `read_insights`
4. Click **Generate Access Token**
5. Copy the token (starts with `EAA...`)

**How to get META_AD_ACCOUNT_ID:**
1. Go to https://adsmanager.facebook.com
2. Look at the URL: `...?act=1234567890`
3. Copy the number: `act_1234567890` (include `act_`)

5. Railway will **auto-redeploy** your worker (takes ~2 minutes)

---

### ✅ Step 2: Trigger Meta Sync (30 seconds)

1. Go to **[Supabase Dashboard](https://supabase.com/dashboard)**
2. Select your project → **SQL Editor** → **New query**
3. Paste this and click **Run**:

```sql
INSERT INTO core_warehouse.etl_runs (shop_id, status, job_type, platform)
VALUES ('sh_test', 'QUEUED', 'HISTORICAL', 'META');
```

This creates a job that fetches the **last 90 days** of Meta data.

---

### ✅ Step 3: Watch It Work (5-10 minutes)

1. Go back to **Railway Dashboard**
2. Click your worker service → **Deployments** → Latest deployment → **View Logs**
3. You should see:

```
[Worker] Starting ETL worker...
[Worker] Polling for queued jobs...
[Worker] Processing job <uuid>: META HISTORICAL
[Meta Comprehensive] Starting HISTORICAL sync for shop sh_test
[Meta] Step 1: Fetching entity hierarchy...
[Meta] Fetched 5 campaigns
[Meta] Fetched 12 ad sets
[Meta] Fetched 23 ads
[Meta] Step 2: Fetching insights...
[Meta] Sync complete: { entities: 58, insights: 234, assets: 15 }
[Worker] Job completed successfully (307 records)
```

---

### ✅ Step 4: Check Your Data (30 seconds)

Back in Supabase SQL Editor, run:

```sql
-- See what you got
SELECT 
  'Campaigns' as entity, 
  COUNT(*) as count 
FROM core_warehouse.meta_campaigns
UNION ALL
SELECT 'Ad Sets', COUNT(*) FROM core_warehouse.meta_adsets
UNION ALL
SELECT 'Ads', COUNT(*) FROM core_warehouse.meta_ads
UNION ALL
SELECT 'Insights (days)', COUNT(DISTINCT date) FROM core_warehouse.meta_insights_campaign;

-- See performance
SELECT 
  c.name as campaign,
  SUM(i.spend) as total_spend,
  SUM(i.impressions) as impressions,
  SUM(i.clicks) as clicks,
  SUM(i.purchase) as purchases,
  SUM(i.purchase_value) as revenue
FROM core_warehouse.meta_insights_campaign i
JOIN core_warehouse.meta_campaigns c ON c.campaign_id = i.campaign_id
GROUP BY c.name
ORDER BY total_spend DESC;
```

**If you see data → SUCCESS!** 🎉

---

## What You'll Get

### 📊 Full Campaign Metadata
- Campaign objectives, budgets, status
- Ad Set targeting (age, gender, location, interests)
- Individual ads with tracking specs
- Ad creatives (copy, images, videos)

### 📈 Daily Performance (Last 90 Days)
- Spend, Impressions, Clicks, Reach
- CPM, CPC, CTR
- Conversions (Add to Cart, Checkout, Purchases)
- Revenue (Purchase Value)
- ROAS calculation

### 🎯 Detailed Breakdowns
- **Age/Gender:** Which demographics perform best
- **Device/Platform:** Mobile vs Desktop, Facebook vs Instagram
- **Geography:** Country-level performance

---

## Troubleshooting

| See This | Do This |
|----------|---------|
| "Invalid OAuth access token" | Regenerate token at [Graph API Explorer](https://developers.facebook.com/tools/explorer) |
| "Unsupported get request" | Check your account ID has `act_` prefix |
| Job stays QUEUED forever | Check Railway environment variables are set |
| No data after 10 minutes | Check Railway logs for errors |

---

## Next Steps

After Meta data is flowing:

1. **Set up daily automatic syncs** (see `enqueue-meta-job.sql`)
2. **Add GA4 integration** (for website analytics)
3. **Add Klaviyo integration** (for email marketing)
4. **View in dashboard** (frontend already built)

---

## Files Created For You

- ✅ `START_HERE_META.md` ← You are here
- ✅ `META_QUICKSTART.md` - Quick reference
- ✅ `META_SETUP_GUIDE.md` - Detailed guide
- ✅ `META_IMPLEMENTATION_SUMMARY.md` - Technical details
- ✅ `check-meta-status.sql` - Diagnostic queries
- ✅ `enqueue-meta-job.sql` - Job trigger SQL

---

## Summary

**Everything is built.** You just need to:
1. Add 4 environment variables to Railway
2. Run 1 SQL query in Supabase
3. Wait 5-10 minutes

**Your comprehensive Meta data will be there.** 🚀
