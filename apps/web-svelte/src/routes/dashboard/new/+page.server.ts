import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import type { PostgrestError } from '@supabase/supabase-js';

const SEED_LOOKBACK_DAYS = 7;

function isDuplicateKey(error: unknown) {
    return (error as PostgrestError)?.code === '23505';
}

async function triggerSync(fetchFn: typeof fetch, jobId: string) {
    try {
        await fetchFn('/api/sync', {
            method: 'POST',
            body: JSON.stringify({ jobId }),
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        console.error('Failed to trigger sync job', err);
    }
}

export const actions: Actions = {
    create: async ({ request, locals: { user }, fetch }) => {
        if (!user) return fail(401, { message: 'Unauthorized' });

        const formData = await request.formData();
        const name = formData.get('name') as string;
        let domain = formData.get('domain') as string;
        const token = formData.get('token') as string;

        if (!name || !domain || !token) {
            return fail(400, { message: 'All fields are required' });
        }

        // Normalize domain
        domain = domain.replace('https://', '').replace('http://', '').replace('.myshopify.com', '');
        const fullDomain = `${domain}.myshopify.com`;
        const shopId = domain; // Use normalized domain as ID

        try {
            // 1. Ensure user exists in app_dashboard.users
            const { error: userError } = await supabaseAdmin
                .schema('app_dashboard')
                .from('users')
                .upsert({
                    id: user.id,
                    email: user.email!,
                    name: user.user_metadata.full_name || user.email?.split('@')[0]
                })
                .select()
                .single();

            if (userError) throw userError;

            // 2. Create Shop
            const { error: shopError } = await supabaseAdmin
                .schema('core_warehouse')
                .from('shops')
                .upsert({
                    id: shopId,
                    name,
                    shopify_domain: fullDomain,
                    currency: 'USD',
                    timezone: 'UTC'
                }, { onConflict: 'shopify_domain' })
                .select()
                .single();

            if (shopError) throw shopError;

            // 3. Link User to Shop
            const { error: linkError } = await supabaseAdmin
                .schema('app_dashboard')
                .from('user_shops')
                .upsert({
                    user_id: user.id,
                    shop_id: shopId,
                    is_default: true
                }, { onConflict: 'user_id,shop_id' });

            if (linkError) throw linkError;

            // 4. Store Credentials
            const { error: credsError } = await supabaseAdmin
                .schema('core_warehouse')
                .from('shop_credentials')
                .upsert({
                    shop_id: shopId,
                    platform: 'SHOPIFY',
                    access_token: token,
                    metadata: { shopify_domain: fullDomain }
                }, { onConflict: 'shop_id,platform' });

            if (credsError) throw credsError;
        } catch (err: any) {
            console.error('Error creating shop:', err);
            return fail(500, { message: err.message || 'Failed to create shop' });
        }

        // 5. Enqueue fast incremental seed job
        try {
            const { data: job, error: jobError } = await supabaseAdmin
                .schema('core_warehouse')
                .from('sync_jobs')
                .insert({
                    shop_id: shopId,
                    platform: 'SHOPIFY',
                    job_type: 'INCREMENTAL',
                    status: 'QUEUED',
                    metadata: {
                        lookback_days: SEED_LOOKBACK_DAYS,
                        auto_queue_historical: true,
                        reason: 'onboarding_seed'
                    }
                })
                .select()
                .single();

            if (jobError) throw jobError;

            if (job) {
                await triggerSync(fetch, job.id);
            }
        } catch (err) {
            if (isDuplicateKey(err)) {
                console.info('Shopify sync already in progress for shop', shopId);
            } else {
                console.error('Failed to queue seed job:', err);
            }
        }

        throw redirect(303, `/dashboard/${shopId}`);
    }
};

