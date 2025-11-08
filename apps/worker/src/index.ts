import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { ETLRun, RunStatus, Platform } from '@dashboard/config'
import { ShopifyClient } from './integrations/shopify.js'
import { MetaClient } from './integrations/meta.js'
import { GA4Client } from './integrations/ga4.js'
import { KlaviyoClient } from './integrations/klaviyo.js'

function requireEnv(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

const supabaseUrl = requireEnv('SUPABASE_URL')
const supabaseKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(supabaseUrl, supabaseKey)

let shouldRun = true

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms)
  })

function registerSignalHandlers() {
  const handleSignal = (signal: NodeJS.Signals) => {
    if (!shouldRun) {
      return
    }

    console.log(`[Worker] Received ${signal}. Preparing to shut down gracefully...`)
    shouldRun = false
  }

  process.on('SIGINT', handleSignal)
  process.on('SIGTERM', handleSignal)
}

async function pollAndProcessJobs() {
  if (!shouldRun) {
    return
  }

  console.log('[Worker] Polling for queued jobs...')

  // Poll for QUEUED jobs via RPC
  const { data, error } = await supabase.rpc('poll_queued_job')

  if (error) {
    console.error('[Worker] Error polling jobs:', error)
    return
  }

  if (!data) {
    console.log('[Worker] No queued jobs found')
    return
  }

  const job = data as ETLRun

  // Claim job with optimistic locking
  const { data: claimed, error: claimError } = await supabase.rpc('claim_job', {
    p_job_id: job.id,
  })

  if (claimError) {
    console.error(`[Worker] Error claiming job ${job.id}:`, claimError)
    return
  }

  if (!claimed) {
    console.log(`[Worker] Job ${job.id} already claimed by another worker`)
    return
  }

  console.log(`[Worker] Processing job ${job.id}: ${job.platform} ${job.job_type}`)

  try {
    // Dispatch to platform handler
    const recordsSynced = await processJob(job)

    // Mark success
    await completeJob(job.id, RunStatus.SUCCEEDED, recordsSynced)
    console.log(`[Worker] Job ${job.id} completed successfully (${recordsSynced} records)`)
  } catch (err) {
    console.error(`[Worker] Job ${job.id} failed:`, err)
    await completeJob(job.id, RunStatus.FAILED, 0, {
      code: 'UNKNOWN',
      message: err instanceof Error ? err.message : String(err),
      service: 'apps/worker',
      task: 'processJob',
      stack_trace: err instanceof Error ? err.stack : undefined,
    })
  }
}

async function completeJob(
  jobId: string,
  status: RunStatus,
  recordsSynced: number,
  error?: any
) {
  const { error: rpcError } = await supabase.rpc('complete_job', {
    p_job_id: jobId,
    p_status: status,
    p_records_synced: recordsSynced,
    p_error: error || null,
  })

  if (rpcError) {
    console.error(`[Worker] Error completing job ${jobId}:`, rpcError)
  }
}

async function processJob(job: ETLRun): Promise<number> {
  switch (job.platform) {
    case Platform.SHOPIFY: {
      const shopifyClient = new ShopifyClient(
        {
          accessToken: requireEnv('SHOPIFY_ADMIN_ACCESS_TOKEN'),
          shopDomain: requireEnv('SHOPIFY_SHOP_DOMAIN'),
          apiVersion: process.env.SHOPIFY_API_VERSION || '2025-01',
        },
        supabase
      )
      return await shopifyClient.sync(job.shop_id, job.job_type)
    }
    case Platform.META: {
      const metaClient = new MetaClient(
        {
          accessToken: requireEnv('META_ACCESS_TOKEN'),
          adAccountId: requireEnv('META_AD_ACCOUNT_ID'),
          apiVersion: process.env.META_API_VERSION || 'v18.0',
        },
        supabase
      )
      return await metaClient.sync(job.shop_id, job.job_type)
    }
    case Platform.GA4: {
      const ga4Client = new GA4Client(
        {
          propertyId: requireEnv('GA4_PROPERTY_ID'),
          serviceAccountKey: requireEnv('GA4_SERVICE_ACCOUNT_KEY'),
          apiVersion: process.env.GA4_API_VERSION || 'v1beta',
        },
        supabase
      )
      return await ga4Client.sync(job.shop_id, job.job_type)
    }
    case Platform.KLAVIYO: {
      const klaviyoClient = new KlaviyoClient(
        {
          privateApiKey: requireEnv('KLAVIYO_PRIVATE_API_KEY'),
          apiVersion: process.env.KLAVIYO_API_VERSION || '2024-10-15',
        },
        supabase
      )
      return await klaviyoClient.sync(job.shop_id, job.job_type)
    }
    default:
      throw new Error(`Unknown platform: ${job.platform}`)
  }
}

async function main() {
  console.log('[Worker] Starting ETL worker...')
  console.log('[Worker] Polling every 30 seconds...')

  registerSignalHandlers()

  // Run continuously with 30 second intervals
  while (shouldRun) {
    try {
      await pollAndProcessJobs()
    } catch (err) {
      console.error('[Worker] Error in poll loop:', err)
    }

    if (!shouldRun) {
      break
    }

    // Wait 30 seconds before next poll
    await wait(30000)
  }

  console.log('[Worker] Shutdown complete.')
}

main().catch((err) => {
  console.error('[Worker] Fatal error:', err)
  process.exit(1)
})
