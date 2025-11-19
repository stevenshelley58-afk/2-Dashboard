import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
    const { shops } = await parent()

    if (shops && shops.length > 0) {
        // Redirect to first shop (or default)
        const defaultShop = shops.find((s: any) => s.is_default) || shops[0]
        throw redirect(303, `/dashboard/${defaultShop.id}`)
    }

    // If no shops, maybe redirect to onboarding or show empty state
    // For now, just return empty
    return {}
}
