import 'dotenv/config'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  Platform,
  normalizeShopifyDomainToShopId,
  normalizeShopIdToShopifyDomain,
} from '@dashboard/config'

interface ShopRow {
  shop_id: string
  shopify_domain?: string | null
  metadata?: Record<string, unknown> | null
}

interface MetadataInputs {
  shopifyDomain?: string | null
  shopifyDomainShopId?: string | null
  metaAdAccountId?: string | null
  ga4PropertyId?: string | null
}

interface PlatformSeed {
  platform: Platform
  accessToken: string
  refreshToken?: string | null
  note: string
}

function assertSupabaseConfig(): { supabaseUrl: string; supabaseServiceRoleKey: string } {
  const supabaseUrl = process.env.SUPABASE_URL?.trim()
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to seed credentials.')
  }

  return { supabaseUrl, supabaseServiceRoleKey }
}

function parseShopIds(): string[] {
  const raw = process.env.SEED_SHOP_IDS?.trim()

  if (!raw) {
    return []
  }

  const ids = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => canonicalShopIdFromInput(value, 'SEED_SHOP_IDS'))

  return Array.from(new Set(ids))
}

function collectSeeds(): { seeds: PlatformSeed[]; metadata: MetadataInputs } {
  const seeds: PlatformSeed[] = []
  const metadata: MetadataInputs = {}

  const shopifyToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim()
  const shopifyDomain = process.env.SHOPIFY_SHOP_DOMAIN?.trim()
  if (shopifyDomain) {
    const canonicalShopId = canonicalShopIdFromInput(shopifyDomain, 'SHOPIFY_SHOP_DOMAIN')
    metadata.shopifyDomain = normalizeShopIdToShopifyDomain(canonicalShopId)
    metadata.shopifyDomainShopId = canonicalShopId
  }
  if (shopifyToken) {
    seeds.push({
      platform: Platform.SHOPIFY,
      accessToken: shopifyToken,
      note: 'Shopify Admin access token',
    })
  }

  const metaToken = process.env.META_ACCESS_TOKEN?.trim()
  const metaAdAccount = process.env.META_AD_ACCOUNT_ID?.trim()
  if (metaAdAccount) {
    metadata.metaAdAccountId = metaAdAccount
  }
  if (metaToken && metaAdAccount) {
    seeds.push({
      platform: Platform.META,
      accessToken: metaToken,
      note: 'Meta Marketing API token',
    })
  }

  const ga4PropertyId = process.env.GA4_PROPERTY_ID?.trim()
  const ga4Credential =
    process.env.GA4_SERVICE_ACCOUNT_KEY?.trim() ?? process.env.GA4_CREDENTIALS_JSON?.trim()
  if (ga4PropertyId) {
    metadata.ga4PropertyId = ga4PropertyId
  }
  if (ga4PropertyId && ga4Credential) {
    seeds.push({
      platform: Platform.GA4,
      accessToken: ga4Credential,
      note: 'GA4 service account credentials',
    })
  }

  const klaviyoKey = process.env.KLAVIYO_PRIVATE_API_KEY?.trim() ?? process.env.KLAVIYO_API_KEY?.trim()
  if (klaviyoKey) {
    seeds.push({
      platform: Platform.KLAVIYO,
      accessToken: klaviyoKey,
      note: 'Klaviyo private API key',
    })
  }

  return { seeds, metadata }
}

function canonicalShopIdFromInput(value: string, context: string): string {
  try {
    return normalizeShopifyDomainToShopId(value)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`[Seed] Invalid Shopify identifier "${value}" for ${context}: ${message}`)
  }
}

function canonicalDomainForShop(shopId: string, override?: string | null): string {
  if (override && override.trim().length > 0) {
    const overrideShopId = canonicalShopIdFromInput(override, 'metadata.shopifyDomain')
    if (overrideShopId !== shopId) {
      throw new Error(
        `[Seed] Provided Shopify domain "${override}" does not match shop_id "${shopId}"`
      )
    }
  }

  return normalizeShopIdToShopifyDomain(shopId)
}

