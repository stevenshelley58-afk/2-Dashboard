-- ============================================================================
-- META ADS COMPREHENSIVE SCHEMA
-- Full metadata extraction with creative assets and breakdowns
-- ============================================================================

-- ============================================================================
-- PART 1: CORE ENTITY TABLES
-- ============================================================================

-- Meta Ad Accounts
CREATE TABLE IF NOT EXISTS core_warehouse.meta_ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  account_id text NOT NULL,
  account_name text,
  currency text,
  timezone_name text,
  business_name text,
  business_id text,
  account_status text, -- ACTIVE, DISABLED, UNSETTLED, etc.
  disable_reason text,
  amount_spent numeric,
  balance numeric,
  created_time timestamptz,
  min_campaign_group_spend_cap numeric,
  min_daily_budget numeric,
  metadata jsonb, -- Full API response
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, account_id)
);

-- Meta Campaigns
CREATE TABLE IF NOT EXISTS core_warehouse.meta_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  campaign_id text NOT NULL,
  account_id text NOT NULL,
  name text,
  status text, -- ACTIVE, PAUSED, DELETED, ARCHIVED
  objective text, -- OUTCOME_SALES, OUTCOME_LEADS, OUTCOME_AWARENESS, etc.
  buying_type text, -- AUCTION, RESERVED
  bid_strategy text,
  budget_remaining numeric,
  daily_budget numeric,
  lifetime_budget numeric,
  spend_cap numeric,
  special_ad_categories text[], -- CREDIT, EMPLOYMENT, HOUSING, etc.
  start_time timestamptz,
  stop_time timestamptz,
  created_time timestamptz,
  updated_time timestamptz,
  metadata jsonb, -- Full API response
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, campaign_id)
);

-- Meta Ad Sets
CREATE TABLE IF NOT EXISTS core_warehouse.meta_adsets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  adset_id text NOT NULL,
  campaign_id text NOT NULL,
  account_id text NOT NULL,
  name text,
  status text, -- ACTIVE, PAUSED, DELETED, ARCHIVED
  optimization_goal text, -- OFFSITE_CONVERSIONS, LINK_CLICKS, IMPRESSIONS, etc.
  billing_event text, -- IMPRESSIONS, LINK_CLICKS, etc.
  bid_amount numeric,
  bid_strategy text,
  daily_budget numeric,
  lifetime_budget numeric,
  budget_remaining numeric,
  start_time timestamptz,
  end_time timestamptz,
  created_time timestamptz,
  updated_time timestamptz,
  -- Targeting (stored as JSONB for flexibility)
  targeting jsonb, -- Full targeting spec
  -- Parsed targeting fields for easy querying
  targeting_age_min int,
  targeting_age_max int,
  targeting_genders int[], -- 1=male, 2=female
  targeting_geo_locations jsonb,
  targeting_interests jsonb,
  targeting_behaviors jsonb,
  targeting_custom_audiences text[],
  -- Delivery settings
  destination_type text,
  promoted_object jsonb,
  attribution_spec jsonb,
  metadata jsonb, -- Full API response
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, adset_id)
);

-- Meta Ads
CREATE TABLE IF NOT EXISTS core_warehouse.meta_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  ad_id text NOT NULL,
  adset_id text NOT NULL,
  campaign_id text NOT NULL,
  account_id text NOT NULL,
  name text,
  status text, -- ACTIVE, PAUSED, DELETED, ARCHIVED
  creative_id text, -- Reference to meta_adcreatives
  tracking_specs jsonb,
  conversion_specs jsonb,
  created_time timestamptz,
  updated_time timestamptz,
  metadata jsonb, -- Full API response
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, ad_id)
);

-- Meta Ad Creatives
CREATE TABLE IF NOT EXISTS core_warehouse.meta_adcreatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  creative_id text NOT NULL,
  account_id text NOT NULL,
  name text,
  title text,
  body text,
  link_url text,
  call_to_action_type text, -- SHOP_NOW, LEARN_MORE, SIGN_UP, etc.
  -- Image/Video references
  image_hash text, -- Reference to meta_adimages
  image_url text,
  video_id text, -- Reference to meta_advideos
  thumbnail_url text,
  -- Creative type
  object_type text, -- SHARE, PHOTO, VIDEO, etc.
  -- Full creative payload
  object_story_spec jsonb,
  asset_feed_spec jsonb, -- For dynamic ads
  -- Product catalog (if applicable)
  product_set_id text,
  -- Carousel/Collection data
  child_attachments jsonb,
  -- Instagram-specific
  instagram_actor_id text,
  instagram_permalink_url text,
  -- Status
  status text,
  effective_object_story_id text,
  metadata jsonb, -- Full API response
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, creative_id)
);

