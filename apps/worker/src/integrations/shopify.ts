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

    // Initiate bulk operation
    const bulkOpId = await this.initiateBulkOperation(jobType)
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

    // Insert to staging
    await this.insertToStaging(shopId, records, jobType)

    // Transform to warehouse
    const synced = await this.transformToWarehouse(shopId, jobType)
    console.log(`[Shopify] Transformed ${synced} records to warehouse`)

    // Update cursor
    if (jobType === JobType.INCREMENTAL) {
      await this.updateCursor(shopId)
    }

    return synced
  }

  private async initiateBulkOperation(jobType: JobType): Promise<string> {
    const query = this.getBulkQuery(jobType)

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

  private getBulkQuery(jobType: JobType): string {
    // For now, just fetch orders
    // TODO: Add line items, transactions, payouts queries
    const baseQuery = `
      mutation {
        bulkOperationRunQuery(
          query: """
          {
            orders {
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

  private async updateCursor(shopId: string) {
    const { error } = await this.supabase.rpc('update_sync_cursor', {
      p_shop_id: shopId,
    })

    if (error) {
      throw new Error(`Failed to update cursor: ${error.message}`)
    }
  }
}
