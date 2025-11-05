import { JobType } from '@dashboard/config'
import { SupabaseClient } from '@supabase/supabase-js'

interface GA4Config {
  propertyId: string
  serviceAccountKey: string // JSON string of service account credentials
  apiVersion: string
}

interface GA4Report {
  date: string
  sessions: number
  users: number
  transactions: number
  revenue: number
}

export class GA4Client {
  private config: GA4Config
  private supabase: SupabaseClient
  private accessToken?: string
  private tokenExpiry?: number

  constructor(config: GA4Config, supabase: SupabaseClient) {
    this.config = config
    this.supabase = supabase
  }

  async sync(shopId: string, jobType: JobType): Promise<number> {
    console.log(`[GA4] Starting ${jobType} sync for shop ${shopId}`)

    // Get OAuth token
    await this.ensureAccessToken()

    // Determine date range
    const { startDate, endDate } = this.getDateRange(jobType, shopId)
    console.log(`[GA4] Fetching report from ${startDate} to ${endDate}`)

    // Fetch report from GA4 Data API
    const report = await this.fetchReport(startDate, endDate)
    console.log(`[GA4] Fetched ${report.length} days of data`)

    // If no records, return early with success
    if (report.length === 0) {
      console.log(`[GA4] No new records to sync`)
      return 0
    }

    // Insert to staging
    await this.insertToStaging(shopId, report, jobType)

    // Transform to warehouse
    const synced = await this.transformToWarehouse(shopId)
    console.log(`[GA4] Transformed ${synced} records to warehouse`)

    // Update cursor
    if (jobType === JobType.INCREMENTAL) {
      await this.updateCursor(shopId, endDate)
    }

    return synced
  }

  private async ensureAccessToken() {
    // Check if token exists and not expired
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return
    }

    const credentials = JSON.parse(this.config.serviceAccountKey)

    // Create JWT for Google OAuth
    const jwt = await this.createJWT(credentials)

    // Exchange JWT for access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OAuth token error: ${response.status} ${error}`)
    }

    const data = (await response.json()) as any
    this.accessToken = data.access_token
    this.tokenExpiry = Date.now() + data.expires_in * 1000
  }

  private async createJWT(credentials: any): Promise<string> {
    // This is a simplified JWT creation
    // In production, use a library like 'jsonwebtoken' or 'jose'
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    }

    const now = Math.floor(Date.now() / 1000)
    const payload = {
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }

    // TODO: Sign with private key using crypto
    // For now, this is a placeholder - need to implement proper JWT signing
    throw new Error('JWT signing not implemented - use googleapis library')
  }

  private getDateRange(
    jobType: JobType,
    shopId: string
  ): { startDate: string; endDate: string } {
    const today = new Date()
    today.setDate(today.getDate() - 1) // GA4 has 1-day delay
    const endDate = today.toISOString().split('T')[0]

    if (jobType === JobType.HISTORICAL) {
      // Fetch last 90 days
      const start = new Date(today)
      start.setDate(start.getDate() - 90)
      return { startDate: start.toISOString().split('T')[0], endDate }
    } else {
      // Incremental: last 7 days (to backfill any late data)
      const start = new Date(today)
      start.setDate(start.getDate() - 7)
      return { startDate: start.toISOString().split('T')[0], endDate }
    }
  }

  private async fetchReport(startDate: string, endDate: string): Promise<GA4Report[]> {
    const url = `https://analyticsdata.googleapis.com/${this.config.apiVersion}/properties/${this.config.propertyId}:runReport`

    const body = {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'transactions' },
        { name: 'totalRevenue' },
      ],
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`GA4 API error: ${response.status} ${error}`)
    }

    const data = (await response.json()) as any

    // Parse response into flat records
    const report: GA4Report[] = []
    for (const row of data.rows || []) {
      report.push({
        date: row.dimensionValues[0].value,
        sessions: parseInt(row.metricValues[0].value),
        users: parseInt(row.metricValues[1].value),
        transactions: parseInt(row.metricValues[2].value),
        revenue: parseFloat(row.metricValues[3].value),
      })
    }

    return report
  }

  private async insertToStaging(shopId: string, report: GA4Report[], jobType: JobType) {
    if (report.length === 0) return

    if (jobType === JobType.HISTORICAL) {
      const { error } = await this.supabase.rpc('truncate_staging_ga4')
      if (error) {
        throw new Error(`Failed to truncate staging: ${error.message}`)
      }
    }

    const { error } = await this.supabase.rpc('insert_staging_ga4', {
      p_records: report,
    })

    if (error) {
      throw new Error(`Failed to insert staging records: ${error.message}`)
    }
  }

  private async transformToWarehouse(shopId: string): Promise<number> {
    const { data, error } = await this.supabase.rpc('transform_ga4', {
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
      p_platform: 'GA4',
      p_last_date: lastDate,
    })

    if (error) {
      throw new Error(`Failed to update cursor: ${error.message}`)
    }
  }
}
