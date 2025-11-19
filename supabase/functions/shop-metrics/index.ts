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
    } = await supabase.auth.getUser(token)

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const url = new URL(req.url)
    const shopId = url.searchParams.get('shop_id')
    const from = url.searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const to = url.searchParams.get('to') || new Date().toISOString().split('T')[0]

    if (!shopId) {
      return new Response(JSON.stringify({ error: 'Missing shop_id parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get daily revenue
    const { data: revenue, error: revError } = await supabase
      .schema('reporting')
      .from('daily_revenue')
      .select('*')
      .eq('shop_id', shopId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })

    if (revError) {
      throw revError
    }

    // Get marketing daily
    const { data: marketing, error: mktError } = await supabase
      .schema('reporting')
      .from('marketing_daily')
      .select('*')
      .eq('shop_id', shopId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })

    if (mktError) {
      throw mktError
    }

    // Get MER/ROAS
    const { data: merRoas, error: mrError } = await supabase
      .schema('reporting')
      .from('mer_roas')
      .select('*')
      .eq('shop_id', shopId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })

    if (mrError) {
      throw mrError
    }

    // Calculate KPIs
    const totalRevenue = revenue?.reduce((sum, r) => sum + Number(r.revenue || 0), 0) || 0
    const totalOrders = revenue?.reduce((sum, r) => sum + Number(r.order_count || 0), 0) || 0
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
    const totalSpend = marketing?.reduce((sum, m) => sum + Number(m.spend || 0), 0) || 0
    const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : null
    const avgMer = totalSpend > 0 ? totalRevenue / totalSpend : null

    return new Response(
      JSON.stringify({
        kpis: {
          total_revenue: totalRevenue,
          total_orders: totalOrders,
          avg_order_value: avgOrderValue,
          total_spend: totalSpend,
          avg_roas: avgRoas,
          avg_mer: avgMer,
        },
        daily_revenue: revenue,
        daily_marketing: marketing,
        mer_roas: merRoas,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

