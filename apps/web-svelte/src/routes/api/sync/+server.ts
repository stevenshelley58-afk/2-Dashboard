import { json } from '@sveltejs/kit'
import { supabaseAdmin } from '$lib/server/supabase-admin'
import { syncShopify } from '$lib/server/sync/shopify'
import { syncMeta } from '$lib/server/sync/meta'
import { claimJob, maybeQueueFollowUp } from '$lib/server/sync/jobs'
import type { RequestHandler } from './$types'
import type { SyncJob } from '@dashboard/config'

export const POST: RequestHandler = async ({ request }) => {
    const body = await request.json()
    const { jobId } = body

    if (!jobId) {
        return json({ error: 'No jobId provided' }, { status: 400 })
    }

    const claimed = await claimJob(jobId)
    if (!claimed) {
        return json({ error: 'Job already claimed or not found' }, { status: 409 })
    }

    const { data: job } = await supabaseAdmin
        .schema('core_warehouse')
        .from('sync_jobs')
        .select('*')
        .eq('id', jobId)
        .single()

    if (!job) return json({ error: 'Job not found' }, { status: 404 })
    const syncJob = job as SyncJob

    try {
        if (syncJob.platform === 'SHOPIFY') {
            await syncShopify(syncJob)
        } else if (syncJob.platform === 'META') {
            await syncMeta(syncJob)
        }
        await maybeQueueFollowUp(syncJob)
    } catch (e) {
        console.error('Sync failed:', e)
        return json({ error: 'Sync failed', details: e }, { status: 500 })
    }

    return json({ success: true })
}
