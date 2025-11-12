-- ============================================================================
-- Expand Shopify historical sync to cover orders, line items, transactions,
-- and payouts while improving cursor tracking.
-- ============================================================================

-- Ensure metadata columns exist so we can retain full raw payloads
ALTER TABLE core_warehouse.orders
ADD COLUMN IF NOT EXISTS metadata jsonb;

ALTER TABLE core_warehouse.order_line_items
ADD COLUMN IF NOT EXISTS metadata jsonb;

ALTER TABLE core_warehouse.transactions
ADD COLUMN IF NOT EXISTS metadata jsonb;

ALTER TABLE core_warehouse.payouts
ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Ensure sync cursor table can store last synced date along with metadata
ALTER TABLE core_warehouse.sync_cursors
ADD COLUMN IF NOT EXISTS last_synced_date date;

-- Missing staging table for legacy Meta insights (used by basic client fallback)
CREATE TABLE IF NOT EXISTS staging_ingest.meta_ads_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Shopify staging helpers
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION truncate_staging_shopify_line_items()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  TRUNCATE staging_ingest.shopify_line_items_raw;
END;
$$;

CREATE OR REPLACE FUNCTION truncate_staging_shopify_transactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  TRUNCATE staging_ingest.shopify_transactions_raw;
END;
$$;

CREATE OR REPLACE FUNCTION truncate_staging_shopify_payouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  TRUNCATE staging_ingest.shopify_payouts_raw;
END;
$$;

CREATE OR REPLACE FUNCTION insert_staging_shopify_line_items(p_records json)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_records IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO staging_ingest.shopify_line_items_raw (raw_data)
  SELECT value
  FROM json_array_elements(p_records) AS value
  WHERE value::text <> 'null';
END;
$$;

CREATE OR REPLACE FUNCTION insert_staging_shopify_transactions(p_records json)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_records IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO staging_ingest.shopify_transactions_raw (raw_data)
  SELECT value
  FROM json_array_elements(p_records) AS value
  WHERE value::text <> 'null';
END;
$$;

CREATE OR REPLACE FUNCTION insert_staging_shopify_payouts(p_records json)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_records IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO staging_ingest.shopify_payouts_raw (raw_data)
  SELECT value
  FROM json_array_elements(p_records) AS value
  WHERE value::text <> 'null';
END;
$$;

