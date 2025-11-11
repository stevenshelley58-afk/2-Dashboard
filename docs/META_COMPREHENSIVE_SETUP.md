# Meta Ads Comprehensive ETL - Setup & Usage Guide

## Overview

This comprehensive Meta Ads ETL system extracts **ALL** metadata from the Meta Marketing API, including:

- ✅ **Entities**: Ad Accounts, Campaigns, AdSets, Ads, Creatives
- ✅ **Media Assets**: Images and Videos (downloaded and stored)
- ✅ **Insights**: Performance metrics at all levels (account, campaign, adset, ad)
- ✅ **Breakdowns**: Age/Gender, Device/Platform, Geographic
- ✅ **Attribution Windows**: 1d_click, 7d_click, 1d_view, 7d_view
- ✅ **Full Metadata**: Complete API responses stored in JSONB for flexibility

---

## Database Schema

### Entity Tables

| Table | Description | Key Fields |
|-------|-------------|------------|
| `meta_ad_accounts` | Ad account metadata | account_id, currency, timezone, business_name |
| `meta_campaigns` | Campaign configuration | name, status, objective, budget, bid_strategy |
| `meta_adsets` | Ad set targeting & optimization | targeting (JSONB), optimization_goal, bid_amount |
| `meta_ads` | Individual ads | name, status, creative_id |
| `meta_adcreatives` | Creative content | title, body, call_to_action_type, image/video refs |
| `meta_adimages` | Downloaded image assets | image_hash, storage_path, storage_url |
| `meta_advideos` | Downloaded video assets | video_id, storage_path, thumbnail_url |

### Insights Tables (Daily Performance)

| Table | Description | Granularity |
|-------|-------------|-------------|
| `meta_insights_campaign` | Campaign performance | Daily per campaign |
| `meta_insights_adset` | AdSet performance | Daily per adset |
| `meta_insights_ad` | Ad performance | Daily per ad |
| `meta_insights_age_gender` | Demographic breakdown | Daily per age/gender |
| `meta_insights_device` | Device/platform breakdown | Daily per device/platform/position |
| `meta_insights_geo` | Geographic breakdown | Daily per country/region |

### Key Metrics (Available in All Insights Tables)

**Core Metrics:**
- spend, impressions, clicks, reach, frequency

**Cost Metrics:**
- cpm (cost per 1000 impressions)
- cpc (cost per click)
- ctr (click-through rate)
- cpp (cost per 1000 people reached)

**Conversion Metrics:**
- add_to_cart, initiate_checkout, purchase, purchase_value

**Engagement Metrics:**
- post_engagement, post_reactions, post_comments, post_shares
- video_views, video_views_3s, video_views_10s, video_avg_time_watched

**Link Metrics:**
- outbound_clicks, link_clicks

---

## Installation & Setup

### 1. Run Database Migrations

```bash
cd "c:\2 Dashboard"

# Run the comprehensive schema migration
pnpm supabase db push

# This will create all tables and RPC functions
```

### 2. Create Supabase Storage Bucket

```bash
# Create the storage bucket for creative assets
pnpm supabase storage create meta-creatives --public
```

Or manually in Supabase Dashboard:
1. Go to Storage
2. Create new bucket: `meta-creatives`
3. Make it **public**

### 3. Configure Environment Variables

Edit `c:\2 Dashboard\apps\worker\.env`:

```bash
# Existing Meta credentials
META_ACCESS_TOKEN="your-business-system-user-token"
META_AD_ACCOUNT_ID="5387069344636761"
META_API_VERSION="v21.0"

# NEW: Enable comprehensive mode
META_USE_COMPREHENSIVE=true
```

### 4. Rebuild Worker

```bash
cd "c:\2 Dashboard\apps\worker"
pnpm install
pnpm build
```

---

## Usage

### Triggering a Sync

#### Option 1: Via Supabase Edge Function (API)

```bash
curl -X POST https://your-project.supabase.co/functions/v1/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "shop_id": "BHM",
    "platform": "META",
    "job_type": "HISTORICAL"
  }'
```

#### Option 2: Direct Database Insert

```sql
SELECT enqueue_etl_job('BHM', 'HISTORICAL', 'META');
```