-- Meta Ad Images (downloaded assets)
CREATE TABLE IF NOT EXISTS core_warehouse.meta_adimages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  image_hash text NOT NULL,
  account_id text NOT NULL,
  url text,
  permalink_url text,
  width int,
  height int,
  -- Storage reference (Supabase Storage bucket)
  storage_bucket text DEFAULT 'meta-creatives',
  storage_path text, -- Path in storage bucket
  storage_url text, -- Public/signed URL
  -- File metadata
  file_size_bytes bigint,
  mime_type text,
  original_filename text,
  -- Download status
  download_status text DEFAULT 'PENDING', -- PENDING, DOWNLOADED, FAILED
  download_error text,
  downloaded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, image_hash)
);

-- Meta Ad Videos (downloaded assets)
CREATE TABLE IF NOT EXISTS core_warehouse.meta_advideos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  video_id text NOT NULL,
  account_id text NOT NULL,
  title text,
  description text,
  source text, -- Original video URL
  permalink_url text,
  -- Video properties
  length_seconds numeric,
  width int,
  height int,
  format jsonb, -- Array of available formats
  -- Thumbnail
  picture_url text,
  thumbnail_storage_path text,
  thumbnail_storage_url text,
  -- Video file storage
  storage_bucket text DEFAULT 'meta-creatives',
  storage_path text,
  storage_url text,
  -- File metadata
  file_size_bytes bigint,
  mime_type text,
  -- Download status
  download_status text DEFAULT 'PENDING',
  download_error text,
  downloaded_at timestamptz,
  -- Stats
  views bigint,
  created_time timestamptz,
  updated_time timestamptz,
  metadata jsonb, -- Full API response
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, video_id)
);

-- ============================================================================
-- PART 2: INSIGHTS TABLES (Performance Metrics)
-- ============================================================================

-- Campaign-level insights (daily)
CREATE TABLE IF NOT EXISTS core_warehouse.meta_insights_campaign (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  campaign_id text NOT NULL,
  date date NOT NULL,
  -- Core metrics
  spend numeric,
  impressions bigint,
  clicks bigint,
  reach bigint,
  frequency numeric,
  -- Cost metrics
  cpm numeric, -- Cost per 1000 impressions
  cpc numeric, -- Cost per click
  ctr numeric, -- Click-through rate
  cpp numeric, -- Cost per 1000 people reached
  -- Conversion metrics (standard events)
  add_to_cart bigint,
  initiate_checkout bigint,
  purchase bigint,
  purchase_value numeric,
  -- Engagement metrics
  post_engagement bigint,
  post_reactions bigint,
  post_comments bigint,
  post_shares bigint,
  video_views bigint,
  video_views_3s bigint,
  video_views_10s bigint,
  video_avg_time_watched_seconds numeric,
  -- Link clicks
  outbound_clicks bigint,
  link_clicks bigint,
  -- Attribution window (new column for future-proofing)
  attribution_window text DEFAULT '7d_click',
  -- Metadata
  currency text,
  metadata jsonb, -- Full insights response
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, campaign_id, date, attribution_window)
);

-- AdSet-level insights (daily)
CREATE TABLE IF NOT EXISTS core_warehouse.meta_insights_adset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  adset_id text NOT NULL,
  campaign_id text NOT NULL,
  date date NOT NULL,
  -- Same metrics as campaign level
  spend numeric,
  impressions bigint,
  clicks bigint,
  reach bigint,
  frequency numeric,
  cpm numeric,
  cpc numeric,
  ctr numeric,
  cpp numeric,
  add_to_cart bigint,
  initiate_checkout bigint,
  purchase bigint,
  purchase_value numeric,
  post_engagement bigint,
  post_reactions bigint,
  post_comments bigint,
  post_shares bigint,
  video_views bigint,
  video_views_3s bigint,
  video_views_10s bigint,
  video_avg_time_watched_seconds numeric,
  outbound_clicks bigint,
  link_clicks bigint,
  attribution_window text DEFAULT '7d_click',
  currency text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, adset_id, date, attribution_window)
);

-- Ad-level insights (daily)
CREATE TABLE IF NOT EXISTS core_warehouse.meta_insights_ad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  ad_id text NOT NULL,
  adset_id text NOT NULL,
  campaign_id text NOT NULL,
  date date NOT NULL,
  -- Same metrics structure
  spend numeric,
  impressions bigint,
  clicks bigint,
  reach bigint,
  frequency numeric,
  cpm numeric,
  cpc numeric,
  ctr numeric,
  cpp numeric,
  add_to_cart bigint,
  initiate_checkout bigint,
  purchase bigint,
  purchase_value numeric,
  post_engagement bigint,
  post_reactions bigint,
  post_comments bigint,
  post_shares bigint,
  video_views bigint,
  video_views_3s bigint,
  video_views_10s bigint,
  video_avg_time_watched_seconds numeric,
  outbound_clicks bigint,
  link_clicks bigint,
  attribution_window text DEFAULT '7d_click',
  currency text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, ad_id, date, attribution_window)
);

