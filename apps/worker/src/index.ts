import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import {
  ETLRun,
  RunStatus,
  Platform,
  ErrorPayload,
  normalizeShopifyDomainToShopId,
  normalizeShopIdToShopifyDomain,
} from '@dashboard/config'
import { ShopifyClient } from './integrations/shopify.js'
import { MetaClient } from './integrations/meta.js'
import { MetaComprehensiveClient } from './integrations/meta-comprehensive.js'
import { GA4Client } from './integrations/ga4.js'
import { KlaviyoClient } from './integrations/klaviyo.js'
import { CredentialManager, CredentialError } from './credential-manager.js'

interface SupabaseConfig {
  supabaseUrl: string
  supabaseServiceRoleKey: string
}

class WorkerError extends Error {
  public readonly code: string
  public readonly task: string

  constructor(message: string, code: string, task: string) {
    super(message)
    this.name = 'WorkerError'
    this.code = code
    this.task = task
  }
}

function assertEnv(): SupabaseConfig {
  const supabaseUrl = process.env.SUPABASE_URL?.trim()
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const missing: string[] = []

  if (!supabaseUrl) {
    missing.push('SUPABASE_URL')
  }
  if (!supabaseServiceRoleKey) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY')
  }

  if (missing.length > 0) {
    const message = `[Worker] Missing required environment variables: ${missing.join(', ')}`
    console.error(message)
    throw new Error(message)
  }

  return {
    supabaseUrl: supabaseUrl as string,
    supabaseServiceRoleKey: supabaseServiceRoleKey as string,
  }
}

function toErrorPayload(err: unknown, fallbackTask: string): ErrorPayload {
  if (err instanceof WorkerError) {
    return {
      code: err.code,
      message: err.message,
      service: 'apps/worker',
      task: err.task,
      stack_trace: err.stack,
    }
  }

  if (err instanceof Error) {
    return {
      code: 'UNKNOWN',
      message: err.message,
      service: 'apps/worker',
      task: fallbackTask,
      stack_trace: err.stack,
    }
  }

  const message =
    typeof err === 'string'
      ? err
      : JSON.stringify(err, undefined, 2) ?? 'Unknown worker error'

  return {
    code: 'UNKNOWN',
    message,
    service: 'apps/worker',
    task: fallbackTask,
  }
}

const { supabaseUrl, supabaseServiceRoleKey } = assertEnv()

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
const credentialManager = new CredentialManager(supabase)

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 30000)
const MAX_STALENESS_SECONDS = Number(process.env.WORKER_MAX_STALENESS_SECONDS ?? 90)
const ALLOW_ENV_FALLBACKS = process.env.WORKER_ALLOW_ENV_FALLBACKS === 'true'

function canonicalShopIdOrNull(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  try {
    const canonical = normalizeShopifyDomainToShopId(value)
    return canonical
  } catch {
    return null
  }
}

function canonicalShopIdOrThrow(value: string, context: string): string {
  const canonical = canonicalShopIdOrNull(value)
  if (!canonical || canonical !== value) {
    throw new WorkerError(
      `Received non-canonical shop_id "${value}" (${context})`,
      'NON_CANONICAL_SHOP_ID',
      context
    )
  }
  return canonical
}

function canonicalShopifyDomainOrNull(value: string | null | undefined): string | null {
  const shopId = canonicalShopIdOrNull(value)
  if (!shopId) {
    return null
  }
  return normalizeShopIdToShopifyDomain(shopId)
}

async function getTargetShops(): Promise<string[]> {
  const { data, error } = await supabase.rpc('list_known_shop_ids')

  if (error) {
    console.error('[Worker] Failed to load known shops for scheduling:', error)
    return []
  }

  const shopsFromDb = Array.isArray(data)
    ? (data as Array<{ shop_id: string | null }>)
        .map((row) => canonicalShopIdOrNull(row.shop_id))
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    : []

  const unique = new Set<string>(shopsFromDb)

  return Array.from(unique)
}

