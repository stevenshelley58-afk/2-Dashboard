#!/bin/bash
# Auto-start Meta Historical Sync Worker
# Usage: ./start-meta-sync.sh [META_ACCESS_TOKEN]

set -e

echo "=========================================="
echo "Meta Historical Sync Worker"
echo "=========================================="
echo ""

# Get token from argument or environment
META_TOKEN="${1:-${META_ACCESS_TOKEN}}"

if [ -z "$META_TOKEN" ]; then
  echo "❌ Error: Meta access token required"
  echo ""
  echo "Usage: ./start-meta-sync.sh [META_ACCESS_TOKEN]"
  echo "   OR: export META_ACCESS_TOKEN='your-token' && ./start-meta-sync.sh"
  echo ""
  echo "To get a fresh token:"
  echo "1. Go to https://developers.facebook.com/tools/explorer/"
  echo "2. Select your app and get User Token"
  echo "3. Exchange for Long-Lived Token (60 days)"
  echo ""
  exit 1
fi

# Verify token is valid
echo "🔍 Verifying Meta access token..."
TOKEN_CHECK=$(curl -s "https://graph.facebook.com/v18.0/me?access_token=${META_TOKEN}" 2>&1)

if echo "$TOKEN_CHECK" | grep -q "error"; then
  echo "❌ Token validation failed:"
  echo "$TOKEN_CHECK" | head -3
  echo ""
  echo "Please get a fresh token and try again."
  exit 1
fi

echo "✅ Token is valid!"
echo ""

# Set all environment variables
export SUPABASE_URL="https://yxbthgncjpimkslputso.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4YnRoZ25janBpbWtzbHB1dHNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjI2NjQ2NiwiZXhwIjoyMDc3ODQyNDY2fQ.MIsSGYSL8lQlZwUNXM57WxVCnQe8XiWdXGXINndZTLI"
export META_USE_COMPREHENSIVE="true"
export META_ACCESS_TOKEN="${META_TOKEN}"
export META_AD_ACCOUNT_ID="5387069344636761"
export META_API_VERSION="v18.0"

echo "📋 Configuration:"
echo "   Supabase URL: $SUPABASE_URL"
echo "   Meta Ad Account: $META_AD_ACCOUNT_ID"
echo "   Comprehensive Mode: Enabled"
echo ""

# Check if job is queued
echo "🔍 Checking for queued jobs..."
cd /workspace/apps/worker

QUEUED_JOB=$(node -e "
import('@supabase/supabase-js').then(async ({ createClient }) => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await supabase.rpc('poll_queued_job');
  if (data) {
    console.log(data.id);
  }
});
" 2>/dev/null || echo "")

if [ -z "$QUEUED_JOB" ]; then
  echo "📝 No queued job found. Enqueuing new HISTORICAL META job..."
  node -e "
  import('@supabase/supabase-js').then(async ({ createClient }) => {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.rpc('enqueue_etl_job', {
      p_shop_id: 'BHM',
      p_job_type: 'HISTORICAL',
      p_platform: 'META'
    });
    if (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
    console.log('✅ Job enqueued! Run ID:', data.run_id);
  });
  " 2>&1
else
  echo "✅ Found queued job: $QUEUED_JOB"
fi

echo ""
echo "🚀 Starting worker..."
echo "   The worker will process the job automatically."
echo "   Press Ctrl+C to stop."
echo ""

# Start worker
cd /workspace/apps/worker
pnpm dev
