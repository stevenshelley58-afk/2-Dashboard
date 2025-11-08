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

const METRIC_NAME_MAP: Record<keyof Omit<KlaviyoMetric, 'date'>, string> = {
  emails_sent: 'Email Sent',
  emails_delivered: 'Email Delivered',
  opens: 'Email Opened',
  clicks: 'Email Clicked',
  revenue: 'Placed Order Value',
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
    const { startDate, endDate } = await this.getDateRange(jobType, shopId)
    console.log(`[Klaviyo] Fetching metrics from ${startDate} to ${endDate}`)

    // Fetch metrics from Klaviyo API
    const metrics = await this.fetchMetrics(startDate, endDate)
    console.log(`[Klaviyo] Fetched ${metrics.length} days of metrics`)

    // If no records, return early with success
    if (metrics.length === 0) {
      console.log(`[Klaviyo] No new records to sync`)
      return 0
    }

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

  private async getDateRange(
    jobType: JobType,
    shopId: string
  ): Promise<{ startDate: string; endDate: string }> {
    const today = new Date()
    const endDate = today.toISOString().split('T')[0]

    if (jobType === JobType.HISTORICAL) {
      const start = new Date(today)
      start.setDate(start.getDate() - 90)
      return { startDate: start.toISOString().split('T')[0], endDate }
    }

    const cursor = await this.getLastSyncedDate(shopId)
    const start = new Date(cursor ?? today)

    // Allow for overlap when backfilling late-arriving metrics
    start.setDate(start.getDate() - 1)

    if (start > today) {
      return { startDate: endDate, endDate }
    }

    return { startDate: start.toISOString().split('T')[0], endDate }
  }

  private async getLastSyncedDate(shopId: string): Promise<Date | null> {
    const { data, error } = await this.supabase
      .schema('core_warehouse')
      .from('sync_cursors')
      .select('last_synced_date')
      .eq('shop_id', shopId)
      .eq('platform', 'KLAVIYO')
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch Klaviyo cursor: ${error.message}`)
    }

    if (!data || !data.last_synced_date) {
      return null
    }

    return new Date(data.last_synced_date)
  }

  private async fetchMetrics(
    startDate: string,
    endDate: string
  ): Promise<KlaviyoMetric[]> {
    // Klaviyo doesn't have a single "daily metrics" endpoint
    // We need to aggregate campaign and flow metrics
    const metricIds = await this.resolveMetricIds(METRIC_NAME_MAP)
    const aggregated = new Map<string, KlaviyoMetric>()

    for (const [field, metricId] of Object.entries(metricIds) as Array<
      [keyof Omit<KlaviyoMetric, 'date'>, string]
    >) {
      const series = await this.fetchMetricTimeseries(metricId, startDate, endDate)

      for (const point of series) {
        const date = point.date.split('T')[0]
        const existing =
          aggregated.get(date) ?? {
            date,
            emails_sent: 0,
            emails_delivered: 0,
            opens: 0,
            clicks: 0,
            revenue: 0,
          }

        existing[field] += point.value
        aggregated.set(date, existing)
      }
    }

    return Array.from(aggregated.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
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

  private async resolveMetricIds(
    metrics: Record<keyof Omit<KlaviyoMetric, 'date'>, string>
  ): Promise<Record<keyof Omit<KlaviyoMetric, 'date'>, string>> {
    const remaining = new Map(Object.entries(metrics))
    const resolved = new Map<string, string>()
    let nextUrl: string | null = 'https://a.klaviyo.com/api/metrics'

    while (nextUrl && remaining.size > 0) {
      const response = await fetch(nextUrl, {
        headers: {
          Authorization: `Klaviyo-API-Key ${this.config.privateApiKey}`,
          revision: this.config.apiVersion,
        },
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Klaviyo metrics error: ${response.status} ${error}`)
      }

      const payload = (await response.json()) as any
      for (const metric of payload.data || []) {
        const name = metric?.attributes?.name
        if (typeof name !== 'string') continue

        for (const [field, desiredName] of remaining.entries()) {
          if (name.toLowerCase() === desiredName.toLowerCase()) {
            resolved.set(field, metric.id as string)
            remaining.delete(field)
            break
          }
        }
      }

      nextUrl = payload?.links?.next ?? null
    }

    if (remaining.size > 0) {
      throw new Error(
        `Missing Klaviyo metrics: ${Array.from(remaining.values()).join(', ')}`
      )
    }

    return Object.fromEntries(resolved) as Record<keyof Omit<KlaviyoMetric, 'date'>, string>
  }

  private async fetchMetricTimeseries(
    metricId: string,
    startDate: string,
    endDate: string
  ): Promise<Array<{ date: string; value: number }>> {
    const url = new URL('https://a.klaviyo.com/api/metrics/timeseries/')
    url.searchParams.set('metric_id', metricId)
    url.searchParams.set('start_date', `${startDate}T00:00:00Z`)
    url.searchParams.set('end_date', `${endDate}T23:59:59Z`)
    url.searchParams.set('interval', 'day')

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Klaviyo-API-Key ${this.config.privateApiKey}`,
        revision: this.config.apiVersion,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Klaviyo timeseries error: ${response.status} ${error}`)
    }

    const payload = (await response.json()) as any
    const seriesPoints: Array<{ date: string; value: number }> = []

    for (const entry of payload?.data ?? []) {
      const series = entry?.attributes?.series as Array<{
        timestamp: string
        value: number | string
      }> | undefined

      if (!series) continue

      for (const point of series) {
        const value =
          typeof point.value === 'string' ? Number(point.value) : point.value || 0
        seriesPoints.push({ date: point.timestamp, value })
      }
    }

    return seriesPoints
  }
}
