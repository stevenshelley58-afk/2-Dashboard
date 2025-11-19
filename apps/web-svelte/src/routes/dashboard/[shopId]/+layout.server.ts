import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ params, locals: { supabase } }) => {
    const { shopId } = params

    const {
        data: { user },
    } = await supabase.auth.getUser()

    // Fetch recent sync jobs
    const { data: jobs } = await supabase
        .schema('core_warehouse')
        .from('sync_jobs')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .limit(5)

    // Fetch cursors
    const { data: cursors } = await supabase
        .schema('core_warehouse')
        .from('sync_cursors')
        .select('*')
        .eq('shop_id', shopId)

    return {
        session: { user },
        sync: {
            jobs: jobs || [],
            cursors: cursors || []
        }
    }
}
