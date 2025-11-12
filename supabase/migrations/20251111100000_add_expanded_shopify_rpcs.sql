-- RPC functions for expanded Shopify data (line items, transactions, payouts)

-- ============================================================================
-- STAGING INSERT FUNCTIONS
-- ============================================================================

-- Insert line items to staging
CREATE OR REPLACE FUNCTION insert_staging_shopify_line_items(
  p_records json
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO staging_ingest.shopify_line_items_raw (raw_data)
  SELECT value
  FROM json_array_elements(p_records);
END;
$$;

-- Insert transactions to staging
CREATE OR REPLACE FUNCTION insert_staging_shopify_transactions(
  p_records json
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO staging_ingest.shopify_transactions_raw (raw_data)
  SELECT value
  FROM json_array_elements(p_records);
END;
$$;

-- Insert payouts to staging (for future use)
CREATE OR REPLACE FUNCTION insert_staging_shopify_payouts(
  p_records json
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO staging_ingest.shopify_payouts_raw (raw_data)
  SELECT value
  FROM json_array_elements(p_records);
END;
$$;

-- ============================================================================
-- STAGING TRUNCATE FUNCTIONS
-- ============================================================================

-- Truncate all Shopify staging tables (for historical syncs)
CREATE OR REPLACE FUNCTION truncate_staging_shopify_all()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  TRUNCATE staging_ingest.shopify_orders_raw;
  TRUNCATE staging_ingest.shopify_line_items_raw;
  TRUNCATE staging_ingest.shopify_transactions_raw;
  TRUNCATE staging_ingest.shopify_payouts_raw;
END;
$$;

-- ============================================================================
-- TRANSFORM FUNCTIONS
-- ============================================================================

-- Transform line items from staging to warehouse
CREATE OR REPLACE FUNCTION transform_shopify_line_items(p_shop_id text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_inserted int;
BEGIN
  -- Use DISTINCT ON to deduplicate by shopify_gid before inserting
  INSERT INTO core_warehouse.order_line_items (
    shop_id,
    shopify_gid,
    order_id,
    product_id,
    variant_id,
    quantity,
    price,
    created_at
  )
  SELECT DISTINCT ON (raw_data->>'id')
    p_shop_id as shop_id,
    raw_data->>'id' as shopify_gid,
    o.id as order_id,
    raw_data->'product'->>'id' as product_id,
    raw_data->'variant'->>'id' as variant_id,
    (raw_data->>'quantity')::integer as quantity,
    (raw_data->'originalUnitPriceSet'->'shopMoney'->>'amount')::numeric as price,
    now() as created_at
  FROM staging_ingest.shopify_line_items_raw li
  LEFT JOIN core_warehouse.orders o
    ON o.shop_id = p_shop_id
    AND o.shopify_gid = li.raw_data->>'__parentId'
  WHERE raw_data->>'id' IS NOT NULL
  ORDER BY raw_data->>'id', li.created_at DESC
  ON CONFLICT (shop_id, shopify_gid)
  DO UPDATE SET
    quantity = EXCLUDED.quantity,
    price = EXCLUDED.price;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
  RETURN v_rows_inserted;
END;
$$;

-- Transform transactions from staging to warehouse
CREATE OR REPLACE FUNCTION transform_shopify_transactions(p_shop_id text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_inserted int;
BEGIN
  -- Use DISTINCT ON to deduplicate by shopify_gid before inserting
  INSERT INTO core_warehouse.transactions (
    shop_id,
    shopify_gid,
    order_id,
    amount,
    kind,
    status,
    processed_at,
    created_at
  )
  SELECT DISTINCT ON (raw_data->>'id')
    p_shop_id as shop_id,
    raw_data->>'id' as shopify_gid,
    o.id as order_id,
    (raw_data->'amountSet'->'shopMoney'->>'amount')::numeric as amount,
    raw_data->>'kind' as kind,
    raw_data->>'status' as status,
    (raw_data->>'processedAt')::timestamptz as processed_at,
    now() as created_at
  FROM staging_ingest.shopify_transactions_raw t
  LEFT JOIN core_warehouse.orders o
    ON o.shop_id = p_shop_id
    AND o.shopify_gid = t.raw_data->>'__parentId'
  WHERE raw_data->>'id' IS NOT NULL
  ORDER BY raw_data->>'id', t.created_at DESC
  ON CONFLICT (shop_id, shopify_gid)
  DO UPDATE SET
    amount = EXCLUDED.amount,
    kind = EXCLUDED.kind,
    status = EXCLUDED.status,
    processed_at = EXCLUDED.processed_at;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
  RETURN v_rows_inserted;
END;
$$;

-- Transform payouts from staging to warehouse (for future use)
CREATE OR REPLACE FUNCTION transform_shopify_payouts(p_shop_id text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_inserted int;
BEGIN
  INSERT INTO core_warehouse.payouts (
    shop_id,
    shopify_gid,
    amount,
    currency,
    status,
    date,
    created_at
  )
  SELECT DISTINCT ON (raw_data->>'id')
    p_shop_id as shop_id,
    raw_data->>'id' as shopify_gid,
    (raw_data->'amount'->>'amount')::numeric as amount,
    raw_data->'amount'->>'currencyCode' as currency,
    raw_data->>'status' as status,
    (raw_data->>'issuedAt')::date as date,
    now() as created_at
  FROM staging_ingest.shopify_payouts_raw
  WHERE raw_data->>'id' IS NOT NULL
  ORDER BY raw_data->>'id', created_at DESC
  ON CONFLICT (shop_id, shopify_gid)
  DO UPDATE SET
    amount = EXCLUDED.amount,
    currency = EXCLUDED.currency,
    status = EXCLUDED.status,
    date = EXCLUDED.date;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
  RETURN v_rows_inserted;
END;
$$;
