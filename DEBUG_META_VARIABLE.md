# Debug: Why META_USE_COMPREHENSIVE Isn't Working

## The Problem

You triggered 2 Meta jobs and both used the basic client:
- Job 1: `8c5c4a6b-941d-4374-bf70-d03ef55f7139` - 25 records
- Job 2: `8d58567b-a56d-4a87-9344-38a28903f48d` - 25 records

Both show:
```
[Meta] Starting HISTORICAL sync    ← Should say "[Meta Comprehensive]"
[Meta] Fetching insights from...   ← No entity fetching
[Meta] Transformed 25 records      ← Too few records
```

## Root Cause

The worker code checks for `META_USE_COMPREHENSIVE` like this:

```typescript
const useComprehensive = process.env.META_USE_COMPREHENSIVE === 'true'

if (useComprehensive) {
  // Use comprehensive client
} else {
  // Use basic client ← Currently running this
}
```

**Possible reasons:**
1. Variable not in Railway yet
2. Variable has wrong value (must be exactly `true`)
3. Railway hasn't redeployed with the new variable
4. Worker process needs hard restart

---

## Step-by-Step Fix

### Step 1: Verify Railway Variable (Screenshot)

Go to Railway Dashboard → Your Worker Service → **Variables** tab

Take a screenshot or verify you see **EXACTLY**:
```
Variable Name: META_USE_COMPREHENSIVE
Value: true
```

**Common mistakes:**
- ❌ `True` (capital T)
- ❌ `TRUE` (all caps)
- ❌ `"true"` (with quotes)
- ✅ `true` (lowercase, no quotes)

### Step 2: Check Railway Deployment Status

Railway Dashboard → Your Worker Service → **Deployments** tab

Look at the latest deployment:
- Status should be **"SUCCESS"** or **"DEPLOYED"**
- Timestamp should be AFTER you added the variable
- If it's old (from before you added variable), click **Redeploy**

### Step 3: Verify Worker Sees the Variable

Add a temporary log to check. But first, let's check via Railway CLI if possible.

**Alternative:** Check Railway environment page to see ALL variables are listed

### Step 4: Hard Restart Worker

If Railway shows "Deployed" but still using basic client:

**Option A:** Redeploy
- Railway → Deployments → Latest → **Redeploy**

**Option B:** Restart Service
- Railway → Service Settings → **Restart**

**Option C:** Add dummy variable to force redeploy
- Add `DEBUG_META=1` to variables
- Railway will auto-redeploy
- Remove it after

### Step 5: Verify Environment in Logs

After redeploying, you should see worker startup logs. Check if it logs the environment (some apps do):

```
[Worker] Starting ETL worker...
[Worker] Environment: production
[Worker] Polling every 30 seconds...
```

---

## Quick Test: Add Debug Logging

If you have access to the code, temporarily add this to `apps/worker/src/index.ts`:

```typescript
// Around line 100-110 in the META case
case Platform.META: {
  console.log('[DEBUG] META_USE_COMPREHENSIVE:', process.env.META_USE_COMPREHENSIVE)
  console.log('[DEBUG] Type:', typeof process.env.META_USE_COMPREHENSIVE)
  const useComprehensive = process.env.META_USE_COMPREHENSIVE === 'true'
  console.log('[DEBUG] useComprehensive:', useComprehensive)
  
  if (useComprehensive) {
    console.log('[DEBUG] Using COMPREHENSIVE client')
    // ...
  } else {
    console.log('[DEBUG] Using BASIC client')
    // ...
  }
}
```

Commit, push, Railway will redeploy, then trigger another job to see what it logs.

---

## Alternative: Check Railway Environment via API

If you have Railway CLI installed locally:

```bash
# Link to your project (if not already)
railway link

# Check environment variables
railway variables

# You should see:
# META_USE_COMPREHENSIVE=true
```

---

## Nuclear Option: Manual Code Change

If variable isn't working for some reason, temporarily hard-code it:

In `apps/worker/src/index.ts` around line 102:

```typescript
case Platform.META: {
  // TEMPORARY: Force comprehensive client
  const useComprehensive = true  // Force to true
  // const useComprehensive = process.env.META_USE_COMPREHENSIVE === 'true'
  
  if (useComprehensive) {
    // ...
```

Commit, push, Railway redeploys, trigger job.

**Don't forget to revert this after testing!**

---

## Verify It's Working

After fixing, trigger a new job:

```sql
INSERT INTO core_warehouse.etl_runs (shop_id, status, job_type, platform)
VALUES ('sh_test', 'QUEUED', 'HISTORICAL', 'META')
RETURNING id, created_at;
```

**Watch Railway logs for:**
```
[Meta Comprehensive] Starting HISTORICAL sync  ← KEY!
[Meta] Step 1: Fetching entity hierarchy...
[Meta] Fetched X campaigns
```

If you still see `[Meta] Starting` (not Comprehensive), the variable isn't being read.

---

## Double Check: Which Client File Is Running?

The worker has TWO Meta client files:
- `meta.ts` - Basic client (just insights)
- `meta-comprehensive.ts` - Comprehensive client (entities + insights + assets)

The code should route to comprehensive when `META_USE_COMPREHENSIVE=true`:

```typescript
if (useComprehensive) {
  const metaClient = new MetaComprehensiveClient(...)  // This one!
} else {
  const metaClient = new MetaClient(...)  // Currently running this
}
```

---

## Most Likely Issues (In Order)

1. **Variable not added yet** (50% chance)
   - Go add it now in Railway

2. **Railway hasn't redeployed** (30% chance)
   - Wait 2 more minutes or click Redeploy

3. **Variable has wrong value** (15% chance)
   - Check it's exactly `true` lowercase

4. **Worker cached/stuck** (5% chance)
   - Hard restart the service

---

## What To Do Right Now

1. **Screenshot Railway variables page** - verify `META_USE_COMPREHENSIVE=true` is there
2. **Check Railway deployments** - verify latest deploy timestamp
3. **Click Redeploy** if needed
4. **Wait 2 minutes** for deploy to complete
5. **Trigger new job** with SQL
6. **Watch logs** for "[Meta Comprehensive]"

If you still see "[Meta]" instead of "[Meta Comprehensive]", we'll need to add debug logging to the code.

---

## Success Criteria

✅ **Variable exists** in Railway with value `true`
✅ **Railway redeployed** after variable was added
✅ **Logs show** `[Meta Comprehensive]`
✅ **Record count** is 100+ (not 25)
✅ **Comprehensive tables** have data

Let me know what you see in Railway variables page!
