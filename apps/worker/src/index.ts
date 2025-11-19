import 'dotenv/config'
import { supabase } from './lib/supabase'
import { claimJob, completeJob } from './lib/jobs'
import { syncShopify } from './platforms/shopify'
import { syncMeta } from './platforms/meta'
import type { Platform, JobType, ErrorPayload } from '@dashboard/config'

const POLL_INTERVAL_MS = 5000 // 5 seconds

async function pollAndProcessJobs() {
  while (true) {
    try {
      // Find next QUEUED job
      const { data: jobs, error } = await supabase
        .schema('core_warehouse')
        .from('sync_jobs')
        .select('*')
        .eq('status', 'QUEUED')
        .order('created_at', { ascending: true })
        .limit(1)

      if (error) {
        console.error('Error fetching jobs:', error)
        await sleep(POLL_INTERVAL_MS)
        continue
      }

      if (!jobs || jobs.length === 0) {
        // No jobs, sleep and poll again
        await sleep(POLL_INTERVAL_MS)
        continue
      }

      const job = jobs[0]

      // Try to claim the job (optimistic locking)
      const claimed = await claimJob(job.id)
      if (!claimed) {
        // Job was claimed by another worker, continue
        continue
      }

      console.log(`Processing job ${job.id}: ${job.platform} ${job.job_type} for shop ${job.shop_id}`)

      try {
        // Route to platform handler
        if (job.platform === 'SHOPIFY') {
          await syncShopify(job.id, job.shop_id, job.job_type as JobType)
        } else if (job.platform === 'META') {
          await syncMeta(job.id, job.shop_id, job.job_type as JobType)
        } else {
          throw new Error(`Unknown platform: ${job.platform}`)
        }

        console.log(`Job ${job.id} completed successfully`)
      } catch (error) {
        console.error(`Job ${job.id} failed:`, error)
        // Error handling is done inside platform sync functions
      }
    } catch (error) {
      console.error('Unexpected error in poll loop:', error)
      await sleep(POLL_INTERVAL_MS)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Start polling
console.log('Worker started, polling for jobs...')
pollAndProcessJobs().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
