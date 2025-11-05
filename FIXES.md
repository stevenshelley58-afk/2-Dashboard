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

---

## Fix 2: Handle Empty Sync Results (2025-11-05)

### Problem
When a sync is triggered but there are no new records to sync (e.g., no new orders since last sync), the worker would attempt to insert/transform 0 records, which could cause unnecessary database operations and potentially fail.

### Solution
Added early return logic to all integration clients (Shopify, Meta, GA4, Klaviyo) to handle empty results gracefully:

```typescript
// If no records, return early with success
if (records.length === 0) {
  console.log(`[Shopify] No new records to sync`)
  return 0
}
```

This ensures:
- Jobs complete successfully even when there's nothing to sync
- No unnecessary database operations (staging inserts, transforms)
- Clear logging that indicates no new data
- Consistent behavior across all platforms

### Files Changed
- `apps/worker/src/integrations/shopify.ts`
- `apps/worker/src/integrations/meta.ts`
- `apps/worker/src/integrations/ga4.ts`
- `apps/worker/src/integrations/klaviyo.ts`

### Status
- ✅ Code updated and built
- ✅ Pushed to GitHub
- 🔄 Railway auto-deploying with fix

### Expected Behavior
When a user clicks "sync" and there are no new records:
```
[Worker] Processing job abc-123: SHOPIFY INCREMENTAL
[Shopify] Starting INCREMENTAL sync for shop sh_test
[Shopify] Bulk operation created: gid://shopify/BulkOperation/456
[Shopify] Bulk operation status: COMPLETED
[Shopify] Bulk operation complete, downloading...
[Shopify] Downloaded 0 records
[Shopify] No new records to sync
[Worker] Job abc-123 completed successfully (0 records)
```
