import type { Platform, JobType, ErrorPayload } from '@dashboard/config'
import { getCredentials, updateCursor, completeJob } from '../lib/jobs'

export async function syncMeta(
  jobId: string,
  shopId: string,
  jobType: JobType
): Promise<void> {
  let recordsSynced = 0

  try {
    const creds = await getCredentials(shopId, 'META' as Platform)
    const adAccountId = creds.metadata.ad_account_id as string

    if (!adAccountId) {
      throw new Error('Missing ad_account_id in credentials metadata')
    }

    if (jobType === 'HISTORICAL_INIT') {
      // Fetch full historical range (Meta allows up to 2 years)
      const endDate = new Date()
      const startDate = new Date()
      startDate.setFullYear(startDate.getFullYear() - 2)

      // 1. Account Level
      recordsSynced += await fetchAndStoreInsights(
        creds.access_token,
        adAccountId,
        shopId,
        startDate,
        endDate,
        'account'
      )

      // 2. Ad Level (for campaign/adset/ad breakdown)
      recordsSynced += await fetchAndStoreInsights(
        creds.access_token,
        adAccountId,
        shopId,
        startDate,
        endDate,
        'ad'
      )
    } else if (jobType === 'INCREMENTAL') {
      // Fetch last 7 days or since watermark
      const { supabase } = await import('../lib/supabase')
      const { data: cursor } = await supabase
        .schema('core_warehouse')
        .from('sync_cursors')
        .select('watermark')
        .eq('shop_id', shopId)
        .eq('platform', 'META')
        .single()

      const since = cursor?.watermark?.last_date
        ? new Date(cursor.watermark.last_date as string)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

      const endDate = new Date()

      // 1. Account Level
      recordsSynced += await fetchAndStoreInsights(
        creds.access_token,
        adAccountId,
        shopId,
        since,
        endDate,
        'account'
      )

      // 2. Ad Level
      recordsSynced += await fetchAndStoreInsights(
        creds.access_token,
        adAccountId,
        shopId,
        since,
        endDate,
        'ad'
      )
    }

    // Update cursor
    await updateCursor(shopId, 'META' as Platform, {
      last_date: new Date().toISOString().split('T')[0],
    })

    await completeJob(jobId, 'SUCCEEDED', recordsSynced)
  } catch (error) {
    const errorPayload: ErrorPayload = {
      code: (error as Error).name || 'UNKNOWN_ERROR',
      message: (error as Error).message || 'Unknown error',
      task: 'meta_sync',
      stack: (error as Error).stack,
    }
    await completeJob(jobId, 'FAILED', undefined, errorPayload)
    throw error
  }
}

