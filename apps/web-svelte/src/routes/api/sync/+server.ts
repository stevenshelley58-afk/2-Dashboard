import { json } from '@sveltejs/kit'
import { supabaseAdmin } from '$lib/server/supabase-admin'
import { syncShopify } from '$lib/server/sync/shopify'
import { syncMeta } from '$lib/server/sync/meta'
import { claimJob } from '$lib/server/sync/jobs'
import type { RequestHandler } from './$types'
import { CRON_SECRET } from '$env/static/private'

export const POST: RequestHandler = async ({ request }) => {
    // Verify cron secret if present (for Vercel Cron)
    const authHeader = request.headers.get('authorization')
    const isCron = authHeader === `Bearer ${CRON_SECRET}`

    // Also allow if triggered by authenticated user? 
    // For now, let's just rely on the body containing a valid jobId that exists in DB.
    // Ideally we check if the user owns the shop, but for background jobs triggered by system, we might skip user check if it's a cron.

    const body = await request.json()
    const { jobId } = body

    if (jobId) {
        // Process specific job
        const claimed = await claimJob(jobId)
        if (!claimed) {
            return json({ error: 'Job already claimed or not found' }, { status: 409 })
        }

        // Fetch job details
        const { data: job } = await supabaseAdmin
            .schema('core_warehouse')
            .from('sync_jobs')
            .select('*')
            .eq('id', jobId)
            .single()

        if (!job) return json({ error: 'Job not found' }, { status: 404 })

        // Execute sync (fire and forget? No, Vercel functions need to await or they die)
        try {
            if (job.platform === 'SHOPIFY') {
                await syncShopify(job.id, job.shop_id, job.job_type)
            } else if (job.platform === 'META') {
                await syncMeta(job.id, job.shop_id, job.job_type)
            }
        } catch (e) {
            console.error('Sync failed:', e)
            return json({ error: 'Sync failed', details: e }, { status: 500 })
        }

        return json({ success: true })
    }

    return json({ error: 'No jobId provided' }, { status: 400 })
}
