// Quick script to check what data exists in the database
require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. Please add them to your .env file.'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkData() {
  console.log('\n=== Checking Database Data ===\n')

  // Check orders table
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })

  console.log('Orders:', orders?.length || 0, 'records', ordersError ? `ERROR: ${ordersError.message}` : '')

  // Check orders for BHM shop
  const { data: bhmOrders, count: bhmCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', 'BHM')

  console.log('Orders for BHM shop:', bhmCount || 0, 'records')

  // Check date range of orders
  const { data: orderDates } = await supabase
    .from('orders')
    .select('order_date')
    .eq('shop_id', 'BHM')
    .order('order_date', { ascending: false })
    .limit(1)

  if (orderDates && orderDates.length > 0) {
    console.log('Latest order date:', orderDates[0].order_date)
  }

  const { data: oldestDate } = await supabase
    .from('orders')
    .select('order_date')
    .eq('shop_id', 'BHM')
    .order('order_date', { ascending: true })
    .limit(1)

  if (oldestDate && oldestDate.length > 0) {
    console.log('Oldest order date:', oldestDate[0].order_date)
  }

  // Check marketing data
  const { count: metaCount } = await supabase
    .from('fact_marketing_daily')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', 'BHM')
    .eq('platform', 'META')

  console.log('\nMarketing data (META):', metaCount || 0, 'records')

  const { count: googleCount } = await supabase
    .from('fact_marketing_daily')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', 'BHM')
    .eq('platform', 'GOOGLE')

  console.log('Marketing data (GOOGLE):', googleCount || 0, 'records')

  // Check GA4 data
  const { count: ga4Count } = await supabase
    .from('fact_ga4_daily')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', 'BHM')

  console.log('\nGA4 data:', ga4Count || 0, 'records')

  // Check dashboard metrics view
  const { data: metrics, error: metricsError } = await supabase
    .rpc('get_dashboard_metrics', {
      p_shop_id: 'BHM',
      p_start_date: '2024-01-01',
      p_end_date: '2025-12-31'
    })

  console.log('\nDashboard metrics RPC result:')
  if (metricsError) {
    console.log('ERROR:', metricsError.message)
  } else {
    console.log(JSON.stringify(metrics, null, 2))
  }

  // Check chart data
  const { data: chartData, error: chartError } = await supabase
    .rpc('get_dashboard_chart_data', {
      p_shop_id: 'BHM',
      p_start_date: '2024-01-01',
      p_end_date: '2025-12-31'
    })

  console.log('\nChart data RPC result:')
  if (chartError) {
    console.log('ERROR:', chartError.message)
  } else {
    console.log('Records:', chartData?.length || 0)
    if (chartData && chartData.length > 0) {
      console.log('Sample:', JSON.stringify(chartData[0], null, 2))
    }
  }
}

checkData().catch(console.error)
