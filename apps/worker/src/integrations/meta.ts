import { JobType } from '@dashboard/config'
import { SupabaseClient } from '@supabase/supabase-js'

interface MetaConfig {
  accessToken: string
  adAccountId: string
  apiVersion: string
}

interface MetaInsight {
  date_start: string
  date_stop: string
  spend: string
  impressions: string
  clicks: string
  actions?: Array<{
    action_type: string
    value: string
  }>
}

export class MetaClient {
  private config: MetaConfig
  private supabase: SupabaseClient

  constructor(config: MetaConfig, supabase: SupabaseClient) {
    this.config = config
    this.supabase = supabase
  }

  async sync(shopId: string, jobType: JobType): Promise<number> {
    console.log(`[Meta] Starting ${jobType} sync for shop ${shopId}`)

    // Determine date range based on job type
    const { startDate, endDate } = this.getDateRange(jobType, shopId)
    console.log(`[Meta] Fetching insights from ${startDate} to ${endDate}`)

    // Fetch insights from Meta Marketing API
    const insights = await this.fetchInsights(startDate, endDate)
    console.log(`[Meta] Fetched ${insights.length} days of insights`)

    // If no records, return early with success
    if (insights.length === 0) {
      console.log(`[Meta] No new records to sync`)
      return 0
    }

    // Insert to staging
    await this.insertToStaging(shopId, insights, jobType)

    // Transform to warehouse
    const synced = await this.transformToWarehouse(shopId)
    console.log(`[Meta] Transformed ${synced} records to warehouse`)

    // Update cursor
    if (jobType === JobType.INCREMENTAL) {
      await this.updateCursor(shopId, endDate)
    }

    return synced
  }

  private getDateRange(
    jobType: JobType,
    shopId: string
  ): { startDate: string; endDate: string } {
    const today = new Date()
    const endDate = today.toISOString().split('T')[0]

    if (jobType === JobType.HISTORICAL) {
      // Fetch last 90 days for historical sync
      const start = new Date(today)
      start.setDate(start.getDate() - 90)
      return { startDate: start.toISOString().split('T')[0], endDate }
    } else {
      // Incremental: fetch from last cursor (or yesterday if no cursor)
      // TODO: Get actual cursor from database
      const start = new Date(today)
      start.setDate(start.getDate() - 1)
      return { startDate: start.toISOString().split('T')[0], endDate }
    }
  }

  private async fetchInsights(
    startDate: string,
    endDate: string
  ): Promise<MetaInsight[]> {
    const url = `https://graph.facebook.com/${this.config.apiVersion}/act_${this.config.adAccountId}/insights`

    const params = new URLSearchParams({
      access_token: this.config.accessToken,
      fields: 'date_start,date_stop,spend,impressions,clicks,actions',
      time_range: JSON.stringify({ since: startDate, until: endDate }),
      time_increment: '1', // Daily granularity
      level: 'account',
    })

    const response = await fetch(`${url}?${params.toString()}`)

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Meta API error: ${response.status} ${error}`)
    }

    const data = (await response.json()) as any

    if (data.error) {
      throw new Error(`Meta API error: ${JSON.stringify(data.error)}`)
    }

    return data.data as MetaInsight[]
  }

  private async insertToStaging(
    shopId: string,
    insights: MetaInsight[],
    jobType: JobType
  ) {
    if (insights.length === 0) return

    // Truncate staging if historical (full refresh)
    if (jobType === JobType.HISTORICAL) {
      const { error } = await this.supabase.rpc('truncate_staging_meta_ads')
      if (error) {
        throw new Error(`Failed to truncate staging: ${error.message}`)
      }
    }

    // Batch insert via RPC
    const { error } = await this.supabase.rpc('insert_staging_meta_ads', {
      p_records: insights,
    })

    if (error) {
      throw new Error(`Failed to insert staging records: ${error.message}`)
    }
  }

  private async transformToWarehouse(shopId: string): Promise<number> {
    const { data, error } = await this.supabase.rpc('transform_meta_ads', {
      p_shop_id: shopId,
    })

    if (error) {
      throw new Error(`Failed to transform records: ${error.message}`)
    }

    return data as number
  }

  private async updateCursor(shopId: string, lastDate: string) {
    const { error } = await this.supabase.rpc('update_sync_cursor_with_date', {
      p_shop_id: shopId,
      p_platform: 'META',
      p_last_date: lastDate,
    })

    if (error) {
      throw new Error(`Failed to update cursor: ${error.message}`)
    }
  }
}
