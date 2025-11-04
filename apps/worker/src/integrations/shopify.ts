import { JobType } from '@dashboard/config'
import pg from 'pg'

const { Pool } = pg

interface ShopifyConfig {
  accessToken: string
  shopDomain: string
  apiVersion: string
}

export class ShopifyClient {
  private config: ShopifyConfig
  private pool: pg.Pool

  constructor(config: ShopifyConfig, pool: pg.Pool) {
    this.config = config
    this.pool = pool
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

    const client = await this.pool.connect()
    try {
      // Truncate staging if historical (full refresh)
      if (jobType === JobType.HISTORICAL) {
        await client.query('TRUNCATE staging_ingest.shopify_orders_raw')
      }

      // Batch insert
      for (const record of records) {
        await client.query(
          'INSERT INTO staging_ingest.shopify_orders_raw (raw_data) VALUES ($1)',
          [record]
        )
      }
    } finally {
      client.release()
    }
  }

  private async transformToWarehouse(shopId: string, jobType: JobType): Promise<number> {
    const client = await this.pool.connect()
    try {
      const result = await client.query(
        `INSERT INTO core_warehouse.orders (shop_id, shopify_gid, order_number, total_price, currency, created_at, updated_at)
         SELECT
           $1 as shop_id,
           raw_data->>'id' as shopify_gid,
           raw_data->>'name' as order_number,
           (raw_data->'totalPriceSet'->'shopMoney'->>'amount')::numeric as total_price,
           raw_data->'totalPriceSet'->'shopMoney'->>'currencyCode' as currency,
           (raw_data->>'createdAt')::timestamptz as created_at,
           (raw_data->>'updatedAt')::timestamptz as updated_at
         FROM staging_ingest.shopify_orders_raw
         ON CONFLICT (shop_id, shopify_gid)
         DO UPDATE SET
           order_number = EXCLUDED.order_number,
           total_price = EXCLUDED.total_price,
           currency = EXCLUDED.currency,
           updated_at = EXCLUDED.updated_at`,
        [shopId]
      )
      return result.rowCount ?? 0
    } finally {
      client.release()
    }
  }

  private async updateCursor(shopId: string) {
    const client = await this.pool.connect()
    try {
      await client.query(
        `INSERT INTO core_warehouse.sync_cursors (shop_id, platform, last_success_at)
         VALUES ($1, 'SHOPIFY', now())
         ON CONFLICT (shop_id, platform)
         DO UPDATE SET last_success_at = now()`,
        [shopId]
      )
    } finally {
      client.release()
    }
  }
}
