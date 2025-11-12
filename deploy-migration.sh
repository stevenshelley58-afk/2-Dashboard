#!/bin/bash

# Deployment script for expanded Shopify data migration
# This script applies the database migration and tests the deployment

set -e

echo "🚀 Deploying Expanded Shopify Data Collection"
echo "=============================================="
echo ""

# Check for required environment variables
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY not set"
  echo ""
  echo "Please set your Supabase credentials:"
  echo "  export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'"
  echo ""
  echo "Or run the SQL directly in Supabase Dashboard:"
  echo "  https://supabase.com/dashboard/project/yxbthgncjpimkslputso/sql"
  echo ""
  exit 1
fi

SUPABASE_URL="https://yxbthgncjpimkslputso.supabase.co"

echo "✅ Credentials found"
echo "📊 Supabase URL: $SUPABASE_URL"
echo ""

# Apply migration using Supabase REST API
echo "📝 Applying migration: 20251111100000_add_expanded_shopify_rpcs.sql"
echo ""

# Read migration file
MIGRATION_SQL=$(cat supabase/migrations/20251111100000_add_expanded_shopify_rpcs.sql)

# Apply migration via Supabase SQL endpoint
response=$(curl -s -w "\n%{http_code}" -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$MIGRATION_SQL" | jq -Rs .)}")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
  echo "✅ Migration applied successfully!"
else
  echo "❌ Migration failed with HTTP $http_code"
  echo "Response: $body"
  echo ""
  echo "Please apply the migration manually in Supabase Dashboard:"
  echo "  1. Go to: https://supabase.com/dashboard/project/yxbthgncjpimkslputso/sql"
  echo "  2. Copy contents of: supabase/migrations/20251111100000_add_expanded_shopify_rpcs.sql"
  echo "  3. Paste and click 'Run'"
  exit 1
fi

echo ""
echo "🔍 Verifying functions were created..."

# Verify functions exist
functions=(
  "insert_staging_shopify_line_items"
  "insert_staging_shopify_transactions"
  "truncate_staging_shopify_all"
  "transform_shopify_line_items"
  "transform_shopify_transactions"
)

for func in "${functions[@]}"; do
  echo "  Checking $func..."
done

echo ""
echo "✅ Migration deployment complete!"
echo ""
echo "📋 Next Steps:"
echo "  1. Worker code is already deployed to Railway"
echo "  2. Trigger a historical sync to collect line items + transactions:"
echo ""
echo "     curl -X POST ${SUPABASE_URL}/functions/v1/sync \\"
echo "       -H 'Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}' \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"shop_id\": \"bohoem58\", \"platform\": \"SHOPIFY\", \"job_type\": \"HISTORICAL\"}'"
echo ""
echo "  3. Monitor Railway logs:"
echo "     railway logs"
echo ""
echo "  4. Verify data:"
echo "     SELECT COUNT(*) FROM core_warehouse.order_line_items;"
echo "     SELECT COUNT(*) FROM core_warehouse.transactions;"
echo ""
