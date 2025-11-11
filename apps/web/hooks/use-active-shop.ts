'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface ActiveShopState {
  shopId: string | null
  currency: string | null
  isLoading: boolean
  error: Error | null
}

/**
 * Resolves the active Shopify shop for the dashboard.
 *
 * The frontend currently supports a single connected shop. We infer the
 * default shop by looking at the most recent order exposed through the
 * `public.orders` view. This keeps the logic aligned with the data that is
 * refreshed by the ingestion pipeline—whenever new orders are synced, this
 * hook will pick up the latest `shop_id` and currency.
 *
 * Returns the resolved shop id, detected currency, loading state, and any
 * error encountered. A `refresh` function is also exposed to re-run the
 * lookup on demand (e.g., after triggering a data sync).
 */
export function useActiveShop() {
  const [{ shopId, currency, isLoading, error }, setState] = useState<ActiveShopState>({
    shopId: null,
    currency: null,
    isLoading: true,
    error: null,
  })
  const isMountedRef = useRef(true)

  const resolveShop = useCallback(async () => {
    setState((prev) => {
      if (!isMountedRef.current) return prev
      return { ...prev, isLoading: true, error: null }
    })

    try {
      const { data, error: supabaseError } = await supabase
        .from('orders')
        .select('shop_id, currency')
        .not('shop_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (supabaseError) {
        throw supabaseError
      }

      if (!data?.shop_id) {
        throw new Error('No shop data found. Run a sync to populate orders.')
      }

      if (!isMountedRef.current) {
        return
      }

      setState({
        shopId: data.shop_id,
        currency: data.currency ?? null,
        isLoading: false,
        error: null,
      })
    } catch (err) {
      const normalizedError = err instanceof Error ? err : new Error('Failed to resolve shop')

      if (!isMountedRef.current) {
        return
      }

      setState({
        shopId: null,
        currency: null,
        isLoading: false,
        error: normalizedError,
      })
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    resolveShop()
    return () => {
      isMountedRef.current = false
    }
  }, [resolveShop])

  return {
    shopId,
    currency,
    isLoading,
    error,
    refresh: resolveShop,
  }
}

