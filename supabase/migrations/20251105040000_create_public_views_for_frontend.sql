-- Create public views for frontend access
-- This maintains security by only exposing what we want through the public schema

-- Public view for orders (only essential fields)
CREATE OR REPLACE VIEW public.orders AS
SELECT
  id,
  shop_id,
  order_number,
  total_price,
  currency,
  created_at,
  updated_at
FROM core_warehouse.orders;

-- Public view for ETL runs (for monitoring)
CREATE OR REPLACE VIEW public.etl_runs AS
SELECT
  id,
  shop_id,
  status,
  job_type,
  platform,
  records_synced,
  created_at,
  started_at,
  completed_at,
  error
FROM core_warehouse.etl_runs;

-- Enable RLS on the views
ALTER VIEW public.orders SET (security_invoker = true);
ALTER VIEW public.etl_runs SET (security_invoker = true);

-- Grant SELECT access to anon users on the views
GRANT SELECT ON public.orders TO anon;
GRANT SELECT ON public.etl_runs TO anon;

-- Create a function to allow inserting ETL runs from public
-- This is safer than exposing the whole table
CREATE OR REPLACE FUNCTION public.trigger_sync(
  p_shop_id text,
  p_job_type text,
  p_platform text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  -- Insert into core_warehouse.etl_runs
  INSERT INTO core_warehouse.etl_runs (shop_id, status, job_type, platform)
  VALUES (p_shop_id, 'QUEUED', p_job_type, p_platform)
  RETURNING id INTO v_job_id;

  -- Return the job details
  RETURN json_build_object(
    'id', v_job_id,
    'shop_id', p_shop_id,
    'status', 'QUEUED',
    'job_type', p_job_type,
    'platform', p_platform
  );
END;
$$;

-- Grant execute permission to anon users
GRANT EXECUTE ON FUNCTION public.trigger_sync(text, text, text) TO anon;

-- Add comment for documentation
COMMENT ON VIEW public.orders IS 'Public view of orders - only exposes safe fields';
COMMENT ON VIEW public.etl_runs IS 'Public view of ETL runs for monitoring';
COMMENT ON FUNCTION public.trigger_sync IS 'Safe function to trigger syncs without direct table access';
