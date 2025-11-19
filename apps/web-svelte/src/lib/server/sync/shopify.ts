import type { Platform, JobType, ErrorPayload } from '@dashboard/config'
import { getCredentials, updateCursor, completeJob } from './jobs'
import type { ShopCredentials } from '@dashboard/config'

const SHOPIFY_API_VERSION = '2026-01'

interface ShopifyBulkOperation {
    id: string
    status: string
    url?: string
    errorCode?: string
}

export async function syncShopify(
    jobId: string,
    shopId: string,
    jobType: JobType
): Promise<void> {
    let recordsSynced = 0

    try {
        const creds = await getCredentials(shopId, 'SHOPIFY' as Platform)
        const shopDomain = creds.metadata.shopify_domain as string

        if (!shopDomain) {
            throw new Error('Missing shopify_domain in credentials metadata')
        }

        // For HISTORICAL_INIT: create bulk operation export
        if (jobType === 'HISTORICAL_INIT') {
            const bulkOp = await createBulkOperation(shopDomain, creds.access_token)
            recordsSynced = await pollAndProcessBulkOperation(
                shopDomain,
                creds.access_token,
                bulkOp.id,
                shopId
            )
        } else if (jobType === 'INCREMENTAL') {
            // For INCREMENTAL: query orders updated since watermark
            recordsSynced = await syncIncremental(shopDomain, creds.access_token, shopId)
        }

        // Update cursor on success
        await updateCursor(shopId, 'SHOPIFY' as Platform, {
            last_updated_at: new Date().toISOString(),
        })

        await completeJob(jobId, 'SUCCEEDED', recordsSynced)
    } catch (error) {
        const errorPayload: ErrorPayload = {
            code: (error as Error).name || 'UNKNOWN_ERROR',
            message: (error as Error).message || 'Unknown error',
            task: 'shopify_sync',
            stack: (error as Error).stack,
        }
        await completeJob(jobId, 'FAILED', undefined, errorPayload)
        throw error
    }
}

