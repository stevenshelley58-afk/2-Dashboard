'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface UserShopRow {
  shop_id: string
  is_default: boolean
  created_at?: string | null
}

interface KnownShop {
  shop_id: string
  shopify_domain?: string | null
  currency?: string | null
}

interface ActiveShopState {
  shopId: string | null
  currency: string | null
  isLoading: boolean
  error: Error | null
}

/**
 * Resolves the active Shopify shop for the dashboard.
 *
 * The frontend currently supports a single connected shop per user. We pick
 * the default shop from `app_dashboard.user_shops`, falling back to the first
 * mapping when no default is flagged. Shop metadata (currency, domain) is
 * resolved via the canonical `list_known_shop_ids` RPC.
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
      const { data: authData, error: authError } = await supabase.auth.getUser()

      if (authError) {
        throw authError
      }

      if (!authData?.user) {
        throw new Error('You must be signed in to view dashboard data.')
      }

      const { data: userShopsData, error: userShopsError } = await supabase
        .from('app_dashboard.user_shops')
        .select('shop_id, is_default, created_at')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })

      if (userShopsError) {
        throw userShopsError
      }

      const userShops = (userShopsData ?? []) as UserShopRow[]

      const activeMapping =
        userShops.find((row) => row.is_default) ?? userShops[0] ?? null

      if (!activeMapping?.shop_id) {
        throw new Error('No shops connected to your account. Connect a shop to get started.')
      }

      const canonicalShopId = activeMapping.shop_id

      const { data: knownShopsData, error: knownShopsError } =
        await supabase.rpc('list_known_shop_ids')

      if (knownShopsError) {
        throw knownShopsError
      }

      const knownShops = (knownShopsData ?? []) as KnownShop[]
      const matchedShop = knownShops.find((shop) => shop.shop_id === canonicalShopId) ?? null

      if (!matchedShop) {
        throw new Error(
          `Shop "${canonicalShopId}" is mapped to your account but is not registered yet.`
        )
      }

      if (!isMountedRef.current) {
        return
      }

      setState({
        shopId: canonicalShopId,
        currency: matchedShop.currency ?? null,
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

