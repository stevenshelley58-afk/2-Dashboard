// Generated types - update from Supabase dashboard when schema changes
export interface Database {
    public: {
        Tables: {
            [_ in never]: never
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
    }
    core_warehouse: {
        Tables: {
            sync_jobs: {
                Row: {
                    id: string
                    shop_id: string
                    platform: 'SHOPIFY' | 'META'
                    job_type: 'HISTORICAL_INIT' | 'HISTORICAL_REBUILD' | 'INCREMENTAL'
                    status: 'QUEUED' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED'
                    error: Record<string, unknown> | null
                    records_synced: number | null
                    created_at: string
                    started_at: string | null
                    completed_at: string | null
                }
                Insert: Omit<Database['core_warehouse']['Tables']['sync_jobs']['Row'], 'id' | 'created_at'>
                Update: Partial<Omit<Database['core_warehouse']['Tables']['sync_jobs']['Row'], 'id' | 'created_at'>>
            }
            sync_cursors: {
                Row: {
                    id: string
                    shop_id: string
                    platform: 'SHOPIFY' | 'META'
                    watermark: Record<string, unknown> | null
                    last_success_at: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: Omit<Database['core_warehouse']['Tables']['sync_cursors']['Row'], 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Omit<Database['core_warehouse']['Tables']['sync_cursors']['Row'], 'id' | 'created_at' | 'updated_at'>>
            }
            shop_credentials: {
                Row: {
                    id: string
                    shop_id: string
                    platform: 'SHOPIFY' | 'META'
                    access_token: string
                    refresh_token: string | null
                    expires_at: string | null
                    metadata: Record<string, unknown>
                    created_at: string
                    updated_at: string
                }
                Insert: Omit<Database['core_warehouse']['Tables']['shop_credentials']['Row'], 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Omit<Database['core_warehouse']['Tables']['shop_credentials']['Row'], 'id' | 'created_at' | 'updated_at'>>
            }
            orders: {
                Row: {
                    id: number
                    shop_id: string
                    shopify_gid: string
                    order_name: string | null
                    order_number: number | null
                    customer_gid: string | null
                    customer_email: string | null
                    customer_first_name: string | null
                    customer_last_name: string | null
                    financial_status: string | null
                    fulfillment_status: string | null
                    confirmed: boolean | null
                    cancelled_at: string | null
                    cancel_reason: string | null
                    currency: string
                    presentment_currency: string | null
                    subtotal_price: number | null
                    total_price: number | null
                    total_tax: number | null
                    total_discounts: number | null
                    total_shipping: number | null
                    total_tip: number | null
                    total_weight_grams: number | null
                    discount_codes: any | null
                    discount_applications: any | null
                    shipping_lines: any | null
                    tax_lines: any | null
                    billing_name: string | null
                    billing_address1: string | null
                    billing_address2: string | null
                    billing_city: string | null
                    billing_province: string | null
                    billing_country: string | null
                    billing_zip: string | null
                    shipping_name: string | null
                    shipping_address1: string | null
                    shipping_address2: string | null
                    shipping_city: string | null
                    shipping_province: string | null
                    shipping_country: string | null
                    shipping_zip: string | null
                    source_name: string | null
                    referring_site: string | null
                    landing_site: string | null
                    tags: string[] | null
                    note: string | null
                    test: boolean | null
                    processed_at: string | null
                    closed_at: string | null
                    created_at: string
                    updated_at: string
                    raw_order: Record<string, unknown>
                }
                Insert: Omit<Database['core_warehouse']['Tables']['orders']['Row'], 'id'>
                Update: Partial<Omit<Database['core_warehouse']['Tables']['orders']['Row'], 'id'>>
            }
            order_line_items: {
                Row: {
                    id: number
                    shop_id: string
                    shopify_gid: string
                    order_shopify_gid: string
                    product_gid: string | null
                    variant_gid: string | null
                    sku: string | null
                    title: string | null
                    variant_title: string | null
                    vendor: string | null
                    quantity: number
                    price: number | null
                    total_discount: number | null
                    taxable: boolean | null
                    requires_shipping: boolean | null
                    fulfillment_status: string | null
                    properties: any | null
                    discount_allocations: any | null
                    tax_lines: any | null
                    created_at: string | null
                    updated_at: string | null
                    raw_line_item: Record<string, unknown>
                }
                Insert: Omit<Database['core_warehouse']['Tables']['order_line_items']['Row'], 'id'>
                Update: Partial<Omit<Database['core_warehouse']['Tables']['order_line_items']['Row'], 'id'>>
            }
            transactions: {
                Row: {
                    id: number
                    shop_id: string
                    shopify_gid: string
                    order_shopify_gid: string
                    kind: string | null
                    status: string | null
                    gateway: string | null
                    amount: number | null
                    currency: string | null
                    authorization_code: string | null
                    processed_at: string | null
                    test: boolean | null
                    payment_id: string | null
                    error_code: string | null
                    source_name: string | null
                    raw_transaction: Record<string, unknown>
                }
                Insert: Omit<Database['core_warehouse']['Tables']['transactions']['Row'], 'id'>
                Update: Partial<Omit<Database['core_warehouse']['Tables']['transactions']['Row'], 'id'>>
            }
            fact_marketing_daily: {
                Row: {
                    id: number
                    shop_id: string
                    date: string
                    platform: string
                    account_id: string | null
                    account_name: string | null
                    currency: string | null
                    impressions: number | null
                    reach: number | null
                    clicks: number | null
                    inline_link_clicks: number | null
                    unique_clicks: number | null
                    spend: number | null
                    cpc: number | null
                    cpm: number | null
                    ctr: number | null
                    unique_ctr: number | null
                    conversions: number | null
                    purchases: number | null
                    purchase_value: number | null
                    leads: number | null
                    adds_to_cart: number | null
                    view_content: number | null
                    actions: any | null
                    action_values: any | null
                    objective: string | null
                    buying_type: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: Omit<Database['core_warehouse']['Tables']['fact_marketing_daily']['Row'], 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Omit<Database['core_warehouse']['Tables']['fact_marketing_daily']['Row'], 'id' | 'created_at' | 'updated_at'>>
            }
            fact_marketing_campaign_daily: {
                Row: {
                    id: number
                    shop_id: string
                    date: string
                    platform: string
                    account_id: string | null
                    account_name: string | null
                    campaign_id: string | null
                    campaign_name: string | null
                    adset_id: string | null
                    adset_name: string | null
                    ad_id: string | null
                    ad_name: string | null
                    impressions: number | null
                    reach: number | null
                    clicks: number | null
                    inline_link_clicks: number | null
                    spend: number | null
                    cpc: number | null
                    cpm: number | null
                    ctr: number | null
                    conversions: number | null
                    purchases: number | null
                    purchase_value: number | null
                    actions: any | null
                    action_values: any | null
                    objective: string | null
                    buying_type: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: Omit<Database['core_warehouse']['Tables']['fact_marketing_campaign_daily']['Row'], 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Omit<Database['core_warehouse']['Tables']['fact_marketing_campaign_daily']['Row'], 'id' | 'created_at' | 'updated_at'>>
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
    }
    staging_ingest: {
        Tables: {
            shopify_orders_raw: {
                Row: {
                    id: number
                    shop_id: string
                    shopify_gid: string
                    payload: Record<string, unknown>
                    received_at: string
                }
                Insert: Omit<Database['staging_ingest']['Tables']['shopify_orders_raw']['Row'], 'id' | 'received_at'>
                Update: Partial<Omit<Database['staging_ingest']['Tables']['shopify_orders_raw']['Row'], 'id' | 'received_at'>>
            }
            meta_insights_raw: {
                Row: {
                    id: number
                    shop_id: string
                    date_start: string
                    date_stop: string
                    level: string
                    payload: Record<string, unknown>
                    received_at: string
                }
                Insert: Omit<Database['staging_ingest']['Tables']['meta_insights_raw']['Row'], 'id' | 'received_at'>
                Update: Partial<Omit<Database['staging_ingest']['Tables']['meta_insights_raw']['Row'], 'id' | 'received_at'>>
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
    }
}
