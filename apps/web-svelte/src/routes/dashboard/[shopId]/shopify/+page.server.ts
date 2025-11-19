import type { PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase-admin';

export const load: PageServerLoad = async ({ params, url }) => {
    const { shopId } = params;
    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setDate(defaultFrom.getDate() - 6);
    const from = url.searchParams.get('from') || defaultFrom.toISOString().split('T')[0];
    const to = url.searchParams.get('to') || today.toISOString().split('T')[0];

    // 1. Fetch Aggregates
    const { data: aggregates, error: aggError } = await supabaseAdmin
        .schema('reporting')
        .from('daily_revenue')
        .select('revenue, order_count')
        .eq('shop_id', shopId)
        .gte('date', from)
        .lte('date', to)
    

    if (aggError) {
        console.error('Error fetching shopify aggregates:', aggError);
    }

    let totalSales = 0;
    let totalOrders = 0;
    
    const aggregateRows = (aggregates || []) as { revenue: number | null; order_count: number | null }[];
    if (aggregateRows.length) {
        totalSales = aggregateRows.reduce((sum, row) => sum + (row.revenue || 0), 0);
        totalOrders = aggregateRows.reduce((sum, row) => sum + (row.order_count || 0), 0);
    }

    const aov = totalOrders > 0 ? totalSales / totalOrders : 0;

    // 2. Fetch Daily Data for Charts
    const { data: dailyData, error: dailyError } = await supabaseAdmin
        .schema('reporting')
        .from('daily_revenue')
        .select('date, revenue, order_count')
        .eq('shop_id', shopId)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: true });

    // 3. Fetch Top Products (from order_line_items)
    // This is a bit heavier, might need a dedicated view or RPC. 
    // For now, let's try a direct query on core_warehouse if RLS allows or use admin.
    // We need to join orders to filter by date.
    // "select title, sum(quantity), sum(price * quantity) from line_items join orders ... group by title"
    // Supabase JS client doesn't do complex joins easily without views.
    // I'll skip Top Products for this iteration or mock it/leave empty until I create a view.
    
    return {
        stats: {
            totalSales,
            totalOrders,
            aov,
            conversionRate: 0 // Placeholder, need session data
        },
        chartData: dailyData || [],
        dateRange: { from, to }
    };
};

