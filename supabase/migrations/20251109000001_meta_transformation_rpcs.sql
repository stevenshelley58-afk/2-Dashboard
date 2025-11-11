-- ============================================================================
-- META ADS TRANSFORMATION RPC FUNCTIONS
-- Transform staged raw data into warehouse tables
-- ============================================================================

-- ============================================================================
-- PART 1: ENTITY TRANSFORMATION FUNCTIONS
-- ============================================================================

-- Transform Ad Accounts
CREATE OR REPLACE FUNCTION transform_meta_ad_accounts(p_shop_id text)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted_count int;
BEGIN
  INSERT INTO core_warehouse.meta_ad_accounts (
    shop_id,
    account_id,
    account_name,
    currency,
    timezone_name,
    business_name,
    business_id,
    account_status,
    disable_reason,
    amount_spent,
    balance,
    created_time,
    min_campaign_group_spend_cap,
    min_daily_budget,
    metadata,
    updated_at
  )
  SELECT
    p_shop_id,
    (data->>'id')::text,
    (data->>'name')::text,
    (data->>'currency')::text,
    (data->>'timezone_name')::text,
    (data->>'business_name')::text,
    (data->>'business')::text,
    (data->>'account_status')::text,
    (data->>'disable_reason')::text,
    (data->>'amount_spent')::numeric,
    (data->>'balance')::numeric,
    (data->>'created_time')::timestamptz,
    (data->>'min_campaign_group_spend_cap')::numeric,
    (data->>'min_daily_budget')::numeric,
    data,
    now()
  FROM staging_ingest.meta_entities_raw
  WHERE shop_id = p_shop_id
    AND entity_type = 'account'
  ON CONFLICT (shop_id, account_id)
  DO UPDATE SET
    account_name = EXCLUDED.account_name,
    currency = EXCLUDED.currency,
    timezone_name = EXCLUDED.timezone_name,
    business_name = EXCLUDED.business_name,
    business_id = EXCLUDED.business_id,
    account_status = EXCLUDED.account_status,
    disable_reason = EXCLUDED.disable_reason,
    amount_spent = EXCLUDED.amount_spent,
    balance = EXCLUDED.balance,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;

-- Transform Campaigns
CREATE OR REPLACE FUNCTION transform_meta_campaigns(p_shop_id text)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted_count int;
BEGIN
  INSERT INTO core_warehouse.meta_campaigns (
    shop_id,
    campaign_id,
    account_id,
    name,
    status,
    objective,
    buying_type,
    bid_strategy,
    budget_remaining,
    daily_budget,
    lifetime_budget,
    spend_cap,
    special_ad_categories,
    start_time,
    stop_time,
    created_time,
    updated_time,
    metadata,
    updated_at
  )
  SELECT
    p_shop_id,
    (data->>'id')::text,
    (data->>'account_id')::text,
    (data->>'name')::text,
    (data->>'status')::text,
    (data->>'objective')::text,
    (data->>'buying_type')::text,
    (data->>'bid_strategy')::text,
    (data->>'budget_remaining')::numeric,
    (data->>'daily_budget')::numeric,
    (data->>'lifetime_budget')::numeric,
    (data->>'spend_cap')::numeric,
    CASE
      WHEN data->'special_ad_categories' IS NOT NULL
      THEN ARRAY(SELECT jsonb_array_elements_text(data->'special_ad_categories'))
      ELSE NULL
    END,
    (data->>'start_time')::timestamptz,
    (data->>'stop_time')::timestamptz,
    (data->>'created_time')::timestamptz,
    (data->>'updated_time')::timestamptz,
    data,
    now()
  FROM staging_ingest.meta_entities_raw
  WHERE shop_id = p_shop_id
    AND entity_type = 'campaign'
  ON CONFLICT (shop_id, campaign_id)
  DO UPDATE SET
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    objective = EXCLUDED.objective,
    buying_type = EXCLUDED.buying_type,
    bid_strategy = EXCLUDED.bid_strategy,
    budget_remaining = EXCLUDED.budget_remaining,
    daily_budget = EXCLUDED.daily_budget,
    lifetime_budget = EXCLUDED.lifetime_budget,
    spend_cap = EXCLUDED.spend_cap,
    special_ad_categories = EXCLUDED.special_ad_categories,
    start_time = EXCLUDED.start_time,
    stop_time = EXCLUDED.stop_time,
    updated_time = EXCLUDED.updated_time,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;

