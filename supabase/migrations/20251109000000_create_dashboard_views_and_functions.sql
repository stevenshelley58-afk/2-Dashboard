-- =====================================================
-- Dashboard Views and Functions for Date-Filtered Metrics
-- =====================================================
-- This migration creates optimized views and RPC functions
-- for the overview dashboard with date range filtering

-- =====================================================
-- 1. DAILY METRICS VIEW (Base aggregation)
-- =====================================================
-- Combines all daily metrics into a single view for easy querying
CREATE OR REPLACE VIEW reporting.dashboard_daily_metrics AS
SELECT
  COALESCE(o.shop_id, m.shop_id, g.shop_id) AS shop_id,
  COALESCE(o.date, m.date, g.date) AS date,

  -- Revenue & Orders (from Shopify)
  COALESCE(o.order_count, 0) AS orders,
  COALESCE(o.revenue, 0) AS revenue,
  COALESCE(o.aov, 0) AS aov,

  -- Ad Spend (aggregated across all platforms)
  COALESCE(m.total_spend, 0) AS ad_spend,

  -- Sessions & Analytics (from GA4)
  COALESCE(g.sessions, 0) AS sessions,
  COALESCE(g.users, 0) AS users,
  COALESCE(g.conversions, 0) AS ga4_conversions,

  -- Calculated Metrics
  CASE
    WHEN COALESCE(m.total_spend, 0) > 0
    THEN COALESCE(o.revenue, 0) / m.total_spend
    ELSE NULL
  END AS roas,
  CASE
    WHEN COALESCE(m.total_spend, 0) > 0
    THEN COALESCE(o.revenue, 0) / m.total_spend
    ELSE NULL
  END AS mer,
  CASE
    WHEN COALESCE(g.sessions, 0) > 0
    THEN (COALESCE(o.order_count, 0)::numeric / g.sessions) * 100
    ELSE NULL
  END AS conversion_rate

FROM reporting.daily_revenue o
FULL OUTER JOIN (
  SELECT
    shop_id,
    date,
    SUM(spend) AS total_spend
  FROM core_warehouse.fact_marketing_daily
  GROUP BY shop_id, date
) m ON o.shop_id = m.shop_id AND o.date = m.date
FULL OUTER JOIN core_warehouse.fact_ga4_daily g
  ON COALESCE(o.shop_id, m.shop_id) = g.shop_id
  AND COALESCE(o.date, m.date) = g.date;

COMMENT ON VIEW reporting.dashboard_daily_metrics IS
'Unified view combining daily revenue, ad spend, and analytics metrics for dashboard';

