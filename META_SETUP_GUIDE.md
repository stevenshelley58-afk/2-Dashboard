# Meta Ads Setup Guide - Get Your Data Flowing

## Problem
You have no Meta data because:
1. ❌ Meta credentials not configured in Railway worker
2. ❌ No Meta ETL jobs have been triggered
3. ❌ Comprehensive Meta client not enabled

## Solution (5 minutes)

### Step 1: Get Your Meta Credentials (2 minutes)

You need two pieces of information:

#### A. Meta Ad Account ID
1. Go to [Meta Business Suite](https://business.facebook.com)
2. Click **Ads Manager** in left menu
3. Look at the URL: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1234567890`
4. Your Ad Account ID is: `act_1234567890` (keep the `act_` prefix!)

#### B. Meta Access Token
1. Go to [Meta for Developers](https://developers.facebook.com/tools/explorer)
2. Select your app (or create one if needed)
3. Click **Get Token** → **Get User Access Token**
4. Select these permissions:
   - `ads_read`
   - `read_insights`
5. Click **Generate Access Token**
6. Copy the long token string (starts with `EAA...`)

**Important:** For production, you should use a System User token that doesn't expire. The above token is for testing.

---

### Step 2: Add Meta Credentials to Railway (1 minute)

1. Go to [Railway Dashboard](https://railway.app)
2. Select your project → Click your worker service
3. Click **Variables** tab
4. Add these three variables:

```
META_ACCESS_TOKEN=<your-token-from-step-1B>
META_AD_ACCOUNT_ID=<your-account-id-from-step-1A>
META_USE_COMPREHENSIVE=true
META_API_VERSION=v21.0
```

5. Railway will automatically redeploy your worker

---

### Step 3: Trigger Meta Data Fetch (1 minute)

Open Supabase Dashboard → SQL Editor → Run this:

```sql
-- Create a HISTORICAL Meta job (fetches last 90 days)
INSERT INTO core_warehouse.etl_runs (shop_id, status, job_type, platform)
VALUES ('sh_test', 'QUEUED', 'HISTORICAL', 'META');
```

---

### Step 4: Watch the Magic Happen (5-10 minutes)

Go to Railway → Your worker service → **Deployments** → View Logs

You should see:
```
[Worker] Processing job <uuid>: META HISTORICAL
[Meta Comprehensive] Starting HISTORICAL sync for shop sh_test
[Meta] Step 1: Fetching entity hierarchy...
[Meta] Fetched 5 campaigns
[Meta] Fetched 12 ad sets
[Meta] Fetched 23 ads
[Meta] Fetching 18 unique creatives
[Meta] Step 2: Fetching insights...
[Meta] Fetching campaign-level insights...
[Meta] Fetching campaign-level age/gender breakdown...
[Meta] Fetching campaign-level device breakdown...
[Meta] Fetching campaign-level geo breakdown...
[Meta] Step 3: Downloading creative assets...
[Meta] Downloading 15 images...
[Meta Comprehensive] Sync complete: { entities: 58, insights: 234, assets: 15 }
[Worker] Job completed successfully (307 records)
```

---

### Step 5: Verify Your Data (30 seconds)

Back in Supabase SQL Editor:

```sql
-- Check job completed
SELECT * FROM core_warehouse.etl_runs
WHERE platform = 'META'
ORDER BY created_at DESC;

-- See your campaigns
SELECT * FROM core_warehouse.meta_campaigns;

-- See your ads
SELECT * FROM core_warehouse.meta_ads;

-- See performance data
SELECT 
  date,
  campaign_id,
  spend,
  impressions,
  clicks,
  purchase,
  purchase_value
FROM core_warehouse.meta_insights_campaign
ORDER BY date DESC
LIMIT 20;

-- See age/gender breakdown
SELECT 
  date,
  age,
  gender,
  spend,
  impressions,
  clicks,
  purchase_value
FROM core_warehouse.meta_insights_age_gender
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC, spend DESC;
```

---

## What You'll Get

The comprehensive Meta integration fetches:

### 📊 Entities (Full Metadata)
- ✅ Ad Accounts
- ✅ Campaigns (objectives, budgets, status)
- ✅ Ad Sets (targeting, optimization goals)
- ✅ Ads (tracking specs, conversion specs)
- ✅ Ad Creatives (titles, body copy, CTAs)

### 🖼️ Creative Assets
- ✅ Images (downloaded to Supabase Storage)
- ✅ Videos (downloaded to Supabase Storage)
- ✅ Thumbnails

### 📈 Performance Insights
- ✅ Campaign-level daily metrics
- ✅ Ad Set-level daily metrics
- ✅ Ad-level daily metrics

### 🎯 Breakdowns
- ✅ Age & Gender (which demographics perform best)
- ✅ Device & Platform (mobile vs desktop, Facebook vs Instagram)
- ✅ Geography (country, region, DMA)

### 💰 Metrics Included
- Spend, Impressions, Clicks, Reach, Frequency
- CPM, CPC, CTR, CPP
- Conversions (add to cart, initiate checkout, purchases)
- Revenue (purchase value)
- Engagement (reactions, comments, shares)
- Video metrics (views, watch time)

---

## Troubleshooting

### "Invalid OAuth access token"
- Your token expired or is invalid
- Generate a new token from [Graph API Explorer](https://developers.facebook.com/tools/explorer)
- For production, use a System User token

### "Unsupported get request"
- Your ad account ID is wrong
- Make sure it has the `act_` prefix (e.g., `act_1234567890`)
- Verify the account ID in Meta Ads Manager URL

### "Permissions error"
- Your token doesn't have required permissions
- Regenerate with `ads_read` and `read_insights` permissions

### Job stays QUEUED
- Worker might not be running
- Check Railway logs to see if worker is polling
- Check environment variables are set correctly

### No insights data
- Meta has 1-day delay on insights data
- If you just created the ads today, check tomorrow
- Historical job fetches last 90 days of data

---

## Schedule Automatic Syncs

Once your first sync works, set up automatic daily syncs:

```sql
-- Option 1: Create a recurring job via SQL (run once)
-- This inserts a new INCREMENTAL job every day at 6 AM UTC
SELECT cron.schedule(
  'meta-daily-sync',
  '0 6 * * *',
  $$
  INSERT INTO core_warehouse.etl_runs (shop_id, status, job_type, platform)
  VALUES ('sh_test', 'QUEUED', 'INCREMENTAL', 'META');
  $$
);
```

**Incremental syncs** fetch the last 7 days to catch any delayed conversions (common with Meta's attribution windows).

---

## Next Steps

Once Meta data is flowing:

1. ✅ Set up GA4 integration (for website analytics)
2. ✅ Set up Klaviyo integration (for email marketing)
3. ✅ View your data in the dashboard (frontend shows all platforms)
4. ✅ Calculate MER/ROAS (marketing efficiency ratio)

---

## Need Help?

Check these tables to debug:

```sql
-- See all Meta entity types in warehouse
SELECT 
  'campaigns' as entity,
  COUNT(*) as count
FROM core_warehouse.meta_campaigns
UNION ALL
SELECT 'adsets', COUNT(*) FROM core_warehouse.meta_adsets
UNION ALL
SELECT 'ads', COUNT(*) FROM core_warehouse.meta_ads
UNION ALL
SELECT 'creatives', COUNT(*) FROM core_warehouse.meta_adcreatives
UNION ALL
SELECT 'images', COUNT(*) FROM core_warehouse.meta_adimages
UNION ALL
SELECT 'videos', COUNT(*) FROM core_warehouse.meta_advideos;

-- See staging data (raw API responses)
SELECT entity_type, COUNT(*) as count
FROM staging_ingest.meta_entities_raw
GROUP BY entity_type;

-- Check for errors in ETL jobs
SELECT 
  id,
  platform,
  job_type,
  status,
  error,
  completed_at
FROM core_warehouse.etl_runs
WHERE platform = 'META' AND status = 'FAILED'
ORDER BY completed_at DESC;
```

---

**Ready? Add those Railway variables and trigger the job!** 🚀