-- Transform Ad Sets
CREATE OR REPLACE FUNCTION transform_meta_adsets(p_shop_id text)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted_count int;
BEGIN
  INSERT INTO core_warehouse.meta_adsets (
    shop_id,
    adset_id,
    campaign_id,
    account_id,
    name,
    status,
    optimization_goal,
    billing_event,
    bid_amount,
    bid_strategy,
    daily_budget,
    lifetime_budget,
    budget_remaining,
    start_time,
    end_time,
    created_time,
    updated_time,
    targeting,
    targeting_age_min,
    targeting_age_max,
    targeting_genders,
    targeting_geo_locations,
    targeting_interests,
    targeting_behaviors,
    targeting_custom_audiences,
    destination_type,
    promoted_object,
    attribution_spec,
    metadata,
    updated_at
  )
  SELECT
    p_shop_id,
    (data->>'id')::text,
    (data->>'campaign_id')::text,
    (data->>'account_id')::text,
    (data->>'name')::text,
    (data->>'status')::text,
    (data->>'optimization_goal')::text,
    (data->>'billing_event')::text,
    (data->>'bid_amount')::numeric,
    (data->>'bid_strategy')::text,
    (data->>'daily_budget')::numeric,
    (data->>'lifetime_budget')::numeric,
    (data->>'budget_remaining')::numeric,
    (data->>'start_time')::timestamptz,
    (data->>'end_time')::timestamptz,
    (data->>'created_time')::timestamptz,
    (data->>'updated_time')::timestamptz,
    data->'targeting',
    (data->'targeting'->>'age_min')::int,
    (data->'targeting'->>'age_max')::int,
    CASE
      WHEN data->'targeting'->'genders' IS NOT NULL
      THEN ARRAY(SELECT (jsonb_array_elements(data->'targeting'->'genders'))::text::int)
      ELSE NULL
    END,
    data->'targeting'->'geo_locations',
    data->'targeting'->'interests',
    data->'targeting'->'behaviors',
    CASE
      WHEN data->'targeting'->'custom_audiences' IS NOT NULL
      THEN ARRAY(SELECT (jsonb_array_elements(data->'targeting'->'custom_audiences')->>'id')::text)
      ELSE NULL
    END,
    (data->>'destination_type')::text,
    data->'promoted_object',
    data->'attribution_spec',
    data,
    now()
  FROM staging_ingest.meta_entities_raw
  WHERE shop_id = p_shop_id
    AND entity_type = 'adset'
  ON CONFLICT (shop_id, adset_id)
  DO UPDATE SET
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    optimization_goal = EXCLUDED.optimization_goal,
    billing_event = EXCLUDED.billing_event,
    bid_amount = EXCLUDED.bid_amount,
    bid_strategy = EXCLUDED.bid_strategy,
    daily_budget = EXCLUDED.daily_budget,
    lifetime_budget = EXCLUDED.lifetime_budget,
    budget_remaining = EXCLUDED.budget_remaining,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    updated_time = EXCLUDED.updated_time,
    targeting = EXCLUDED.targeting,
    targeting_age_min = EXCLUDED.targeting_age_min,
    targeting_age_max = EXCLUDED.targeting_age_max,
    targeting_genders = EXCLUDED.targeting_genders,
    targeting_geo_locations = EXCLUDED.targeting_geo_locations,
    targeting_interests = EXCLUDED.targeting_interests,
    targeting_behaviors = EXCLUDED.targeting_behaviors,
    targeting_custom_audiences = EXCLUDED.targeting_custom_audiences,
    destination_type = EXCLUDED.destination_type,
    promoted_object = EXCLUDED.promoted_object,
    attribution_spec = EXCLUDED.attribution_spec,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;

