-- RPC functions for worker operations (avoids schema restrictions and IPv6 issues)

-- Poll for next queued job
CREATE OR REPLACE FUNCTION poll_queued_job()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job json;
BEGIN
  SELECT row_to_json(t)
  INTO v_job
  FROM (
    SELECT *
    FROM core_warehouse.etl_runs
    WHERE status = 'QUEUED'
    ORDER BY created_at ASC
    LIMIT 1
  ) t;

  RETURN v_job;
END;
$$;

-- Claim a job (optimistic locking)
CREATE OR REPLACE FUNCTION claim_job(p_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_updated int;
BEGIN
  UPDATE core_warehouse.etl_runs
  SET status = 'IN_PROGRESS', started_at = now()
  WHERE id = p_job_id AND status = 'QUEUED';

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  RETURN v_rows_updated > 0;
END;
$$;

-- Complete a job (success or failure)
CREATE OR REPLACE FUNCTION complete_job(
  p_job_id uuid,
  p_status text,
  p_records_synced int,
  p_error json DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE core_warehouse.etl_runs
  SET
    status = p_status,
    completed_at = now(),
    records_synced = p_records_synced,
    error = p_error
  WHERE id = p_job_id;
END;
$$;

-- Insert to staging (for Shopify client)
CREATE OR REPLACE FUNCTION insert_staging_shopify_orders(
  p_records json
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO staging_ingest.shopify_orders_raw (raw_data)
  SELECT value
  FROM json_array_elements(p_records);
END;
$$;

-- Truncate staging (for historical syncs)
CREATE OR REPLACE FUNCTION truncate_staging_shopify_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  TRUNCATE staging_ingest.shopify_orders_raw;
END;
$$;

-- Transform to warehouse and return count
CREATE OR REPLACE FUNCTION transform_shopify_orders(p_shop_id text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_inserted int;
BEGIN
  -- Use DISTINCT ON to deduplicate by shopify_gid before inserting
  -- This prevents "ON CONFLICT DO UPDATE command cannot affect row a second time" error
  INSERT INTO core_warehouse.orders (
    shop_id,
    shopify_gid,
    order_number,
    total_price,
    currency,
    created_at,
    updated_at
  )
  SELECT DISTINCT ON (shopify_gid)
    p_shop_id as shop_id,
    raw_data->>'id' as shopify_gid,
    raw_data->>'name' as order_number,
    (raw_data->'totalPriceSet'->'shopMoney'->>'amount')::numeric as total_price,
    raw_data->'totalPriceSet'->'shopMoney'->>'currencyCode' as currency,
    (raw_data->>'createdAt')::timestamptz as created_at,
    (raw_data->>'updatedAt')::timestamptz as updated_at
  FROM staging_ingest.shopify_orders_raw
  ORDER BY raw_data->>'id', (raw_data->>'updatedAt')::timestamptz DESC
  ON CONFLICT (shop_id, shopify_gid)
  DO UPDATE SET
    order_number = EXCLUDED.order_number,
    total_price = EXCLUDED.total_price,
    currency = EXCLUDED.currency,
    updated_at = EXCLUDED.updated_at;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
  RETURN v_rows_inserted;
END;
$$;

-- Update sync cursor
CREATE OR REPLACE FUNCTION update_sync_cursor(p_shop_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO core_warehouse.sync_cursors (shop_id, platform, last_success_at)
  VALUES (p_shop_id, 'SHOPIFY', now())
  ON CONFLICT (shop_id, platform)
  DO UPDATE SET last_success_at = now();
END;
$$;
