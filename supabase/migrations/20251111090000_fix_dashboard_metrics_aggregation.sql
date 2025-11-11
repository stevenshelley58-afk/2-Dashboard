-- Fix dashboard metrics aggregation to derive averages from totals
-- Ensures KPI calculations (AOV, ROAS, MER, Conversion Rate) are mathematically correct

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(
  p_shop_id TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_currency TEXT DEFAULT 'AUD'
)
RETURNS TABLE(
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
  v_days := p_end_date - p_start_date + 1;
  v_comparison_end := p_start_date - 1;
  v_comparison_start := v_comparison_end - v_days + 1;

  RETURN QUERY
  WITH current_period AS (
    SELECT
      COALESCE(SUM(revenue), 0)::NUMERIC AS revenue,
      COALESCE(SUM(orders), 0)::NUMERIC AS orders,
      COALESCE(SUM(ad_spend), 0)::NUMERIC AS ad_spend,
      COALESCE(SUM(sessions), 0)::NUMERIC AS sessions
    FROM reporting.dashboard_daily_metrics
    WHERE shop_id = p_shop_id
      AND date BETWEEN p_start_date AND p_end_date
  ),
  current_metrics AS (
    SELECT
      revenue,
      orders,
      ad_spend,
      sessions,
      CASE WHEN orders > 0 THEN revenue / orders ELSE NULL END AS aov,
      CASE WHEN ad_spend > 0 THEN revenue / ad_spend ELSE NULL END AS roas,
      CASE WHEN ad_spend > 0 THEN revenue / ad_spend ELSE NULL END AS mer,
      CASE WHEN sessions > 0 THEN (orders / sessions) * 100 ELSE NULL END AS conversion_rate
    FROM current_period
  ),
  comparison_period AS (
    SELECT
      COALESCE(SUM(revenue), 0)::NUMERIC AS revenue,
      COALESCE(SUM(orders), 0)::NUMERIC AS orders,
      COALESCE(SUM(ad_spend), 0)::NUMERIC AS ad_spend,
      COALESCE(SUM(sessions), 0)::NUMERIC AS sessions
    FROM reporting.dashboard_daily_metrics
    WHERE shop_id = p_shop_id
      AND date BETWEEN v_comparison_start AND v_comparison_end
  ),
  comparison_metrics AS (
    SELECT
      revenue,
      orders,
      ad_spend,
      sessions,
      CASE WHEN orders > 0 THEN revenue / orders ELSE NULL END AS aov,
      CASE WHEN ad_spend > 0 THEN revenue / ad_spend ELSE NULL END AS roas,
      CASE WHEN ad_spend > 0 THEN revenue / ad_spend ELSE NULL END AS mer,
      CASE WHEN sessions > 0 THEN (orders / sessions) * 100 ELSE NULL END AS conversion_rate
    FROM comparison_period
  )
  SELECT
    cm.revenue AS total_revenue,
    CASE
      WHEN comp.revenue > 0
      THEN ((cm.revenue - comp.revenue) / comp.revenue) * 100
      ELSE NULL
    END AS revenue_delta,

    cm.orders::BIGINT AS total_orders,
    CASE
      WHEN comp.orders > 0
      THEN ((cm.orders - comp.orders) / comp.orders) * 100
      ELSE NULL
    END AS orders_delta,

    cm.aov AS avg_order_value,
    CASE
      WHEN comp.aov IS NOT NULL AND comp.aov <> 0
      THEN ((cm.aov - comp.aov) / comp.aov) * 100
      ELSE NULL
    END AS aov_delta,

    cm.ad_spend AS total_ad_spend,
    CASE
      WHEN comp.ad_spend > 0
      THEN ((cm.ad_spend - comp.ad_spend) / comp.ad_spend) * 100
      ELSE NULL
    END AS ad_spend_delta,

    cm.roas AS avg_roas,
    CASE
      WHEN comp.roas IS NOT NULL AND comp.roas <> 0
      THEN ((cm.roas - comp.roas) / comp.roas) * 100
      ELSE NULL
    END AS roas_delta,

    cm.mer AS avg_mer,
    CASE
      WHEN comp.mer IS NOT NULL AND comp.mer <> 0
      THEN ((cm.mer - comp.mer) / comp.mer) * 100
      ELSE NULL
    END AS mer_delta,

    cm.sessions::BIGINT AS total_sessions,
    CASE
      WHEN comp.sessions > 0
      THEN ((cm.sessions - comp.sessions) / comp.sessions) * 100
      ELSE NULL
    END AS sessions_delta,

    cm.conversion_rate AS avg_conversion_rate,
    CASE
      WHEN comp.conversion_rate IS NOT NULL AND comp.conversion_rate <> 0
      THEN ((cm.conversion_rate - comp.conversion_rate) / comp.conversion_rate) * 100
      ELSE NULL
    END AS conversion_rate_delta
  FROM current_metrics cm
  CROSS JOIN comparison_metrics comp;
END;
$$;

COMMENT ON FUNCTION public.get_dashboard_metrics IS
'Returns aggregated dashboard metrics for a date range with period-over-period comparison (averages derived from totals).';

