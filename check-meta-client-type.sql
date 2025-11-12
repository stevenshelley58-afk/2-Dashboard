-- ============================================================================
-- CHECK WHICH META CLIENT IS ACTIVE
-- Run this to see if you have basic or comprehensive Meta data
-- ============================================================================

-- 1. Check basic Meta data (old client)
SELECT 
  'BASIC CLIENT DATA' as data_source,
  'fact_marketing_daily' as table_name,
  COUNT(*) as record_count,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Has data'
    ELSE '❌ No data'
  END as status
FROM core_warehouse.fact_marketing_daily
WHERE platform = 'META';

-- 2. Check comprehensive Meta data (new client)
SELECT 
  'COMPREHENSIVE CLIENT DATA' as data_source,
  table_name,
  record_count,
  NULL as earliest_date,
  NULL as latest_date,
  CASE 
    WHEN record_count > 0 THEN '✅ Has data'
    ELSE '❌ No data'
  END as status
FROM (
  SELECT 'meta_campaigns' as table_name, COUNT(*) as record_count FROM core_warehouse.meta_campaigns
  UNION ALL
  SELECT 'meta_adsets', COUNT(*) FROM core_warehouse.meta_adsets
  UNION ALL
  SELECT 'meta_ads', COUNT(*) FROM core_warehouse.meta_ads
  UNION ALL
  SELECT 'meta_adcreatives', COUNT(*) FROM core_warehouse.meta_adcreatives
  UNION ALL
  SELECT 'meta_insights_campaign', COUNT(*) FROM core_warehouse.meta_insights_campaign
  UNION ALL
  SELECT 'meta_insights_adset', COUNT(*) FROM core_warehouse.meta_insights_adset
  UNION ALL
  SELECT 'meta_insights_ad', COUNT(*) FROM core_warehouse.meta_insights_ad
  UNION ALL
  SELECT 'meta_insights_age_gender', COUNT(*) FROM core_warehouse.meta_insights_age_gender
  UNION ALL
  SELECT 'meta_insights_device', COUNT(*) FROM core_warehouse.meta_insights_device
  UNION ALL
  SELECT 'meta_insights_geo', COUNT(*) FROM core_warehouse.meta_insights_geo
) comprehensive_data;

-- 3. Check recent Meta ETL jobs
SELECT 
  id,
  job_type,
  status,
  records_synced,
  created_at,
  started_at,
  completed_at,
  EXTRACT(EPOCH FROM (completed_at - started_at))::int as duration_seconds,
  CASE
    WHEN records_synced < 50 THEN '❌ Basic client (low record count)'
    WHEN records_synced > 100 THEN '✅ Likely comprehensive client'
    ELSE '❓ Unknown'
  END as client_type_indicator
FROM core_warehouse.etl_runs
WHERE platform = 'META'
ORDER BY created_at DESC
LIMIT 5;

-- 4. Check staging data (shows what was fetched)
SELECT 
  'Staging Data' as source,
  entity_type,
  COUNT(*) as count,
  MAX(created_at) as last_received
FROM staging_ingest.meta_entities_raw
GROUP BY entity_type
UNION ALL
SELECT 
  'Staging Data',
  insight_level || COALESCE(' (' || breakdown_type || ')', '') as entity_type,
  COUNT(*),
  MAX(created_at)
FROM staging_ingest.meta_insights_raw
GROUP BY insight_level, breakdown_type;

-- ============================================================================
-- INTERPRETATION
-- ============================================================================
-- 
-- IF YOU SEE:
-- - fact_marketing_daily has 25 records
-- - All meta_* tables have 0 records
-- - Recent job synced ~25 records
-- → You're using the BASIC client
--
-- TO GET COMPREHENSIVE DATA:
-- 1. Add META_USE_COMPREHENSIVE=true to Railway
-- 2. Wait for Railway redeploy
-- 3. Trigger new HISTORICAL job
-- 4. Watch logs for "[Meta Comprehensive]"
--
-- AFTER COMPREHENSIVE CLIENT RUNS:
-- - meta_campaigns: 5-50 records (depends on your account)
-- - meta_adsets: 10-100+ records
-- - meta_ads: 20-200+ records
-- - meta_insights_campaign: 100-1000+ records (campaigns × days)
-- - meta_insights_age_gender: Even more (campaigns × days × age groups × genders)
-- ============================================================================
