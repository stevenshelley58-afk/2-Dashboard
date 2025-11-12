# Expanded Shopify Data - Deployment Guide

**Status:** ✅ Code Complete - Ready for Deployment
**Date:** 2025-11-11

## What Was Built

Expanded Shopify integration to collect and transform:
- ✅ **Line Items** - Product-level order details (quantity, price, variant)
- ✅ **Transactions** - Payment details (captures, refunds, authorization, gateway)
- ✅ **Payouts** - Bank transfers (prepared for future Shopify Payments data)

## Changes Made

### 1. Worker Code (`apps/worker/src/integrations/shopify.ts`)
- ✅ Updated GraphQL query to fetch nested line items and transactions
- ✅ Modified `downloadAndParse()` to separate records by `__typename`
- ✅ Updated `insertToStaging()` to handle all three record types
- ✅ Updated `transformToWarehouse()` to call all transform functions sequentially

### 2. Database Migration (`supabase/migrations/20251111100000_add_expanded_shopify_rpcs.sql`)
- ✅ `insert_staging_shopify_line_items()` - Insert raw line items to staging
- ✅ `insert_staging_shopify_transactions()` - Insert raw transactions to staging
- ✅ `insert_staging_shopify_payouts()` - Insert raw payouts to staging (future use)
- ✅ `truncate_staging_shopify_all()` - Truncate all Shopify staging tables for historical syncs
- ✅ `transform_shopify_line_items()` - Transform line items to warehouse with order FK
- ✅ `transform_shopify_transactions()` - Transform transactions to warehouse with order FK
- ✅ `transform_shopify_payouts()` - Transform payouts to warehouse (future use)

### 3. Compilation Status
- ✅ TypeScript builds successfully with no errors
- ✅ All dependencies resolved

## Deployment Steps

### Step 1: Apply Database Migration

**Option A: Supabase Dashboard (Recommended)**
1. Go to Supabase Dashboard → SQL Editor
2. Open the migration file: `supabase/migrations/20251111100000_add_expanded_shopify_rpcs.sql`
3. Copy and paste the entire contents
4. Click "Run" to execute
5. Verify all 7 functions were created successfully

**Option B: Supabase CLI (If Available)**
```bash
supabase db push
```

### Step 2: Deploy Worker to Railway

Since the worker code has changed, you need to redeploy:

```bash
cd /workspace/apps/worker
git add .
git commit -m "feat(shopify): add line items and transactions sync"
git push origin main
```

Railway will automatically rebuild and deploy the worker.

### Step 3: Trigger Historical Sync

Test the expanded data collection with a historical sync:

**Option A: Via Edge Function**
```bash
curl -X POST https://YOUR_SUPABASE_URL/functions/v1/sync \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "shop_id": "bohoem58",
    "platform": "SHOPIFY",
    "job_type": "HISTORICAL"
  }'
```

**Option B: Via Supabase Dashboard**
```sql
-- Insert a job into the queue
SELECT enqueue_job('bohoem58', 'SHOPIFY', 'HISTORICAL');
```

The worker will pick it up automatically.

### Step 4: Monitor Progress

Watch the Railway logs to see the sync progress:

```bash
railway logs
```

You should see output like:
```
[Shopify] Downloaded 15,000 records (2,994 orders, 8,500 line items, 3,506 transactions)
[Shopify] Transformed 2994 orders
[Shopify] Transformed 8500 line items
[Shopify] Transformed 3506 transactions
```

### Step 5: Verify Data

Check the warehouse tables to confirm data was loaded:

```sql
-- Check orders
SELECT COUNT(*) FROM core_warehouse.orders;

-- Check line items (should have more records than orders)
SELECT COUNT(*) FROM core_warehouse.order_line_items;

-- Check transactions
SELECT COUNT(*) FROM core_warehouse.transactions;

-- Sample query: Top products by quantity sold
SELECT 
  product_id,
  COUNT(*) as order_count,
  SUM(quantity) as total_quantity,
  SUM(quantity * price) as total_revenue
FROM core_warehouse.order_line_items
WHERE product_id IS NOT NULL
GROUP BY product_id
ORDER BY total_revenue DESC
LIMIT 10;

-- Sample query: Payment methods breakdown
SELECT 
  kind,
  status,
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount
FROM core_warehouse.transactions
GROUP BY kind, status
ORDER BY total_amount DESC;
```

## What You'll Get

Once deployed, you'll have access to:

### Product-Level Insights
- Which products/variants are selling
- Quantity sold per product
- Revenue by product
- Average price per variant

### Payment Details
- Payment methods used (gateway)
- Transaction types (capture, refund, authorization)
- Transaction status tracking
- Refund analysis

### Future: Cash Flow Visibility
- When payouts were issued
- Payout amounts and status
- (Requires separate payout sync - not yet implemented)

## Incremental Syncs

Going forward, incremental syncs will automatically collect:
- New orders **with their line items and transactions**
- Updated orders **with refreshed line items and transactions**

The cursor management remains unchanged - it tracks at the order level.

## Troubleshooting

### Error: "Function does not exist"
- Migration wasn't applied. Go back to Step 1.

### Error: "Column does not exist"
- Database schema missing. Check that `20251104144705_init_schemas.sql` was applied.
- Tables should exist: `core_warehouse.order_line_items` and `core_warehouse.transactions`

### No line items or transactions synced
- Check Shopify API permissions - ensure the access token has permission to read line items and transactions
- Check Railway logs for GraphQL errors

### Line items have NULL order_id
- The `__parentId` field from Shopify Bulk Operations might not be matching
- Check staging data: `SELECT raw_data FROM staging_ingest.shopify_line_items_raw LIMIT 1;`
- Verify the `__parentId` matches an order's `id`

## Next Steps

After successful deployment:
1. ✅ Verify data quality in warehouse tables
2. ✅ Build frontend views for product performance
3. ✅ Add payment method breakdown charts
4. ✅ Create refund tracking dashboard
5. ⚪ Implement Shopify Payments payout sync (optional)

## Rollback Plan

If something goes wrong:

1. **Revert Worker Code:**
```bash
git revert HEAD
git push origin main
```

2. **Drop New Functions (if needed):**
```sql
DROP FUNCTION IF EXISTS insert_staging_shopify_line_items(json);
DROP FUNCTION IF EXISTS insert_staging_shopify_transactions(json);
DROP FUNCTION IF EXISTS truncate_staging_shopify_all();
DROP FUNCTION IF EXISTS transform_shopify_line_items(text);
DROP FUNCTION IF EXISTS transform_shopify_transactions(text);
```

The old orders-only sync will continue working.

---

**Ready to Deploy!** 🚀