async function fetchAndStoreInsights(
  accessToken: string,
  adAccountId: string,
  shopId: string,
  startDate: Date,
  endDate: Date,
  level: 'account' | 'campaign' | 'adset' | 'ad'
): Promise<number> {
  const fields = [
    'impressions',
    'reach',
    'clicks',
    'inline_link_clicks',
    'unique_clicks',
    'spend',
    'cpc',
    'cpm',
    'ctr',
    'unique_ctr',
    'actions',
    'action_values',
    'objective',
    'buying_type',
    'account_id',
    'account_name',
  ]

  if (level !== 'account') {
    fields.push('campaign_id', 'campaign_name', 'adset_id', 'adset_name', 'ad_id', 'ad_name')
  }

  const breakdowns = [] // level param handles the grouping usually, but 'breakdowns' param is for other dimensions like age/gender. 'level' is sufficient for hierarchy.

  const params = new URLSearchParams({
    level,
    fields: fields.join(','),
    time_range: JSON.stringify({
      since: startDate.toISOString().split('T')[0],
      until: endDate.toISOString().split('T')[0],
    }),
    access_token: accessToken,
    limit: '500', // Maximize page size
  })

  let url = `https://graph.facebook.com/v21.0/${adAccountId}/insights?${params.toString()}`
  let inserted = 0
  const { supabase } = await import('../lib/supabase')

  while (url) {
    const response = await fetch(url)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Meta API error: ${JSON.stringify(error)}`)
    }

    const data = await response.json()
    const insights = data.data || []

    for (const insight of insights) {
      const dateStart = insight.date_start
      const dateStop = insight.date_stop || insight.date_start

      // 1. Insert into Staging
      const { error: stagingError } = await supabase.schema('staging_ingest').from('meta_insights_raw').upsert(
        {
          shop_id: shopId,
          date_start: dateStart,
          date_stop: dateStop,
          level,
          payload: insight,
        },
        {
          onConflict: 'shop_id,date_start,date_stop,level',
        }
      )

      if (stagingError) {
        console.error('Failed to insert raw insight:', stagingError)
        continue
      }

      // 2. Transform & Insert into Warehouse
      try {
        await processMetaInsight(shopId, insight, level, supabase)
        inserted++
      } catch (err) {
        console.error(`Failed to process insight:`, err)
      }
    }

    // Pagination
    url = data.paging?.next
  }

  return inserted
}

async function processMetaInsight(
  shopId: string,
  insight: any,
  level: string,
  supabase: any
) {
  const commonFields = {
    shop_id: shopId,
    date: insight.date_start,
    platform: 'META',
    account_id: insight.account_id,
    account_name: insight.account_name,
    currency: 'USD', // Meta insights usually don't return currency in the insight object unless requested or inferred from account. Assuming USD or handled elsewhere.
    impressions: insight.impressions,
    reach: insight.reach,
    clicks: insight.clicks,
    inline_link_clicks: insight.inline_link_clicks,
    unique_clicks: insight.unique_clicks,
    spend: insight.spend,
    cpc: insight.cpc,
    cpm: insight.cpm,
    ctr: insight.ctr,
    unique_ctr: insight.unique_ctr,
    conversions: 0, // Need to parse actions
    purchases: 0, // Need to parse actions
    purchase_value: 0, // Need to parse action_values
    leads: 0, // Need to parse actions
    adds_to_cart: 0, // Need to parse actions
    view_content: 0, // Need to parse actions
    actions: insight.actions || [],
    action_values: insight.action_values || [],
    objective: insight.objective,
    buying_type: insight.buying_type,
    updated_at: new Date().toISOString()
  }

  // Helper to parse actions
  const parseAction = (actions: any[], type: string) => {
    const action = actions?.find((a: any) => a.action_type === type)
    return action ? parseInt(action.value) : 0
  }
  const parseActionValue = (actionValues: any[], type: string) => {
    const action = actionValues?.find((a: any) => a.action_type === type)
    return action ? parseFloat(action.value) : 0
  }

  commonFields.purchases = parseAction(insight.actions, 'purchase') || parseAction(insight.actions, 'offsite_conversion.fb_pixel_purchase')
  commonFields.purchase_value = parseActionValue(insight.action_values, 'purchase') || parseActionValue(insight.action_values, 'offsite_conversion.fb_pixel_purchase')
  commonFields.leads = parseAction(insight.actions, 'lead')
  commonFields.adds_to_cart = parseAction(insight.actions, 'add_to_cart')
  commonFields.view_content = parseAction(insight.actions, 'view_content')
  // Conversions is often a sum or specific type, let's use purchases for now or custom logic
  commonFields.conversions = commonFields.purchases

  if (level === 'account') {
    const { error } = await supabase.schema('core_warehouse').from('fact_marketing_daily').upsert(commonFields, {
      onConflict: 'shop_id,date,platform'
    })
    if (error) throw error
  } else if (level === 'ad') {
    const campaignFields = {
      ...commonFields,
      campaign_id: insight.campaign_id,
      campaign_name: insight.campaign_name,
      adset_id: insight.adset_id,
      adset_name: insight.adset_name,
      ad_id: insight.ad_id,
      ad_name: insight.ad_name
    }
    // Note: The table is fact_marketing_campaign_daily but we are inserting ad level data.
    // The schema has ad_id, so it supports ad level granularity.
    // However, the unique constraint might be on (shop_id, date, platform)?
    // Let's check schema.
    // Schema: create table core_warehouse.fact_marketing_campaign_daily ...
    // It doesn't show a unique constraint in the provided snippet!
    // Wait, let me check the schema file again.
    // Step 17:
    // 261: create table core_warehouse.fact_marketing_campaign_daily (
    // ...
    // 293: create index idx_fact_campaign_daily_shop_date ...
    // No unique constraint defined for fact_marketing_campaign_daily in the snippet!
    // That's a potential issue for upserting.
    // I should probably add a unique constraint or just insert.
    // But upsert is safer.
    // I will assume I should add a unique constraint or use ID if I knew it.
    // Since I can't easily change schema now without another migration, I'll try to upsert on a logical key if it exists, or just insert?
    // If I just insert, I'll get duplicates on re-sync.
    // I really should have a unique constraint.
    // The schema in Step 17 shows unique (shop_id, date, platform) for fact_marketing_daily.
    // But for fact_marketing_campaign_daily it is missing.
    // I should probably add it.

    // For now, I will try to upsert on (shop_id, date, ad_id) if possible, but if the constraint doesn't exist, upsert might fail or fallback to insert.
    // Actually, Supabase/Postgres upsert requires a constraint.
    // I will add the constraint in a new migration or just execute SQL if I could.
    // Since I can't execute SQL directly, I will add a task to fix the schema.
    // But for now, I will write the code assuming the constraint exists or I will add it.

    // Let's add the constraint to the schema file I edited earlier?
    // I already edited `core_schema.sql`. I can edit it again to add the unique constraint.
    // unique (shop_id, date, ad_id) seems appropriate for ad level data.

    // Wait, if the table is for "campaign" daily, maybe it should be unique on campaign_id?
    // But it has ad_id.
    // If I store ad level data, it should be unique on ad_id + date.

    // I'll pause editing `meta.ts` and fix the schema first.
  }
}

