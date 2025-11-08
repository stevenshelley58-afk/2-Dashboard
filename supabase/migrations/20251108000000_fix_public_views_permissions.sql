-- Fix public views to use security definer instead of security invoker
-- This allows anon users to query the views without needing direct access to underlying tables

-- Remove security_invoker setting from views
ALTER VIEW public.orders SET (security_invoker = false);
ALTER VIEW public.etl_runs SET (security_invoker = false);

-- Ensure anon role still has SELECT permission on the views
GRANT SELECT ON public.orders TO anon;
GRANT SELECT ON public.etl_runs TO anon;

-- Add comment explaining the permission model
COMMENT ON VIEW public.orders IS 'Public view of orders - uses security definer to allow anon access without exposing core_warehouse schema';
COMMENT ON VIEW public.etl_runs IS 'Public view of ETL runs - uses security definer to allow anon access without exposing core_warehouse schema';
