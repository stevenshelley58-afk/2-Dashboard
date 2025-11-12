# Meta Historical Sync Status

## ✅ What's Ready

1. **Code Complete**: Meta comprehensive client updated with chunked historical syncs
2. **Job Queued**: Historical META job is queued and ready to process
3. **Worker Ready**: Worker code is ready and waiting for valid token

## ❌ Current Blocker

**Meta Access Token Expired**
- Token expired: Saturday, 08-Nov-25 17:00:00 PST
- Current time: Wednesday, 12-Nov-25 00:53:36 PST

## 🚀 Quick Start (Once You Have Fresh Token)

```bash
# Option 1: Use the helper script
./start-meta-sync.sh YOUR_NEW_META_TOKEN

# Option 2: Manual start
export META_ACCESS_TOKEN="your-new-token"
export SUPABASE_URL="https://yxbthgncjpimkslputso.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
export META_USE_COMPREHENSIVE="true"
export META_AD_ACCOUNT_ID="5387069344636761"
export META_API_VERSION="v18.0"

cd apps/worker
pnpm dev
```

## 📋 How to Get Fresh Meta Token

### Quick Method (Graph API Explorer)
1. Go to: https://developers.facebook.com/tools/explorer/
2. Select your app
3. Click "Generate Access Token"
4. Select permissions: `ads_read`, `ads_management`, `business_management`
5. Copy the token

### Long-Lived Token (60 days)
Exchange short-lived token for long-lived:
```
GET https://graph.facebook.com/v18.0/oauth/access_token?
  grant_type=fb_exchange_token&
  client_id={app-id}&
  client_secret={app-secret}&
  fb_exchange_token={short-lived-token}
```

### System User Token (Best - No Expiry)
1. Meta Business Settings → System Users
2. Create/Select System User
3. Generate Token with permissions
4. This token doesn't expire until revoked

## 📊 What Will Happen When Started

1. Worker picks up queued job
2. Fetches all Meta entities (campaigns, adsets, ads, creatives)
3. Processes historical insights in 90-day chunks:
   - Base insights
   - Age/gender breakdowns
   - Device/platform breakdowns
   - Geographic breakdowns
4. Downloads creative assets (images/videos)
5. Transforms all data to warehouse tables
6. Updates sync cursor

## ⏱️ Estimated Time

- Small account (<100 campaigns): 30-60 minutes
- Medium account (100-500 campaigns): 1-3 hours
- Large account (>500 campaigns): 3-8 hours

The worker processes chunks sequentially and will continue until complete.

## 🔍 Monitor Progress

Check job status:
```sql
SELECT * FROM core_warehouse.etl_runs 
WHERE platform = 'META' AND job_type = 'HISTORICAL'
ORDER BY created_at DESC 
LIMIT 1;
```

Worker logs will show:
- `[Meta] Processing chunk X/Y`
- `[Meta] Fetched N campaigns`
- `[Meta] Transformed N records`

---

**Status**: Waiting for fresh Meta access token  
**Job ID**: d4172190-e0fb-4f02-87b9-4a9b740889dd  
**Ready to execute**: ✅ YES (once token provided)
