-- RPC function to enqueue job (bypasses schema restrictions)
CREATE OR REPLACE FUNCTION enqueue_etl_job(
  p_shop_id text,
  p_job_type text,
  p_platform text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_run_id uuid;
BEGIN
  INSERT INTO core_warehouse.etl_runs (shop_id, status, job_type, platform)
  VALUES (p_shop_id, 'QUEUED', p_job_type, p_platform)
  RETURNING id INTO v_run_id;

  RETURN json_build_object('run_id', v_run_id);
END;
$$;
