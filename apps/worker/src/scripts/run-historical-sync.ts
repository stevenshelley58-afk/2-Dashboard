import 'dotenv/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  JobType,
  normalizeShopifyDomainToShopId,
  normalizeShopIdToShopifyDomain,
} from '@dashboard/config'
import { ShopifyClient } from '../integrations/shopify.js'
import { MetaClient } from '../integrations/meta.js'
import { MetaComprehensiveClient } from '../integrations/meta-comprehensive.js'

type HistoricalResult = {
  platform: 'SHOPIFY' | 'META'
  status: 'SUCCEEDED' | 'SKIPPED' | 'FAILED'
  synced: number
  error?: string
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

async function runShopifyHistorical(supabase: SupabaseClient, shopId: string): Promise<HistoricalResult> {
  const rawDomain = process.env.SHOPIFY_SHOP_DOMAIN?.trim()

  if (!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || !rawDomain) {
    return {
      platform: 'SHOPIFY',
      status: 'SKIPPED',
      synced: 0,
      error: 'Missing Shopify credentials',
    }
  }

  const domainShopId = normalizeShopifyDomainToShopId(rawDomain)
  if (domainShopId !== shopId) {
    return {
      platform: 'SHOPIFY',
      status: 'FAILED',
      synced: 0,
      error: `SHOPIFY_SHOP_DOMAIN (${rawDomain}) does not match HISTORICAL_SHOP_ID (${shopId})`,
    }
  }

  const canonicalDomain = normalizeShopIdToShopifyDomain(shopId)

  const shopifyClient = new ShopifyClient(
    {
      accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
      shopDomain: canonicalDomain,
      apiVersion: process.env.SHOPIFY_API_VERSION || '2025-01',
    },
    supabase
  )

  try {
    const synced = await shopifyClient.sync(shopId, JobType.HISTORICAL)
    return { platform: 'SHOPIFY', status: 'SUCCEEDED', synced }
  } catch (error) {
    return {
      platform: 'SHOPIFY',
      status: 'FAILED',
      synced: 0,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function runMetaHistorical(supabase: SupabaseClient, shopId: string): Promise<HistoricalResult> {
  if (!process.env.META_ACCESS_TOKEN || !process.env.META_AD_ACCOUNT_ID) {
    return {
      platform: 'META',
      status: 'SKIPPED',
      synced: 0,
      error: 'Missing Meta credentials',
    }
  }

  const baseConfig = {
    accessToken: process.env.META_ACCESS_TOKEN,
    adAccountId: process.env.META_AD_ACCOUNT_ID,
    apiVersion: process.env.META_API_VERSION || 'v18.0',
  }

  const useComprehensive = process.env.META_USE_COMPREHENSIVE === 'true'

  try {
    if (useComprehensive) {
      const metaClient = new MetaComprehensiveClient(baseConfig, supabase)
      const stats = await metaClient.sync(shopId, JobType.HISTORICAL)
      const synced = stats.entities + stats.insights + stats.assets
      return { platform: 'META', status: 'SUCCEEDED', synced }
    }

    const metaClient = new MetaClient(baseConfig, supabase)
    const synced = await metaClient.sync(shopId, JobType.HISTORICAL)
    return { platform: 'META', status: 'SUCCEEDED', synced }
  } catch (error) {
    return {
      platform: 'META',
      status: 'FAILED',
      synced: 0,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL')
  const supabaseKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const supabase = createClient(supabaseUrl, supabaseKey)

  const rawShopId = process.env.HISTORICAL_SHOP_ID

  if (!rawShopId) {
    throw new Error('Set HISTORICAL_SHOP_ID (canonical Shopify subdomain) for manual historical sync.')
  }

  const shopId = normalizeShopifyDomainToShopId(rawShopId)

  console.log(`Running historical sync for shop_id=${shopId}`)

  const results: HistoricalResult[] = []

  const shopifyResult = await runShopifyHistorical(supabase, shopId)
  results.push(shopifyResult)
  console.log(
    `[Shopify] ${shopifyResult.status} - synced=${shopifyResult.synced}${
      shopifyResult.error ? ` (${shopifyResult.error})` : ''
    }`
  )

  const metaResult = await runMetaHistorical(supabase, shopId)
  results.push(metaResult)
  console.log(
    `[Meta] ${metaResult.status} - synced=${metaResult.synced}${
      metaResult.error ? ` (${metaResult.error})` : ''
    }`
  )

  const failures = results.filter((result) => result.status === 'FAILED')

  if (failures.length > 0) {
    throw new Error(
      failures
        .map((failure) => `${failure.platform}: ${failure.error ?? 'unknown error'}`)
        .join('; ')
    )
  }
}

main()
  .then(() => {
    console.log('Historical sync completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Historical sync failed:', error)
    process.exit(1)
  })

