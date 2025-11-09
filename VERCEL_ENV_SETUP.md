# Vercel Environment Variables Setup

## Required Environment Variables

Your Vercel deployment needs these environment variables configured:

### 1. NEXT_PUBLIC_SUPABASE_URL
```
https://yxbthgncjpimkslputso.supabase.co
```

### 2. NEXT_PUBLIC_SUPABASE_ANON_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4YnRoZ25janBpbWtzbHB1dHNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNjY0NjYsImV4cCI6MjA3Nzg0MjQ2Nn0.N-V0jcfMeV144rHggHrRdncyHrgIN5EeHq7vKXA-MCc
```

## How to Set Environment Variables in Vercel

### Option 1: Via Vercel Dashboard (Recommended)
1. Go to your Vercel project dashboard
2. Click on "Settings" tab
3. Click on "Environment Variables" in the left sidebar
4. Add each variable:
   - Click "Add New"
   - Enter the variable name (e.g., `NEXT_PUBLIC_SUPABASE_URL`)
   - Enter the value
   - Select environments: Production, Preview, Development (check all)
   - Click "Save"
5. Repeat for both variables
6. Redeploy your application for the changes to take effect

### Option 2: Via Vercel CLI
```bash
# Install Vercel CLI if not already installed
npm install -g vercel

# Link your project (run from project root)
vercel link

# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Paste: https://yxbthgncjpimkslputso.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Paste: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4YnRoZ25janBpbWtzbHB1dHNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNjY0NjYsImV4cCI6MjA3Nzg0MjQ2Nn0.N-V0jcfMeV144rHggHrRdncyHrgIN5EeHq7vKXA-MCc

# Trigger a new deployment
vercel --prod
```

## Verify the Setup

After setting the environment variables and redeploying:

1. Open your Vercel deployment URL
2. Open browser DevTools (F12)
3. Go to the Console tab
4. You should see data loading without any 401 errors
5. The dashboard should display orders and allow you to trigger syncs

## What Was Fixed

The 401 errors were caused by:
1. **Missing anon key in Vercel** - The environment variable wasn't set or had a placeholder value
2. **Database view permissions** - The `public.orders` view had `security_invoker = true` which prevented anon users from accessing it

Both issues have been resolved:
- Local `.env.local` updated with the correct anon key
- Database migration applied to fix view permissions (`security_invoker = false`)
- Supabase API now properly returns data when queried with the anon key

## Architecture Summary

```
Frontend (Vercel)
  ↓ (uses NEXT_PUBLIC_SUPABASE_ANON_KEY)
Public Schema Views (public.orders, public.etl_runs)
  ↓ (security_definer = uses postgres permissions)
Core Warehouse Tables (core_warehouse.orders, core_warehouse.etl_runs)
```

The `public` schema acts as a secure API layer:
- Frontend only queries `public` schema (simple, no `.schema()` calls)
- Views expose only safe fields (no sensitive data)
- RLS policies control what anon users can access
- `reporting` schema remains for your ad-hoc SQL analysis (not exposed to frontend)
