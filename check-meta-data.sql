-- Check if comprehensive Meta tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'core_warehouse' AND tablename LIKE 'meta_%' ORDER BY tablename;

-- Check if there are any Meta ETL jobs
SELECT id, platform, job_type, status, created_at, started_at, completed_at, records_synced, error
FROM core_warehouse.etl_runs 
WHERE platform = 'META'
ORDER BY created_at DESC
LIMIT 10;

-- Check if there's data in Meta tables
SELECT 
  (SELECT COUNT(*) FROM core_warehouse.meta_campaigns) as campaigns,
  (SELECT COUNT(*) FROM core_warehouse.meta_adsets) as adsets,
  (SELECT COUNT(*) FROM core_warehouse.meta_ads) as ads,
  (SELECT COUNT(*) FROM core_warehouse.meta_adcreatives) as creatives,
  (SELECT COUNT(*) FROM core_warehouse.meta_insights_campaign) as campaign_insights,
  (SELECT COUNT(*) FROM staging_ingest.meta_entities_raw) as entities_staged,
  (SELECT COUNT(*) FROM staging_ingest.meta_insights_raw) as insights_staged;

-- Check sync cursors for META
SELECT * FROM core_warehouse.sync_cursors WHERE platform = 'META';
