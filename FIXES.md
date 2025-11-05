# Production Fixes

## Fix 1: Shopify Order Deduplication (2025-11-05)

### Problem
Worker successfully downloaded 2,994 orders from Shopify but failed during transform with error:
```
ON CONFLICT DO UPDATE command cannot affect row a second time
```

### Root Cause
Shopify's Bulk Operations API returns duplicate records in the JSONL file (same order appears multiple times). When inserting all records at once, PostgreSQL's `ON CONFLICT DO UPDATE` tries to update the same row twice in a single INSERT statement, which is not allowed.

### Solution
Modified `transform_shopify_orders()` RPC function to use `DISTINCT ON (shopify_gid)` to deduplicate records before inserting:

```sql
SELECT DISTINCT ON (shopify_gid)
  p_shop_id as shop_id,
  raw_data->>'id' as shopify_gid,
  -- ... other fields
FROM staging_ingest.shopify_orders_raw
ORDER BY raw_data->>'id', (raw_data->>'updatedAt')::timestamptz DESC
```

This ensures:
- Only one record per `shopify_gid` is inserted
- If duplicates exist, we keep the most recently updated version
- No more "cannot affect row a second time" errors

### Files Changed
- `supabase/migrations/20251105000000_add_worker_rpc_functions.sql`

### Status
- ✅ Migration applied to Supabase
- ✅ Code pushed to GitHub
- 🔄 Railway auto-deploying with fix

### Next Test
Insert a QUEUED job and verify it completes successfully:
```sql
INSERT INTO core_warehouse.etl_runs (shop_id, status, job_type, platform)
VALUES ('sh_test', 'QUEUED', 'INCREMENTAL', 'SHOPIFY');
```