-- ----------------------------------------------------------------------------
-- Shopify transforms (Orders updated to include metadata, new transforms added)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION transform_shopify_orders(p_shop_id text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_inserted int;
BEGIN
  INSERT INTO core_warehouse.orders (
    shop_id,
    shopify_gid,
    order_number,
    total_price,
    currency,
    created_at,
    updated_at,
    metadata
  )
  SELECT DISTINCT ON (raw_data->>'id')
    p_shop_id,
    raw_data->>'id',
    raw_data->>'name',
    COALESCE(
      NULLIF(raw_data->'currentTotalPriceSet'->'shopMoney'->>'amount', '')::numeric,
      NULLIF(raw_data->'totalPriceSet'->'shopMoney'->>'amount', '')::numeric
    ),
    COALESCE(
      raw_data->'currentTotalPriceSet'->'shopMoney'->>'currencyCode',
      raw_data->'totalPriceSet'->'shopMoney'->>'currencyCode'
    ),
    NULLIF(raw_data->>'createdAt', '')::timestamptz,
    NULLIF(raw_data->>'updatedAt', '')::timestamptz,
    raw_data
  FROM staging_ingest.shopify_orders_raw
  WHERE raw_data ? 'id'
  ORDER BY raw_data->>'id', COALESCE((raw_data->>'updatedAt')::timestamptz, now()) DESC
  ON CONFLICT (shop_id, shopify_gid)
  DO UPDATE SET
    order_number = EXCLUDED.order_number,
    total_price = EXCLUDED.total_price,
    currency = EXCLUDED.currency,
    updated_at = EXCLUDED.updated_at,
    metadata = EXCLUDED.metadata;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
  RETURN v_rows_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION transform_shopify_line_items(p_shop_id text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_inserted int;
BEGIN
  INSERT INTO core_warehouse.order_line_items (
    shop_id,
    shopify_gid,
    order_id,
    product_id,
    variant_id,
    quantity,
    price,
    metadata
  )
  SELECT DISTINCT ON (raw_data->>'id')
    p_shop_id,
    raw_data->>'id',
    (
      SELECT id
      FROM core_warehouse.orders
      WHERE shop_id = p_shop_id
        AND shopify_gid = COALESCE(raw_data->>'__parentId', raw_data->'order'->>'id')
      LIMIT 1
    ),
    raw_data->'product'->>'id',
    raw_data->'variant'->>'id',
    NULLIF(raw_data->>'quantity', '')::int,
    COALESCE(
      NULLIF(raw_data->'originalUnitPriceSet'->'shopMoney'->>'amount', '')::numeric,
      NULLIF(raw_data->'priceSet'->'shopMoney'->>'amount', '')::numeric
    ),
    raw_data
  FROM staging_ingest.shopify_line_items_raw
  WHERE raw_data ? 'id'
  ORDER BY raw_data->>'id',
           COALESCE(
             NULLIF(raw_data->>'updatedAt', '')::timestamptz,
             NULLIF(raw_data->>'createdAt', '')::timestamptz,
             now()
           ) DESC
  ON CONFLICT (shop_id, shopify_gid)
  DO UPDATE SET
    order_id = EXCLUDED.order_id,
    product_id = EXCLUDED.product_id,
    variant_id = EXCLUDED.variant_id,
    quantity = EXCLUDED.quantity,
    price = EXCLUDED.price,
    metadata = EXCLUDED.metadata;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
  RETURN v_rows_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION transform_shopify_transactions(p_shop_id text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_inserted int;
BEGIN
  INSERT INTO core_warehouse.transactions (
    shop_id,
    shopify_gid,
    order_id,
    amount,
    kind,
    status,
    processed_at,
    metadata
  )
  SELECT DISTINCT ON (raw_data->>'id')
    p_shop_id,
    raw_data->>'id',
    (
      SELECT id
      FROM core_warehouse.orders
      WHERE shop_id = p_shop_id
        AND shopify_gid = COALESCE(raw_data->>'__parentId', raw_data->'order'->>'id')
      LIMIT 1
    ),
    COALESCE(
      NULLIF(raw_data->'amountSet'->'shopMoney'->>'amount', '')::numeric,
      NULLIF(raw_data->>'amount', '')::numeric
    ),
    raw_data->>'kind',
    raw_data->>'status',
    NULLIF(raw_data->>'processedAt', '')::timestamptz,
    raw_data
  FROM staging_ingest.shopify_transactions_raw
  WHERE raw_data ? 'id'
  ORDER BY raw_data->>'id',
           COALESCE(
             NULLIF(raw_data->>'processedAt', '')::timestamptz,
             NULLIF(raw_data->>'createdAt', '')::timestamptz,
             now()
           ) DESC
  ON CONFLICT (shop_id, shopify_gid)
  DO UPDATE SET
    order_id = EXCLUDED.order_id,
    amount = EXCLUDED.amount,
    kind = EXCLUDED.kind,
    status = EXCLUDED.status,
    processed_at = EXCLUDED.processed_at,
    metadata = EXCLUDED.metadata;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
  RETURN v_rows_inserted;
END;
$$;

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
    metadata
  )
  SELECT DISTINCT ON (raw_data->>'id')
    p_shop_id,
    raw_data->>'id',
    COALESCE(
      NULLIF(raw_data->'summary'->'totalNetAmountSet'->'shopMoney'->>'amount', '')::numeric,
      NULLIF(raw_data->'summary'->'totalNetAmount'->>'amount', '')::numeric,
      NULLIF(raw_data->'summary'->'totalGrossAmountSet'->'shopMoney'->>'amount', '')::numeric,
      NULLIF(raw_data->'amount'->>'amount', '')::numeric
    ),
    COALESCE(
      raw_data->'summary'->'totalNetAmountSet'->'shopMoney'->>'currencyCode',
      raw_data->'summary'->'totalNetAmount'->>'currencyCode',
      raw_data->>'currencyCode',
      raw_data->>'payoutCurrency'
    ),
    raw_data->>'status',
    COALESCE(
      NULLIF(raw_data->>'date', '')::date,
      NULLIF(raw_data->>'issuedAt', '')::date,
      NULLIF(raw_data->>'scheduledAt', '')::date
    ),
    raw_data
  FROM staging_ingest.shopify_payouts_raw
  WHERE raw_data ? 'id'
  ORDER BY raw_data->>'id',
           COALESCE(
             NULLIF(raw_data->>'issuedAt', '')::timestamptz,
             NULLIF(raw_data->>'date', '')::timestamptz,
             now()
           ) DESC
  ON CONFLICT (shop_id, shopify_gid)
  DO UPDATE SET
    amount = EXCLUDED.amount,
    currency = EXCLUDED.currency,
    status = EXCLUDED.status,
    date = EXCLUDED.date,
    metadata = EXCLUDED.metadata;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
  RETURN v_rows_inserted;
END;
$$;

-- ----------------------------------------------------------------------------
-- Cursor helpers
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_shopify_cursor(
  p_shop_id text,
  p_latest_updated_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO core_warehouse.sync_cursors (
    shop_id,
    platform,
    last_success_at,
    last_synced_date,
    watermark,
    metadata
  )
  VALUES (
    p_shop_id,
    'SHOPIFY',
    now(),
    p_latest_updated_at::date,
    jsonb_build_object('orders_updated_at', p_latest_updated_at),
    jsonb_build_object('orders_updated_at', p_latest_updated_at)
  )
  ON CONFLICT (shop_id, platform)
  DO UPDATE SET
    last_success_at = now(),
    last_synced_date = p_latest_updated_at::date,
    watermark = jsonb_build_object('orders_updated_at', p_latest_updated_at),
    metadata = jsonb_build_object('orders_updated_at', p_latest_updated_at),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION get_sync_cursor(p_shop_id text, p_platform text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cursor json;
BEGIN
  SELECT row_to_json(c)
  INTO v_cursor
  FROM core_warehouse.sync_cursors c
  WHERE c.shop_id = p_shop_id
    AND c.platform = p_platform
  ORDER BY c.updated_at DESC
  LIMIT 1;

  RETURN v_cursor;
END;
$$;

CREATE OR REPLACE FUNCTION update_sync_cursor_with_date(
  p_shop_id text,
  p_platform text,
  p_last_date text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_date date;
BEGIN
  v_date := p_last_date::date;

  INSERT INTO core_warehouse.sync_cursors (
    shop_id,
    platform,
    last_success_at,
    last_synced_date,
    watermark,
    metadata
  )
  VALUES (
    p_shop_id,
    p_platform,
    now(),
    v_date,
    jsonb_build_object('meta_latest_date', v_date),
    jsonb_build_object('meta_latest_date', v_date)
  )
  ON CONFLICT (shop_id, platform)
  DO UPDATE SET
    last_success_at = now(),
    last_synced_date = v_date,
    watermark = jsonb_build_object('meta_latest_date', v_date),
    metadata = jsonb_build_object('meta_latest_date', v_date),
    updated_at = now();
END;
$$;
