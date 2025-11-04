-- Create schemas
CREATE SCHEMA IF NOT EXISTS staging_ingest;
CREATE SCHEMA IF NOT EXISTS core_warehouse;
CREATE SCHEMA IF NOT EXISTS reporting;
CREATE SCHEMA IF NOT EXISTS app_dashboard;

-- staging_ingest: Raw JSONB tables
CREATE TABLE staging_ingest.shopify_shops_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE staging_ingest.shopify_orders_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE staging_ingest.shopify_line_items_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE staging_ingest.shopify_transactions_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE staging_ingest.shopify_payouts_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE staging_ingest.meta_insights_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE staging_ingest.ga4_report_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE staging_ingest.klaviyo_metrics_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- core_warehouse: Typed tables
CREATE TABLE core_warehouse.shops (
  shop_id text PRIMARY KEY,
  shopify_domain text,
  currency text,
  timezone text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE core_warehouse.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  shopify_gid text NOT NULL,
  order_number text,
  total_price numeric,
  currency text,
  created_at timestamptz,
  updated_at timestamptz,
  UNIQUE(shop_id, shopify_gid)
);

CREATE TABLE core_warehouse.order_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  shopify_gid text NOT NULL,
  order_id uuid REFERENCES core_warehouse.orders(id),
  product_id text,
  variant_id text,
  quantity integer,
  price numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, shopify_gid)
);

CREATE TABLE core_warehouse.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  shopify_gid text NOT NULL,
  order_id uuid REFERENCES core_warehouse.orders(id),
  amount numeric,
  kind text,
  status text,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, shopify_gid)
);

CREATE TABLE core_warehouse.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  shopify_gid text NOT NULL,
  amount numeric,
  currency text,
  status text,
  date date,
  created_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, shopify_gid)
);

CREATE TABLE core_warehouse.fact_marketing_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  date date NOT NULL,
  platform text NOT NULL,
  spend numeric,
  impressions bigint,
  clicks bigint,
  conversions bigint,
  revenue numeric,
  currency text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, date, platform)
);

CREATE TABLE core_warehouse.fact_ga4_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  date date NOT NULL,
  sessions bigint,
  users bigint,
  conversions bigint,
  revenue numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, date)
);

CREATE TABLE core_warehouse.fact_email_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  date date NOT NULL,
  sent bigint,
  opened bigint,
  clicked bigint,
  revenue numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, date)
);

CREATE TABLE core_warehouse.etl_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  status text NOT NULL,
  job_type text NOT NULL,
  platform text NOT NULL,
  error jsonb,
  records_synced integer,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX idx_etl_runs_shop_status ON core_warehouse.etl_runs(shop_id, status);
CREATE INDEX idx_etl_runs_created ON core_warehouse.etl_runs(created_at DESC);

-- Prevent duplicate in-flight jobs
CREATE UNIQUE INDEX idx_etl_runs_inflight ON core_warehouse.etl_runs(shop_id, platform)
WHERE status IN ('QUEUED', 'IN_PROGRESS');

CREATE TABLE core_warehouse.sync_cursors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL,
  platform text NOT NULL,
  last_success_at timestamptz,
  watermark jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, platform)
);

-- Indexes for performance
CREATE INDEX idx_orders_shop_created ON core_warehouse.orders(shop_id, created_at);
CREATE INDEX idx_transactions_shop_processed ON core_warehouse.transactions(shop_id, processed_at);
CREATE INDEX idx_payouts_shop_date ON core_warehouse.payouts(shop_id, date);
CREATE INDEX idx_fact_marketing_shop_date ON core_warehouse.fact_marketing_daily(shop_id, date);

-- reporting: Views
CREATE VIEW reporting.sync_status AS
SELECT
  e.id AS run_id,
  e.shop_id,
  s.shopify_domain,
  e.platform,
  e.job_type,
  e.status,
  e.records_synced,
  e.error,
  e.created_at,
  e.started_at,
  e.completed_at
FROM core_warehouse.etl_runs e
LEFT JOIN core_warehouse.shops s USING (shop_id)
ORDER BY e.created_at DESC;

CREATE VIEW reporting.daily_revenue AS
SELECT
  shop_id,
  DATE(created_at) AS date,
  COUNT(*) AS order_count,
  SUM(total_price) AS revenue,
  AVG(total_price) AS aov
FROM core_warehouse.orders
GROUP BY shop_id, DATE(created_at);

CREATE VIEW reporting.orders_daily AS
SELECT
  shop_id,
  DATE(created_at) AS date,
  COUNT(*) AS order_count
FROM core_warehouse.orders
GROUP BY shop_id, DATE(created_at);

CREATE VIEW reporting.cash_to_bank AS
SELECT
  p.shop_id,
  p.date AS payout_date,
  p.amount AS payout_amount,
  p.status AS payout_status,
  COALESCE(SUM(t.amount), 0) AS transaction_total
FROM core_warehouse.payouts p
LEFT JOIN core_warehouse.transactions t ON t.shop_id = p.shop_id
  AND DATE(t.processed_at) = p.date
GROUP BY p.shop_id, p.date, p.amount, p.status;

CREATE VIEW reporting.mer_roas AS
SELECT
  r.shop_id,
  r.date,
  r.revenue,
  m.spend AS total_spend,
  m.platform,
  CASE WHEN m.spend > 0 THEN r.revenue / m.spend ELSE NULL END AS mer,
  CASE WHEN m.spend > 0 THEN r.revenue / m.spend ELSE NULL END AS roas
FROM reporting.daily_revenue r
LEFT JOIN core_warehouse.fact_marketing_daily m USING (shop_id, date);

-- app_dashboard: App tables
CREATE TABLE app_dashboard.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  preferences jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE app_dashboard.saved_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  query jsonb,
  created_at timestamptz DEFAULT now()
);