async function fetchShopRow(supabase: SupabaseClient, shopId: string): Promise<ShopRow | null> {
  const { data, error } = await supabase
    .from('core_warehouse.shops')
    .select('shop_id, shopify_domain, metadata')
    .eq('shop_id', shopId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load shop ${shopId}: ${error.message}`)
  }

  return (data as ShopRow | null) ?? null
}

async function loadOrCreateShop(
  supabase: SupabaseClient,
  shopId: string,
  desiredDomain?: string | null
): Promise<ShopRow> {
  const existing = await fetchShopRow(supabase, shopId)

  if (existing) {
    return existing
  }

  const domainToRegister = canonicalDomainForShop(shopId, desiredDomain)
  const { data: registered, error: registerError } = await supabase.rpc('register_shop', {
    p_shopify_domain: domainToRegister,
    p_currency: 'USD',
    p_timezone: 'UTC',
  })

  if (registerError) {
    throw new Error(`Failed to register shop ${shopId}: ${registerError.message}`)
  }

  if (!registered || typeof registered !== 'object') {
    throw new Error(`register_shop returned invalid response for ${shopId}`)
  }

  const registeredShop = registered as { shop_id: string; shopify_domain: string }
  console.log(`[Seed] Registered shop ${registeredShop.shop_id}`)

  const refreshed = await fetchShopRow(supabase, registeredShop.shop_id)

  if (!refreshed) {
    throw new Error(`[Seed] Newly registered shop ${registeredShop.shop_id} could not be loaded`)
  }

  return refreshed
}

function mergeMetadata(existing: ShopRow, inputs: MetadataInputs): { metadata: Record<string, unknown>; changed: boolean } {
  const currentMetadata =
    existing.metadata && typeof existing.metadata === 'object'
      ? (existing.metadata as Record<string, unknown>)
      : {}

  const currentPlatforms =
    currentMetadata.platforms && typeof currentMetadata.platforms === 'object'
      ? (currentMetadata.platforms as Record<string, unknown>)
      : {}

  const nextPlatforms: Record<string, unknown> = { ...currentPlatforms }
  let platformsChanged = false

  if (inputs.shopifyDomain) {
    const existingShopify =
      currentPlatforms.shopify && typeof currentPlatforms.shopify === 'object'
        ? (currentPlatforms.shopify as Record<string, unknown>)
        : {}
    if (existingShopify.shop_domain !== inputs.shopifyDomain) {
      nextPlatforms.shopify = { ...existingShopify, shop_domain: inputs.shopifyDomain }
      platformsChanged = true
    }
  }

  if (inputs.metaAdAccountId) {
    const existingMeta =
      currentPlatforms.meta && typeof currentPlatforms.meta === 'object'
        ? (currentPlatforms.meta as Record<string, unknown>)
        : {}
    if (existingMeta.ad_account_id !== inputs.metaAdAccountId) {
      nextPlatforms.meta = { ...existingMeta, ad_account_id: inputs.metaAdAccountId }
      platformsChanged = true
    }
  }

  if (inputs.ga4PropertyId) {
    const existingGa4 =
      currentPlatforms.ga4 && typeof currentPlatforms.ga4 === 'object'
        ? (currentPlatforms.ga4 as Record<string, unknown>)
        : {}
    if (existingGa4.property_id !== inputs.ga4PropertyId) {
      nextPlatforms.ga4 = { ...existingGa4, property_id: inputs.ga4PropertyId }
      platformsChanged = true
    }
  }

  const nextMetadata: Record<string, unknown> = { ...currentMetadata }
  if (platformsChanged) {
    nextMetadata.platforms = nextPlatforms
  }

  return { metadata: nextMetadata, changed: platformsChanged }
}

async function syncShopMetadata(
  supabase: SupabaseClient,
  shop: ShopRow,
  inputs: MetadataInputs
): Promise<ShopRow> {
  const { metadata, changed } = mergeMetadata(shop, inputs)
  const needsDomainUpdate = inputs.shopifyDomain && inputs.shopifyDomain !== shop.shopify_domain
  const needsMetadataUpdate = changed

  if (!needsDomainUpdate && !needsMetadataUpdate) {
    return shop
  }

  const domainToUpdate = needsDomainUpdate ? inputs.shopifyDomain : undefined
  const metadataToUpdate = needsMetadataUpdate ? metadata : undefined

  const { error } = await supabase.rpc('update_shop_metadata', {
    p_shop_id: shop.shop_id,
    p_shopify_domain: domainToUpdate ?? null,
    p_metadata: metadataToUpdate ?? null,
  })

  if (error) {
    throw new Error(`Failed to update metadata for shop ${shop.shop_id}: ${error.message}`)
  }

  console.log(`[Seed] Updated shop metadata for ${shop.shop_id}`)

  return {
    ...shop,
    shopify_domain: domainToUpdate ?? shop.shopify_domain ?? null,
    metadata: metadataToUpdate ?? shop.metadata ?? null,
  }
}

async function upsertCredential(
  supabase: SupabaseClient,
  shopId: string,
  seed: PlatformSeed
): Promise<void> {
  const { error } = await supabase.rpc('upsert_shop_credential', {
    p_shop_id: shopId,
    p_platform: seed.platform,
    p_access_token: seed.accessToken,
    p_refresh_token: seed.refreshToken ?? null,
    p_expires_at: null,
  })

  if (error) {
    throw new Error(`Failed to store ${seed.platform} credentials for shop ${shopId}: ${error.message}`)
  }

  console.log(`[Seed] Stored ${seed.platform} credentials for shop ${shopId} (${seed.note})`)
}

async function main() {
  const { supabaseUrl, supabaseServiceRoleKey } = assertSupabaseConfig()
  const shopIds = parseShopIds()

  if (shopIds.length === 0) {
    console.error('No shop ids specified. Set SEED_SHOP_IDS before running.')
    process.exit(1)
  }

  const { seeds, metadata } = collectSeeds()

  if (metadata.shopifyDomainShopId && shopIds.some((id) => id !== metadata.shopifyDomainShopId)) {
    console.error(
      `[Seed] SHOPIFY_SHOP_DOMAIN belongs to "${metadata.shopifyDomainShopId}" but SEED_SHOP_IDS includes ${shopIds.join(
        ', '
      )}`
    )
    process.exit(1)
  }

  if (seeds.length === 0) {
    console.warn('No platform credentials found in environment. Nothing to seed.')
    return
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

  for (const shopId of shopIds) {
    try {
      let shop = await loadOrCreateShop(supabase, shopId, metadata.shopifyDomain ?? null)
      shop = await syncShopMetadata(supabase, shop, metadata)

      for (const seed of seeds) {
        await upsertCredential(supabase, shopId, seed)
      }

      console.log(
        `[Seed] Shop ${shopId} synced with domain ${
          shop.shopify_domain ?? normalizeShopIdToShopifyDomain(shopId)
        }`
      )
    } catch (error) {
      console.error(`[Seed] Failed to process shop ${shopId}:`, error)
      process.exitCode = 1
      return
    }
  }

  console.log(`[Seed] Completed credential seeding for ${shopIds.length} shop(s).`)
}

main().catch((error) => {
  console.error('[Seed] Unexpected error:', error)
  process.exit(1)
})