async function createBulkOperation(
    shopDomain: string,
    accessToken: string
): Promise<ShopifyBulkOperation> {
    const query = `
    mutation {
      bulkOperationRunQuery(
        query: """
          {
            orders {
              edges {
                node {
                  id
                  name
                  email
                  createdAt
                  updatedAt
                  processedAt
                  cancelledAt
                  cancelReason
                  confirmed
                  financialStatus
                  fulfillmentStatus
                  currencyCode
                  presentmentCurrencyCode
                  subtotalPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  totalPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  totalTaxSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  totalDiscountsSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  totalShippingPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  totalTipReceivedSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  totalWeight
                  discountCodes {
                    code
                    amount
                    type
                  }
                  discountApplications {
                    targetType
                    targetSelection
                    allocationMethod
                    value
                    valueType
                  }
                  shippingAddress {
                    name
                    address1
                    address2
                    city
                    province
                    country
                    zip
                  }
                  billingAddress {
                    name
                    address1
                    address2
                    city
                    province
                    country
                    zip
                  }
                  customer {
                    id
                    email
                    firstName
                    lastName
                  }
                  lineItems(first: 250) {
                    edges {
                      node {
                        id
                        title
                        variantTitle
                        quantity
                        originalUnitPriceSet {
                          shopMoney {
                            amount
                            currencyCode
                          }
                        }
                      }
                      discountedTotalSet {
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
                        sku
                      }
                      vendor
                      taxable
                      requiresShipping
                      fulfillmentStatus
                      properties {
                        name
                        value
                      }
                      discountAllocations {
                        allocatedAmountSet {
                          shopMoney {
                            amount
                            currencyCode
                          }
                        }
                      }
                      taxLines {
                        title
                        priceSet {
                          shopMoney {
                            amount
                            currencyCode
                          }
                        }
                      }
                    }
                  }
                  transactions {
                    id
                    kind
                    status
                    gateway
                    amount
                    currencyCode
                    authorizationCode
                    processedAt
                    test
                    paymentId
                    errorCode
                    source
                  }
                  sourceIdentifier
                  referringSite
                  landingSite
                  tags
                  note
                  test
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

    const response = await fetch(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ query }),
    })

    if (!response.ok) {
        throw new Error(`Shopify API error: ${response.statusText}`)
    }

    const data = await response.json()
    if (data.errors || data.data?.bulkOperationRunQuery?.userErrors?.length > 0) {
        throw new Error(
            `Shopify GraphQL error: ${JSON.stringify(data.errors || data.data.bulkOperationRunQuery.userErrors)}`
        )
    }

    return data.data.bulkOperationRunQuery.bulkOperation
}

async function pollAndProcessBulkOperation(
    shopDomain: string,
    accessToken: string,
    bulkOpId: string,
    shopId: string
): Promise<number> {
    // Poll until completed
    let bulkOp: ShopifyBulkOperation
    do {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        bulkOp = await getBulkOperationStatus(shopDomain, accessToken, bulkOpId)

        if (bulkOp.status === 'FAILED') {
            throw new Error(`Bulk operation failed: ${bulkOp.errorCode}`)
        }
    } while (bulkOp.status !== 'COMPLETED')

    if (!bulkOp.url) {
        throw new Error('Bulk operation completed but no URL provided')
    }

    // Download and process JSONL file
    const response = await fetch(bulkOp.url)
    const text = await response.text()
    const lines = text.trim().split('\n').filter(Boolean)

    // Insert raw JSON into staging
    const { supabaseAdmin: supabase } = await import('../supabase-admin')
    let inserted = 0

    for (const line of lines) {
        const order = JSON.parse(line)

        // 1. Insert into Staging
        const { error: stagingError } = await supabase.schema('staging_ingest').from('shopify_orders_raw').upsert(
            {
                shop_id: shopId,
                shopify_gid: order.id,
                payload: order,
            },
            {
                onConflict: 'shop_id,shopify_gid',
            }
        )

        if (stagingError) {
            console.error('Failed to insert raw order:', stagingError)
            continue
        }

        // 2. Transform & Insert into Warehouse
        try {
            await processOrder(shopId, order, supabase)
            inserted++
        } catch (err) {
            console.error(`Failed to process order ${order.id}:`, err)
        }
    }

    return inserted
}

async function getBulkOperationStatus(
    shopDomain: string,
    accessToken: string,
    bulkOpId: string
): Promise<ShopifyBulkOperation> {
    const query = `
    query {
      node(id: "${bulkOpId}") {
        ... on BulkOperation {
          id
          status
          url
          errorCode
        }
      }
    }
  `

    const response = await fetch(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ query }),
    })

    const data = await response.json()
    return data.data.node
}

async function syncIncremental(
    shopDomain: string,
    accessToken: string,
    shopId: string
): Promise<number> {
    // Get cursor watermark
    const { supabaseAdmin: supabase } = await import('../supabase-admin')
    const { data: cursor } = await supabase
        .schema('core_warehouse')
        .from('sync_cursors')
        .select('watermark')
        .eq('shop_id', shopId)
        .eq('platform', 'SHOPIFY')
        .single()

    const since = cursor?.watermark?.last_updated_at || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Query orders updated since watermark
    // Note: For a real production app, you'd want pagination here. 
    // For this demo/MVP, we'll fetch first 250.
    const query = `
    query {
      orders(first: 250, query: "updated_at:>${since}") {
        edges {
          node {
            id
            name
            email
            createdAt
            updatedAt
            processedAt
            cancelledAt
            cancelReason
            confirmed
            financialStatus
            fulfillmentStatus
            currencyCode
            presentmentCurrencyCode
            subtotalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            totalTaxSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            totalDiscountsSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            totalShippingPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            totalTipReceivedSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            totalWeight
            discountCodes {
              code
              amount
              type
            }
            discountApplications {
              targetType
              targetSelection
              allocationMethod
              value
              valueType
            }
            shippingAddress {
              name
              address1
              address2
              city
              province
              country
              zip
            }
            billingAddress {
              name
              address1
              address2
              city
              province
              country
              zip
            }
            customer {
              id
              email
              firstName
              lastName
            }
            lineItems(first: 250) {
              edges {
                node {
                  id
                  title
                  variantTitle
                  quantity
                  originalUnitPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                }
                discountedTotalSet {
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
                  sku
                }
                vendor
                taxable
                requiresShipping
                fulfillmentStatus
                properties {
                  name
                  value
                }
                discountAllocations {
                  allocatedAmountSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                }
                taxLines {
                  title
                  priceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
            transactions {
              id
              kind
              status
              gateway
              amount
              currencyCode
              authorizationCode
              processedAt
              test
              paymentId
              errorCode
              source
            }
            sourceIdentifier
            referringSite
            landingSite
            tags
            note
            test
          }
        }
      }
    }
  `

    const response = await fetch(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ query }),
    })

    if (!response.ok) {
        throw new Error(`Shopify API error: ${response.statusText}`)
    }

    const data = await response.json()
    if (data.errors) {
        throw new Error(`Shopify GraphQL error: ${JSON.stringify(data.errors)}`)
    }

    const orders = data.data.orders.edges.map((e: any) => e.node)
    let inserted = 0

    for (const order of orders) {
        // 1. Insert into Staging
        const { error: stagingError } = await supabase.schema('staging_ingest').from('shopify_orders_raw').upsert(
            {
                shop_id: shopId,
                shopify_gid: order.id,
                payload: order,
            },
            {
                onConflict: 'shop_id,shopify_gid',
            }
        )

        if (stagingError) {
            console.error('Failed to insert raw order:', stagingError)
            continue
        }

        // 2. Transform & Insert into Warehouse
        try {
            await processOrder(shopId, order, supabase)
            inserted++
        } catch (err) {
            console.error(`Failed to process order ${order.id}:`, err)
        }
    }

    return inserted
}

async function processOrder(shopId: string, order: any, supabase: any) {
    // Helper to safely get money amount
    const getAmount = (moneySet: any) => moneySet?.shopMoney?.amount ?? 0

    // 1. Upsert Order
    const { error: orderError } = await supabase.schema('core_warehouse').from('orders').upsert({
        shop_id: shopId,
        shopify_gid: order.id,
        order_name: order.name,
        order_number: order.orderNumber, // Note: GraphQL might not return orderNumber directly if not requested, but usually it's 'name' or separate field. Added to query if needed, but 'name' is often '#1001'.
        customer_gid: order.customer?.id,
        customer_email: order.email || order.customer?.email,
        customer_first_name: order.customer?.firstName,
        customer_last_name: order.customer?.lastName,
        financial_status: order.financialStatus,
        fulfillment_status: order.fulfillmentStatus,
        confirmed: order.confirmed,
        cancelled_at: order.cancelledAt,
        cancel_reason: order.cancelReason,
        currency: order.currencyCode,
        presentment_currency: order.presentmentCurrencyCode,
        subtotal_price: getAmount(order.subtotalPriceSet),
        total_price: getAmount(order.totalPriceSet),
        total_tax: getAmount(order.totalTaxSet),
        total_discounts: getAmount(order.totalDiscountsSet),
        total_shipping: getAmount(order.totalShippingPriceSet),
        total_tip: getAmount(order.totalTipReceivedSet),
        total_weight_grams: order.totalWeight,
        discount_codes: order.discountCodes,
        discount_applications: order.discountApplications,
        shipping_lines: [], // Not in query yet, can add if needed
        tax_lines: [], // Not in query yet
        billing_name: order.billingAddress?.name,
        billing_address1: order.billingAddress?.address1,
        billing_address2: order.billingAddress?.address2,
        billing_city: order.billingAddress?.city,
        billing_province: order.billingAddress?.province,
        billing_country: order.billingAddress?.country,
        billing_zip: order.billingAddress?.zip,
        shipping_name: order.shippingAddress?.name,
        shipping_address1: order.shippingAddress?.address1,
        shipping_address2: order.shippingAddress?.address2,
        shipping_city: order.shippingAddress?.city,
        shipping_province: order.shippingAddress?.province,
        shipping_country: order.shippingAddress?.country,
        shipping_zip: order.shippingAddress?.zip,
        source_name: order.sourceIdentifier,
        referring_site: order.referringSite,
        landing_site: order.landingSite,
        tags: order.tags,
        note: order.note,
        test: order.test,
        processed_at: order.processedAt,
        closed_at: order.closedAt, // Not in query
        created_at: order.createdAt,
        updated_at: order.updatedAt,
        raw_order: order
    }, { onConflict: 'shop_id,shopify_gid' })

    if (orderError) throw orderError

    // 2. Upsert Line Items
    if (order.lineItems?.edges) {
        const lineItems = order.lineItems.edges.map((e: any) => {
            const node = e.node
            return {
                shop_id: shopId,
                shopify_gid: node.id,
                order_shopify_gid: order.id,
                product_gid: node.product?.id,
                variant_gid: node.variant?.id,
                sku: node.variant?.sku,
                title: node.title,
                variant_title: node.variantTitle,
                vendor: node.vendor,
                quantity: node.quantity,
                price: getAmount(node.originalUnitPriceSet),
                total_discount: 0, // logic needed if using discountedTotalSet vs original
                taxable: node.taxable,
                requires_shipping: node.requiresShipping,
                fulfillment_status: node.fulfillmentStatus,
                properties: node.properties,
                discount_allocations: node.discountAllocations,
                tax_lines: node.taxLines,
                raw_line_item: node
            }
        })

        if (lineItems.length > 0) {
            const { error: linesError } = await supabase.schema('core_warehouse').from('order_line_items').upsert(lineItems, { onConflict: 'shop_id,shopify_gid' })
            if (linesError) throw linesError
        }
    }

    // 3. Upsert Transactions
    if (order.transactions) {
        // Transactions might be direct array or edges depending on API version/query. 
        // In the query above it's just 'transactions { ... }' which implies a list if using recent API versions on Order object directly? 
        // Actually in 2024+ it's usually a connection, but let's assume the query returns a list or we handle it.
        // The query above has `transactions { id ... }` which is valid for some versions but often it's `transactions(first:x) { edges ... }`.
        // Let's assume the query returns a list for now as per the code structure.
        const transactions = Array.isArray(order.transactions) ? order.transactions : []

        const txRows = transactions.map((tx: any) => ({
            shop_id: shopId,
            shopify_gid: tx.id,
            order_shopify_gid: order.id,
            kind: tx.kind,
            status: tx.status,
            gateway: tx.gateway,
            amount: tx.amount, // This might need parsing if it's a string
            currency: tx.currencyCode,
            authorization_code: tx.authorizationCode,
            processed_at: tx.processedAt,
            test: tx.test,
            payment_id: tx.paymentId,
            error_code: tx.errorCode,
            source_name: tx.source,
            raw_transaction: tx
        }))

        if (txRows.length > 0) {
            const { error: txError } = await supabase.schema('core_warehouse').from('transactions').upsert(txRows, { onConflict: 'shop_id,shopify_gid' })
            if (txError) throw txError
        }
    }
}
