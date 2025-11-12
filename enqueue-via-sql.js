#!/usr/bin/env node
/**
 * Enqueue Meta historical job by directly calling the RPC function
 * This requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://yxbthgncjpimkslputso.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

if (!SUPABASE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY must be set')
  console.error('Please set one of these environment variables and try again')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function enqueueJob() {
  // Try to get existing shop_id from database
  let shopId = process.argv[2]
  
  if (!shopId) {
    console.log('No shop_id provided, checking for existing shops...')
    
    // Try to get shop_id from sync_cursors
    const { data: cursor } = await supabase
      .from('core_warehouse.sync_cursors')
      .select('shop_id')
      .limit(1)
      .single()
    
    if (cursor?.shop_id) {
      shopId = cursor.shop_id
      console.log(`Found shop_id from sync_cursors: ${shopId}`)
    } else {
      // Try etl_runs
      const { data: run } = await supabase
        .from('core_warehouse.etl_runs')
        .select('shop_id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (run?.shop_id) {
        shopId = run.shop_id
        console.log(`Found shop_id from etl_runs: ${shopId}`)
      } else {
        shopId = 'default-shop'
        console.log(`Using default shop_id: ${shopId}`)
      }
    }
  }

  console.log(`\nEnqueuing HISTORICAL META job for shop: ${shopId}`)

  const { data, error } = await supabase.rpc('enqueue_etl_job', {
    p_shop_id: shopId,
    p_job_type: 'HISTORICAL',
    p_platform: 'META',
  })

  if (error) {
    console.error('❌ Error enqueuing job:', error)
    process.exit(1)
  }

  console.log('✅ Job enqueued successfully!')
  console.log('Response:', JSON.stringify(data, null, 2))
  console.log(`\nRun ID: ${data.run_id}`)
  console.log('\n📋 Next steps:')
  console.log('1. Ensure worker is running with META_USE_COMPREHENSIVE=true')
  console.log('2. Worker will automatically pick up and process this job')
  console.log('3. Check worker logs to see progress')
}

enqueueJob().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
