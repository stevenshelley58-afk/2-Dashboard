import { JobType } from '@dashboard/config'
import { SupabaseClient } from '@supabase/supabase-js'

interface ShopifyConfig {
  accessToken: string
  shopDomain: string
  apiVersion: string
}

type BulkRecord = Record<string, unknown> & {
  __typename?: string
  id?: string
  updatedAt?: string
  createdAt?: string
}

interface ShopifyBulkCollections {
  orders: BulkRecord[]
  lineItems: BulkRecord[]
  transactions: BulkRecord[]
}

interface ShopifySyncStats {
  orders: number
  lineItems: number
  transactions: number
  payouts: number
}

const INCREMENTAL_LOOKBACK_DAYS = 7

export class ShopifyClient {
  private readonly ordersConnectionPageSize = 250

  constructor(private readonly config: ShopifyConfig, private readonly supabase: SupabaseClient) {}

  async sync(shopId: string, jobType: JobType): Promise<number> {
    console.log(`[Shopify] Starting ${jobType} sync for shop ${shopId}`)

    if (jobType === JobType.HISTORICAL) {
      await this.truncateStagingForHistorical()
    }

    const previousCursor = await this.getExistingCursor(shopId)
    const orderQuery = this.buildOrdersBulkQuery(jobType, previousCursor)

    console.log('[Shopify] Launching orders bulk operation…')
    const ordersDownloadUrl = await this.runBulkOperation(orderQuery)
    const collections = ordersDownloadUrl ? await this.downloadOrders(ordersDownloadUrl) : this.createEmptyCollections()

    console.log(
      `[Shopify] Orders bulk download complete. Orders=${collections.orders.length}, LineItems=${collections.lineItems.length}, Transactions=${collections.transactions.length}`
    )

    await this.insertOrdersToStaging(collections)

    const latestOrderUpdatedAt = this.computeLatestOrderUpdatedAt(collections.orders)

    console.log('[Shopify] Launching payouts bulk operation…')
    const payoutsQuery = this.buildPayoutsBulkQuery()
    const payoutsDownloadUrl = await this.runBulkOperation(payoutsQuery)
    const payouts = payoutsDownloadUrl ? await this.downloadPayouts(payoutsDownloadUrl) : []
    console.log(`[Shopify] Payouts bulk download complete. Payouts=${payouts.length}`)

    if (payouts.length > 0) {
      await this.insertPayoutsToStaging(payouts)
    } else if (jobType === JobType.HISTORICAL) {
      // Ensure staging is empty when no payouts were returned for a historical run
      await this.clearPayoutStaging()
    }

    const stats = await this.transformToWarehouse(shopId)
    console.log(
      `[Shopify] Transform complete → orders=${stats.orders}, line_items=${stats.lineItems}, transactions=${stats.transactions}, payouts=${stats.payouts}`
    )

    await this.updateCursor(shopId, latestOrderUpdatedAt)

    const totalSynced = stats.orders + stats.lineItems + stats.transactions + stats.payouts
    console.log(`[Shopify] ${jobType} sync finished. Total records synced: ${totalSynced}`)

    return totalSynced
  }

  private async runBulkOperation(query: string): Promise<string | null> {
    const bulkOpId = await this.initiateBulkOperation(query)
    return this.pollBulkOperation(bulkOpId)
  }

