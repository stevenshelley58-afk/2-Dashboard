# Deploy Frontend to Vercel

## Step 1: Connect to Vercel (2 minutes)

1. Go to https://vercel.com/new
2. Click **"Import Git Repository"**
3. Select **`stevenshelley58-afk/2-Dashboard`** from GitHub
4. Vercel will auto-detect the monorepo

## Step 2: Configure Project (1 minute)

**Framework Preset:** Next.js (should auto-detect)

**Root Directory:** `apps/web`
- Click **"Edit"** next to Root Directory
- Select or type: `apps/web`

**Build Settings:**
- Build Command: `pnpm build` (auto-detected)
- Output Directory: `.next` (auto-detected)
- Install Command: `pnpm install` (auto-detected)

## Step 3: Add Environment Variables (1 minute)

Click **"Environment Variables"** and add:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://yxbthgncjpimkslputso.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Get from Supabase Dashboard → Settings → API → `anon public` key |

**How to get the anon key:**
1. Go to https://supabase.com/dashboard/project/yxbthgncjpimkslputso/settings/api
2. Copy the **`anon public`** key (not the service_role key!)
3. Paste it into Vercel

## Step 4: Deploy (2 minutes)

Click **"Deploy"**

Watch the deployment logs:
- Should see pnpm install
- Should see Next.js build
- Should complete in ~2 minutes

## Step 5: Verify Dashboard (30 seconds)

Once deployed, Vercel will give you a URL like:
```
https://2-dashboard-<random>.vercel.app
```

Visit the URL and you should see:
- **Dashboard page** with stats cards (Total Orders, Revenue, Avg Order Value)
- **"Trigger Sync" button**
- **Recent Jobs table** showing sync history
- **Recent Orders table** showing Shopify orders

## Step 6: Test the Dashboard (1 minute)

1. **View Orders**: Should show the 2,999 orders from your last sync
2. **Click "Trigger Sync"**: Should queue a new job
3. **Watch Jobs Table**: Should show the new job status changing:
   - QUEUED → IN_PROGRESS → SUCCEEDED
4. **Auto-refresh**: Page refreshes every 5 seconds automatically

---

## Expected Result

✅ Dashboard is live on Vercel
✅ Shows real-time data from Supabase
✅ "Trigger Sync" button queues jobs successfully
✅ Job status updates automatically
✅ Orders table displays Shopify data

---

## Custom Domain (Optional)

After successful deployment, you can add a custom domain:

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add your domain (e.g., `dashboard.yourdomain.com`)
3. Follow Vercel's DNS configuration instructions

---

## Architecture Summary

```
┌─────────────┐
│   Browser   │ ← User visits dashboard
└──────┬──────┘
       │
       ↓
┌─────────────┐
│   Vercel    │ ← Next.js app (SSR + Client-side)
│  (Frontend) │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│  Supabase   │ ← PostgreSQL database
│   (HTTP)    │    - Read orders
└──────┬──────┘    - Queue sync jobs
       │           - Monitor job status
       ↓
┌─────────────┐
│   Railway   │ ← Worker polls for jobs
│   (Worker)  │    - Processes QUEUED jobs
└──────┬──────┘    - Syncs Shopify data
       │
       ↓
┌─────────────┐
│   Shopify   │ ← Source data
│     API     │
└─────────────┘
```

---

## Troubleshooting

**"Network Error" when clicking "Trigger Sync"**
- Check that `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set correctly
- Verify Supabase Row Level Security (RLS) allows inserts to `etl_runs` table

**No orders showing**
- Check that Railway worker has successfully synced data
- Verify Supabase has data in `core_warehouse.orders` table
- Check browser console for errors

**Build fails on Vercel**
- Ensure Root Directory is set to `apps/web`
- Check that all dependencies are in package.json
- Review Vercel build logs for specific error

---

Total deployment time: ~5-10 minutes
