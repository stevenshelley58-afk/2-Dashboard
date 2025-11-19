import { supabaseAdmin as supabase } from '../supabase-admin'
import { JobStatus } from '@dashboard/config'
import type { Platform, ErrorPayload, SyncJob } from '@dashboard/config'
const ACTIVE_STATUSES: JobStatus[] = [JobStatus.QUEUED, JobStatus.IN_PROGRESS]

export async function claimJob(jobId: string): Promise<boolean> {
    const { data, error } = await supabase
        .schema('core_warehouse')
        .from('sync_jobs')
        .update({
            status: 'IN_PROGRESS' as JobStatus,
            started_at: new Date().toISOString(),
        })
        .eq('id', jobId)
        .eq('status', 'QUEUED')
        .select()
        .single()

    if (error || !data) {
        return false
    }
    return true
}

export async function completeJob(
    jobId: string,
    status: 'SUCCEEDED' | 'FAILED',
    recordsSynced?: number,
    error?: ErrorPayload
): Promise<void> {
    await supabase
        .schema('core_warehouse')
        .from('sync_jobs')
        .update({
            status,
            records_synced: recordsSynced ?? null,
            error: error ?? null,
            completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)
}

export async function updateCursor(
    shopId: string,
    platform: Platform,
    watermark: Record<string, unknown> | null
): Promise<void> {
    await supabase
        .schema('core_warehouse')
        .from('sync_cursors')
        .upsert(
            {
                shop_id: shopId,
                platform,
                watermark,
                last_success_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            {
                onConflict: 'shop_id,platform',
            }
        )
}

export async function getCredentials(shopId: string, platform: Platform) {
    const { data, error } = await supabase
        .schema('core_warehouse')
        .from('shop_credentials')
        .select('*')
        .eq('shop_id', shopId)
        .eq('platform', platform)
        .single()

    if (error || !data) {
        throw new Error(`Credentials not found for shop ${shopId}, platform ${platform}`)
    }

    return data
}

export async function maybeQueueFollowUp(job: SyncJob): Promise<void> {
    if (job.platform !== 'SHOPIFY' || job.job_type !== 'INCREMENTAL') {
        return
    }

    const metadata = (job.metadata || {}) as Record<string, unknown>
    if (!metadata.auto_queue_historical) {
        return
    }

    // Only queue once the current job has finished (caller should ensure this)
    const { data: existing, error: existingError } = await supabase
        .schema('core_warehouse')
        .from('sync_jobs')
        .select('id, status')
        .eq('shop_id', job.shop_id)
        .eq('platform', job.platform)
        .eq('job_type', 'HISTORICAL_INIT')
        .in('status', ACTIVE_STATUSES)

    if (existingError) {
        console.error('Failed to check existing historical job', existingError)
        return
    }

    if (existing && existing.length > 0) {
        return
    }

    const { error: insertError } = await supabase
        .schema('core_warehouse')
        .from('sync_jobs')
        .insert({
            shop_id: job.shop_id,
            platform: job.platform,
            job_type: 'HISTORICAL_INIT',
            status: 'QUEUED',
            metadata: {
                triggered_by: job.id,
            },
        })

    if (insertError) {
        console.error('Failed to queue historical job', insertError)
    }
}
