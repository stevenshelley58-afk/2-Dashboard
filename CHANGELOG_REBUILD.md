# Changelog (Rebuild)

## 2025-11-19

- Added sequential Shopify onboarding flow: seed incremental job (last 7 days) auto-enqueues historical backfill after success.
- Extended sync workers to use job metadata, queue follow-up jobs, and support configurable lookback windows.
- Built UI indicators for seed vs historical jobs plus empty-state messaging; default date range now last 7 days.

## 2025-11-18

- Performed repo + Supabase hard reset, deleted all legacy UI/worker/config code.
- Applied reset migration `20260101000000_reset_for_rebuild.sql` to recreate empty schemas.
- Added new documentation baseline: `REBUILD_SPEC.md`, `ENV_SPEC.md`, `PROGRESS_REBUILD.md`.***