-- =====================================================
-- 2. RPC FUNCTION: Get Dashboard Overview Metrics
-- =====================================================
-- Returns aggregated metrics for a date range
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(
  p_shop_id TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_currency TEXT DEFAULT 'AUD'
)
RETURNS TABLE(
  -- KPI Metrics
  total_revenue NUMERIC,
  revenue_delta NUMERIC,
  total_orders BIGINT,
  orders_delta NUMERIC,
  avg_order_value NUMERIC,
  aov_delta NUMERIC,
  total_ad_spend NUMERIC,
  ad_spend_delta NUMERIC,
  avg_roas NUMERIC,
  roas_delta NUMERIC,
  avg_mer NUMERIC,
  mer_delta NUMERIC,
  total_sessions BIGINT,
  sessions_delta NUMERIC,
  avg_conversion_rate NUMERIC,
  conversion_rate_delta NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_days INTEGER;
  v_comparison_start DATE;
  v_comparison_end DATE;
BEGIN
  -- Calculate comparison period (previous period of same length)
  v_days := p_end_date - p_start_date + 1;
  v_comparison_end := p_start_date - 1;
  v_comparison_start := v_comparison_end - v_days + 1;

  RETURN QUERY
  WITH current_period AS (
    SELECT
      SUM(revenue) AS revenue,
      SUM(orders) AS orders,
      AVG(aov) AS aov,
      SUM(ad_spend) AS ad_spend,
      AVG(roas) AS roas,
      AVG(mer) AS mer,
      SUM(sessions) AS sessions,
      AVG(conversion_rate) AS conversion_rate
    FROM reporting.dashboard_daily_metrics
    WHERE shop_id = p_shop_id
      AND date BETWEEN p_start_date AND p_end_date
  ),
  comparison_period AS (
    SELECT
      SUM(revenue) AS revenue,
      SUM(orders) AS orders,
      AVG(aov) AS aov,
      SUM(ad_spend) AS ad_spend,
      AVG(roas) AS roas,
      AVG(mer) AS mer,
      SUM(sessions) AS sessions,
      AVG(conversion_rate) AS conversion_rate
    FROM reporting.dashboard_daily_metrics
    WHERE shop_id = p_shop_id
      AND date BETWEEN v_comparison_start AND v_comparison_end
  )
  SELECT
    -- Current period values
    COALESCE(c.revenue, 0) AS total_revenue,
    -- Delta calculations (percentage change)
    CASE
      WHEN COALESCE(comp.revenue, 0) > 0
      THEN ((c.revenue - comp.revenue) / comp.revenue) * 100
      ELSE NULL
    END AS revenue_delta,

    COALESCE(c.orders, 0)::BIGINT AS total_orders,
    CASE
      WHEN COALESCE(comp.orders, 0) > 0
      THEN ((c.orders - comp.orders) / comp.orders) * 100
      ELSE NULL
    END AS orders_delta,

    COALESCE(c.aov, 0) AS avg_order_value,
    CASE
      WHEN COALESCE(comp.aov, 0) > 0
      THEN ((c.aov - comp.aov) / comp.aov) * 100
      ELSE NULL
    END AS aov_delta,

    COALESCE(c.ad_spend, 0) AS total_ad_spend,
    CASE
      WHEN COALESCE(comp.ad_spend, 0) > 0
      THEN ((c.ad_spend - comp.ad_spend) / comp.ad_spend) * 100
      ELSE NULL
    END AS ad_spend_delta,

    COALESCE(c.roas, 0) AS avg_roas,
    CASE
      WHEN COALESCE(comp.roas, 0) > 0
      THEN ((c.roas - comp.roas) / comp.roas) * 100
      ELSE NULL
    END AS roas_delta,

    COALESCE(c.mer, 0) AS avg_mer,
    CASE
      WHEN COALESCE(comp.mer, 0) > 0
      THEN ((c.mer - comp.mer) / comp.mer) * 100
      ELSE NULL
    END AS mer_delta,

    COALESCE(c.sessions, 0)::BIGINT AS total_sessions,
    CASE
      WHEN COALESCE(comp.sessions, 0) > 0
      THEN ((c.sessions - comp.sessions) / comp.sessions) * 100
      ELSE NULL
    END AS sessions_delta,

    COALESCE(c.conversion_rate, 0) AS avg_conversion_rate,
    CASE
      WHEN COALESCE(comp.conversion_rate, 0) > 0
      THEN ((c.conversion_rate - comp.conversion_rate) / comp.conversion_rate) * 100
      ELSE NULL
    END AS conversion_rate_delta

  FROM current_period c
  CROSS JOIN comparison_period comp;
END;
$$;

COMMENT ON FUNCTION public.get_dashboard_metrics IS
'Returns aggregated dashboard metrics for a date range with period-over-period comparison';

-- =====================================================
-- 3. RPC FUNCTION: Get Chart Data (Daily Time Series)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_chart_data(
  p_shop_id TEXT,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE(
  date DATE,
  revenue NUMERIC,
  ad_spend NUMERIC,
  roas NUMERIC,
  mer NUMERIC,
  orders BIGINT,
  sessions BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    date,
    COALESCE(revenue, 0) AS revenue,
    COALESCE(ad_spend, 0) AS ad_spend,
    COALESCE(roas, 0) AS roas,
    COALESCE(mer, 0) AS mer,
    COALESCE(orders, 0)::BIGINT AS orders,
    COALESCE(sessions, 0)::BIGINT AS sessions
  FROM reporting.dashboard_daily_metrics
  WHERE shop_id = p_shop_id
    AND date BETWEEN p_start_date AND p_end_date
  ORDER BY date ASC;
$$;

COMMENT ON FUNCTION public.get_dashboard_chart_data IS
'Returns daily time series data for dashboard charts';

-- =====================================================
-- 4. RPC FUNCTION: Get Top Products by Revenue
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_top_products(
  p_shop_id TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  product_id TEXT,
  product_name TEXT,
  revenue NUMERIC,
  quantity_sold BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    li.product_id,
    li.product_id AS product_name, -- TODO: Join with products table when available
    SUM(li.price * li.quantity) AS revenue,
    SUM(li.quantity)::BIGINT AS quantity_sold
  FROM core_warehouse.order_line_items li
  INNER JOIN core_warehouse.orders o ON li.order_id = o.id
  WHERE o.shop_id = p_shop_id
    AND DATE(o.created_at) BETWEEN p_start_date AND p_end_date
  GROUP BY li.product_id
  ORDER BY revenue DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.get_top_products IS
'Returns top products by revenue for a date range';

-- =====================================================
-- 5. RPC FUNCTION: Get Channel Split (by Platform)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_channel_split(
  p_shop_id TEXT,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE(
  platform TEXT,
  spend NUMERIC,
  revenue NUMERIC,
  conversions BIGINT,
  roas NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    platform,
    SUM(spend) AS spend,
    SUM(revenue) AS revenue,
    SUM(conversions)::BIGINT AS conversions,
    CASE
      WHEN SUM(spend) > 0
      THEN SUM(revenue) / SUM(spend)
      ELSE NULL
    END AS roas
  FROM core_warehouse.fact_marketing_daily
  WHERE shop_id = p_shop_id
    AND date BETWEEN p_start_date AND p_end_date
  GROUP BY platform
  ORDER BY spend DESC;
$$;

COMMENT ON FUNCTION public.get_channel_split IS
'Returns marketing performance by platform (META, GOOGLE, etc.)';

-- =====================================================
-- 6. GRANT PERMISSIONS
-- =====================================================
-- Allow anonymous users to call these functions
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics TO anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_chart_data TO anon;
GRANT EXECUTE ON FUNCTION public.get_top_products TO anon;
GRANT EXECUTE ON FUNCTION public.get_channel_split TO anon;

-- Allow read access to the reporting view
GRANT SELECT ON reporting.dashboard_daily_metrics TO anon;
