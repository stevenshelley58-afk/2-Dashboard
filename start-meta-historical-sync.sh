#!/bin/bash
# Script to enqueue and start Meta historical sync
# This script requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set

set -e

echo "=== Meta Historical Sync Setup ==="
echo ""

# Check for required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
  echo ""
  echo "To set them:"
  echo "  export SUPABASE_URL='https://your-project.supabase.co'"
  echo "  export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'"
  echo ""
  echo "Then run this script again."
  exit 1
fi

# Get shop_id from argument or use default
SHOP_ID=${1:-"default-shop"}

echo "Using Supabase URL: $SUPABASE_URL"
echo "Shop ID: $SHOP_ID"
echo ""

# Enqueue the job
echo "Enqueuing HISTORICAL META job..."
node enqueue-meta-historical.js "$SHOP_ID" "$SUPABASE_URL" "$SUPABASE_SERVICE_ROLE_KEY"

echo ""
echo "=== Next Steps ==="
echo "1. Ensure the worker is running with:"
echo "   - META_USE_COMPREHENSIVE=true"
echo "   - META_ACCESS_TOKEN=<your-token>"
echo "   - META_AD_ACCOUNT_ID=<your-ad-account-id>"
echo ""
echo "2. The worker will automatically pick up and process the queued job"
echo ""
