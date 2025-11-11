'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

export interface DashboardMetrics {
  total_revenue: number
  revenue_delta: number | null
  total_orders: number
  orders_delta: number | null
  avg_order_value: number | null
  aov_delta: number | null
  total_ad_spend: number
  ad_spend_delta: number | null
  avg_roas: number | null
  roas_delta: number | null
  avg_mer: number | null
  mer_delta: number | null
  total_sessions: number
  sessions_delta: number | null
  avg_conversion_rate: number | null
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

const toNumber = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined) {
    return fallback
  }

  const numericValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null
  }

  const numericValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}

export function useDashboardMetrics(
  shopId: string | null,
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
    if (!shopId) {
      setMetrics(null)
      setChartData([])
      setTopProducts([])
      setChannelSplit([])
      setError(null)
      setIsLoading(false)
      return
    }

    let isCancelled = false

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

        if (isCancelled) return

        // Normalise metric payload
        const metricsRow = metricsRes.data?.[0]
        if (metricsRow) {
          setMetrics({
            total_revenue: toNumber(metricsRow.total_revenue),
            revenue_delta: toNullableNumber(metricsRow.revenue_delta),
            total_orders: toNumber(metricsRow.total_orders),
            orders_delta: toNullableNumber(metricsRow.orders_delta),
            avg_order_value: toNullableNumber(metricsRow.avg_order_value),
            aov_delta: toNullableNumber(metricsRow.aov_delta),
            total_ad_spend: toNumber(metricsRow.total_ad_spend),
            ad_spend_delta: toNullableNumber(metricsRow.ad_spend_delta),
            avg_roas: toNullableNumber(metricsRow.avg_roas),
            roas_delta: toNullableNumber(metricsRow.roas_delta),
            avg_mer: toNullableNumber(metricsRow.avg_mer),
            mer_delta: toNullableNumber(metricsRow.mer_delta),
            total_sessions: toNumber(metricsRow.total_sessions),
            sessions_delta: toNullableNumber(metricsRow.sessions_delta),
            avg_conversion_rate: toNullableNumber(metricsRow.avg_conversion_rate),
            conversion_rate_delta: toNullableNumber(metricsRow.conversion_rate_delta),
          })
        } else {
          setMetrics(null)
        }

        // Chart data
        const chartRows =
          (chartRes.data as Array<{
            date: string
            revenue: number | null
            ad_spend: number | null
            roas: number | null
            mer: number | null
            orders: number | null
            sessions: number | null
          }>) ?? []

        setChartData(
          chartRows.map((row) => ({
            date: row.date,
            revenue: toNumber(row.revenue),
            ad_spend: toNumber(row.ad_spend),
            roas: toNumber(row.roas),
            mer: toNumber(row.mer),
            orders: toNumber(row.orders),
            sessions: toNumber(row.sessions),
          }))
        )

        // Top products
        const productRows =
          (productsRes.data as Array<{
            product_id: string
            product_name: string | null
            revenue: number | null
            quantity_sold: number | null
          }>) ?? []

        setTopProducts(
          productRows.map((product) => ({
            product_id: product.product_id,
            product_name: product.product_name ?? product.product_id,
            revenue: toNumber(product.revenue),
            quantity_sold: toNumber(product.quantity_sold),
          }))
        )

        // Channel split
        const channelRows =
          (channelsRes.data as Array<{
            platform: string
            spend: number | null
            revenue: number | null
            conversions: number | null
            roas: number | null
          }>) ?? []

        setChannelSplit(
          channelRows.map((channel) => ({
            platform: channel.platform,
            spend: toNumber(channel.spend),
            revenue: toNumber(channel.revenue),
            conversions: toNumber(channel.conversions),
            roas: toNullableNumber(channel.roas),
          }))
        )
      } catch (err) {
        if (isCancelled) return
        console.error('Error fetching dashboard metrics:', err)
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      isCancelled = true
    }
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
