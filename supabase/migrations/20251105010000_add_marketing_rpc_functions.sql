-- RPC functions for Meta, GA4, Klaviyo integrations

-- Meta Ads: Truncate staging
CREATE OR REPLACE FUNCTION truncate_staging_meta_ads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  TRUNCATE staging_ingest.meta_ads_raw;
END;
$$;

-- Meta Ads: Insert staging records
CREATE OR REPLACE FUNCTION insert_staging_meta_ads(p_records json)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO staging_ingest.meta_ads_raw (raw_data)
  SELECT value
  FROM json_array_elements(p_records);
END;
$$;

-- Meta Ads: Transform to warehouse
CREATE OR REPLACE FUNCTION transform_meta_ads(p_shop_id text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_inserted int;
BEGIN
  INSERT INTO core_warehouse.fact_marketing_daily (
    shop_id,
    date,
    platform,
    spend,
    impressions,
    clicks,
    conversions,
    revenue
  )
  SELECT
    p_shop_id as shop_id,
    (raw_data->>'date_start')::date as date,
    'META' as platform,
    (raw_data->>'spend')::numeric as spend,
    (raw_data->>'impressions')::int as impressions,
    (raw_data->>'clicks')::int as clicks,
    COALESCE((
      SELECT SUM((action->>'value')::int)
      FROM json_array_elements(raw_data->'actions') action
      WHERE action->>'action_type' = 'purchase'
    ), 0) as conversions,
    COALESCE((
      SELECT SUM((action->>'value')::numeric)
      FROM json_array_elements(raw_data->'actions') action
      WHERE action->>'action_type' = 'purchase_value'
    ), 0) as revenue
  FROM staging_ingest.meta_ads_raw
  ON CONFLICT (shop_id, platform, date)
  DO UPDATE SET
    spend = EXCLUDED.spend,
    impressions = EXCLUDED.impressions,
    clicks = EXCLUDED.clicks,
    conversions = EXCLUDED.conversions,
    revenue = EXCLUDED.revenue;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
  RETURN v_rows_inserted;
END;
$$;

-- GA4: Truncate staging
CREATE OR REPLACE FUNCTION truncate_staging_ga4()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  TRUNCATE staging_ingest.ga4_raw;
END;
$$;

-- GA4: Insert staging records
CREATE OR REPLACE FUNCTION insert_staging_ga4(p_records json)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO staging_ingest.ga4_raw (raw_data)
  SELECT value
  FROM json_array_elements(p_records);
END;
$$;

-- GA4: Transform to warehouse
CREATE OR REPLACE FUNCTION transform_ga4(p_shop_id text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_inserted int;
BEGIN
  INSERT INTO core_warehouse.fact_ga4_daily (
    shop_id,
    date,
    sessions,
    users,
    transactions,
    revenue
  )
  SELECT
    p_shop_id as shop_id,
    (raw_data->>'date')::date as date,
    (raw_data->>'sessions')::int as sessions,
    (raw_data->>'users')::int as users,
    (raw_data->>'transactions')::int as transactions,
    (raw_data->>'revenue')::numeric as revenue
  FROM staging_ingest.ga4_raw
  ON CONFLICT (shop_id, date)
  DO UPDATE SET
    sessions = EXCLUDED.sessions,
    users = EXCLUDED.users,
    transactions = EXCLUDED.transactions,
    revenue = EXCLUDED.revenue;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
  RETURN v_rows_inserted;
END;
$$;

-- Klaviyo: Truncate staging
CREATE OR REPLACE FUNCTION truncate_staging_klaviyo()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  TRUNCATE staging_ingest.klaviyo_raw;
END;
$$;

-- Klaviyo: Insert staging records
CREATE OR REPLACE FUNCTION insert_staging_klaviyo(p_records json)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO staging_ingest.klaviyo_raw (raw_data)
  SELECT value
  FROM json_array_elements(p_records);
END;
$$;

-- Klaviyo: Transform to warehouse
CREATE OR REPLACE FUNCTION transform_klaviyo(p_shop_id text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_inserted int;
BEGIN
  INSERT INTO core_warehouse.fact_email_daily (
    shop_id,
    date,
    emails_sent,
    emails_delivered,
    opens,
    clicks,
    revenue
  )
  SELECT
    p_shop_id as shop_id,
    (raw_data->>'date')::date as date,
    (raw_data->>'emails_sent')::int as emails_sent,
    (raw_data->>'emails_delivered')::int as emails_delivered,
    (raw_data->>'opens')::int as opens,
    (raw_data->>'clicks')::int as clicks,
    (raw_data->>'revenue')::numeric as revenue
  FROM staging_ingest.klaviyo_raw
  ON CONFLICT (shop_id, date)
  DO UPDATE SET
    emails_sent = EXCLUDED.emails_sent,
    emails_delivered = EXCLUDED.emails_delivered,
    opens = EXCLUDED.opens,
    clicks = EXCLUDED.clicks,
    revenue = EXCLUDED.revenue;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
  RETURN v_rows_inserted;
END;
$$;

-- Update sync cursor with date
CREATE OR REPLACE FUNCTION update_sync_cursor_with_date(
  p_shop_id text,
  p_platform text,
  p_last_date text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO core_warehouse.sync_cursors (shop_id, platform, last_success_at, last_synced_date)
  VALUES (p_shop_id, p_platform, now(), p_last_date::date)
  ON CONFLICT (shop_id, platform)
  DO UPDATE SET
    last_success_at = now(),
    last_synced_date = p_last_date::date;
END;
$$;
