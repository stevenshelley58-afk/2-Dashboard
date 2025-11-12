# Meta Ads Comprehensive Implementation Summary

## Current Status: ✅ READY TO USE

All code is implemented and deployed. You just need to configure credentials.

---

## What's Already Built

### 1. Database Schema ✅
**File:** `supabase/migrations/20251109000000_meta_comprehensive_schema.sql`

**13 Tables Created:**

#### Entity Tables (Metadata)
- `meta_ad_accounts` - Account details, currency, timezone
- `meta_campaigns` - Campaign objectives, budgets, status
- `meta_adsets` - Ad set targeting, optimization, bidding
- `meta_ads` - Individual ads with tracking specs
- `meta_adcreatives` - Creative content (titles, copy, CTAs)
- `meta_adimages` - Image assets with storage references
- `meta_advideos` - Video assets with storage references

#### Insights Tables (Performance)
- `meta_insights_campaign` - Daily campaign performance
- `meta_insights_adset` - Daily ad set performance  
- `meta_insights_ad` - Daily ad performance

#### Breakdown Tables (Segmented Analysis)
- `meta_insights_age_gender` - Performance by age/gender
- `meta_insights_device` - Performance by device/platform
- `meta_insights_geo` - Performance by geography

#### Staging Tables
- `staging_ingest.meta_entities_raw` - Raw entity API responses
- `staging_ingest.meta_insights_raw` - Raw insights API responses

---

### 2. Transformation Functions ✅
**File:** `supabase/migrations/20251109000001_meta_transformation_rpcs.sql`

**16 Functions Created:**

#### Entity Transformations
- `transform_meta_ad_accounts(shop_id)` - Parse account data
- `transform_meta_campaigns(shop_id)` - Parse campaign data
- `transform_meta_adsets(shop_id)` - Parse ad set data with targeting
- `transform_meta_ads(shop_id)` - Parse ad data
- `transform_meta_adcreatives(shop_id)` - Parse creative data
- `transform_meta_entities(shop_id)` - **Master function** - transforms all entities

#### Insights Transformations
- `transform_meta_insights_campaign(shop_id)` - Parse campaign insights
- `transform_meta_insights_adset(shop_id)` - Parse ad set insights
- `transform_meta_insights_ad(shop_id)` - Parse ad insights
- `transform_meta_insights_age_gender(shop_id)` - Parse age/gender breakdowns
- `transform_meta_insights_device(shop_id)` - Parse device breakdowns
- `transform_meta_insights_geo(shop_id)` - Parse geo breakdowns
- `transform_meta_insights(shop_id)` - **Master function** - transforms all insights

#### Helper Functions
- `extract_action_value(actions, action_type)` - Extract conversion counts
- `extract_action_value_numeric(action_values, action_type)` - Extract conversion values

---

### 3. ETL Client ✅
**File:** `apps/worker/src/integrations/meta-comprehensive.ts`

**Features:**
- Full Meta Marketing API integration (v21.0)
- Fetches ALL entity types (accounts, campaigns, adsets, ads, creatives)
- Fetches insights at all levels (campaign, adset, ad)
- Fetches breakdowns (age/gender, device, geo)
- Downloads creative assets (images/videos) to Supabase Storage
- Automatic pagination handling
- Rate limiting (100ms between requests)
- Error handling and retry logic
- Idempotent transformations (safe to re-run)

**API Fields Requested:**
- **Account:** 14 fields (currency, timezone, status, balance, spend)
- **Campaign:** 15 fields (objective, budget, status, dates)
- **AdSet:** 18 fields (targeting, optimization, bidding)
- **Ad:** 9 fields (status, creative, tracking, conversions)
- **Creative:** 19 fields (copy, images, videos, CTAs)
- **Insights:** 30+ metrics (spend, impressions, clicks, conversions, engagement, video)

---

### 4. Worker Integration ✅
**File:** `apps/worker/src/index.ts`

**Line 100-127:** Meta platform handler with comprehensive client toggle

```typescript
case Platform.META: {
  const useComprehensive = process.env.META_USE_COMPREHENSIVE === 'true'
  
  if (useComprehensive) {
    const metaClient = new MetaComprehensiveClient(...)
    const stats = await metaClient.sync(job.shop_id, job.job_type)
    return stats.entities + stats.insights + stats.assets
  } else {
    // Legacy basic client
  }
}
```

---

## What You Need to Do

### Step 1: Get Meta Credentials (2 minutes)

