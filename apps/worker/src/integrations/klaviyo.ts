import { JobType } from '@dashboard/config'
import { SupabaseClient } from '@supabase/supabase-js'

interface KlaviyoConfig {
  privateApiKey: string
  apiVersion: string
}

interface KlaviyoMetric {
  date: string
  emails_sent: number
  emails_delivered: number
  opens: number
  clicks: number
  revenue: number
}

export class KlaviyoClient {
  private config: KlaviyoConfig
  private supabase: SupabaseClient

  constructor(config: KlaviyoConfig, supabase: SupabaseClient) {
    this.config = config
    this.supabase = supabase
  }

  async sync(shopId: string, jobType: JobType): Promise<number> {
    console.log(`[Klaviyo] Starting ${jobType} sync for shop ${shopId}`)

    // Determine date range
    const { startDate, endDate } = this.getDateRange(jobType, shopId)
    console.log(`[Klaviyo] Fetching metrics from ${startDate} to ${endDate}`)

    // Fetch metrics from Klaviyo API
    const metrics = await this.fetchMetrics(startDate, endDate)
    console.log(`[Klaviyo] Fetched ${metrics.length} days of metrics`)

    // Insert to staging
    await this.insertToStaging(shopId, metrics, jobType)

    // Transform to warehouse
    const synced = await this.transformToWarehouse(shopId)
    console.log(`[Klaviyo] Transformed ${synced} records to warehouse`)

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
      // Fetch last 90 days
      const start = new Date(today)
      start.setDate(start.getDate() - 90)
      return { startDate: start.toISOString().split('T')[0], endDate }
    } else {
      // Incremental: last 7 days
      const start = new Date(today)
      start.setDate(start.getDate() - 7)
      return { startDate: start.toISOString().split('T')[0], endDate }
    }
  }

  private async fetchMetrics(
    startDate: string,
    endDate: string
  ): Promise<KlaviyoMetric[]> {
    // Klaviyo doesn't have a single "daily metrics" endpoint
    // We need to aggregate campaign and flow metrics
    const campaigns = await this.fetchCampaignMetrics(startDate, endDate)
    const flows = await this.fetchFlowMetrics(startDate, endDate)

    // Aggregate by date
    const byDate = new Map<string, KlaviyoMetric>()

    for (const campaign of campaigns) {
      const date = campaign.send_time.split('T')[0]
      const existing = byDate.get(date) || {
        date,
        emails_sent: 0,
        emails_delivered: 0,
        opens: 0,
        clicks: 0,
        revenue: 0,
      }

      existing.emails_sent += campaign.total_recipients || 0
      existing.emails_delivered += campaign.total_delivered || 0
      existing.opens += campaign.total_opens || 0
      existing.clicks += campaign.total_clicks || 0
      existing.revenue += campaign.revenue || 0

      byDate.set(date, existing)
    }

    for (const flow of flows) {
      const date = flow.send_time.split('T')[0]
      const existing = byDate.get(date) || {
        date,
        emails_sent: 0,
        emails_delivered: 0,
        opens: 0,
        clicks: 0,
        revenue: 0,
      }

      existing.emails_sent += flow.total_recipients || 0
      existing.emails_delivered += flow.total_delivered || 0
      existing.opens += flow.total_opens || 0
      existing.clicks += flow.total_clicks || 0
      existing.revenue += flow.revenue || 0

      byDate.set(date, existing)
    }

    return Array.from(byDate.values())
  }

  private async fetchCampaignMetrics(startDate: string, endDate: string): Promise<any[]> {
    const url = `https://a.klaviyo.com/api/campaigns`

    const params = new URLSearchParams({
      'filter[send_time][gte]': `${startDate}T00:00:00Z`,
      'filter[send_time][lte]': `${endDate}T23:59:59Z`,
    })

    const response = await fetch(`${url}?${params.toString()}`, {
      headers: {
        Authorization: `Klaviyo-API-Key ${this.config.privateApiKey}`,
        revision: this.config.apiVersion,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Klaviyo API error: ${response.status} ${error}`)
    }

    const data = (await response.json()) as any
    return data.data || []
  }

  private async fetchFlowMetrics(startDate: string, endDate: string): Promise<any[]> {
    // Similar to campaigns but for flows (automated emails)
    const url = `https://a.klaviyo.com/api/flows`

    const response = await fetch(url, {
      headers: {
        Authorization: `Klaviyo-API-Key ${this.config.privateApiKey}`,
        revision: this.config.apiVersion,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Klaviyo API error: ${response.status} ${error}`)
    }

    const data = (await response.json()) as any
    return data.data || []
  }

  private async insertToStaging(
    shopId: string,
    metrics: KlaviyoMetric[],
    jobType: JobType
  ) {
    if (metrics.length === 0) return

    if (jobType === JobType.HISTORICAL) {
      const { error } = await this.supabase.rpc('truncate_staging_klaviyo')
      if (error) {
        throw new Error(`Failed to truncate staging: ${error.message}`)
      }
    }

    const { error } = await this.supabase.rpc('insert_staging_klaviyo', {
      p_records: metrics,
    })

    if (error) {
      throw new Error(`Failed to insert staging records: ${error.message}`)
    }
  }

  private async transformToWarehouse(shopId: string): Promise<number> {
    const { data, error } = await this.supabase.rpc('transform_klaviyo', {
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
      p_platform: 'KLAVIYO',
      p_last_date: lastDate,
    })

    if (error) {
      throw new Error(`Failed to update cursor: ${error.message}`)
    }
  }
}
