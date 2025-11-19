import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals: { supabase }, cookies }) => {
    const {
        data: { session },
    } = await supabase.auth.getSession()

    return {
        session,
        cookies: cookies.getAll(),
    }
}
