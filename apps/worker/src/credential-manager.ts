import { SupabaseClient } from '@supabase/supabase-js'
import { Platform } from '@dashboard/config'

export type CredentialErrorCode = 'NOT_FOUND' | 'EXPIRED' | 'INVALID'

export class CredentialError extends Error {
  code: CredentialErrorCode

  constructor(message: string, code: CredentialErrorCode) {
    super(message)
    this.code = code
  }
}

interface CredentialRow {
  shop_id: string
  platform: Platform
  access_token: string
  refresh_token?: string | null
  expires_at?: string | null
  last_validated_at?: string | null
  updated_at?: string | null
}

interface ShopRow {
  shop_id: string
  shopify_domain?: string | null
  metadata?: Record<string, unknown> | null
}

export interface ResolvedCredential {
  shopId: string
  platform: Platform
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  lastValidatedAt: Date | null
  shop: ShopRow
}

interface CacheEntry<T> {
  fetchedAt: number
  value: T
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000

export class CredentialManager {
  private credentialCache = new Map<string, CacheEntry<CredentialRow>>()
  private shopCache = new Map<string, CacheEntry<ShopRow>>()
  private shopCredentialListCache = new Map<string, CacheEntry<CredentialRow[]>>()
  private cacheTtlMs: number

  constructor(
    private readonly supabase: SupabaseClient,
    options?: {
      cacheTtlMs?: number
    }
  ) {
    this.cacheTtlMs = options?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS
  }

  async get(shopId: string, platform: Platform): Promise<ResolvedCredential> {
    const key = this.credentialCacheKey(shopId, platform)
    const cached = this.credentialCache.get(key)
    const now = Date.now()

    if (cached && now - cached.fetchedAt < this.cacheTtlMs) {
      this.ensureNotExpired(cached.value, shopId, platform)
      return this.hydrateCredential(cached.value)
    }

    const row = await this.fetchCredentialRow(shopId, platform)
    this.credentialCache.set(key, { value: row, fetchedAt: now })

    return this.hydrateCredential(row)
  }

  async getPlatformsForShop(shopId: string): Promise<Platform[]> {
    const rows = await this.listCredentialRowsForShop(shopId)
    const now = Date.now()

    return rows
      .filter((row) => {
        if (!row.expires_at) {
          return true
        }
        const expiresAt = Date.parse(row.expires_at)
        return Number.isFinite(expiresAt) ? expiresAt > now : true
      })
      .map((row) => row.platform)
  }

  clearCache(): void {
    this.credentialCache.clear()
    this.shopCache.clear()
    this.shopCredentialListCache.clear()
  }

  private credentialCacheKey(shopId: string, platform: Platform): string {
    return `${shopId}::${platform}`
  }

  private async fetchCredentialRow(shopId: string, platform: Platform): Promise<CredentialRow> {
    const { data, error } = await this.supabase
      .from('core_warehouse.shop_credentials')
      .select('shop_id, platform, access_token, refresh_token, expires_at, last_validated_at, updated_at')
      .eq('shop_id', shopId)
      .eq('platform', platform)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to load credentials for ${shopId}/${platform}: ${error.message}`)
    }

    if (!data) {
      throw new CredentialError(`No credentials configured for ${shopId}/${platform}`, 'NOT_FOUND')
    }

    const row = data as CredentialRow
    this.ensureNotExpired(row, shopId, platform)

    if (!row.access_token || row.access_token.trim().length === 0) {
      throw new CredentialError(`Credential for ${shopId}/${platform} is missing access token`, 'INVALID')
    }

    return row
  }

  private async listCredentialRowsForShop(shopId: string): Promise<CredentialRow[]> {
    const cached = this.shopCredentialListCache.get(shopId)
    const now = Date.now()

    if (cached && now - cached.fetchedAt < this.cacheTtlMs) {
      return cached.value
    }

    const { data, error } = await this.supabase
      .from('core_warehouse.shop_credentials')
      .select('shop_id, platform, access_token, refresh_token, expires_at, last_validated_at, updated_at')
      .eq('shop_id', shopId)

    if (error) {
      throw new Error(`Failed to list credentials for shop ${shopId}: ${error.message}`)
    }

    const rows = (Array.isArray(data) ? data : []) as CredentialRow[]
    this.shopCredentialListCache.set(shopId, { value: rows, fetchedAt: now })

    return rows
  }

  private async hydrateCredential(row: CredentialRow): Promise<ResolvedCredential> {
    const shop = await this.getShop(row.shop_id)

    return {
      shopId: row.shop_id,
      platform: row.platform,
      accessToken: row.access_token,
      refreshToken: row.refresh_token ?? null,
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
      lastValidatedAt: row.last_validated_at ? new Date(row.last_validated_at) : null,
      shop,
    }
  }

  private async getShop(shopId: string): Promise<ShopRow> {
    const cached = this.shopCache.get(shopId)
    const now = Date.now()

    if (cached && now - cached.fetchedAt < this.cacheTtlMs) {
      return cached.value
    }

    const { data, error } = await this.supabase
      .from('core_warehouse.shops')
      .select('shop_id, shopify_domain, metadata')
      .eq('shop_id', shopId)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to load shop ${shopId}: ${error.message}`)
    }

    if (!data) {
      throw new CredentialError(`Shop ${shopId} not found`, 'INVALID')
    }

    const shop = data as ShopRow
    this.shopCache.set(shopId, { value: shop, fetchedAt: now })

    return shop
  }

  private ensureNotExpired(row: CredentialRow, shopId: string, platform: Platform) {
    if (!row.expires_at) {
      return
    }

    const expiresAt = Date.parse(row.expires_at)
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      throw new CredentialError(`Credential for ${shopId}/${platform} has expired`, 'EXPIRED')
    }
  }
}



