import { supabaseAdmin as supabase } from '../supabase-admin'
import type { Platform, JobStatus, ErrorPayload } from '@dashboard/config'

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
