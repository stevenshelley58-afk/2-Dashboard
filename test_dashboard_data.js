// Test script to verify dashboard data is working
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://yxbthgncjpimkslputso.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4YnRoZ25janBpbWtzbHB1dHNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNjY0NjYsImV4cCI6MjA3Nzg0MjQ2Nn0.N-V0jcfMeV144rHggHrRdncyHrgIN5EeHq7vKXA-MCc'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testDashboardData() {
  console.log('\n=== Testing Dashboard Data ===\n')

  const shopId = 'default-shop'
  const startDate = '2025-01-01'
  const endDate = '2025-11-09'

  try {
    // Test 1: Get dashboard metrics
    console.log('1. Testing get_dashboard_metrics...')
    const { data: metrics, error: metricsError } = await supabase.rpc('get_dashboard_metrics', {
      p_shop_id: shopId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_currency: 'AUD'
    })

    if (metricsError) {
      console.error('❌ Error:', metricsError.message)
    } else {
      console.log('✅ Metrics:', metrics?.[0] || 'No data')
    }

    // Test 2: Get chart data
    console.log('\n2. Testing get_dashboard_chart_data...')
    const { data: chartData, error: chartError } = await supabase.rpc('get_dashboard_chart_data', {
      p_shop_id: shopId,
      p_start_date: startDate,
      p_end_date: endDate
    })

    if (chartError) {
      console.error('❌ Error:', chartError.message)
    } else {
      console.log(`✅ Chart data: ${chartData?.length || 0} days`)
      if (chartData && chartData.length > 0) {
        console.log('   Sample:', chartData[0])
      }
    }

    // Test 3: Get top products
    console.log('\n3. Testing get_top_products...')
    const { data: products, error: productsError } = await supabase.rpc('get_top_products', {
      p_shop_id: shopId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_limit: 5
    })

    if (productsError) {
      console.error('❌ Error:', productsError.message)
    } else {
      console.log(`✅ Products: ${products?.length || 0} items`)
      if (products && products.length > 0) {
        console.log('   Sample:', products[0])
      }
    }

    // Test 4: Get channel split
    console.log('\n4. Testing get_channel_split...')
    const { data: channels, error: channelsError } = await supabase.rpc('get_channel_split', {
      p_shop_id: shopId,
      p_start_date: startDate,
      p_end_date: endDate
    })

    if (channelsError) {
      console.error('❌ Error:', channelsError.message)
    } else {
      console.log(`✅ Channels: ${channels?.length || 0} platforms`)
      if (channels && channels.length > 0) {
        channels.forEach(c => console.log(`   ${c.platform}: $${c.spend} spend, $${c.revenue} revenue`))
      }
    }

    // Test 5: Check if we have any data in core tables
    console.log('\n5. Checking core tables...')
    const { count: ordersCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
    console.log(`   Orders in database: ${ordersCount || 0}`)

    const { count: etlCount } = await supabase
      .from('etl_runs')
      .select('*', { count: 'exact', head: true })
    console.log(`   ETL runs in database: ${etlCount || 0}`)

  } catch (err) {
    console.error('\n❌ Unexpected error:', err.message)
  }

  console.log('\n=== Test Complete ===\n')
}

testDashboardData()
