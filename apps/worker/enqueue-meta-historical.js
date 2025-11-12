#!/usr/bin/env node
/**
 * Script to enqueue a historical Meta sync job
 * Usage: node enqueue-meta-historical.js [shop_id] [supabase_url] [supabase_key]
 */

import { createClient } from '@supabase/supabase-js'

// Get connection details from args or env
const supabaseUrl = process.argv[3] || process.env.SUPABASE_URL
const supabaseKey = process.argv[4] || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be provided')
  console.error('Usage: node enqueue-meta-historical.js [shop_id] [supabase_url] [supabase_key]')
  console.error('Or set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Get shop_id from command line or query database for existing shops
const shopId = process.argv[2]

async function enqueueJob() {
  let finalShopId = shopId

  // If no shop_id provided, try to get one from existing sync_cursors or etl_runs
  if (!finalShopId) {
    console.log('No shop_id provided, checking for existing shops...')
    const { data: shops } = await supabase
      .from('core_warehouse.sync_cursors')
      .select('shop_id')
      .limit(1)
      .single()

    if (shops) {
      finalShopId = shops.shop_id
      console.log(`Using shop_id from database: ${finalShopId}`)
    } else {
      // Try etl_runs
      const { data: runs } = await supabase
        .from('core_warehouse.etl_runs')
        .select('shop_id')
        .limit(1)
        .single()

      if (runs) {
        finalShopId = runs.shop_id
        console.log(`Using shop_id from etl_runs: ${finalShopId}`)
      } else {
        finalShopId = 'default-shop'
        console.log(`No existing shop found, using default: ${finalShopId}`)
      }
    }
  }

  console.log(`Enqueuing HISTORICAL META job for shop: ${finalShopId}`)

  const { data, error } = await supabase.rpc('enqueue_etl_job', {
    p_shop_id: finalShopId,
    p_job_type: 'HISTORICAL',
    p_platform: 'META',
  })

  if (error) {
    console.error('Error enqueuing job:', error)
    process.exit(1)
  }

  console.log('Job enqueued successfully:', data)
  console.log(`Run ID: ${data.run_id}`)
  console.log(`\nTo process this job, ensure the worker is running with:`)
  console.log(`  - META_USE_COMPREHENSIVE=true`)
  console.log(`  - META_ACCESS_TOKEN set`)
  console.log(`  - META_AD_ACCOUNT_ID set`)
}

enqueueJob().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
