import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { ETLRun, RunStatus, Platform } from '@dashboard/config'
import { ShopifyClient } from './integrations/shopify.js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function pollAndProcessJobs() {
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
          accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!,
          shopDomain: process.env.SHOPIFY_SHOP_DOMAIN!,
          apiVersion: process.env.SHOPIFY_API_VERSION || '2025-01',
        },
        supabase
      )
      return await shopifyClient.sync(job.shop_id, job.job_type)
    }
    case Platform.META:
      console.log(`[Worker] TODO: Implement Meta sync for ${job.job_type}`)
      return 0
    case Platform.GA4:
      console.log(`[Worker] TODO: Implement GA4 sync for ${job.job_type}`)
      return 0
    case Platform.KLAVIYO:
      console.log(`[Worker] TODO: Implement Klaviyo sync for ${job.job_type}`)
      return 0
    default:
      throw new Error(`Unknown platform: ${job.platform}`)
  }
}

async function main() {
  console.log('[Worker] Starting ETL worker...')

  // Run once
  await pollAndProcessJobs()

  console.log('[Worker] Exiting')
  process.exit(0)
}

main().catch((err) => {
  console.error('[Worker] Fatal error:', err)
  process.exit(1)
})
