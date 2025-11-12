import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { ETLRun, RunStatus, Platform } from '@dashboard/config'
import { ShopifyClient } from './integrations/shopify.js'
import { MetaClient } from './integrations/meta.js'
import { MetaComprehensiveClient } from './integrations/meta-comprehensive.js'
import { GA4Client } from './integrations/ga4.js'
import { KlaviyoClient } from './integrations/klaviyo.js'

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
    case Platform.META: {
      // Use comprehensive client for full metadata extraction
      console.log('[DEBUG META] Checking META_USE_COMPREHENSIVE variable...')
      console.log('[DEBUG META] Raw value:', process.env.META_USE_COMPREHENSIVE)
      console.log('[DEBUG META] Type:', typeof process.env.META_USE_COMPREHENSIVE)
      
      const useComprehensive = process.env.META_USE_COMPREHENSIVE === 'true'
      console.log('[DEBUG META] useComprehensive result:', useComprehensive)

      if (useComprehensive) {
        console.log('[DEBUG META] ✅ Using COMPREHENSIVE client (MetaComprehensiveClient)')
        const metaClient = new MetaComprehensiveClient(
          {
            accessToken: process.env.META_ACCESS_TOKEN!,
            adAccountId: process.env.META_AD_ACCOUNT_ID!,
            apiVersion: process.env.META_API_VERSION || 'v18.0',
          },
          supabase
        )
        const stats = await metaClient.sync(job.shop_id, job.job_type)
        return stats.entities + stats.insights + stats.assets
      } else {
        console.log('[DEBUG META] ❌ Using BASIC client (MetaClient) - legacy')
        // Use legacy client (basic insights only)
        const metaClient = new MetaClient(
          {
            accessToken: process.env.META_ACCESS_TOKEN!,
            adAccountId: process.env.META_AD_ACCOUNT_ID!,
            apiVersion: process.env.META_API_VERSION || 'v18.0',
          },
          supabase
        )
        return await metaClient.sync(job.shop_id, job.job_type)
      }
    }
    case Platform.GA4: {
      const ga4Client = new GA4Client(
        {
          propertyId: process.env.GA4_PROPERTY_ID!,
          serviceAccountKey: process.env.GA4_SERVICE_ACCOUNT_KEY!,
          apiVersion: process.env.GA4_API_VERSION || 'v1beta',
        },
        supabase
      )
      return await ga4Client.sync(job.shop_id, job.job_type)
    }
    case Platform.KLAVIYO: {
      const klaviyoClient = new KlaviyoClient(
        {
          privateApiKey: process.env.KLAVIYO_PRIVATE_API_KEY!,
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

  // Run continuously with 30 second intervals
  while (true) {
    try {
      await pollAndProcessJobs()
    } catch (err) {
      console.error('[Worker] Error in poll loop:', err)
    }

    // Wait 30 seconds before next poll
    await new Promise((resolve) => setTimeout(resolve, 30000))
  }
}

main().catch((err) => {
  console.error('[Worker] Fatal error:', err)
  process.exit(1)
})
