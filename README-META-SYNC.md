# Meta Historical Sync - Ready to Execute

## ✅ Code Changes Completed

I've successfully updated the Meta comprehensive client to handle full historical syncs:

1. **Chunked Historical Syncs**: Processes entire account timeline in 90-day chunks
2. **Sequential Processing**: Each chunk is transformed before moving to the next
3. **Cursor Updates**: Sync cursor is updated after successful historical sync
4. **Rate Limiting**: Delays between chunks to avoid API rate limits

## 🚀 To Execute the Historical Sync

You have **3 options** to enqueue the job:

### Option 1: Using Supabase Edge Function (Recommended)

```bash
# Get your anon key from Supabase Dashboard → Settings → API
export SUPABASE_ANON_KEY="your-anon-key-here"

# Enqueue the job
node direct-enqueue-meta.js [shop_id]
```

### Option 2: Using Direct Database Access

```bash
# Set your service role key (from Supabase Dashboard → Settings → API)
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"

# Enqueue the job
cd apps/worker
node ../../enqueue-via-sql.js [shop_id]
```

### Option 3: Using the Helper Script

```bash
export SUPABASE_URL="https://yxbthgncjpimkslputso.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

./start-meta-historical-sync.sh [shop_id]
```

## 📋 Prerequisites

Before running, ensure:

1. **Worker Environment Variables** (in Railway or your worker environment):
   - `META_USE_COMPREHENSIVE=true` ⚠️ **CRITICAL**
   - `META_ACCESS_TOKEN=<your-meta-access-token>`
   - `META_AD_ACCOUNT_ID=<your-ad-account-id>`
   - `SUPABASE_URL=https://yxbthgncjpimkslputso.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>`

2. **Worker is Running**: The worker will automatically pick up queued jobs

## 🔍 Verify Job Status

After enqueuing, check the job status:

```sql
-- Check job status
SELECT * FROM core_warehouse.etl_runs 
WHERE platform = 'META' AND job_type = 'HISTORICAL'
ORDER BY created_at DESC 
LIMIT 5;
```

## 📊 What Happens During Sync

1. **Entity Sync**: Fetches all campaigns, adsets, ads, creatives
2. **Historical Insights**: Processes entire timeline in 90-day chunks
   - Base insights (no breakdown)
   - Age/gender breakdown
   - Device/platform breakdown  
   - Geographic breakdown
3. **Transformation**: Each chunk is transformed before next chunk
4. **Asset Download**: Downloads creative images and videos
5. **Cursor Update**: Updates sync cursor when complete

## ⚠️ Important Notes

- Historical syncs can take **hours** depending on account size
- Each 90-day chunk processes all insight levels and breakdowns
- Worker will process chunks sequentially
- Check worker logs for progress updates

## 🛠️ Troubleshooting

**Job stays QUEUED:**
- Check worker is running
- Verify `META_USE_COMPREHENSIVE=true` is set
- Check worker logs for errors

**Job fails:**
- Verify Meta API credentials are correct
- Check Meta API rate limits
- Review error details in `core_warehouse.etl_runs.error` column

---

**Project**: yxbthgncjpimkslputso  
**Supabase URL**: https://yxbthgncjpimkslputso.supabase.co  
**Ready to execute**: ✅