-- Transform Ads
CREATE OR REPLACE FUNCTION transform_meta_ads(p_shop_id text)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted_count int;
BEGIN
  INSERT INTO core_warehouse.meta_ads (
    shop_id,
    ad_id,
    adset_id,
    campaign_id,
    account_id,
    name,
    status,
    creative_id,
    tracking_specs,
    conversion_specs,
    created_time,
    updated_time,
    metadata,
    updated_at
  )
  SELECT
    p_shop_id,
    (data->>'id')::text,
    (data->>'adset_id')::text,
    (data->>'campaign_id')::text,
    (data->>'account_id')::text,
    (data->>'name')::text,
    (data->>'status')::text,
    (data->'creative'->>'id')::text,
    data->'tracking_specs',
    data->'conversion_specs',
    (data->>'created_time')::timestamptz,
    (data->>'updated_time')::timestamptz,
    data,
    now()
  FROM staging_ingest.meta_entities_raw
  WHERE shop_id = p_shop_id
    AND entity_type = 'ad'
  ON CONFLICT (shop_id, ad_id)
  DO UPDATE SET
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    creative_id = EXCLUDED.creative_id,
    tracking_specs = EXCLUDED.tracking_specs,
    conversion_specs = EXCLUDED.conversion_specs,
    updated_time = EXCLUDED.updated_time,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;

