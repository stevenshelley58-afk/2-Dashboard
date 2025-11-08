'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

export interface DashboardMetrics {
  total_revenue: number
  revenue_delta: number | null
  total_orders: number
  orders_delta: number | null
  avg_order_value: number
  aov_delta: number | null
  total_ad_spend: number
  ad_spend_delta: number | null
  avg_roas: number
  roas_delta: number | null
  avg_mer: number
  mer_delta: number | null
  total_sessions: number
  sessions_delta: number | null
  avg_conversion_rate: number
  conversion_rate_delta: number | null
}

export interface ChartDataPoint {
  date: string
  revenue: number
  ad_spend: number
  roas: number
  mer: number
  orders: number
  sessions: number
}

export interface TopProduct {
  product_id: string
  product_name: string
  revenue: number
  quantity_sold: number
}

export interface ChannelData {
  platform: string
  spend: number
  revenue: number
  conversions: number
  roas: number | null
}

export interface DateRange {
  from: Date
  to: Date
}

export function useDashboardMetrics(
  shopId: string,
  dateRange: DateRange,
  currency: string = 'AUD'
) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [channelSplit, setChannelSplit] = useState<ChannelData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const startDate = format(dateRange.from, 'yyyy-MM-dd')
        const endDate = format(dateRange.to, 'yyyy-MM-dd')

        // Fetch all data in parallel
        const [metricsRes, chartRes, productsRes, channelsRes] = await Promise.all([
          supabase.rpc('get_dashboard_metrics', {
            p_shop_id: shopId,
            p_start_date: startDate,
            p_end_date: endDate,
            p_currency: currency,
          }),
          supabase.rpc('get_dashboard_chart_data', {
            p_shop_id: shopId,
            p_start_date: startDate,
            p_end_date: endDate,
          }),
          supabase.rpc('get_top_products', {
            p_shop_id: shopId,
            p_start_date: startDate,
            p_end_date: endDate,
            p_limit: 5,
          }),
          supabase.rpc('get_channel_split', {
            p_shop_id: shopId,
            p_start_date: startDate,
            p_end_date: endDate,
          }),
        ])

        // Check for errors
        if (metricsRes.error) throw metricsRes.error
        if (chartRes.error) throw chartRes.error
        if (productsRes.error) throw productsRes.error
        if (channelsRes.error) throw channelsRes.error

        // Set data
        setMetrics(metricsRes.data?.[0] || null)
        setChartData(chartRes.data || [])
        setTopProducts(productsRes.data || [])
        setChannelSplit(channelsRes.data || [])
      } catch (err) {
        console.error('Error fetching dashboard metrics:', err)
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [shopId, dateRange.from, dateRange.to, currency])

  return {
    metrics,
    chartData,
    topProducts,
    channelSplit,
    isLoading,
    error,
  }
}