-- ============================================================================
-- PART 3: BREAKDOWN INSIGHTS TABLES
-- ============================================================================

-- Age & Gender breakdown
CREATE TABLE IF NOT EXISTS core_warehouse.meta_insights_age_gender (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  campaign_id text,
  adset_id text,
  ad_id text,
  date date NOT NULL,
  age text, -- '18-24', '25-34', '35-44', '45-54', '55-64', '65+'
  gender text, -- 'male', 'female', 'unknown'
  spend numeric,
  impressions bigint,
  clicks bigint,
  reach bigint,
  frequency numeric,
  cpm numeric,
  cpc numeric,
  ctr numeric,
  purchase bigint,
  purchase_value numeric,
  attribution_window text DEFAULT '7d_click',
  currency text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Device/Platform breakdown
CREATE TABLE IF NOT EXISTS core_warehouse.meta_insights_device (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  campaign_id text,
  adset_id text,
  ad_id text,
  date date NOT NULL,
  device_platform text, -- 'mobile', 'desktop', 'unknown'
  publisher_platform text, -- 'facebook', 'instagram', 'messenger', 'audience_network'
  platform_position text, -- 'feed', 'right_hand_column', 'instant_article', 'story', 'reels', etc.
  impression_device text, -- 'iPhone', 'Android', 'iPad', etc.
  spend numeric,
  impressions bigint,
  clicks bigint,
  reach bigint,
  cpm numeric,
  cpc numeric,
  ctr numeric,
  purchase bigint,
  purchase_value numeric,
  attribution_window text DEFAULT '7d_click',
  currency text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Geographic breakdown
CREATE TABLE IF NOT EXISTS core_warehouse.meta_insights_geo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  campaign_id text,
  adset_id text,
  ad_id text,
  date date NOT NULL,
  country text,
  region text,
  dma text, -- Designated Market Area (US only)
  spend numeric,
  impressions bigint,
  clicks bigint,
  reach bigint,
  cpm numeric,
  cpc numeric,
  ctr numeric,
  purchase bigint,
  purchase_value numeric,
  attribution_window text DEFAULT '7d_click',
  currency text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- PART 4: STAGING TABLES (Raw API Responses)
-- ============================================================================

-- Staging table for all entity types
CREATE TABLE IF NOT EXISTS staging_ingest.meta_entities_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  entity_type text NOT NULL, -- 'account', 'campaign', 'adset', 'ad', 'creative', 'image', 'video'
  entity_id text NOT NULL,
  data jsonb NOT NULL,
  job_type text, -- 'HISTORICAL' or 'INCREMENTAL'
  created_at timestamptz DEFAULT now()
);

-- Staging table for insights (all levels and breakdowns)
CREATE TABLE IF NOT EXISTS staging_ingest.meta_insights_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  insight_level text NOT NULL, -- 'campaign', 'adset', 'ad'
  breakdown_type text, -- NULL, 'age_gender', 'device', 'geo'
  entity_id text NOT NULL,
  data jsonb NOT NULL,
  job_type text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- PART 5: INDEXES FOR PERFORMANCE
-- ============================================================================

-- Entity table indexes
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_shop_id ON core_warehouse.meta_campaigns(shop_id);
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_account_id ON core_warehouse.meta_campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_status ON core_warehouse.meta_campaigns(status);

CREATE INDEX IF NOT EXISTS idx_meta_adsets_shop_id ON core_warehouse.meta_adsets(shop_id);
CREATE INDEX IF NOT EXISTS idx_meta_adsets_campaign_id ON core_warehouse.meta_adsets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_adsets_status ON core_warehouse.meta_adsets(status);

CREATE INDEX IF NOT EXISTS idx_meta_ads_shop_id ON core_warehouse.meta_ads(shop_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_adset_id ON core_warehouse.meta_ads(adset_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_campaign_id ON core_warehouse.meta_ads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_creative_id ON core_warehouse.meta_ads(creative_id);

CREATE INDEX IF NOT EXISTS idx_meta_adcreatives_shop_id ON core_warehouse.meta_adcreatives(shop_id);
CREATE INDEX IF NOT EXISTS idx_meta_adcreatives_image_hash ON core_warehouse.meta_adcreatives(image_hash);
CREATE INDEX IF NOT EXISTS idx_meta_adcreatives_video_id ON core_warehouse.meta_adcreatives(video_id);

CREATE INDEX IF NOT EXISTS idx_meta_adimages_shop_id ON core_warehouse.meta_adimages(shop_id);
CREATE INDEX IF NOT EXISTS idx_meta_adimages_download_status ON core_warehouse.meta_adimages(download_status);

CREATE INDEX IF NOT EXISTS idx_meta_advideos_shop_id ON core_warehouse.meta_advideos(shop_id);
CREATE INDEX IF NOT EXISTS idx_meta_advideos_download_status ON core_warehouse.meta_advideos(download_status);

-- Insights table indexes
CREATE INDEX IF NOT EXISTS idx_meta_insights_campaign_shop_date ON core_warehouse.meta_insights_campaign(shop_id, date);
CREATE INDEX IF NOT EXISTS idx_meta_insights_campaign_campaign_id ON core_warehouse.meta_insights_campaign(campaign_id);

CREATE INDEX IF NOT EXISTS idx_meta_insights_adset_shop_date ON core_warehouse.meta_insights_adset(shop_id, date);
CREATE INDEX IF NOT EXISTS idx_meta_insights_adset_adset_id ON core_warehouse.meta_insights_adset(adset_id);
CREATE INDEX IF NOT EXISTS idx_meta_insights_adset_campaign_id ON core_warehouse.meta_insights_adset(campaign_id);

CREATE INDEX IF NOT EXISTS idx_meta_insights_ad_shop_date ON core_warehouse.meta_insights_ad(shop_id, date);
CREATE INDEX IF NOT EXISTS idx_meta_insights_ad_ad_id ON core_warehouse.meta_insights_ad(ad_id);

-- Breakdown indexes
CREATE INDEX IF NOT EXISTS idx_meta_insights_age_gender_shop_date ON core_warehouse.meta_insights_age_gender(shop_id, date);
CREATE INDEX IF NOT EXISTS idx_meta_insights_device_shop_date ON core_warehouse.meta_insights_device(shop_id, date);
CREATE INDEX IF NOT EXISTS idx_meta_insights_geo_shop_date ON core_warehouse.meta_insights_geo(shop_id, date);

-- Unique indexes for breakdown tables (using expressions for nullable columns)
CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_insights_age_gender_unique
ON core_warehouse.meta_insights_age_gender(shop_id, COALESCE(campaign_id, ''), COALESCE(adset_id, ''), COALESCE(ad_id, ''), date, age, gender, attribution_window);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_insights_device_unique
ON core_warehouse.meta_insights_device(shop_id, COALESCE(campaign_id, ''), COALESCE(adset_id, ''), COALESCE(ad_id, ''), date, device_platform, publisher_platform, platform_position, attribution_window);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_insights_geo_unique
ON core_warehouse.meta_insights_geo(shop_id, COALESCE(campaign_id, ''), COALESCE(adset_id, ''), COALESCE(ad_id, ''), date, COALESCE(country, ''), COALESCE(region, ''), COALESCE(dma, ''), attribution_window);

-- Staging indexes
CREATE INDEX IF NOT EXISTS idx_meta_entities_raw_shop_type ON staging_ingest.meta_entities_raw(shop_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_meta_insights_raw_shop_level ON staging_ingest.meta_insights_raw(shop_id, insight_level);

-- ============================================================================
-- PART 6: UPDATED sync_cursors FOR GRANULAR TRACKING
-- ============================================================================

-- Add columns to existing sync_cursors table
ALTER TABLE core_warehouse.sync_cursors
ADD COLUMN IF NOT EXISTS entity_type text,
ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Create unique index for entity-specific cursors
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_cursors_shop_platform_entity
ON core_warehouse.sync_cursors(shop_id, platform, COALESCE(entity_type, ''));

COMMENT ON TABLE core_warehouse.meta_ad_accounts IS 'Meta ad account metadata';
COMMENT ON TABLE core_warehouse.meta_campaigns IS 'Meta campaign entities with full metadata';
COMMENT ON TABLE core_warehouse.meta_adsets IS 'Meta ad set entities with targeting and optimization settings';
COMMENT ON TABLE core_warehouse.meta_ads IS 'Meta ad entities';
COMMENT ON TABLE core_warehouse.meta_adcreatives IS 'Meta ad creative content and specifications';
COMMENT ON TABLE core_warehouse.meta_adimages IS 'Downloaded Meta ad image assets';
COMMENT ON TABLE core_warehouse.meta_advideos IS 'Downloaded Meta ad video assets';
COMMENT ON TABLE core_warehouse.meta_insights_campaign IS 'Daily campaign-level performance metrics';
COMMENT ON TABLE core_warehouse.meta_insights_adset IS 'Daily adset-level performance metrics';
COMMENT ON TABLE core_warehouse.meta_insights_ad IS 'Daily ad-level performance metrics';
COMMENT ON TABLE core_warehouse.meta_insights_age_gender IS 'Performance metrics broken down by age and gender';
COMMENT ON TABLE core_warehouse.meta_insights_device IS 'Performance metrics broken down by device and platform';
COMMENT ON TABLE core_warehouse.meta_insights_geo IS 'Performance metrics broken down by geography';
