import type { PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase-admin';

export const load: PageServerLoad = async ({ params, url }) => {
    const { shopId } = params;
    const from = url.searchParams.get('from') || new Date().toISOString().split('T')[0];
    const to = url.searchParams.get('to') || new Date().toISOString().split('T')[0];

    // 1. Fetch Aggregates
    const { data: aggregates, error: aggError } = await supabaseAdmin
        .from('marketing_daily')
        .select('spend, impressions, clicks, revenue')
        .eq('shop_id', shopId)
        .eq('platform', 'META')
        .gte('date', from)
        .lte('date', to)
        .schema('reporting');

    if (aggError) {
        console.error('Error fetching meta aggregates:', aggError);
    }

    let spend = 0;
    let impressions = 0;
    let clicks = 0;
    let revenue = 0;
    
    if (aggregates) {
        spend = aggregates.reduce((sum, row) => sum + (row.spend || 0), 0);
        impressions = aggregates.reduce((sum, row) => sum + (row.impressions || 0), 0);
        clicks = aggregates.reduce((sum, row) => sum + (row.clicks || 0), 0);
        revenue = aggregates.reduce((sum, row) => sum + (row.revenue || 0), 0);
    }

    const roas = spend > 0 ? revenue / spend : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

    // 2. Fetch Daily Data for Charts
    const { data: dailyData, error: dailyError } = await supabaseAdmin
        .from('marketing_daily')
        .select('date, spend, revenue, impressions, clicks')
        .eq('shop_id', shopId)
        .eq('platform', 'META')
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: true })
        .schema('reporting');

    return {
        stats: {
            spend,
            revenue,
            roas,
            cpc,
            ctr,
            impressions,
            clicks
        },
        chartData: dailyData || [],
        dateRange: { from, to }
    };
};

