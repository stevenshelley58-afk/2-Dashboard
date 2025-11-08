import { JobType } from '@dashboard/config'
import { SupabaseClient } from '@supabase/supabase-js'

interface ShopifyConfig {
  accessToken: string
  shopDomain: string
  apiVersion: string
}

export class ShopifyClient {
  private config: ShopifyConfig
  private supabase: SupabaseClient

  constructor(config: ShopifyConfig, supabase: SupabaseClient) {
    this.config = config
    this.supabase = supabase
  }

  async sync(shopId: string, jobType: JobType): Promise<number> {
    console.log(`[Shopify] Starting ${jobType} sync for shop ${shopId}`)

    const { startDate, endDate } = await this.getDateRange(jobType, shopId)
    console.log(`[Shopify] Fetching data from ${startDate} to ${endDate}`)

    const bulkQuery = this.getBulkQuery(jobType, startDate)

    // Initiate bulk operation
    const bulkOpId = await this.initiateBulkOperation(bulkQuery)
    console.log(`[Shopify] Bulk operation created: ${bulkOpId}`)

    // Poll for completion
    const downloadUrl = await this.pollBulkOperation(bulkOpId)
    console.log(`[Shopify] Bulk operation complete, downloading...`)

    // Download and parse JSONL
    const records = await this.downloadAndParse(downloadUrl)
    console.log(`[Shopify] Downloaded ${records.length} records`)

    // If no records, return early with success
    if (records.length === 0) {
      console.log(`[Shopify] No new records to sync`)
      return 0
    }

    const latestUpdatedAt = this.getLatestUpdatedAt(records)

    // Insert to staging
    await this.insertToStaging(shopId, records, jobType)

    // Transform to warehouse
    const synced = await this.transformToWarehouse(shopId, jobType)
    console.log(`[Shopify] Transformed ${synced} records to warehouse`)

    // Update cursor
    if (jobType === JobType.INCREMENTAL) {
      const cursorDate = latestUpdatedAt ?? `${endDate}T23:59:59Z`
      await this.updateCursor(shopId, cursorDate)
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
      start.setDate(start.getDate() - 180)
      return { startDate: start.toISOString().split('T')[0], endDate }
    }

    const cursor = await this.getLastSyncedDate(shopId)
    const start = new Date(cursor ?? today)

    // Provide a one-day overlap to capture late updates
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
      .eq('platform', 'SHOPIFY')
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch Shopify cursor: ${error.message}`)
    }

    if (!data || !data.last_synced_date) {
      return null
    }

    return new Date(data.last_synced_date)
  }

  private async initiateBulkOperation(query: string): Promise<string> {
    const response = await fetch(
      `https://${this.config.shopDomain}/admin/api/${this.config.apiVersion}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.config.accessToken,
        },
        body: JSON.stringify({ query }),
      }
    )

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as any

    if (data.errors) {
      throw new Error(`Shopify GraphQL errors: ${JSON.stringify(data.errors)}`)
    }

    const bulkOpId = data.data?.bulkOperationRunQuery?.bulkOperation?.id
    if (!bulkOpId) {
      throw new Error('Failed to create bulk operation')
    }

    return bulkOpId
  }

  private getBulkQuery(jobType: JobType, startDate: string): string {
    const isoStart = `${startDate}T00:00:00Z`
    const filters: string[] = []

    if (jobType === JobType.INCREMENTAL) {
      filters.push(`updated_at:>=\\"${isoStart}\\"`)
    } else {
      filters.push(`created_at:>=\\"${isoStart}\\"`)
    }

    const filterClause = filters.length ? `(query: \"${filters.join(' ')}\")` : ''

    return `
      mutation {
        bulkOperationRunQuery(
          query: """
          {
            orders ${filterClause} {
              edges {
                node {
                  id
                  name
                  createdAt
                  updatedAt
                  totalPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
          """
        ) {
          bulkOperation {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `
    return baseQuery
  }

  private async pollBulkOperation(bulkOpId: string): Promise<string> {
    const query = `
      query {
        node(id: "${bulkOpId}") {
          ... on BulkOperation {
            id
            status
            errorCode
            url
          }
        }
      }
    `

    // Poll every 5 seconds, max 10 minutes
    const maxAttempts = 120
    let attempts = 0

    while (attempts < maxAttempts) {
      const response = await fetch(
        `https://${this.config.shopDomain}/admin/api/${this.config.apiVersion}/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': this.config.accessToken,
          },
          body: JSON.stringify({ query }),
        }
      )

      const data = (await response.json()) as any
      const bulkOp = data.data?.node

      if (!bulkOp) {
        throw new Error('Bulk operation not found')
      }

      console.log(`[Shopify] Bulk operation status: ${bulkOp.status}`)

      if (bulkOp.status === 'COMPLETED') {
        if (!bulkOp.url) {
          throw new Error('Bulk operation completed but no download URL')
        }
        return bulkOp.url
      }

      if (bulkOp.status === 'FAILED' || bulkOp.status === 'CANCELED') {
        throw new Error(`Bulk operation ${bulkOp.status}: ${bulkOp.errorCode}`)
      }

      // Wait 5 seconds before next poll
      await new Promise((resolve) => setTimeout(resolve, 5000))
      attempts++
    }

    throw new Error('Bulk operation timed out')
  }

  private async downloadAndParse(url: string): Promise<any[]> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download JSONL: ${response.status}`)
    }

    const text = await response.text()
    const lines = text.trim().split('\n')
    return lines.map((line) => JSON.parse(line))
  }

  private getLatestUpdatedAt(records: any[]): string | null {
    const timestamps = records
      .map((record) => record?.updatedAt as string | undefined)
      .filter((value): value is string => typeof value === 'string')

    if (timestamps.length === 0) {
      return null
    }

    return timestamps.reduce((latest, current) => {
      return new Date(current) > new Date(latest) ? current : latest
    })
  }

  private async insertToStaging(shopId: string, records: any[], jobType: JobType) {
    if (records.length === 0) return

    // Truncate staging if historical (full refresh)
    if (jobType === JobType.HISTORICAL) {
      const { error } = await this.supabase.rpc('truncate_staging_shopify_orders')
      if (error) {
        throw new Error(`Failed to truncate staging: ${error.message}`)
      }
    }

    // Batch insert via RPC
    const { error } = await this.supabase.rpc('insert_staging_shopify_orders', {
      p_records: records,
    })

    if (error) {
      throw new Error(`Failed to insert staging records: ${error.message}`)
    }
  }

  private async transformToWarehouse(shopId: string, jobType: JobType): Promise<number> {
    const { data, error } = await this.supabase.rpc('transform_shopify_orders', {
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
      p_platform: 'SHOPIFY',
      p_last_date: lastDate,
    })

    if (error) {
      throw new Error(`Failed to update cursor: ${error.message}`)
    }
  }
}
