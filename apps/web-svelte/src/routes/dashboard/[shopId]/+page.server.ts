import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
    const { shopId } = params
    const today = new Date()
    const thirtyDaysAgo = new Date(today.setDate(today.getDate() - 30)).toISOString()

    // Fetch Revenue (Orders)
    const { data: orders, error: ordersError } = await supabase
        .schema('core_warehouse')
        .from('orders')
        .select('total_price')
        .eq('shop_id', shopId)
        .gte('created_at', thirtyDaysAgo)

    const totalRevenue = orders?.reduce((sum, order) => sum + (order.total_price || 0), 0) || 0

    // Fetch Spend (Marketing)
    const { data: marketing, error: marketingError } = await supabase
        .schema('core_warehouse')
        .from('fact_marketing_daily')
        .select('spend')
        .eq('shop_id', shopId)
        .gte('date', thirtyDaysAgo)

    const totalSpend = marketing?.reduce((sum, record) => sum + (record.spend || 0), 0) || 0

    // Calculate MER / ROAS
    const mer = totalSpend > 0 ? totalRevenue / totalSpend : 0
    const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0

    return {
        shopId,
        metrics: {
            revenue: totalRevenue,
            spend: totalSpend,
            mer,
            roas
        }
    }
}
