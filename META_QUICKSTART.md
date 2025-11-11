# Meta Ads Quick Start - 5 Minutes to Data

## TL;DR

You have all the code. You just need to:
1. Add 4 environment variables to Railway
2. Run one SQL query in Supabase
3. Watch your data flow in

---

## Step 1: Add Railway Environment Variables (2 min)

Railway Dashboard → Your Worker → Variables → Add these:

```bash
META_ACCESS_TOKEN=<get-from-meta-graph-api-explorer>
META_AD_ACCOUNT_ID=act_1234567890
META_USE_COMPREHENSIVE=true
META_API_VERSION=v21.0
```

**Get your credentials:**
- **Account ID**: Go to Meta Ads Manager, look at URL → `act=1234567890`
- **Access Token**: Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer) → Generate Token → Select `ads_read` + `read_insights` permissions

Railway will auto-redeploy with new variables.

---

## Step 2: Trigger Meta Sync (30 seconds)

Supabase Dashboard → SQL Editor → Paste and run:

```sql
INSERT INTO core_warehouse.etl_runs (shop_id, status, job_type, platform)
VALUES ('sh_test', 'QUEUED', 'HISTORICAL', 'META');
```

---

## Step 3: Watch Railway Logs (5-10 min)

Railway → Worker → Logs

You'll see:
```
[Meta Comprehensive] Starting HISTORICAL sync
[Meta] Fetched 5 campaigns
[Meta] Fetched 12 ad sets
[Meta] Fetched 23 ads
[Meta] Fetching 18 unique creatives
[Meta] Sync complete: { entities: 58, insights: 234, assets: 15 }
```

---

## Step 4: Check Your Data (30 seconds)

Supabase SQL Editor:

```sql
-- Quick status check
\i check-meta-status.sql

-- Or manually check:
SELECT COUNT(*) FROM core_warehouse.meta_campaigns;
SELECT COUNT(*) FROM core_warehouse.meta_insights_campaign;
```

---

## What You Get

### Entity Data
- ✅ Campaigns (name, status, objective, budget)
- ✅ Ad Sets (targeting, optimization)
- ✅ Ads (tracking, conversion specs)
- ✅ Creatives (copy, images, videos)

### Performance Data (Daily)
- ✅ Campaign insights
- ✅ Ad Set insights  
- ✅ Ad insights
- ✅ Age/Gender breakdown
- ✅ Device/Platform breakdown
- ✅ Geographic breakdown

### Metrics
- Spend, Impressions, Clicks, Reach
- CPM, CPC, CTR
- Conversions (add to cart, checkout, purchase)
- Revenue (purchase value)
- ROAS calculation

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid OAuth token" | Regenerate token in Graph API Explorer |
| "Unsupported get request" | Check account ID has `act_` prefix |
| Job stays QUEUED | Check Railway worker logs, verify environment vars |
| No insights data | Meta has 1-day delay, check tomorrow |

---

## Files Created

- ✅ `META_SETUP_GUIDE.md` - Detailed setup instructions
- ✅ `enqueue-meta-job.sql` - SQL to trigger jobs
- ✅ `check-meta-status.sql` - SQL to check data status
- ✅ `META_QUICKSTART.md` - This file

---

**Ready? Add those variables and trigger the sync!** 🚀

Problems? Check the full guide: `META_SETUP_GUIDE.md`
