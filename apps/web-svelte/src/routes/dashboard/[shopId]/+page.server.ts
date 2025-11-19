import type { PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase-admin';

export const load: PageServerLoad = async ({ params, url }) => {
    const { shopId } = params;
    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setDate(defaultFrom.getDate() - 6);
    const from = url.searchParams.get('from') || defaultFrom.toISOString().split('T')[0];
    const to = url.searchParams.get('to') || today.toISOString().split('T')[0];

    // 1. Fetch Aggregates from MER View
    const { data: aggregates, error: aggError } = await supabaseAdmin
        .schema('reporting')
        .from('mer_roas')
        .select('revenue, total_spend')
        .eq('shop_id', shopId)
        .gte('date', from)
        .lte('date', to)
    

    if (aggError) {
        console.error('Error fetching overview aggregates:', aggError);
    }

    let revenue = 0;
    let spend = 0;
    
    const aggregateRows = (aggregates || []) as { revenue: number | null; total_spend: number | null }[];
    if (aggregateRows.length) {
        revenue = aggregateRows.reduce((sum, row) => sum + (row.revenue || 0), 0);
        spend = aggregateRows.reduce((sum, row) => sum + (row.total_spend || 0), 0);
    }

    const mer = spend > 0 ? revenue / spend : 0;
    const roas = spend > 0 ? revenue / spend : 0; // Simplified for now, usually ROAS is platform specific

    // 2. Fetch Daily Data for Charts
    const { data: dailyData, error: dailyError } = await supabaseAdmin
        .schema('reporting')
        .from('mer_roas')
        .select('date, revenue, total_spend, mer')
        .eq('shop_id', shopId)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: true });

    return {
        stats: {
            revenue,
            spend,
            mer,
            roas
        },
        chartData: dailyData || [],
        dateRange: { from, to }
    };
};