-- Transform Ad Creatives
CREATE OR REPLACE FUNCTION transform_meta_adcreatives(p_shop_id text)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted_count int;
BEGIN
  INSERT INTO core_warehouse.meta_adcreatives (
    shop_id,
    creative_id,
    account_id,
    name,
    title,
    body,
    link_url,
    call_to_action_type,
    image_hash,
    image_url,
    video_id,
    thumbnail_url,
    object_type,
    object_story_spec,
    asset_feed_spec,
    product_set_id,
    instagram_actor_id,
    instagram_permalink_url,
    status,
    effective_object_story_id,
    metadata,
    updated_at
  )
  SELECT
    p_shop_id,
    (data->>'id')::text,
    (data->>'account_id')::text,
    (data->>'name')::text,
    (data->>'title')::text,
    (data->>'body')::text,
    (data->>'link_url')::text,
    (data->'call_to_action'->>'type')::text,
    (data->>'image_hash')::text,
    (data->>'image_url')::text,
    (data->>'video_id')::text,
    (data->>'thumbnail_url')::text,
    (data->>'object_type')::text,
    data->'object_story_spec',
    data->'asset_feed_spec',
    (data->>'product_set_id')::text,
    (data->>'instagram_actor_id')::text,
    (data->>'instagram_permalink_url')::text,
    (data->>'status')::text,
    (data->>'effective_object_story_id')::text,
    data,
    now()
  FROM staging_ingest.meta_entities_raw
  WHERE shop_id = p_shop_id
    AND entity_type = 'creative'
  ON CONFLICT (shop_id, creative_id)
  DO UPDATE SET
    name = EXCLUDED.name,
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    link_url = EXCLUDED.link_url,
    call_to_action_type = EXCLUDED.call_to_action_type,
    image_hash = EXCLUDED.image_hash,
    image_url = EXCLUDED.image_url,
    video_id = EXCLUDED.video_id,
    thumbnail_url = EXCLUDED.thumbnail_url,
    object_type = EXCLUDED.object_type,
    object_story_spec = EXCLUDED.object_story_spec,
    asset_feed_spec = EXCLUDED.asset_feed_spec,
    product_set_id = EXCLUDED.product_set_id,
    instagram_actor_id = EXCLUDED.instagram_actor_id,
    instagram_permalink_url = EXCLUDED.instagram_permalink_url,
    status = EXCLUDED.status,
    effective_object_story_id = EXCLUDED.effective_object_story_id,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  -- Also create records in meta_adimages and meta_advideos for asset download
  INSERT INTO core_warehouse.meta_adimages (
    shop_id,
    image_hash,
    account_id,
    url,
    permalink_url,
    download_status
  )
  SELECT DISTINCT
    p_shop_id,
    (data->>'image_hash')::text,
    (data->>'account_id')::text,
    (data->>'image_url')::text,
    (data->>'image_url')::text,
    'PENDING'
  FROM staging_ingest.meta_entities_raw
  WHERE shop_id = p_shop_id
    AND entity_type = 'creative'
    AND data->>'image_hash' IS NOT NULL
  ON CONFLICT (shop_id, image_hash) DO NOTHING;

  INSERT INTO core_warehouse.meta_advideos (
    shop_id,
    video_id,
    account_id,
    source,
    picture_url,
    download_status
  )
  SELECT DISTINCT
    p_shop_id,
    (data->>'video_id')::text,
    (data->>'account_id')::text,
    (data->>'video_id')::text, -- Will need to fetch source URL separately
    (data->>'thumbnail_url')::text,
    'PENDING'
  FROM staging_ingest.meta_entities_raw
  WHERE shop_id = p_shop_id
    AND entity_type = 'creative'
    AND data->>'video_id' IS NOT NULL
  ON CONFLICT (shop_id, video_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;

-- Master entity transformation function
CREATE OR REPLACE FUNCTION transform_meta_entities(p_shop_id text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_accounts int;
  v_campaigns int;
  v_adsets int;
  v_ads int;
  v_creatives int;
BEGIN
  v_accounts := transform_meta_ad_accounts(p_shop_id);
  v_campaigns := transform_meta_campaigns(p_shop_id);
  v_adsets := transform_meta_adsets(p_shop_id);
  v_ads := transform_meta_ads(p_shop_id);
  v_creatives := transform_meta_adcreatives(p_shop_id);

  RETURN jsonb_build_object(
    'accounts', v_accounts,
    'campaigns', v_campaigns,
    'adsets', v_adsets,
    'ads', v_ads,
    'creatives', v_creatives
  );
END;
$$;

-- ============================================================================
-- PART 2: INSIGHTS TRANSFORMATION FUNCTIONS
-- ============================================================================

-- Helper function to extract action value by type
CREATE OR REPLACE FUNCTION extract_action_value(actions jsonb, action_type text)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  action jsonb;
BEGIN
  FOR action IN SELECT * FROM jsonb_array_elements(actions)
  LOOP
    IF action->>'action_type' = action_type THEN
      RETURN (action->>'value')::bigint;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

-- Helper function to extract action value (numeric) by type
CREATE OR REPLACE FUNCTION extract_action_value_numeric(action_values jsonb, action_type text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  action jsonb;
BEGIN
  FOR action IN SELECT * FROM jsonb_array_elements(action_values)
  LOOP
    IF action->>'action_type' = action_type THEN
      RETURN (action->>'value')::numeric;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

-- Transform Campaign Insights
CREATE OR REPLACE FUNCTION transform_meta_insights_campaign(p_shop_id text)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted_count int;
BEGIN
  INSERT INTO core_warehouse.meta_insights_campaign (
    shop_id,
    campaign_id,
    date,
    spend,
    impressions,
    clicks,
    reach,
    frequency,
    cpm,
    cpc,
    ctr,
    cpp,
    add_to_cart,
    initiate_checkout,
    purchase,
    purchase_value,
    post_engagement,
    outbound_clicks,
    link_clicks,
    currency,
    metadata,
    updated_at
  )
  SELECT
    p_shop_id,
    entity_id,
    (data->>'date_start')::date,
    (data->>'spend')::numeric,
    (data->>'impressions')::bigint,
    (data->>'clicks')::bigint,
    (data->>'reach')::bigint,
    (data->>'frequency')::numeric,
    (data->>'cpm')::numeric,
    (data->>'cpc')::numeric,
    (data->>'ctr')::numeric,
    (data->>'cpp')::numeric,
    extract_action_value(data->'actions', 'offsite_conversion.fb_pixel_add_to_cart'),
    extract_action_value(data->'actions', 'offsite_conversion.fb_pixel_initiate_checkout'),
    extract_action_value(data->'actions', 'offsite_conversion.fb_pixel_purchase'),
    extract_action_value_numeric(data->'action_values', 'offsite_conversion.fb_pixel_purchase'),
    extract_action_value(data->'actions', 'post_engagement'),
    extract_action_value(data->'actions', 'outbound_click'),
    extract_action_value(data->'actions', 'link_click'),
    'USD', -- TODO: Get from account settings
    data,
    now()
  FROM staging_ingest.meta_insights_raw
  WHERE shop_id = p_shop_id
    AND insight_level = 'campaign'
    AND breakdown_type IS NULL
  ON CONFLICT (shop_id, campaign_id, date, attribution_window)
  DO UPDATE SET
    spend = EXCLUDED.spend,
    impressions = EXCLUDED.impressions,
    clicks = EXCLUDED.clicks,
    reach = EXCLUDED.reach,
    frequency = EXCLUDED.frequency,
    cpm = EXCLUDED.cpm,
    cpc = EXCLUDED.cpc,
    ctr = EXCLUDED.ctr,
    cpp = EXCLUDED.cpp,
    add_to_cart = EXCLUDED.add_to_cart,
    initiate_checkout = EXCLUDED.initiate_checkout,
    purchase = EXCLUDED.purchase,
    purchase_value = EXCLUDED.purchase_value,
    post_engagement = EXCLUDED.post_engagement,
    outbound_clicks = EXCLUDED.outbound_clicks,
    link_clicks = EXCLUDED.link_clicks,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;

-- Transform AdSet Insights (similar structure)
CREATE OR REPLACE FUNCTION transform_meta_insights_adset(p_shop_id text)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted_count int;
BEGIN
  INSERT INTO core_warehouse.meta_insights_adset (
    shop_id,
    adset_id,
    campaign_id,
    date,
    spend,
    impressions,
    clicks,
    reach,
    frequency,
    cpm,
    cpc,
    ctr,
    cpp,
    add_to_cart,
    initiate_checkout,
    purchase,
    purchase_value,
    post_engagement,
    outbound_clicks,
    link_clicks,
    currency,
    metadata,
    updated_at
  )
  SELECT
    p_shop_id,
    entity_id,
    (data->>'campaign_id')::text,
    (data->>'date_start')::date,
    (data->>'spend')::numeric,
    (data->>'impressions')::bigint,
    (data->>'clicks')::bigint,
    (data->>'reach')::bigint,
    (data->>'frequency')::numeric,
    (data->>'cpm')::numeric,
    (data->>'cpc')::numeric,
    (data->>'ctr')::numeric,
    (data->>'cpp')::numeric,
    extract_action_value(data->'actions', 'offsite_conversion.fb_pixel_add_to_cart'),
    extract_action_value(data->'actions', 'offsite_conversion.fb_pixel_initiate_checkout'),
    extract_action_value(data->'actions', 'offsite_conversion.fb_pixel_purchase'),
    extract_action_value_numeric(data->'action_values', 'offsite_conversion.fb_pixel_purchase'),
    extract_action_value(data->'actions', 'post_engagement'),
    extract_action_value(data->'actions', 'outbound_click'),
    extract_action_value(data->'actions', 'link_click'),
    'USD',
    data,
    now()
  FROM staging_ingest.meta_insights_raw
  WHERE shop_id = p_shop_id
    AND insight_level = 'adset'
    AND breakdown_type IS NULL
  ON CONFLICT (shop_id, adset_id, date, attribution_window)
  DO UPDATE SET
    campaign_id = EXCLUDED.campaign_id,
    spend = EXCLUDED.spend,
    impressions = EXCLUDED.impressions,
    clicks = EXCLUDED.clicks,
    reach = EXCLUDED.reach,
    frequency = EXCLUDED.frequency,
    cpm = EXCLUDED.cpm,
    cpc = EXCLUDED.cpc,
    ctr = EXCLUDED.ctr,
    cpp = EXCLUDED.cpp,
    add_to_cart = EXCLUDED.add_to_cart,
    initiate_checkout = EXCLUDED.initiate_checkout,
    purchase = EXCLUDED.purchase,
    purchase_value = EXCLUDED.purchase_value,
    post_engagement = EXCLUDED.post_engagement,
    outbound_clicks = EXCLUDED.outbound_clicks,
    link_clicks = EXCLUDED.link_clicks,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;

-- Transform Ad Insights
CREATE OR REPLACE FUNCTION transform_meta_insights_ad(p_shop_id text)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted_count int;
BEGIN
  INSERT INTO core_warehouse.meta_insights_ad (
    shop_id,
    ad_id,
    adset_id,
    campaign_id,
    date,
    spend,
    impressions,
    clicks,
    reach,
    frequency,
    cpm,
    cpc,
    ctr,
    cpp,
    add_to_cart,
    initiate_checkout,
    purchase,
    purchase_value,
    post_engagement,
    outbound_clicks,
    link_clicks,
    currency,
    metadata,
    updated_at
  )
  SELECT
    p_shop_id,
    entity_id,
    (data->>'adset_id')::text,
    (data->>'campaign_id')::text,
    (data->>'date_start')::date,
    (data->>'spend')::numeric,
    (data->>'impressions')::bigint,
    (data->>'clicks')::bigint,
    (data->>'reach')::bigint,
    (data->>'frequency')::numeric,
    (data->>'cpm')::numeric,
    (data->>'cpc')::numeric,
    (data->>'ctr')::numeric,
    (data->>'cpp')::numeric,
    extract_action_value(data->'actions', 'offsite_conversion.fb_pixel_add_to_cart'),
    extract_action_value(data->'actions', 'offsite_conversion.fb_pixel_initiate_checkout'),
    extract_action_value(data->'actions', 'offsite_conversion.fb_pixel_purchase'),
    extract_action_value_numeric(data->'action_values', 'offsite_conversion.fb_pixel_purchase'),
    extract_action_value(data->'actions', 'post_engagement'),
    extract_action_value(data->'actions', 'outbound_click'),
    extract_action_value(data->'actions', 'link_click'),
    'USD',
    data,
    now()
  FROM staging_ingest.meta_insights_raw
  WHERE shop_id = p_shop_id
    AND insight_level = 'ad'
    AND breakdown_type IS NULL
  ON CONFLICT (shop_id, ad_id, date, attribution_window)
  DO UPDATE SET
    adset_id = EXCLUDED.adset_id,
    campaign_id = EXCLUDED.campaign_id,
    spend = EXCLUDED.spend,
    impressions = EXCLUDED.impressions,
    clicks = EXCLUDED.clicks,
    reach = EXCLUDED.reach,
    frequency = EXCLUDED.frequency,
    cpm = EXCLUDED.cpm,
    cpc = EXCLUDED.cpc,
    ctr = EXCLUDED.ctr,
    cpp = EXCLUDED.cpp,
    add_to_cart = EXCLUDED.add_to_cart,
    initiate_checkout = EXCLUDED.initiate_checkout,
    purchase = EXCLUDED.purchase,
    purchase_value = EXCLUDED.purchase_value,
    post_engagement = EXCLUDED.post_engagement,
    outbound_clicks = EXCLUDED.outbound_clicks,
    link_clicks = EXCLUDED.link_clicks,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;

-- Transform Age/Gender Breakdown Insights
CREATE OR REPLACE FUNCTION transform_meta_insights_age_gender(p_shop_id text)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted_count int;
BEGIN
  INSERT INTO core_warehouse.meta_insights_age_gender (
    shop_id,
    campaign_id,
    adset_id,
    ad_id,
    date,
    age,
    gender,
    spend,
    impressions,
    clicks,
    reach,
    frequency,
    cpm,
    cpc,
    ctr,
    purchase,
    purchase_value,
    currency,
    metadata
  )
  SELECT
    p_shop_id,
    CASE WHEN insight_level = 'campaign' THEN entity_id ELSE NULL END,
    CASE WHEN insight_level = 'adset' THEN entity_id ELSE NULL END,
    CASE WHEN insight_level = 'ad' THEN entity_id ELSE NULL END,
    (data->>'date_start')::date,
    (data->>'age')::text,
    (data->>'gender')::text,
    (data->>'spend')::numeric,
    (data->>'impressions')::bigint,
    (data->>'clicks')::bigint,
    (data->>'reach')::bigint,
    (data->>'frequency')::numeric,
    (data->>'cpm')::numeric,
    (data->>'cpc')::numeric,
    (data->>'ctr')::numeric,
    extract_action_value(data->'actions', 'offsite_conversion.fb_pixel_purchase'),
    extract_action_value_numeric(data->'action_values', 'offsite_conversion.fb_pixel_purchase'),
    'USD',
    data
  FROM staging_ingest.meta_insights_raw
  WHERE shop_id = p_shop_id
    AND breakdown_type = 'age_gender'
  ON CONFLICT (shop_id, COALESCE(campaign_id, ''), COALESCE(adset_id, ''), COALESCE(ad_id, ''), date, age, gender, attribution_window)
  DO UPDATE SET
    spend = EXCLUDED.spend,
    impressions = EXCLUDED.impressions,
    clicks = EXCLUDED.clicks,
    reach = EXCLUDED.reach,
    frequency = EXCLUDED.frequency,
    cpm = EXCLUDED.cpm,
    cpc = EXCLUDED.cpc,
    ctr = EXCLUDED.ctr,
    purchase = EXCLUDED.purchase,
    purchase_value = EXCLUDED.purchase_value,
    metadata = EXCLUDED.metadata;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;

-- Transform Device/Platform Breakdown Insights
CREATE OR REPLACE FUNCTION transform_meta_insights_device(p_shop_id text)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted_count int;
BEGIN
  INSERT INTO core_warehouse.meta_insights_device (
    shop_id,
    campaign_id,
    adset_id,
    ad_id,
    date,
    device_platform,
    publisher_platform,
    platform_position,
    spend,
    impressions,
    clicks,
    reach,
    cpm,
    cpc,
    ctr,
    purchase,
    purchase_value,
    currency,
    metadata
  )
  SELECT
    p_shop_id,
    CASE WHEN insight_level = 'campaign' THEN entity_id ELSE NULL END,
    CASE WHEN insight_level = 'adset' THEN entity_id ELSE NULL END,
    CASE WHEN insight_level = 'ad' THEN entity_id ELSE NULL END,
    (data->>'date_start')::date,
    (data->>'device_platform')::text,
    (data->>'publisher_platform')::text,
    (data->>'platform_position')::text,
    (data->>'spend')::numeric,
    (data->>'impressions')::bigint,
    (data->>'clicks')::bigint,
    (data->>'reach')::bigint,
    (data->>'cpm')::numeric,
    (data->>'cpc')::numeric,
    (data->>'ctr')::numeric,
    extract_action_value(data->'actions', 'offsite_conversion.fb_pixel_purchase'),
    extract_action_value_numeric(data->'action_values', 'offsite_conversion.fb_pixel_purchase'),
    'USD',
    data
  FROM staging_ingest.meta_insights_raw
  WHERE shop_id = p_shop_id
    AND breakdown_type = 'device'
  ON CONFLICT (shop_id, COALESCE(campaign_id, ''), COALESCE(adset_id, ''), COALESCE(ad_id, ''), date, device_platform, publisher_platform, platform_position, attribution_window)
  DO UPDATE SET
    spend = EXCLUDED.spend,
    impressions = EXCLUDED.impressions,
    clicks = EXCLUDED.clicks,
    reach = EXCLUDED.reach,
    cpm = EXCLUDED.cpm,
    cpc = EXCLUDED.cpc,
    ctr = EXCLUDED.ctr,
    purchase = EXCLUDED.purchase,
    purchase_value = EXCLUDED.purchase_value,
    metadata = EXCLUDED.metadata;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;

-- Transform Geographic Breakdown Insights
CREATE OR REPLACE FUNCTION transform_meta_insights_geo(p_shop_id text)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted_count int;
BEGIN
  INSERT INTO core_warehouse.meta_insights_geo (
    shop_id,
    campaign_id,
    adset_id,
    ad_id,
    date,
    country,
    spend,
    impressions,
    clicks,
    reach,
    cpm,
    cpc,
    ctr,
    purchase,
    purchase_value,
    currency,
    metadata
  )
  SELECT
    p_shop_id,
    CASE WHEN insight_level = 'campaign' THEN entity_id ELSE NULL END,
    CASE WHEN insight_level = 'adset' THEN entity_id ELSE NULL END,
    CASE WHEN insight_level = 'ad' THEN entity_id ELSE NULL END,
    (data->>'date_start')::date,
    (data->>'country')::text,
    (data->>'spend')::numeric,
    (data->>'impressions')::bigint,
    (data->>'clicks')::bigint,
    (data->>'reach')::bigint,
    (data->>'cpm')::numeric,
    (data->>'cpc')::numeric,
    (data->>'ctr')::numeric,
    extract_action_value(data->'actions', 'offsite_conversion.fb_pixel_purchase'),
    extract_action_value_numeric(data->'action_values', 'offsite_conversion.fb_pixel_purchase'),
    'USD',
    data
  FROM staging_ingest.meta_insights_raw
  WHERE shop_id = p_shop_id
    AND breakdown_type = 'geo'
  ON CONFLICT (shop_id, COALESCE(campaign_id, ''), COALESCE(adset_id, ''), COALESCE(ad_id, ''), date, COALESCE(country, ''), COALESCE(region, ''), COALESCE(dma, ''), attribution_window)
  DO UPDATE SET
    spend = EXCLUDED.spend,
    impressions = EXCLUDED.impressions,
    clicks = EXCLUDED.clicks,
    reach = EXCLUDED.reach,
    cpm = EXCLUDED.cpm,
    cpc = EXCLUDED.cpc,
    ctr = EXCLUDED.ctr,
    purchase = EXCLUDED.purchase,
    purchase_value = EXCLUDED.purchase_value,
    metadata = EXCLUDED.metadata;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;

-- Master insights transformation function
CREATE OR REPLACE FUNCTION transform_meta_insights(p_shop_id text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_campaign int;
  v_adset int;
  v_ad int;
  v_age_gender int;
  v_device int;
  v_geo int;
BEGIN
  v_campaign := transform_meta_insights_campaign(p_shop_id);
  v_adset := transform_meta_insights_adset(p_shop_id);
  v_ad := transform_meta_insights_ad(p_shop_id);
  v_age_gender := transform_meta_insights_age_gender(p_shop_id);
  v_device := transform_meta_insights_device(p_shop_id);
  v_geo := transform_meta_insights_geo(p_shop_id);

  RETURN jsonb_build_object(
    'campaign', v_campaign,
    'adset', v_adset,
    'ad', v_ad,
    'age_gender', v_age_gender,
    'device', v_device,
    'geo', v_geo
  );
END;
$$;

-- ============================================================================
-- PART 3: STORAGE BUCKET SETUP
-- ============================================================================

-- Create storage bucket for creative assets (run this manually or via migration)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('meta-creatives', 'meta-creatives', true)
-- ON CONFLICT DO NOTHING;

COMMENT ON FUNCTION transform_meta_entities IS 'Transform all Meta entity types from staging to warehouse';
COMMENT ON FUNCTION transform_meta_insights IS 'Transform all Meta insights (all levels and breakdowns) from staging to warehouse';
COMMENT ON FUNCTION extract_action_value IS 'Extract action value by action_type from Meta actions array';
COMMENT ON FUNCTION extract_action_value_numeric IS 'Extract numeric action value by action_type from Meta action_values array';
