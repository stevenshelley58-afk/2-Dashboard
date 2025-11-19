import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get auth user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (req.method === 'GET') {
      // List shops for user
      const { data: userShops, error } = await supabase
        .schema('app_dashboard')
        .from('user_shops')
        .select('shop_id, is_default, shops(*)')
        .eq('user_id', user.id)

      if (error) {
        throw error
      }

      return new Response(JSON.stringify(userShops), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } else if (req.method === 'POST') {
      // Create shop + credentials + enqueue HISTORICAL_INIT
      const body = await req.json()
      const { name, shopify_domain, currency, timezone, shopify_access_token } = body

      if (!name || !shopify_domain || !shopify_access_token) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const shopId = shopify_domain.replace('.myshopify.com', '').toLowerCase()

      // Create shop
      const { error: shopError } = await supabase
        .schema('core_warehouse')
        .from('shops')
        .upsert({
          id: shopId,
          name,
          shopify_domain,
          currency: currency || 'USD',
          timezone: timezone || 'UTC',
        })

      if (shopError) {
        throw shopError
      }

      // Store Shopify credentials
      const { error: credError } = await supabase
        .schema('core_warehouse')
        .from('shop_credentials')
        .upsert({
          shop_id: shopId,
          platform: 'SHOPIFY',
          access_token: shopify_access_token,
          metadata: { shopify_domain },
        })

      if (credError) {
        throw credError
      }

      // Link shop to user
      const { error: linkError } = await supabase
        .schema('app_dashboard')
        .from('user_shops')
        .upsert({
          user_id: user.id,
          shop_id: shopId,
          is_default: false,
        })

      if (linkError) {
        throw linkError
      }

      // Enqueue HISTORICAL_INIT job
      const { error: jobError } = await supabase
        .schema('core_warehouse')
        .from('sync_jobs')
        .insert({
          shop_id: shopId,
          platform: 'SHOPIFY',
          job_type: 'HISTORICAL_INIT',
          status: 'QUEUED',
        })

      if (jobError) {
        throw jobError
      }

      return new Response(JSON.stringify({ shop_id: shopId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

