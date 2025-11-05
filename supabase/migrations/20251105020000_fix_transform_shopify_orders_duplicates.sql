-- Fix transform_shopify_orders to handle duplicate records in staging
-- This is a hotfix migration to update the function that was modified in 20251105000000

DROP FUNCTION IF EXISTS transform_shopify_orders(text);

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
