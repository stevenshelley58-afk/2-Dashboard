# Manual Migration Steps

Since we can't apply the migration programmatically via API, please follow these simple steps:

## ✅ Apply Database Migration (2 minutes)

### Option 1: Supabase Dashboard SQL Editor (Recommended)

1. **Open SQL Editor:**
   - Go to: https://supabase.com/dashboard/project/yxbthgncjpimkslputso/sql

2. **Copy the migration:**
   ```bash
   # From your local machine, copy the contents:
   cat /workspace/supabase/migrations/20251111100000_add_expanded_shopify_rpcs.sql
   ```

3. **Run in Supabase:**
   - Paste the entire SQL into the SQL Editor
   - Click "Run" button
   - Should complete in ~1 second

4. **Verify functions were created:**
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_name LIKE '%shopify%' 
   AND routine_schema = 'public'
   ORDER BY routine_name;
   ```

   You should see:
   - `insert_staging_shopify_line_items`
   - `insert_staging_shopify_transactions`
   - `insert_staging_shopify_payouts`
   - `truncate_staging_shopify_all`
   - `transform_shopify_line_items`
   - `transform_shopify_transactions`
   - `transform_shopify_payouts`

---

## ✅ Worker Already Deployed

The worker code with expanded Shopify data collection is **already committed and pushed**:
- ✅ Commit: `3beff71` - "feat(shopify): Add line items and transactions sync"
- ✅ Pushed to: `origin/cursor/investigate-shopify-data-and-pipelines-e8cb`

If Railway is linked to this branch, it's already deployed. Otherwise, merge to `main`:
```bash
git checkout main
git merge cursor/investigate-shopify-data-and-pipelines-e8cb
git push origin main
```

---

## 🚀 Test the Deployment

Once the migration is applied:

### 1. Trigger Historical Sync

```bash
curl -X POST https://yxbthgncjpimkslputso.supabase.co/functions/v1/sync \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4YnRoZ25janBpbWtzbHB1dHNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjI2NjQ2NiwiZXhwIjoyMDc3ODQyNDY2fQ.MIsSGYSL8lQlZwUNXM57WxVCnQe8XiWdXGXINndZTLI" \
  -H "Content-Type: application/json" \
  -d '{
    "shop_id": "bohoem58",
    "platform": "SHOPIFY",
    "job_type": "HISTORICAL"
  }'
```

### 2. Monitor Railway Logs

```bash
railway logs
```

Expected output:
```
[Shopify] Downloaded 15,000 records (2,994 orders, 8,500 line items, 3,506 transactions)
[Shopify] Transformed 2994 orders
[Shopify] Transformed 8500 line items
[Shopify] Transformed 3506 transactions
```

### 3. Verify Data in Supabase

```sql
-- Check record counts
SELECT 
  (SELECT COUNT(*) FROM core_warehouse.orders) as orders,
  (SELECT COUNT(*) FROM core_warehouse.order_line_items) as line_items,
  (SELECT COUNT(*) FROM core_warehouse.transactions) as transactions;

-- Top selling products
SELECT 
  product_id,
  SUM(quantity) as total_quantity,
  SUM(quantity * price) as total_revenue,
  COUNT(DISTINCT order_id) as order_count
FROM core_warehouse.order_line_items
WHERE product_id IS NOT NULL
GROUP BY product_id
ORDER BY total_revenue DESC
LIMIT 10;

-- Payment breakdown
SELECT 
  kind,
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM core_warehouse.transactions
GROUP BY kind, status
ORDER BY total_amount DESC;
```

---

## That's It!

Once you apply the SQL migration, everything else is ready to go! 🎉
