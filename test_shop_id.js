const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxbthgncjpimkslputso.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4YnRoZ25janBpbWtzbHB1dHNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNjY0NjYsImV4cCI6MjA3Nzg0MjQ2Nn0.N-V0jcfMeV144rHggHrRdncyHrgIN5EeHq7vKXA-MCc'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkShopIds() {
  console.log('Checking for shop_ids in the database...\n')

  // Check orders table
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('shop_id')
    .limit(5)

  if (ordersError) {
    console.log('Error querying orders:', ordersError.message)
  } else {
    console.log('Sample shop_ids from orders:', orders?.map(o => o.shop_id))
  }

  // Get unique shop_ids
  const { data: shops, error: shopsError } = await supabase
    .rpc('get_unique_shop_ids')
    .limit(10)

  if (shopsError) {
    console.log('\nNote: get_unique_shop_ids RPC not available')

    // Try alternative - get distinct from orders view
    const { data: distinctShops } = await supabase
      .from('orders')
      .select('shop_id')

    if (distinctShops) {
      const uniqueIds = [...new Set(distinctShops.map(s => s.shop_id))]
      console.log('\nUnique shop_ids found:', uniqueIds)
      console.log('\nRecommended shop_id to use:', uniqueIds[0] || 'default-shop')
    }
  } else {
    console.log('\nAvailable shop_ids:', shops)
  }
}

checkShopIds().catch(console.error)
