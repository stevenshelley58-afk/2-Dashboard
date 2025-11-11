-- ============================================================================
-- META DATA STATUS CHECK
-- Quick diagnostic queries to see if Meta data is flowing
-- ============================================================================

-- 1. Check if comprehensive Meta tables exist
SELECT 
  schemaname,
  tablename
FROM pg_tables 
WHERE schemaname = 'core_warehouse' 
  AND tablename LIKE 'meta_%'
ORDER BY tablename;

-- 2. Check for Meta ETL jobs (recent history)
SELECT 
  id,
  shop_id,
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
LIMIT 10;

-- 3. Count records in all Meta tables
SELECT 
  'Account' as entity,
  (SELECT COUNT(*) FROM core_warehouse.meta_ad_accounts) as count
UNION ALL
SELECT 
  'Campaigns',
  (SELECT COUNT(*) FROM core_warehouse.meta_campaigns)
UNION ALL
SELECT 
  'Ad Sets',
  (SELECT COUNT(*) FROM core_warehouse.meta_adsets)
UNION ALL
SELECT 
  'Ads',
  (SELECT COUNT(*) FROM core_warehouse.meta_ads)
UNION ALL
SELECT 
  'Creatives',
  (SELECT COUNT(*) FROM core_warehouse.meta_adcreatives)
UNION ALL
SELECT 
  'Images',
  (SELECT COUNT(*) FROM core_warehouse.meta_adimages)
UNION ALL
SELECT 
  'Videos',
  (SELECT COUNT(*) FROM core_warehouse.meta_advideos)
UNION ALL
SELECT 
  'Campaign Insights (days)',
  (SELECT COUNT(DISTINCT date) FROM core_warehouse.meta_insights_campaign)
UNION ALL
SELECT 
  'AdSet Insights (rows)',
  (SELECT COUNT(*) FROM core_warehouse.meta_insights_adset)
UNION ALL
SELECT 
  'Ad Insights (rows)',
  (SELECT COUNT(*) FROM core_warehouse.meta_insights_ad)
UNION ALL
SELECT 
  'Age/Gender Breakdown (rows)',
  (SELECT COUNT(*) FROM core_warehouse.meta_insights_age_gender)
UNION ALL
SELECT 
  'Device Breakdown (rows)',
  (SELECT COUNT(*) FROM core_warehouse.meta_insights_device)
UNION ALL
SELECT 
  'Geo Breakdown (rows)',
  (SELECT COUNT(*) FROM core_warehouse.meta_insights_geo);

-- 4. Check staging tables (raw API data)
SELECT 
  'Entities Staged' as type,
  COUNT(*) as count,
  MAX(created_at) as last_received
FROM staging_ingest.meta_entities_raw
UNION ALL
SELECT 
  'Insights Staged',
  COUNT(*),
  MAX(created_at)
FROM staging_ingest.meta_insights_raw;

-- 5. Check sync cursors (tracking incremental progress)
SELECT 
  shop_id,
  platform,
  entity_type,
  watermark,
  last_success_at,
  last_attempt_at
FROM core_warehouse.sync_cursors
WHERE platform = 'META';

-- 6. Sample data: Recent campaign performance
SELECT 
  c.name as campaign_name,
  c.status,
  c.objective,
  i.date,
  i.spend,
  i.impressions,
  i.clicks,
  i.purchase,
  i.purchase_value,
  CASE 
    WHEN i.spend > 0 THEN ROUND((i.purchase_value / i.spend)::numeric, 2)
    ELSE NULL 
  END as roas
FROM core_warehouse.meta_insights_campaign i
JOIN core_warehouse.meta_campaigns c ON c.campaign_id = i.campaign_id
WHERE i.date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY i.date DESC, i.spend DESC
LIMIT 10;

-- 7. Check for failed jobs
SELECT 
  id,
  job_type,
  status,
  error->>'message' as error_message,
  error->>'code' as error_code,
  completed_at
FROM core_warehouse.etl_runs
WHERE platform = 'META' 
  AND status = 'FAILED'
ORDER BY completed_at DESC
LIMIT 5;

-- ============================================================================
-- INTERPRETATION
-- ============================================================================
-- 
-- If all counts are 0:
-- → No Meta data has been fetched yet
-- → Check if META_ACCESS_TOKEN and META_AD_ACCOUNT_ID are set in Railway
-- → Create a job with: enqueue-meta-job.sql
--
-- If ETL job shows FAILED:
-- → Check the error_message column
-- → Common issues: invalid token, wrong account ID, missing permissions
--
-- If ETL job shows SUCCEEDED but counts are still 0:
-- → Check staging tables - data might be there but transformation failed
-- → Look at Railway logs for transformation errors
--
-- If counts > 0:
-- → SUCCESS! Meta data is flowing
-- → Set up automatic daily syncs (see META_SETUP_GUIDE.md)
-- ============================================================================