async function ensureIncrementalJobs(): Promise<void> {
  const shops = await getTargetShops()

  if (shops.length === 0) {
    console.warn('[Worker] No shops found to enqueue incremental jobs for')
    return
  }

  for (const shopId of shops) {
    const canonicalShopId = canonicalShopIdOrNull(shopId)
    if (!canonicalShopId) {
      console.warn(`[Worker] Skipping non-canonical shop identifier "${shopId}"`)
      continue
    }

    let platforms: Platform[] = []

    try {
      platforms = await credentialManager.getPlatformsForShop(canonicalShopId)
    } catch (error) {
      console.error(`[Worker] Failed to load credentials for shop ${canonicalShopId}:`, error)
      continue
    }

    if (platforms.length === 0) {
      console.warn(
        `[Worker] No credentials configured for shop ${canonicalShopId}; skipping incremental scheduling`
      )
      continue
    }

    for (const platform of platforms) {
      const { data, error } = await supabase.rpc('ensure_incremental_job', {
        p_shop_id: canonicalShopId,
        p_platform: platform,
        p_max_staleness_seconds: MAX_STALENESS_SECONDS,
      })

      if (error) {
        console.error(
          `[Worker] Failed to ensure incremental job for shop ${canonicalShopId} (${platform}):`,
          error
        )
        continue
      }

      if (data) {
        const job = data as { job_id: string; job_type: string; platform: string; shop_id: string }
        console.log(
          `[Worker] Enqueued ${job.job_type} job ${job.job_id} for shop ${job.shop_id} (${job.platform})`
        )
      }
    }
  }
}

async function pollAndProcessJobs(): Promise<boolean> {
  console.log('[Worker] Polling for queued jobs...')

  // Poll for QUEUED jobs via RPC
  const { data, error } = await supabase.rpc('poll_queued_job')

  if (error) {
    console.error('[Worker] Error polling jobs:', error)
    return false
  }

  console.log('[Worker] RPC response:', { data: data ? 'found job ' + data.id : 'null', error: error ? error.message : 'none' })

  if (!data) {
    console.log('[Worker] No queued jobs found')
    return false
  }

  const job = data as ETLRun

  // Claim job with optimistic locking
  const { data: claimed, error: claimError } = await supabase.rpc('claim_job', {
    p_job_id: job.id,
  })

  if (claimError) {
    console.error(`[Worker] Error claiming job ${job.id}:`, claimError)
    return false
  }

  if (!claimed) {
    console.log(`[Worker] Job ${job.id} already claimed by another worker`)
    return false
  }

  console.log(`[Worker] Processing job ${job.id}: ${job.platform} ${job.job_type}`)

  try {
    // Dispatch to platform handler
    const recordsSynced = await processJob(job)

    // Mark success
    await completeJob(job.id, RunStatus.SUCCEEDED, recordsSynced)
    console.log(`[Worker] Job ${job.id} completed successfully (${recordsSynced} records)`)
  } catch (err) {
    const taskName = err instanceof WorkerError ? err.task : 'processJob'
    console.error(
      `[Worker] Job ${job.id} failed for shop ${job.shop_id} (${job.platform}) [task=${taskName}]:`,
      err
    )
    const errorPayload = toErrorPayload(err, taskName)
    await completeJob(job.id, RunStatus.FAILED, 0, errorPayload)
  }

  return true
}

async function completeJob(
  jobId: string,
  status: RunStatus,
  recordsSynced: number,
  error?: ErrorPayload
) {
  const { error: rpcError } = await supabase.rpc('complete_job', {
    p_job_id: jobId,
    p_status: status,
    p_records_synced: recordsSynced,
    p_error: error ?? null,
  })

  if (rpcError) {
    console.error(`[Worker] Error completing job ${jobId}:`, rpcError)
  }
}

