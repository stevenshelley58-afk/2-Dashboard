# Supabase Deployment Commands

## 1. Database Migrations

```bash
supabase db push
```

If you get migration history conflicts:

```bash
supabase migration repair --status reverted
supabase db push
```

## 2. Deploy Edge Functions

```bash
supabase functions deploy shops
supabase functions deploy shop-metrics
supabase functions deploy shop-sync-status
supabase functions deploy shop-sync
supabase functions deploy shop-meta-connect
```

## All-in-One Command

```bash
supabase functions deploy shops && supabase functions deploy shop-metrics && supabase functions deploy shop-sync-status && supabase functions deploy shop-sync && supabase functions deploy shop-meta-connect
```

## Verify

```bash
supabase functions list
```