#### Option 3: Schedule with pg_cron

```sql
-- Daily incremental sync at 2 AM
SELECT cron.schedule(
  'meta-daily-sync',
  '0 2 * * *',
  $$SELECT enqueue_etl_job('BHM', 'INCREMENTAL', 'META')$$
);
```

### Job Types

| Job Type | Description | Date Range | Use Case |
|----------|-------------|------------|----------|
| `HISTORICAL` | Full refresh | Last 90 days | Initial setup, backfill |
| `INCREMENTAL` | Daily update | Last 7 days | Daily automation (catches delayed conversions) |

---

## What Gets Extracted

### 1. Entity Hierarchy

```
Ad Account
├── Campaigns (all campaigns in account)
│   ├── Name, Status, Objective
│   ├── Budget (daily/lifetime)
│   ├── Bid Strategy
│   └── Special Ad Categories
│
├── AdSets (all ad sets)
│   ├── Optimization Goal
│   ├── Targeting (full JSONB spec)
│   │   ├── Age/Gender
│   │   ├── Geo Locations
│   │   ├── Interests
│   │   └── Custom Audiences
│   └── Attribution Spec
│
├── Ads (all ads)
│   ├── Name, Status
│   └── Creative Reference
│
└── Creatives (all unique creatives)
    ├── Title, Body, Link
    ├── Call-to-Action Type
    ├── Image/Video References
    └── Object Story Spec (full payload)
```

### 2. Creative Assets

**Images:**
- Original URL from Meta
- Downloaded to Supabase Storage: `{shop_id}/images/{hash}.jpg`
- Public URL stored in `storage_url` column
- Metadata: dimensions, file size, mime type

**Videos:**
- Source video downloaded to: `{shop_id}/videos/{video_id}.mp4`
- Thumbnail downloaded to: `{shop_id}/videos/thumbnails/{video_id}.jpg`
- Metadata: length, dimensions, format, views

### 3. Insights (Performance Data)

**Fetched at 3 Levels:**
1. **Campaign-level**: Aggregate performance per campaign
2. **AdSet-level**: Performance per ad set
3. **Ad-level**: Performance per individual ad (creative testing)

**With 3 Breakdown Dimensions:**
1. **Age & Gender**: See which demographics perform best
2. **Device/Platform**: Mobile vs Desktop, Facebook vs Instagram vs Stories
3. **Geographic**: Performance by country/region

**Attribution Windows:**
- 1d_click, 7d_click (default)
- 1d_view, 7d_view (if enabled on account)

### 4. Full API Response Storage

Every entity and insight record includes a `metadata` JSONB column containing the **complete** API response, ensuring you never lose data even if new fields are added to the API.

---

## Example Queries

### 1. Top Performing Campaigns (by ROAS)

```sql
SELECT
  c.name AS campaign_name,
  SUM(i.spend) AS total_spend,
  SUM(i.purchase_value) AS total_revenue,
  SUM(i.purchase) AS total_purchases,
  ROUND(SUM(i.purchase_value) / NULLIF(SUM(i.spend), 0), 2) AS roas
FROM core_warehouse.meta_insights_campaign i
JOIN core_warehouse.meta_campaigns c ON i.campaign_id = c.campaign_id
WHERE i.shop_id = 'BHM'
  AND i.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY c.name
ORDER BY roas DESC
LIMIT 10;
```

### 2. Best Performing Demographics

```sql
SELECT
  age,
  gender,
  SUM(spend) AS total_spend,
  SUM(purchase_value) AS total_revenue,
  ROUND(SUM(purchase_value) / NULLIF(SUM(spend), 0), 2) AS roas,
  SUM(purchase) AS total_purchases
FROM core_warehouse.meta_insights_age_gender
WHERE shop_id = 'BHM'
  AND date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY age, gender
ORDER BY roas DESC;
```

### 3. Platform Performance (Facebook vs Instagram)

```sql
SELECT
  publisher_platform,
  platform_position,
  SUM(impressions) AS total_impressions,
  SUM(clicks) AS total_clicks,
  ROUND(SUM(clicks)::numeric / NULLIF(SUM(impressions), 0) * 100, 2) AS ctr,
  SUM(spend) AS total_spend,
  ROUND(SUM(spend) / NULLIF(SUM(impressions), 0) * 1000, 2) AS cpm
FROM core_warehouse.meta_insights_device
WHERE shop_id = 'BHM'
  AND date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY publisher_platform, platform_position
ORDER BY total_impressions DESC;
```

