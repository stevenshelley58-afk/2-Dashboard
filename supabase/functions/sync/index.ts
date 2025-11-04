import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const VALID_JOB_TYPES = ['HISTORICAL', 'INCREMENTAL']
const VALID_PLATFORMS = ['SHOPIFY', 'META', 'GA4', 'KLAVIYO']

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { shop_id, job_type, platform } = await req.json()

    // Validate inputs
    if (!shop_id || typeof shop_id !== 'string') {
      return new Response(JSON.stringify({ error: 'shop_id is required and must be a string' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!VALID_JOB_TYPES.includes(job_type)) {
      return new Response(
        JSON.stringify({ error: `Invalid job_type. Must be HISTORICAL or INCREMENTAL.` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!VALID_PLATFORMS.includes(platform)) {
      return new Response(
        JSON.stringify({ error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client (auto-injected env vars)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Insert QUEUED job via RPC
    const { data, error } = await supabase
      .rpc('enqueue_etl_job', {
        p_shop_id: shop_id,
        p_job_type: job_type,
        p_platform: platform,
      })

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to enqueue job', details: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify(data), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
