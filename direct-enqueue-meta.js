#!/usr/bin/env node
/**
 * Direct script to enqueue Meta historical job using Supabase Edge Function
 * This uses the public Edge Function endpoint which requires anon key
 */

const SUPABASE_URL = 'https://yxbthgncjpimkslputso.supabase.co'
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/sync`

// Try to get anon key from environment or use a placeholder
// The Edge Function will handle authentication internally
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

async function enqueueMetaHistorical() {
  const shopId = process.argv[2] || 'default-shop'
  
  console.log(`Enqueuing HISTORICAL META job for shop: ${shopId}`)
  console.log(`Using Edge Function: ${EDGE_FUNCTION_URL}`)
  
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(ANON_KEY && { 'Authorization': `Bearer ${ANON_KEY}` })
    },
    body: JSON.stringify({
      shop_id: shopId,
      job_type: 'HISTORICAL',
      platform: 'META'
    })
  })

  const data = await response.json()
  
  if (!response.ok) {
    console.error('Error enqueuing job:', data)
    process.exit(1)
  }

  console.log('✅ Job enqueued successfully!')
  console.log('Response:', JSON.stringify(data, null, 2))
  console.log(`\nRun ID: ${data.run_id}`)
  console.log('\nThe worker will automatically pick up this job when it polls.')
}

enqueueMetaHistorical().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
