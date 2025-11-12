-- ============================================================================
-- ENQUEUE META DATA FETCH JOB
-- ============================================================================
-- Run this in Supabase SQL Editor to trigger a Meta data fetch
-- 
-- Prerequisites:
-- 1. META_ACCESS_TOKEN set in Railway environment
-- 2. META_AD_ACCOUNT_ID set in Railway environment  
-- 3. META_USE_COMPREHENSIVE=true set in Railway environment
-- 4. Railway worker is running
-- ============================================================================

-- HISTORICAL job: Fetches last 90 days of data (use for first sync)
INSERT INTO core_warehouse.etl_runs (shop_id, status, job_type, platform)
VALUES ('sh_test', 'QUEUED', 'HISTORICAL', 'META');

-- INCREMENTAL job: Fetches last 7 days (use for daily syncs)
-- INSERT INTO core_warehouse.etl_runs (shop_id, status, job_type, platform)
-- VALUES ('sh_test', 'QUEUED', 'INCREMENTAL', 'META');

-- ============================================================================
-- Check job status
-- ============================================================================
SELECT 
  id,
  platform,
  job_type,
  status,
  records_synced,
  created_at,
  started_at,
  completed_at,
  error
FROM core_warehouse.etl_runs
WHERE platform = 'META'
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- After job completes, check your data
-- ============================================================================

-- Count entities fetched
SELECT 
  'campaigns' as entity,
  COUNT(*) as count,
  MAX(updated_at) as last_updated
FROM core_warehouse.meta_campaigns
UNION ALL
SELECT 'adsets', COUNT(*), MAX(updated_at) FROM core_warehouse.meta_adsets
UNION ALL
SELECT 'ads', COUNT(*), MAX(updated_at) FROM core_warehouse.meta_ads
UNION ALL
SELECT 'creatives', COUNT(*), MAX(updated_at) FROM core_warehouse.meta_adcreatives;

-- View campaign insights (daily performance)
SELECT 
  c.name as campaign_name,
  i.date,
  i.spend,
  i.impressions,
  i.clicks,
  i.ctr,
  i.purchase,
  i.purchase_value,
  ROUND((i.purchase_value / NULLIF(i.spend, 0))::numeric, 2) as roas
FROM core_warehouse.meta_insights_campaign i
JOIN core_warehouse.meta_campaigns c ON c.campaign_id = i.campaign_id
WHERE i.date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY i.date DESC, i.spend DESC;

-- View age/gender breakdown
SELECT 
  date,
  age,
  gender,
  spend,
  impressions,
  clicks,
  purchase,
  purchase_value
FROM core_warehouse.meta_insights_age_gender
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC, spend DESC
LIMIT 20;

-- View device breakdown
SELECT 
  date,
  device_platform,
  publisher_platform,
  platform_position,
  spend,
  impressions,
  clicks,
  purchase_value
FROM core_warehouse.meta_insights_device
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC, spend DESC
LIMIT 20;