#### A. Ad Account ID
1. Go to [Meta Ads Manager](https://adsmanager.facebook.com)
2. Look at URL: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1234567890`
3. Copy the number after `act=` → Your account ID is `act_1234567890`

#### B. Access Token
1. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer)
2. Select your app (or create one)
3. Click **Get Token** → **Get User Access Token**
4. Select permissions:
   - ✅ `ads_read`
   - ✅ `read_insights`
5. Click **Generate Access Token**
6. Copy the token (starts with `EAA...`)

**Note:** For production, use a System User token that doesn't expire.

---

### Step 2: Configure Railway (1 minute)

Railway Dashboard → Your Worker Service → Variables tab → Add:

```bash
META_ACCESS_TOKEN=<your-token-from-step-1>
META_AD_ACCOUNT_ID=<your-account-id-from-step-1>
META_USE_COMPREHENSIVE=true
META_API_VERSION=v21.0
```

Railway will auto-redeploy.

---

### Step 3: Trigger Initial Sync (30 seconds)

Supabase Dashboard → SQL Editor → Run:

```sql
INSERT INTO core_warehouse.etl_runs (shop_id, status, job_type, platform)
VALUES ('sh_test', 'QUEUED', 'HISTORICAL', 'META');
```

---

### Step 4: Watch Sync (5-10 minutes)

Railway → Worker Service → Logs

Expected output:
```
[Worker] Processing job <uuid>: META HISTORICAL
[Meta Comprehensive] Starting HISTORICAL sync for shop sh_test
[Meta] Step 1: Fetching entity hierarchy...
[Meta] Fetched 5 campaigns
[Meta] Fetched 12 ad sets
[Meta] Fetched 23 ads
[Meta] Fetching 18 unique creatives
[Meta] Step 2: Fetching insights...
[Meta] Fetching campaign-level insights from 2024-08-01 to 2024-11-10
[Meta] Fetching campaign-level age/gender breakdown...
[Meta] Fetching campaign-level device breakdown...
[Meta] Fetching campaign-level geo breakdown...
[Meta] Fetching adset-level insights...
[Meta] Fetching ad-level insights...
[Meta] Step 3: Downloading creative assets...
[Meta] Downloading 15 images...
[Meta] Downloaded image abc123
[Meta Comprehensive] Sync complete: { entities: 58, insights: 234, assets: 15 }
[Worker] Job <uuid> completed successfully (307 records)
```

---

### Step 5: Verify Data (30 seconds)

Supabase SQL Editor:

```sql
-- Quick check
SELECT 
  'Campaigns' as entity, COUNT(*) as count
FROM core_warehouse.meta_campaigns
UNION ALL
SELECT 'Ad Sets', COUNT(*) FROM core_warehouse.meta_adsets
UNION ALL
SELECT 'Ads', COUNT(*) FROM core_warehouse.meta_ads
UNION ALL
SELECT 'Creatives', COUNT(*) FROM core_warehouse.meta_adcreatives
UNION ALL
SELECT 'Campaign Insights (days)', COUNT(DISTINCT date) FROM core_warehouse.meta_insights_campaign;

-- See campaign performance
SELECT 
  c.name as campaign,
  i.date,
  i.spend,
  i.impressions,
  i.clicks,
  i.purchase,
  i.purchase_value,
  ROUND((i.purchase_value / NULLIF(i.spend, 0))::numeric, 2) as roas
FROM core_warehouse.meta_insights_campaign i
JOIN core_warehouse.meta_campaigns c ON c.campaign_id = i.campaign_id
WHERE i.date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY i.date DESC, i.spend DESC;
```

---

## Data Retrieved

### Entities (Full Metadata)
For every campaign/adset/ad you've ever run:
- Campaign objectives (OUTCOME_SALES, OUTCOME_AWARENESS, etc.)
- Budgets (daily, lifetime, remaining, spend cap)
- Targeting (age, gender, location, interests, behaviors)
- Optimization goals (OFFSITE_CONVERSIONS, LINK_CLICKS, etc.)
- Bid strategies (LOWEST_COST_WITH_BID_CAP, etc.)
- Status (ACTIVE, PAUSED, ARCHIVED)
- Dates (start, stop, created, updated)
- Ad copy (headlines, body text, CTAs)
- Creative assets (images, videos with download URLs)

### Insights (Daily Performance)
For the last 90 days (HISTORICAL) or 7 days (INCREMENTAL):
- **Core Metrics:** Spend, Impressions, Clicks, Reach, Frequency
- **Efficiency:** CPM, CPC, CTR, CPP
- **Conversions:** Add to Cart, Initiate Checkout, Purchases, Revenue
- **Engagement:** Post reactions, comments, shares
- **Video:** Views (3s, 10s, full), watch time
- **Links:** Outbound clicks, link clicks

### Breakdowns (Segmented Performance)
- **Age/Gender:** 18-24, 25-34, 35-44, 45-54, 55-64, 65+ × Male/Female
- **Device:** Mobile vs Desktop × Facebook/Instagram/Messenger/Audience Network × Feed/Story/Reels
- **Geography:** Country-level performance

---

## Scheduling Automatic Syncs

After first sync succeeds, set up daily sync:

```sql
-- Run this ONCE in Supabase SQL Editor
-- Schedules daily sync at 6 AM UTC
SELECT cron.schedule(
  'meta-daily-sync',
  '0 6 * * *',
  $$
  INSERT INTO core_warehouse.etl_runs (shop_id, status, job_type, platform)
  VALUES ('sh_test', 'QUEUED', 'INCREMENTAL', 'META');
  $$
);
```

**Incremental syncs** fetch last 7 days to catch delayed conversions (common with Meta's attribution windows).

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "Invalid OAuth access token" | Token expired or invalid | Regenerate in Graph API Explorer |
| "Unsupported get request" | Wrong account ID | Verify `act_` prefix in account ID |
| "(#100) Permissions error" | Missing permissions | Regenerate token with `ads_read` + `read_insights` |
| Job stays QUEUED | Worker not running or credentials missing | Check Railway logs and environment variables |
| No insights data | Meta has 1-day delay | Wait until tomorrow for today's data |
| "Rate limit exceeded" | Too many requests | Worker has built-in rate limiting, wait and retry |

---

## Architecture Flow

```
1. User inserts QUEUED job → core_warehouse.etl_runs
2. Railway worker polls for jobs every 30 seconds
3. Worker claims job (status: QUEUED → IN_PROGRESS)
4. MetaComprehensiveClient.sync() runs:
   a. Fetch entities (account → campaigns → adsets → ads → creatives)
   b. Insert to staging_ingest.meta_entities_raw
   c. Call transform_meta_entities() RPC
   d. Entities now in core_warehouse.meta_* tables
   
   e. Fetch insights (campaign/adset/ad levels + breakdowns)
   f. Insert to staging_ingest.meta_insights_raw
   g. Call transform_meta_insights() RPC
   h. Insights now in core_warehouse.meta_insights_* tables
   
   i. Download creative assets (images/videos)
   j. Upload to Supabase Storage
   k. Update meta_adimages/meta_advideos with storage URLs
5. Worker marks job SUCCEEDED
6. Data ready for dashboard!
```

---

## Files Reference

### Documentation
- ✅ `META_QUICKSTART.md` - 5-minute setup guide
- ✅ `META_SETUP_GUIDE.md` - Detailed setup instructions
- ✅ `META_IMPLEMENTATION_SUMMARY.md` - This file
- ✅ `check-meta-status.sql` - Diagnostic queries
- ✅ `enqueue-meta-job.sql` - Job trigger SQL

### Code
- ✅ `apps/worker/src/integrations/meta-comprehensive.ts` - ETL client (807 lines)
- ✅ `supabase/migrations/20251109000000_meta_comprehensive_schema.sql` - Database schema
- ✅ `supabase/migrations/20251109000001_meta_transformation_rpcs.sql` - Transformation functions

### Documentation (Already Existed)
- `docs/META_API_FIELDS_REFERENCE.md` - Complete field list
- `docs/META_COMPREHENSIVE_SETUP.md` - Original setup doc

---

## Next Steps After Meta Works

1. ✅ Set up GA4 integration (website analytics)
2. ✅ Set up Klaviyo integration (email marketing)
3. ✅ Build frontend dashboard pages for Meta data
4. ✅ Create MER/ROAS calculation view (combines Shopify revenue + Meta/GA4/Klaviyo spend)

---

## Support

If anything fails, run this diagnostic SQL:

```sql
-- Check everything
\i check-meta-status.sql

-- Or run manually:
SELECT * FROM core_warehouse.etl_runs WHERE platform = 'META' ORDER BY created_at DESC LIMIT 5;
SELECT COUNT(*) FROM core_warehouse.meta_campaigns;
SELECT COUNT(*) FROM core_warehouse.meta_insights_campaign;
```

Check Railway logs for error details.

---

**You're 4 environment variables away from comprehensive Meta data!** 🚀