### 4. Ad Creative Analysis (with Images)

```sql
SELECT
  c.title,
  c.body,
  c.call_to_action_type,
  img.storage_url AS image_url,
  SUM(i.impressions) AS total_impressions,
  SUM(i.clicks) AS total_clicks,
  ROUND(SUM(i.clicks)::numeric / NULLIF(SUM(i.impressions), 0) * 100, 2) AS ctr,
  SUM(i.purchase) AS total_purchases
FROM core_warehouse.meta_insights_ad i
JOIN core_warehouse.meta_ads a ON i.ad_id = a.ad_id
JOIN core_warehouse.meta_adcreatives c ON a.creative_id = c.creative_id
LEFT JOIN core_warehouse.meta_adimages img ON c.image_hash = img.image_hash
WHERE i.shop_id = 'BHM'
  AND i.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY c.creative_id, c.title, c.body, c.call_to_action_type, img.storage_url
ORDER BY total_impressions DESC
LIMIT 20;
```

### 5. Campaign Targeting Analysis

```sql
SELECT
  c.name AS campaign_name,
  a.targeting->>'age_min' AS age_min,
  a.targeting->>'age_max' AS age_max,
  a.targeting->'geo_locations'->>'countries' AS countries,
  SUM(i.spend) AS total_spend,
  SUM(i.purchase_value) AS total_revenue
FROM core_warehouse.meta_insights_adset i
JOIN core_warehouse.meta_adsets a ON i.adset_id = a.adset_id
JOIN core_warehouse.meta_campaigns c ON a.campaign_id = c.campaign_id
WHERE i.shop_id = 'BHM'
  AND i.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY c.name, a.targeting
ORDER BY total_revenue DESC;
```

### 6. Video Asset Performance

```sql
SELECT
  v.title AS video_title,
  v.length_seconds,
  v.storage_url AS video_url,
  v.thumbnail_storage_url AS thumbnail_url,
  SUM(i.video_views) AS total_views,
  SUM(i.video_views_10s) AS views_10s,
  ROUND(SUM(i.video_views_10s)::numeric / NULLIF(SUM(i.video_views), 0) * 100, 2) AS retention_rate,
  SUM(i.purchase) AS total_purchases
FROM core_warehouse.meta_insights_ad i
JOIN core_warehouse.meta_ads a ON i.ad_id = a.ad_id
JOIN core_warehouse.meta_adcreatives c ON a.creative_id = c.creative_id
JOIN core_warehouse.meta_advideos v ON c.video_id = v.video_id
WHERE i.shop_id = 'BHM'
  AND i.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY v.video_id, v.title, v.length_seconds, v.storage_url, v.thumbnail_storage_url
ORDER BY total_views DESC;
```

---

## Monitoring & Troubleshooting

### Check Sync Status

```sql
SELECT
  id AS run_id,
  platform,
  job_type,
  status,
  records_synced,
  started_at,
  finished_at,
  finished_at - started_at AS duration,
  error
FROM core_warehouse.etl_runs
WHERE platform = 'META'
ORDER BY started_at DESC
LIMIT 10;
```

### Check Asset Download Status

```sql
-- Images
SELECT
  download_status,
  COUNT(*) AS count,
  SUM(file_size_bytes) / 1024 / 1024 AS total_mb
FROM core_warehouse.meta_adimages
WHERE shop_id = 'BHM'
GROUP BY download_status;

-- Videos
SELECT
  download_status,
  COUNT(*) AS count,
  SUM(file_size_bytes) / 1024 / 1024 AS total_mb
FROM core_warehouse.meta_advideos
WHERE shop_id = 'BHM'
GROUP BY download_status;
```

### Retry Failed Asset Downloads

The worker automatically retries PENDING assets on each sync. To manually trigger:

