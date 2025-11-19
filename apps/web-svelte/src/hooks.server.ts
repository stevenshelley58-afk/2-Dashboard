import { createServerClient } from '@supabase/ssr'
import { type Handle, redirect } from '@sveltejs/kit'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'

export const handle: Handle = async ({ event, resolve }) => {
    event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
        cookies: {
            getAll: () => event.cookies.getAll(),
            setAll: (cookiesToSet) => {
                cookiesToSet.forEach(({ name, value, options }) => {
                    event.cookies.set(name, value, { ...options, path: '/' })
                })
            },
        },
    })

    /**
     * Unlike `supabase.auth.getSession()`, which returns the session _at the time_ the client was initialized,
     * `supabase.auth.getUser()` returns the user _at the time_ it's called.
     */
    const {
        data: { user },
    } = await event.locals.supabase.auth.getUser()

    event.locals.user = user
    event.locals.session = null // Deprecated but sometimes used, getUser is safer

    if (!user && event.url.pathname.startsWith('/dashboard')) {
        throw redirect(303, '/login')
    }

    if (user && event.url.pathname === '/login') {
        throw redirect(303, '/dashboard')
    }

    return resolve(event, {
        filterSerializedResponseHeaders(name) {
            return name === 'content-range' || name === 'x-supabase-api-version'
        },
    })
}
