'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { DateRange } from '@/components/ui/date-picker-header'

export interface ShopifyOrderSummary {
  id: string
  order_number: string | null
  total_price: number | null
  currency: string | null
  created_at: string
  updated_at: string | null
}

interface UseShopifyOrdersOptions {
  limit?: number
}

/**
 * Fetches Shopify orders for a given shop and date range.
 *
 * The data is sourced from the `public.orders` view which is refreshed by the
 * ingestion pipeline. The hook returns a list of orders (sorted by newest
 * first) alongside convenience metrics like count and revenue totals for the
 * current range. Consumers can use the `limit` option to adjust how many
 * records are returned (default: 25).
 */
export function useShopifyOrders(
  shopId: string | null,
  dateRange: DateRange,
  { limit = 25 }: UseShopifyOrdersOptions = {}
) {
  const [orders, setOrders] = useState<ShopifyOrderSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!shopId) {
      setOrders([])
      setIsLoading(false)
      setError(null)
      return
    }

    let isMounted = true

    const fetchOrders = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const from = new Date(dateRange.from)
        from.setHours(0, 0, 0, 0)
        const to = new Date(dateRange.to)
        to.setHours(23, 59, 59, 999)

        const { data, error: supabaseError } = await supabase
          .from('orders')
          .select('id, order_number, total_price, currency, created_at, updated_at')
          .eq('shop_id', shopId)
          .gte('created_at', from.toISOString())
          .lte('created_at', to.toISOString())
          .order('created_at', { ascending: false })
          .limit(limit)

        if (supabaseError) throw supabaseError

        if (!isMounted) return

        setOrders(data ?? [])
        setIsLoading(false)
        setError(null)
      } catch (err) {
        if (!isMounted) return

        setOrders([])
        setIsLoading(false)
        setError(err instanceof Error ? err : new Error('Failed to load orders'))
      }
    }

    fetchOrders()

    return () => {
      isMounted = false
    }
  }, [shopId, dateRange.from, dateRange.to, limit])

  const rangeTotalRevenue = useMemo(() => {
    return orders.reduce((sum, order) => sum + (order.total_price ?? 0), 0)
  }, [orders])
  const rangeOrderCount = useMemo(() => orders.length, [orders])

  return {
    orders,
    isLoading,
    error,
    rangeOrderCount,
    rangeTotalRevenue,
  }
}

