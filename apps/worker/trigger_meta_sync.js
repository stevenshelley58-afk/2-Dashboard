/**
 * Trigger a Meta sync job
 * This will queue a job for the worker to process
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function triggerSync() {
  console.log('🚀 Triggering Meta sync job...\n')

  const shopId = 'shop_001' // Your shop ID
  const jobType = 'HISTORICAL' // HISTORICAL (last 90 days) or INCREMENTAL (since last sync)
  const platform = 'META'

  console.log(`📋 Job details:`)
  console.log(`   Shop ID: ${shopId}`)
  console.log(`   Platform: ${platform}`)
  console.log(`   Job Type: ${jobType}`)
  console.log()

  // Insert ETL job
  const { data, error } = await supabase.rpc('enqueue_etl_job', {
    p_shop_id: shopId,
    p_platform: platform,
    p_job_type: jobType,
  })

  if (error) {
    console.error('❌ Error queueing job:', error)
    process.exit(1)
  }

  console.log('✅ Job queued successfully!')
  console.log(`   Job ID: ${data.id}`)
  console.log(`   Status: ${data.status}`)
  console.log()
  console.log('👀 The worker will pick this up within 30 seconds...')
  console.log()
  console.log('💡 To check job status, query the database:')
  console.log(`   SELECT * FROM core_warehouse.etl_runs WHERE id = '${data.id}';`)
}

triggerSync()