  private async initiateBulkOperation(query: string): Promise<string> {
    const response = await fetch(this.graphqlEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.config.accessToken,
      },
      body: JSON.stringify({ query }),
    })

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

  private async pollBulkOperation(bulkOpId: string): Promise<string | null> {
    const query = `
      query {
        node(id: "${bulkOpId}") {
          ... on BulkOperation {
            id
            status
            errorCode
            url
            objectCount
            fileSize
          }
        }
      }
    `

    const maxAttempts = 120
    let attempts = 0

    while (attempts < maxAttempts) {
      const response = await fetch(this.graphqlEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.config.accessToken,
        },
        body: JSON.stringify({ query }),
      })

      const data = (await response.json()) as any
      const bulkOp = data.data?.node

      if (!bulkOp) {
        throw new Error('Bulk operation not found')
      }

      console.log(`[Shopify] Bulk operation ${bulkOp.id} status: ${bulkOp.status}`)

      if (bulkOp.status === 'COMPLETED') {
        const objectCount = Number(bulkOp.objectCount ?? 0)
        if (!bulkOp.url) {
          console.log('[Shopify] Bulk operation completed with zero records.')
          return null
        }

        if (objectCount === 0) {
          console.log('[Shopify] Bulk operation returned zero rows.')
          return null
        }

        return bulkOp.url as string
      }

      if (bulkOp.status === 'FAILED' || bulkOp.status === 'CANCELED') {
        throw new Error(`Bulk operation ${bulkOp.status}: ${bulkOp.errorCode ?? 'UNKNOWN_ERROR'}`)
      }

      await this.sleep(5000)
      attempts++
    }

    throw new Error('Bulk operation timed out')
  }

  private buildOrdersBulkQuery(jobType: JobType, existingCursor: string | null): string {
    let sinceIso: string | null = null

    if (jobType === JobType.INCREMENTAL) {
      if (existingCursor) {
        const cursorDate = new Date(existingCursor)
        if (!Number.isNaN(cursorDate.getTime())) {
          sinceIso = cursorDate.toISOString()
        }
      }

      if (!sinceIso) {
        const fallback = new Date()
        fallback.setDate(fallback.getDate() - INCREMENTAL_LOOKBACK_DAYS)
        sinceIso = fallback.toISOString()
      }
    }

    const connectionArgs = [`first: ${this.ordersConnectionPageSize}`]
    if (sinceIso) {
      connectionArgs.push(`query: "updated_at:>=${sinceIso}"`)
    }

    const connectionDirective = `(${connectionArgs.join(', ')})`

    return `
      mutation {
        bulkOperationRunQuery(
          query: """
          {
            orders${connectionDirective} {
              edges {
                node {
                  __typename
                  id
                  name
                  email
                  customerLocale
                  createdAt
                  updatedAt
                  processedAt
                  closedAt
                  cancelledAt
                  currencyCode
                  totalWeight
                  totalQuantity
                  financialStatus
                  displayFinancialStatus
                  fulfillmentStatus
                  displayFulfillmentStatus
                  tags
                  note
                  test
                  totalPriceSet {
                    shopMoney { amount currencyCode }
                    presentmentMoney { amount currencyCode }
                  }
                  currentTotalPriceSet {
                    shopMoney { amount currencyCode }
                  }
                  subtotalPriceSet { shopMoney { amount currencyCode } }
                  totalTaxSet { shopMoney { amount currencyCode } }
                  totalShippingPriceSet { shopMoney { amount currencyCode } }
                  totalDiscountsSet { shopMoney { amount currencyCode } }
                  customer {
                    __typename
                    id
                    email
                    firstName
                    lastName
                    phone
                    createdAt
                    tags
                  }
                  shippingAddress {
                    firstName
                    lastName
                    address1
                    address2
                    city
                    province
                    provinceCode
                    zip
                    country
                    countryCode
                  }
                  billingAddress {
                    firstName
                    lastName
                    address1
                    address2
                    city
                    province
                    provinceCode
                    zip
                    country
                    countryCode
                  }
                  lineItems(first: 250) {
                    edges {
                      node {
                        __typename
                        id
                        sku
                        name
                        title
                        vendor
                        quantity
                        currentQuantity
                        fulfillableQuantity
                        refundableQuantity
                        requiresShipping
                        taxable
                        discountedTotalSet { shopMoney { amount currencyCode } }
                        originalTotalSet { shopMoney { amount currencyCode } }
                        originalUnitPriceSet { shopMoney { amount currencyCode } }
                        priceSet { shopMoney { amount currencyCode } }
                        totalDiscountSet { shopMoney { amount currencyCode } }
                        createdAt
                        updatedAt
                        variant {
                          id
                          sku
                          title
                          price
                          barcode
                        }
                        product {
                          id
                          title
                          handle
                          status
                        }
                      }
                    }
                  }
                  transactions {
                    __typename
                    id
                    amount
                    amountSet { shopMoney { amount currencyCode } }
                    kind
                    status
                    createdAt
                    processedAt
                    gateway
                    paymentId
                    authorizationCode
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
  }

  private buildPayoutsBulkQuery(): string {
    return `
      mutation {
        bulkOperationRunQuery(
          query: """
          {
            payouts {
              edges {
                node {
                  __typename
                  id
                  status
                  date
                  issuedAt
                  scheduledAt
                  payoutType
                  currencyCode
                  payoutCurrency
                  summary {
                    adjustmentFeesSet { shopMoney { amount currencyCode } }
                    chargesFeeSet { shopMoney { amount currencyCode } }
                    refundsFeeSet { shopMoney { amount currencyCode } }
                    reserveHeldSet { shopMoney { amount currencyCode } }
                    reserveReleasedSet { shopMoney { amount currencyCode } }
                    totalFeesSet { shopMoney { amount currencyCode } }
                    totalGrossAmountSet { shopMoney { amount currencyCode } }
                    totalNetAmountSet { shopMoney { amount currencyCode } }
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
  }

  private async downloadOrders(url: string): Promise<ShopifyBulkCollections> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download orders JSONL: ${response.status}`)
    }

    const text = await response.text()
    const collections = this.createEmptyCollections()

    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim()
      if (!line) continue

      const record = JSON.parse(line) as BulkRecord
      const type = record.__typename

      switch (type) {
        case 'Order':
          collections.orders.push(record)
          break
        case 'OrderLineItem':
        case 'LineItem':
          collections.lineItems.push(record)
          break
        case 'OrderTransaction':
          collections.transactions.push(record)
          break
        default:
          break
      }
    }

    return collections
  }

  private async downloadPayouts(url: string): Promise<BulkRecord[]> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download payouts JSONL: ${response.status}`)
    }

    const text = await response.text()
    const payouts: BulkRecord[] = []

    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim()
      if (!line) continue

      const record = JSON.parse(line) as BulkRecord
      if (record.__typename === 'Payout') {
        payouts.push(record)
      }
    }

    return payouts
  }

  private createEmptyCollections(): ShopifyBulkCollections {
    return {
      orders: [],
      lineItems: [],
      transactions: [],
    }
  }

  private async insertOrdersToStaging(collections: ShopifyBulkCollections): Promise<void> {
    await this.insertIfNotEmpty('insert_staging_shopify_orders', collections.orders)
    await this.insertIfNotEmpty('insert_staging_shopify_line_items', collections.lineItems)
    await this.insertIfNotEmpty('insert_staging_shopify_transactions', collections.transactions)
  }

  private async insertPayoutsToStaging(payouts: BulkRecord[]): Promise<void> {
    await this.insertIfNotEmpty('insert_staging_shopify_payouts', payouts)
  }

  private async insertIfNotEmpty(functionName: string, payload: BulkRecord[]): Promise<void> {
    if (payload.length === 0) {
      return
    }

    const { error } = await this.supabase.rpc(functionName, {
      p_records: payload,
    })

    if (error) {
      throw new Error(`Failed to execute ${functionName}: ${error.message}`)
    }
  }

  private async clearPayoutStaging(): Promise<void> {
    const { error } = await this.supabase.rpc('truncate_staging_shopify_payouts')
    if (error) {
      throw new Error(`Failed to truncate payout staging: ${error.message}`)
    }
  }

  private async transformToWarehouse(shopId: string): Promise<ShopifySyncStats> {
    const stats: ShopifySyncStats = {
      orders: 0,
      lineItems: 0,
      transactions: 0,
      payouts: 0,
    }

    const transformCalls: Array<{
      fn: string
      key: keyof ShopifySyncStats
    }> = [
      { fn: 'transform_shopify_orders', key: 'orders' },
      { fn: 'transform_shopify_line_items', key: 'lineItems' },
      { fn: 'transform_shopify_transactions', key: 'transactions' },
      { fn: 'transform_shopify_payouts', key: 'payouts' },
    ]

    for (const call of transformCalls) {
      const { data, error } = await this.supabase.rpc(call.fn, {
        p_shop_id: shopId,
      })

      if (error) {
        throw new Error(`Failed to execute ${call.fn}: ${error.message}`)
      }

      stats[call.key] = Number(data ?? 0)
    }

    return stats
  }

  private async truncateStagingForHistorical(): Promise<void> {
    const truncates = [
      'truncate_staging_shopify_orders',
      'truncate_staging_shopify_line_items',
      'truncate_staging_shopify_transactions',
      'truncate_staging_shopify_payouts',
    ]

    for (const fn of truncates) {
      const { error } = await this.supabase.rpc(fn)
      if (error) {
        throw new Error(`Failed to execute ${fn}: ${error.message}`)
      }
    }
  }

  private computeLatestOrderUpdatedAt(orders: BulkRecord[]): string | null {
    let latest: string | null = null
    for (const order of orders) {
      const updatedAt = typeof order.updatedAt === 'string' ? order.updatedAt : null
      if (!updatedAt) continue
      if (!latest || updatedAt > latest) {
        latest = updatedAt
      }
    }
    return latest
  }

  private async updateCursor(shopId: string, latestUpdatedAt: string | null): Promise<void> {
    if (!latestUpdatedAt) {
      console.log('[Shopify] No updatedAt watermark found; skipping cursor update.')
      return
    }

    const { error } = await this.supabase.rpc('update_shopify_cursor', {
      p_shop_id: shopId,
      p_latest_updated_at: latestUpdatedAt,
    })

    if (error) {
      throw new Error(`Failed to update Shopify cursor: ${error.message}`)
    }
  }

  private async getExistingCursor(shopId: string): Promise<string | null> {
    const { data, error } = await this.supabase.rpc('get_sync_cursor', {
      p_shop_id: shopId,
      p_platform: 'SHOPIFY',
    })

    if (error) {
      console.warn('[Shopify] Failed to read cursor:', error)
      return null
    }

    if (!data) {
      return null
    }

    try {
      const cursor = data as {
        last_synced_date?: string
        watermark?: Record<string, unknown>
      }

      const watermarkValue = cursor?.watermark?.['orders_updated_at']
      if (typeof watermarkValue === 'string') {
        return watermarkValue
      }

      if (typeof cursor?.last_synced_date === 'string') {
        return new Date(cursor.last_synced_date).toISOString()
      }
    } catch (err) {
      console.warn('[Shopify] Unable to parse existing cursor payload:', err)
    }

    return null
  }

  private graphqlEndpoint(): string {
    return `https://${this.config.shopDomain}/admin/api/${this.config.apiVersion}/graphql.json`
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
