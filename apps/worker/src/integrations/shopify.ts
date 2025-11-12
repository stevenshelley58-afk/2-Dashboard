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

    // Download and parse JSONL (separates by type)
    const recordsByType = await this.downloadAndParse(downloadUrl)
    const totalRecords =
      recordsByType.orders.length +
      recordsByType.lineItems.length +
      recordsByType.transactions.length
    console.log(
      `[Shopify] Downloaded ${totalRecords} records (${recordsByType.orders.length} orders, ${recordsByType.lineItems.length} line items, ${recordsByType.transactions.length} transactions)`
    )

    // If no records, return early with success
    if (totalRecords === 0) {
      console.log(`[Shopify] No new records to sync`)
      return 0
    }

    // Insert to staging
    await this.insertToStaging(shopId, recordsByType, jobType)

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
    // Fetch orders with nested line items and transactions
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
                  lineItems {
                    edges {
                      node {
                        id
                        name
                        quantity
                        originalUnitPriceSet {
                          shopMoney {
                            amount
                            currencyCode
                          }
                        }
                        product {
                          id
                        }
                        variant {
                          id
                        }
                      }
                    }
                  }
                  transactions {
                    id
                    amountSet {
                      shopMoney {
                        amount
                        currencyCode
                      }
                    }
                    kind
                    status
                    processedAt
                    gateway
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

  private async downloadAndParse(
    url: string
  ): Promise<{ orders: any[]; lineItems: any[]; transactions: any[] }> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download JSONL: ${response.status}`)
    }

    const text = await response.text()
    const lines = text.trim().split('\n')
    const allRecords = lines.filter((line) => line).map((line) => JSON.parse(line))

    // Separate records by __typename (Shopify Bulk Operations uses this field)
    const orders = allRecords.filter((r) => r.__typename === 'Order' || !r.__typename)
    const lineItems = allRecords.filter((r) => r.__typename === 'LineItem')
    const transactions = allRecords.filter((r) => r.__typename === 'OrderTransaction')

    return { orders, lineItems, transactions }
  }

  private async insertToStaging(
    shopId: string,
    recordsByType: { orders: any[]; lineItems: any[]; transactions: any[] },
    jobType: JobType
  ) {
    // Truncate staging if historical (full refresh)
    if (jobType === JobType.HISTORICAL) {
      const { error: truncateError } = await this.supabase.rpc(
        'truncate_staging_shopify_all'
      )
      if (truncateError) {
        throw new Error(`Failed to truncate staging: ${truncateError.message}`)
      }
    }

    // Insert orders
    if (recordsByType.orders.length > 0) {
      const { error } = await this.supabase.rpc('insert_staging_shopify_orders', {
        p_records: recordsByType.orders,
      })
      if (error) {
        throw new Error(`Failed to insert orders to staging: ${error.message}`)
      }
    }

    // Insert line items
    if (recordsByType.lineItems.length > 0) {
      const { error } = await this.supabase.rpc('insert_staging_shopify_line_items', {
        p_records: recordsByType.lineItems,
      })
      if (error) {
        throw new Error(`Failed to insert line items to staging: ${error.message}`)
      }
    }

    // Insert transactions
    if (recordsByType.transactions.length > 0) {
      const { error } = await this.supabase.rpc('insert_staging_shopify_transactions', {
        p_records: recordsByType.transactions,
      })
      if (error) {
        throw new Error(`Failed to insert transactions to staging: ${error.message}`)
      }
    }
  }

  private async transformToWarehouse(shopId: string, jobType: JobType): Promise<number> {
    let totalSynced = 0

    // Transform orders first (required for foreign keys)
    const { data: orderCount, error: orderError } = await this.supabase.rpc(
      'transform_shopify_orders',
      {
        p_shop_id: shopId,
      }
    )
    if (orderError) {
      throw new Error(`Failed to transform orders: ${orderError.message}`)
    }
    totalSynced += (orderCount as number) || 0
    console.log(`[Shopify] Transformed ${orderCount} orders`)

    // Transform line items (depends on orders)
    const { data: lineItemCount, error: lineItemError } = await this.supabase.rpc(
      'transform_shopify_line_items',
      {
        p_shop_id: shopId,
      }
    )
    if (lineItemError) {
      throw new Error(`Failed to transform line items: ${lineItemError.message}`)
    }
    totalSynced += (lineItemCount as number) || 0
    console.log(`[Shopify] Transformed ${lineItemCount} line items`)

    // Transform transactions (depends on orders)
    const { data: transactionCount, error: transactionError } = await this.supabase.rpc(
      'transform_shopify_transactions',
      {
        p_shop_id: shopId,
      }
    )
    if (transactionError) {
      throw new Error(`Failed to transform transactions: ${transactionError.message}`)
    }
    totalSynced += (transactionCount as number) || 0
    console.log(`[Shopify] Transformed ${transactionCount} transactions`)

    return totalSynced
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