```sql
-- Reset failed images to pending
UPDATE core_warehouse.meta_adimages
SET download_status = 'PENDING',
    download_error = NULL
WHERE shop_id = 'BHM'
  AND download_status = 'FAILED';

-- Then trigger a new sync job
SELECT enqueue_etl_job('BHM', 'INCREMENTAL', 'META');
```

---

## Data Retention & Performance

### Recommended Indexes (Already Created)

All necessary indexes are created by the migration for optimal query performance:
- Entity relationships (campaign_id, adset_id, ad_id)
- Time-based queries (shop_id, date)
- Status filtering (status, download_status)

### Storage Estimates

**Per 90 days of data:**
- Campaigns: ~100 KB per campaign
- AdSets: ~200 KB per adset (targeting data)
- Ads: ~50 KB per ad
- Creatives: ~10 KB per creative
- Images: ~500 KB per image (downloaded file)
- Videos: ~5 MB per video (downloaded file)
- Insights (daily): ~2 KB per metric row

**Example: 10 campaigns, 50 adsets, 200 ads, 90 days:**
- Metadata: ~50 MB
- Assets: ~100 images × 500 KB + 20 videos × 5 MB = ~150 MB
- Insights: ~18,000 rows × 2 KB = ~36 MB
- **Total: ~236 MB**

### Data Cleanup

To save space, you can archive old data:

```sql
-- Delete insights older than 365 days
DELETE FROM core_warehouse.meta_insights_campaign
WHERE date < CURRENT_DATE - INTERVAL '365 days';

DELETE FROM core_warehouse.meta_insights_adset
WHERE date < CURRENT_DATE - INTERVAL '365 days';

DELETE FROM core_warehouse.meta_insights_ad
WHERE date < CURRENT_DATE - INTERVAL '365 days';
```

---

## API Rate Limits

Meta Marketing API limits:
- **200 calls per hour** per ad account
- **Insights queries**: ~25 calls/hour recommended to avoid throttling

The comprehensive client includes:
- Automatic pagination (500 records per page)
- Rate limiting (100ms delay between pages)
- Error handling with detailed logging

For very large accounts (1000+ ads), consider:
1. Running HISTORICAL sync during off-peak hours
2. Splitting sync into separate jobs per campaign
3. Using `maxPages` parameter to limit pagination

---

## Advanced Configuration

### Custom Attribution Windows

Edit the transformation RPC to support custom windows:

```sql
-- In meta_transformation_rpcs.sql
-- Modify the INSERT statements to parameterize attribution_window
```

### Selective Entity Sync

Modify the `syncEntities` function in `meta-comprehensive.ts` to filter by:
- Campaign status (only ACTIVE)
- Date range (only recent campaigns)
- Specific campaign IDs

Example:
```typescript
// Only fetch active campaigns
const campaigns = await this.fetchAllPaginated<any>(
  `act_${this.config.adAccountId}/campaigns`,
  {
    fields: ENTITY_FIELDS.campaign,
    filtering: JSON.stringify([{field: 'status', operator: 'IN', value: ['ACTIVE']}])
  }
)
```

---

## Next Steps

1. **Run Initial Historical Sync**
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/sync \
     -H "Authorization: Bearer YOUR_KEY" \
     -d '{"shop_id": "BHM", "platform": "META", "job_type": "HISTORICAL"}'
   ```

2. **Set Up Daily Automation**
   ```sql
   SELECT cron.schedule(
     'meta-daily-sync',
     '0 2 * * *',
     $$SELECT enqueue_etl_job('BHM', 'INCREMENTAL', 'META')$$
   );
   ```

3. **Build Dashboard Views**
   - Create materialized views for common metrics
   - Set up refresh schedules
   - Connect to BI tools (Metabase, Looker, etc.)

4. **Enable Asset Analysis**
   - Use AI/ML tools to analyze downloaded images/videos
   - Classify creative types (lifestyle, product, UGC, etc.)
   - Correlate creative characteristics with performance

---

## Support & Resources

- **Meta Marketing API Docs**: https://developers.facebook.com/docs/marketing-apis
- **Supabase Storage Docs**: https://supabase.com/docs/guides/storage
- **Your Worker Logs**: Check Railway/Render logs for sync status

For issues, check:
1. Worker logs for API errors
2. `etl_runs` table for job failures
3. `meta_adimages`/`meta_advideos` for asset download errors
