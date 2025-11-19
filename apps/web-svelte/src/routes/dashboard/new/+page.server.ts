import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { supabaseAdmin } from '$lib/server/supabase-admin';

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

            // 5. Enqueue Historical Sync Job
            const { data: job, error: jobError } = await supabaseAdmin
                .schema('core_warehouse')
                .from('sync_jobs')
                .insert({
                    shop_id: shopId,
                    platform: 'SHOPIFY',
                    job_type: 'HISTORICAL_INIT',
                    status: 'QUEUED'
                })
                .select()
                .single();

            if (jobError) throw jobError;

            // 6. Trigger Sync (Fire and forget via API)
            // We use the public URL or internal fetch if possible.
            // Since we are on the server, we can use `fetch` with the full URL or relative if handled by SvelteKit.
            // But `fetch` in `actions` is special.
            if (job) {
                // We don't await this to avoid blocking, OR we await with a timeout.
                // Actually, for Vercel, it's safer to await but maybe catch errors so we don't fail the redirect.
                // But a full sync takes too long.
                // We will just fire the request and hope Vercel doesn't kill it immediately after response.
                // Better: The API endpoint should probably spawn a background task if possible, but on Vercel that's hard without queues.
                // For now, we'll just let the user go to the dashboard and they will see "QUEUED".
                // We will try to kick it off though.
                fetch('/api/sync', {
                    method: 'POST',
                    body: JSON.stringify({ jobId: job.id }),
                    headers: { 'Content-Type': 'application/json' }
                }).catch(err => console.error('Failed to trigger sync:', err));
            }

        } catch (err: any) {
            console.error('Error creating shop:', err);
            return fail(500, { message: err.message || 'Failed to create shop' });
        }

        throw redirect(303, `/dashboard/${shopId}`);
    }
};

