import { fail, redirect } from '@sveltejs/kit'
import type { Actions } from './$types'

export const actions: Actions = {
    login: async ({ request, locals: { supabase } }) => {
        const formData = await request.formData()
        const email = formData.get('email') as string

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                // set this to false if you do not want the user to be automatically signed up
                shouldCreateUser: true,
                emailRedirectTo: 'http://localhost:5173/auth/callback', // TODO: make dynamic
            },
        })

        if (error) {
            return fail(500, { message: 'Could not send magic link' })
        }

        return { success: true }
    },
}
