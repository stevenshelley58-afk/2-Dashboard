import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals: { supabase } }) => {
    const { data: userShops } = await supabase
        .schema('app_dashboard')
        .from('user_shops')
        .select('shop_id, is_default, core_warehouse:shops(id, name, shopify_domain)')

    // Transform to flat array
    const shops = userShops?.map((us: any) => ({
        id: us.core_warehouse.id,
        name: us.core_warehouse.name,
        domain: us.core_warehouse.shopify_domain,
        is_default: us.is_default
    })) || []

    return {
        shops
    }
}
