# Next Steps: Debug Why Comprehensive Client Isn't Running

## What I Just Did

✅ Added debug logging to `apps/worker/src/index.ts`
✅ Committed and pushed to GitHub
✅ Railway will auto-deploy in ~2 minutes

## What You'll See in Logs

After Railway redeploys, when you trigger a new Meta job, you'll see:

### If Variable Is Missing (Current Issue)
```
[Worker] Processing job <id>: META HISTORICAL
[DEBUG META] Checking META_USE_COMPREHENSIVE variable...
[DEBUG META] Raw value: undefined            ← PROBLEM!
[DEBUG META] Type: undefined
[DEBUG META] useComprehensive result: false
[DEBUG META] ❌ Using BASIC client (MetaClient) - legacy
[Meta] Starting HISTORICAL sync              ← Basic client
```

### If Variable Is Set Correctly
```
[Worker] Processing job <id>: META HISTORICAL
[DEBUG META] Checking META_USE_COMPREHENSIVE variable...
[DEBUG META] Raw value: true                 ← GOOD!
[DEBUG META] Type: string
[DEBUG META] useComprehensive result: true
[DEBUG META] ✅ Using COMPREHENSIVE client (MetaComprehensiveClient)
[Meta Comprehensive] Starting HISTORICAL sync ← Comprehensive client!
```

---

## What To Do Now

### Step 1: Wait for Railway Deploy (2 minutes)

Go to Railway Dashboard → Your Worker → **Deployments** tab

Watch for new deployment to complete (status: **SUCCESS**)

### Step 2: Verify Variable in Railway

While waiting, double-check Railway Dashboard → Your Worker → **Variables** tab

**Make absolutely sure you see:**
```
META_USE_COMPREHENSIVE = true
```

**If it's not there:**
1. Click **New Variable**
2. Variable name: `META_USE_COMPREHENSIVE`
3. Value: `true` (lowercase, no quotes)
4. Click **Add**

### Step 3: Trigger New Job

Once Railway shows "Deployed", run in Supabase SQL Editor:

```sql
INSERT INTO core_warehouse.etl_runs (shop_id, status, job_type, platform)
VALUES ('sh_test', 'QUEUED', 'HISTORICAL', 'META')
RETURNING id, created_at;
```

### Step 4: Check Railway Logs

Railway → Worker → Deployments → Latest → **View Logs**

Look for the `[DEBUG META]` lines. They'll tell us exactly what's wrong.

---

## Possible Outcomes

### Outcome 1: Variable Is Undefined
```
[DEBUG META] Raw value: undefined
```

**Fix:** Add `META_USE_COMPREHENSIVE=true` to Railway variables
- You forgot to add it, or
- Railway didn't save it properly

### Outcome 2: Variable Is Wrong Value
```
[DEBUG META] Raw value: True
[DEBUG META] useComprehensive result: false
```

**Fix:** Change value to exactly `true` (lowercase)
- Not `True`, `TRUE`, `"true"`, `1`, etc.
- Must be exactly: `true`

### Outcome 3: Variable Is Correct But Still Basic
```
[DEBUG META] Raw value: true
[DEBUG META] Type: string
[DEBUG META] useComprehensive result: false  ← Shouldn't happen!
```

**Fix:** This would be bizarre. Possible code issue.

### Outcome 4: Success! ✅
```
[DEBUG META] Raw value: true
[DEBUG META] useComprehensive result: true
[DEBUG META] ✅ Using COMPREHENSIVE client
[Meta Comprehensive] Starting HISTORICAL sync
```

**Next:** Watch logs for comprehensive data fetch

---

## After We Fix It

Once debug logs show the comprehensive client is running, you'll see:

```
[Meta Comprehensive] Starting HISTORICAL sync for shop sh_test
[Meta] Step 1: Fetching entity hierarchy...
[Meta] Fetched 5 campaigns
[Meta] Fetched 12 ad sets
[Meta] Fetched 23 ads
[Meta] Fetching 18 unique creatives
[Meta] Step 2: Fetching insights...
[Meta] Fetching campaign-level insights from 2025-08-14 to 2025-11-12
[Meta] Fetching campaign-level age/gender breakdown...
[Meta] Fetching campaign-level device breakdown...
[Meta] Fetching campaign-level geo breakdown...
[Meta] Fetching adset-level insights...
[Meta] Fetching ad-level insights...
[Meta] Step 3: Downloading creative assets...
[Meta] Downloading 15 images...
[Meta Comprehensive] Sync complete: { entities: 58, insights: 234, assets: 15 }
[Worker] Job completed successfully (307 records)
```

Then verify data:

```sql
SELECT COUNT(*) as campaigns FROM core_warehouse.meta_campaigns;
SELECT COUNT(*) as ads FROM core_warehouse.meta_ads;
SELECT COUNT(*) as insights FROM core_warehouse.meta_insights_campaign;
```

---

## Timeline

- ⏱️ **Now:** Code pushed, Railway deploying
- ⏱️ **+2 min:** Railway deploy complete
- ⏱️ **+2.5 min:** Add variable if not there
- ⏱️ **+3 min:** Trigger new job
- ⏱️ **+3.5 min:** See debug logs
- ⏱️ **+4 min:** Fix issue based on logs
- ⏱️ **+6 min:** Trigger final job
- ⏱️ **+16 min:** Comprehensive data fetched! ✅

---

## Summary

**The debug logs will show us exactly why the comprehensive client isn't running.**

Most likely: Variable simply isn't in Railway yet.

**After you see the debug logs in the next job, send them to me and I'll tell you exactly what to fix.**