async function processJob(job: ETLRun): Promise<number> {
  const canonicalShopId = canonicalShopIdOrThrow(job.shop_id, 'process_job')

  let resolvedCredential

  try {
    resolvedCredential = await credentialManager.get(canonicalShopId, job.platform)
  } catch (error) {
    if (error instanceof CredentialError) {
      throw new WorkerError(
        `Credential error (${error.code}) for shop ${canonicalShopId}`,
        `CREDENTIAL_${error.code}`,
        'credential_lookup'
      )
    }

    throw error
  }

  const shopMetadata = (resolvedCredential.shop.metadata as Record<string, unknown> | null) ?? null
  const platformMetadata =
    shopMetadata?.platforms && typeof shopMetadata.platforms === 'object'
      ? (shopMetadata.platforms as Record<string, unknown>)
      : {}

  switch (job.platform) {
    case Platform.SHOPIFY: {
      const shopifyMeta =
        typeof platformMetadata === 'object' && platformMetadata
          ? (platformMetadata.shopify as Record<string, unknown> | undefined)
          : undefined

      const shopDomainFromMetadata = canonicalShopifyDomainOrNull(
        shopifyMeta && typeof shopifyMeta.shop_domain === 'string'
          ? (shopifyMeta.shop_domain as string).trim()
          : null
      )
      const shopDomainFromShop = canonicalShopifyDomainOrNull(
        resolvedCredential.shop.shopify_domain ?? null
      )
      const shopDomainFromEnv =
        ALLOW_ENV_FALLBACKS && process.env.SHOPIFY_SHOP_DOMAIN
          ? canonicalShopifyDomainOrNull(process.env.SHOPIFY_SHOP_DOMAIN)
          : null

      const shopDomain =
        shopDomainFromShop ??
        shopDomainFromMetadata ??
        shopDomainFromEnv ??
        null

      if (!shopDomainFromShop && !shopDomainFromMetadata && shopDomainFromEnv) {
        console.warn(
          `[Worker] Using SHOPIFY_SHOP_DOMAIN fallback for ${canonicalShopId}. Set WORKER_ALLOW_ENV_FALLBACKS="true" only for local development.`
        )
      }

      if (!shopDomain) {
        throw new WorkerError(
          `Missing Shopify domain for shop ${canonicalShopId}`,
          'CONFIG_SHOPIFY_DOMAIN_MISSING',
          'shopify_config'
        )
      }

      const shopifyClient = new ShopifyClient(
        {
          accessToken: resolvedCredential.accessToken,
          shopDomain,
          apiVersion: process.env.SHOPIFY_API_VERSION || '2025-01',
        },
        supabase
      )
      return await shopifyClient.sync(canonicalShopId, job.job_type)
    }
    case Platform.META: {
      // Use comprehensive client for full metadata extraction
      const useComprehensive = process.env.META_USE_COMPREHENSIVE === 'true'
      const metaMeta =
        typeof platformMetadata === 'object' && platformMetadata
          ? (platformMetadata.meta as Record<string, unknown> | undefined)
          : undefined

      const adAccountIdFromMetadata =
        metaMeta && typeof metaMeta.ad_account_id === 'string'
          ? (metaMeta.ad_account_id as string).trim()
          : null
      const adAccountIdFallback =
        ALLOW_ENV_FALLBACKS && process.env.META_AD_ACCOUNT_ID
          ? process.env.META_AD_ACCOUNT_ID.trim()
          : null
      const adAccountId =
        (adAccountIdFromMetadata && adAccountIdFromMetadata.length > 0 ? adAccountIdFromMetadata : null) ??
        (adAccountIdFallback && adAccountIdFallback.length > 0 ? adAccountIdFallback : null)

      if (!adAccountIdFromMetadata && adAccountIdFallback) {
        console.warn(
          `[Worker] Using META_AD_ACCOUNT_ID fallback for ${canonicalShopId}. Set WORKER_ALLOW_ENV_FALLBACKS="true" only for local development.`
        )
      }

      if (!adAccountId) {
        throw new WorkerError(
          `Missing Meta ad account id for shop ${canonicalShopId}`,
          'CONFIG_META_ACCOUNT_MISSING',
          'meta_config'
        )
      }

      const apiVersion = process.env.META_API_VERSION || 'v18.0'

      if (useComprehensive) {
        const metaClient = new MetaComprehensiveClient(
          {
            accessToken: resolvedCredential.accessToken,
            adAccountId,
            apiVersion,
          },
          supabase
        )
        const stats = await metaClient.sync(canonicalShopId, job.job_type)
        return stats.entities + stats.insights + stats.assets
      } else {
        // Use legacy client (basic insights only)
        const metaClient = new MetaClient(
          {
            accessToken: resolvedCredential.accessToken,
            adAccountId,
            apiVersion,
          },
          supabase
        )
        return await metaClient.sync(canonicalShopId, job.job_type)
      }
    }
    case Platform.GA4: {
      const ga4Meta =
        typeof platformMetadata === 'object' && platformMetadata
          ? (platformMetadata.ga4 as Record<string, unknown> | undefined)
          : undefined

      const propertyIdFromMetadata =
        ga4Meta && typeof ga4Meta.property_id === 'string'
          ? (ga4Meta.property_id as string).trim()
          : null
      const propertyIdFallback = process.env.GA4_PROPERTY_ID?.trim()
      const propertyId =
        (propertyIdFromMetadata && propertyIdFromMetadata.length > 0 ? propertyIdFromMetadata : null) ??
        (propertyIdFallback && propertyIdFallback.length > 0 ? propertyIdFallback : null)

      if (!propertyId) {
        throw new WorkerError(
          `Missing GA4 property id for shop ${canonicalShopId}`,
          'CONFIG_GA4_PROPERTY_MISSING',
          'ga4_config'
        )
      }

      const serviceAccountKey =
        resolvedCredential.accessToken?.trim() ??
        process.env.GA4_SERVICE_ACCOUNT_KEY?.trim() ??
        process.env.GA4_CREDENTIALS_JSON?.trim() ??
        null

      if (!serviceAccountKey) {
        throw new WorkerError(
          `Missing GA4 service account credential for shop ${canonicalShopId}`,
          'CONFIG_GA4_CREDENTIAL_MISSING',
          'ga4_config'
        )
      }

      const ga4Client = new GA4Client(
        {
          propertyId,
          serviceAccountKey,
          apiVersion: process.env.GA4_API_VERSION || 'v1beta',
        },
        supabase
      )
      return await ga4Client.sync(canonicalShopId, job.job_type)
    }
    case Platform.KLAVIYO: {
      const klaviyoKey =
        resolvedCredential.accessToken?.trim() ??
        process.env.KLAVIYO_PRIVATE_API_KEY?.trim() ??
        process.env.KLAVIYO_API_KEY?.trim() ??
        null

      if (!klaviyoKey) {
        throw new WorkerError(
          `Missing Klaviyo API key for shop ${canonicalShopId}`,
          'CONFIG_KLAVIYO_KEY_MISSING',
          'klaviyo_config'
        )
      }

      const klaviyoClient = new KlaviyoClient(
        {
          privateApiKey: klaviyoKey,
          apiVersion: process.env.KLAVIYO_API_VERSION || '2024-10-15',
        },
        supabase
      )
      return await klaviyoClient.sync(canonicalShopId, job.job_type)
    }
    default:
      throw new Error(`Unknown platform: ${job.platform}`)
  }
}

async function main() {
  console.log('[Worker] Starting ETL worker...')
  console.log(`[Worker] Polling every ${POLL_INTERVAL_MS / 1000} seconds...`)

  await ensureIncrementalJobs()

  // Run continuously with 30 second intervals
  while (true) {
    try {
      await ensureIncrementalJobs()
      await pollAndProcessJobs()
    } catch (err) {
      console.error('[Worker] Error in poll loop:', err)
    }

    // Wait 30 seconds before next poll
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

main().catch((err) => {
  console.error('[Worker] Fatal error:', err)
  process.exit(1)
})
