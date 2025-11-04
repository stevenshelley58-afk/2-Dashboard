import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { ETLRun, RunStatus, Platform } from '@dashboard/config'
import pg from 'pg'
import { ShopifyClient } from './integrations/shopify.js'

const { Pool } = pg

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const dbUrl = process.env.SUPABASE_DB_URL!

const supabase = createClient(supabaseUrl, supabaseKey)
const pool = new Pool({ connectionString: dbUrl })

async function pollAndProcessJobs() {
  console.log('[Worker] Polling for queued jobs...')

  // Poll for QUEUED jobs using raw SQL
  const client = await pool.connect()
  let jobs: ETLRun[]
  try {
    const result = await client.query(
      `SELECT * FROM core_warehouse.etl_runs
       WHERE status = $1
       ORDER BY created_at ASC
       LIMIT 1`,
      [RunStatus.QUEUED]
    )
    jobs = result.rows as ETLRun[]
  } finally {
    client.release()
  }

  if (jobs.length === 0) {
    console.log('[Worker] No queued jobs found')
    return
  }

  const job = jobs[0]

  // Claim job with optimistic locking
  const claimed = await claimJob(job.id)
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

async function claimJob(jobId: string): Promise<boolean> {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `UPDATE core_warehouse.etl_runs
       SET status = $1, started_at = now()
       WHERE id = $2 AND status = $3
       RETURNING id`,
      [RunStatus.IN_PROGRESS, jobId, RunStatus.QUEUED]
    )
    return (result.rowCount ?? 0) > 0
  } finally {
    client.release()
  }
}

async function completeJob(
  jobId: string,
  status: RunStatus,
  recordsSynced: number,
  error?: any
) {
  const client = await pool.connect()
  try {
    await client.query(
      `UPDATE core_warehouse.etl_runs
       SET status = $1, completed_at = now(), records_synced = $2, error = $3
       WHERE id = $4`,
      [status, recordsSynced, error ? JSON.stringify(error) : null, jobId]
    )
  } finally {
    client.release()
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
        pool
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
  await pool.end()
  process.exit(0)
}

main().catch((err) => {
  console.error('[Worker] Fatal error:', err)
  process.exit(1)
})
