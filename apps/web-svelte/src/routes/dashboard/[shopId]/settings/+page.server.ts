import { error, fail } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { supabaseAdmin } from '$lib/server/supabase-admin'
import { Platform } from '@dashboard/config'

type CredentialSummary = {
    id: string
    platform: Platform
    metadata: Record<string, unknown>
    created_at: string
    updated_at: string
    tokenPreview: string | null
    hasToken: boolean
}

const maskToken = (token: string): string => {
    if (token.length <= 4) return token
    return `•••• ${token.slice(-4)}`
}

const successResponse = (target: 'shopify' | 'meta', message: string) => ({
    ok: true,
    target,
    message,
})

const failureResponse = (target: 'shopify' | 'meta', status: number, message: string) =>
    fail(status, { ok: false, target, message })

const normalizeShopifyDomain = (value: string) => {
    let domain = value.trim().toLowerCase()
    domain = domain.replace(/^https?:\/\//, '')
    domain = domain.replace(/\.myshopify\.com$/, '')
    domain = domain.replace(/\/.*$/, '')
    domain = domain.replace(/\s+/g, '')

    if (!domain || !/^[a-z0-9][a-z0-9-]*$/.test(domain)) {
        return null
    }

    return `${domain}.myshopify.com`
}

const fetchCredentialMetadata = async (shopId: string, platform: Platform) => {
    const { data } = await supabaseAdmin
        .schema('core_warehouse')
        .from('shop_credentials')
        .select('metadata')
        .eq('shop_id', shopId)
        .eq('platform', platform)
        .maybeSingle()

    return (data?.metadata as Record<string, unknown>) ?? {}
}

const ensureShopAccess = async (supabase: App.Locals['supabase'], shopId: string) => {
    const { data, error: shopError } = await supabase
        .schema('core_warehouse')
        .from('shops')
        .select('id, shopify_domain')
        .eq('id', shopId)
        .single()

    if (shopError || !data) {
        return null
    }

    return data
}

export const load: PageServerLoad = async ({ params, locals }) => {
    const { supabase, user } = locals
    if (!user) {
        throw error(401, 'Unauthorized')
    }

    const { shopId } = params

    const { data: shop, error: shopError } = await supabase
        .schema('core_warehouse')
        .from('shops')
        .select('id, name, shopify_domain, currency, timezone')
        .eq('id', shopId)
        .single()

    if (shopError || !shop) {
        throw error(404, 'Shop not found')
    }

    const { data: credentials, error: credentialError } = await supabase
        .schema('core_warehouse')
        .from('shop_credentials')
        .select('id, platform, metadata, created_at, updated_at, access_token')
        .eq('shop_id', shopId)

    if (credentialError) {
        console.error('Failed to load credentials', credentialError)
        throw error(500, 'Unable to load credentials')
    }

    const sanitized: CredentialSummary[] = (credentials || []).map((row) => ({
        id: row.id,
        platform: row.platform as Platform,
        metadata: row.metadata ?? {},
        created_at: row.created_at,
        updated_at: row.updated_at,
        tokenPreview: row.access_token ? maskToken(row.access_token) : null,
        hasToken: Boolean(row.access_token),
    }))

    return {
        shop,
        credentials: sanitized,
    }
}

export const actions: Actions = {
    shopify: async ({ request, params, locals }) => {
        if (!locals.user) {
            return failureResponse('shopify', 401, 'You must be signed in.')
        }

        const { shopId } = params
        if (!shopId) {
            return failureResponse('shopify', 400, 'Missing shop id.')
        }

        const shop = await ensureShopAccess(locals.supabase, shopId)
        if (!shop) {
            return failureResponse('shopify', 404, 'Shop not found.')
        }

        const formData = await request.formData()
        const domainInput = (formData.get('shopify_domain') as string | null)?.trim()
        const accessToken = (formData.get('shopify_token') as string | null)?.trim()

        if (!domainInput) {
            return failureResponse('shopify', 400, 'Shopify domain is required.')
        }

        if (!accessToken) {
            return failureResponse('shopify', 400, 'Admin API access token is required.')
        }

        const normalizedDomain = normalizeShopifyDomain(domainInput)
        if (!normalizedDomain) {
            return failureResponse('shopify', 400, 'Provide a valid Shopify subdomain.')
        }

        const existingMetadata = await fetchCredentialMetadata(shopId, Platform.SHOPIFY)
        const metadata = {
            ...existingMetadata,
            shopify_domain: normalizedDomain,
        }
        const now = new Date().toISOString()

        const { error: shopUpdateError } = await supabaseAdmin
            .schema('core_warehouse')
            .from('shops')
            .update({
                shopify_domain: normalizedDomain,
                updated_at: now,
            })
            .eq('id', shopId)

        if (shopUpdateError) {
            console.error('Failed to update shop domain', shopUpdateError)
            return failureResponse('shopify', 500, 'Could not update Shopify domain.')
        }

        const { error: credentialError } = await supabaseAdmin
            .schema('core_warehouse')
            .from('shop_credentials')
            .upsert(
                {
                    shop_id: shopId,
                    platform: Platform.SHOPIFY,
                    access_token: accessToken,
                    metadata,
                    updated_at: now,
                },
                { onConflict: 'shop_id,platform' }
            )

        if (credentialError) {
            console.error('Failed to store Shopify credentials', credentialError)
            return failureResponse('shopify', 500, 'Could not store Shopify credentials.')
        }

        return successResponse('shopify', 'Shopify API key saved. The next sync will use it automatically.')
    },
    meta: async ({ request, params, locals }) => {
        if (!locals.user) {
            return failureResponse('meta', 401, 'You must be signed in.')
        }

        const { shopId } = params
        if (!shopId) {
            return failureResponse('meta', 400, 'Missing shop id.')
        }

        const shop = await ensureShopAccess(locals.supabase, shopId)
        if (!shop) {
            return failureResponse('meta', 404, 'Shop not found.')
        }

        const formData = await request.formData()
        const adAccountInput = (formData.get('meta_account') as string | null)?.trim()
        const accessToken = (formData.get('meta_token') as string | null)?.trim()

        if (!adAccountInput) {
            return failureResponse('meta', 400, 'Meta ad account ID is required.')
        }

        if (!accessToken) {
            return failureResponse('meta', 400, 'System user access token is required.')
        }

        const normalizedAccount = adAccountInput.startsWith('act_')
            ? adAccountInput
            : `act_${adAccountInput.replace(/^act_/, '')}`

        const existingMetadata = await fetchCredentialMetadata(shopId, Platform.META)
        const metadata = {
            ...existingMetadata,
            ad_account_id: normalizedAccount,
        }
        const now = new Date().toISOString()

        const { error: credentialError } = await supabaseAdmin
            .schema('core_warehouse')
            .from('shop_credentials')
            .upsert(
                {
                    shop_id: shopId,
                    platform: Platform.META,
                    access_token: accessToken,
                    metadata,
                    updated_at: now,
                },
                { onConflict: 'shop_id,platform' }
            )

        if (credentialError) {
            console.error('Failed to store Meta credentials', credentialError)
            return failureResponse('meta', 500, 'Could not store Meta credentials.')
        }

        return successResponse('meta', 'Meta credentials updated. We will re-queue marketing syncs if needed.')
    },
}

