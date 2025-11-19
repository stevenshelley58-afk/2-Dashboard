begin;

create extension if not exists "uuid-ossp";

-- =========================
-- USERS & SHOPS (app layer)
-- =========================

create table app_dashboard.users (
    id uuid primary key references auth.users (id) on delete cascade,
    email text not null,
    name text,
    role text not null default 'AGENCY_OWNER',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table core_warehouse.shops (
    id text primary key,
    name text not null,
    shopify_domain text not null unique,
    currency text not null,
    timezone text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table app_dashboard.user_shops (
    user_id uuid not null references app_dashboard.users (id) on delete cascade,
    shop_id text not null references core_warehouse.shops (id) on delete cascade,
    is_default boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, shop_id)
);

-- =========================
-- CREDENTIALS & SYNC TABLES
-- =========================

create table core_warehouse.shop_credentials (
    id uuid primary key default gen_random_uuid(),
    shop_id text not null references core_warehouse.shops (id) on delete cascade,
    platform text not null check (platform in ('SHOPIFY', 'META')),
    access_token text not null,
    refresh_token text,
    expires_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (shop_id, platform)
);

create table core_warehouse.sync_jobs (
    id uuid primary key default gen_random_uuid(),
    shop_id text not null references core_warehouse.shops (id) on delete cascade,
    platform text not null check (platform in ('SHOPIFY', 'META')),
    job_type text not null check (job_type in ('HISTORICAL_INIT', 'HISTORICAL_REBUILD', 'INCREMENTAL')),
    status text not null check (status in ('QUEUED', 'IN_PROGRESS', 'SUCCEEDED', 'FAILED')),
    error jsonb,
    records_synced integer,
    created_at timestamptz not null default now(),
    started_at timestamptz,
    completed_at timestamptz
);

create unique index idx_sync_jobs_one_inflight
    on core_warehouse.sync_jobs (shop_id, platform)
    where status in ('QUEUED', 'IN_PROGRESS');

create table core_warehouse.sync_cursors (
    id uuid primary key default gen_random_uuid(),
    shop_id text not null references core_warehouse.shops (id) on delete cascade,
    platform text not null check (platform in ('SHOPIFY', 'META')),
    watermark jsonb,
    last_success_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (shop_id, platform)
);

-- ==============
-- STAGING TABLES
-- ==============

create table staging_ingest.shopify_orders_raw (
    id bigserial primary key,
    shop_id text not null,
    shopify_gid text not null,
    payload jsonb not null,
    received_at timestamptz not null default now()
);

create unique index idx_shopify_orders_raw_gid on staging_ingest.shopify_orders_raw (shop_id, shopify_gid);

create table staging_ingest.meta_insights_raw (
    id bigserial primary key,
    shop_id text not null,
    date_start date not null,
    date_stop date not null,
    level text not null,
    payload jsonb not null,
    received_at timestamptz not null default now()
);

create index idx_meta_insights_raw_shop_date on staging_ingest.meta_insights_raw (shop_id, date_start);

-- =================
-- SHOPIFY WAREHOUSE
-- =================

create table core_warehouse.orders (
    id bigserial primary key,
    shop_id text not null references core_warehouse.shops (id) on delete cascade,
    shopify_gid text not null,
    order_name text,
    order_number bigint,
    customer_gid text,
    customer_email text,
    customer_first_name text,
    customer_last_name text,
    financial_status text,
    fulfillment_status text,
    confirmed boolean,
    cancelled_at timestamptz,
    cancel_reason text,
    currency text not null,
    presentment_currency text,
    subtotal_price numeric(18, 2),
    total_price numeric(18, 2),
    total_tax numeric(18, 2),
    total_discounts numeric(18, 2),
    total_shipping numeric(18, 2),
    total_tip numeric(18, 2),
    total_weight_grams numeric(18, 3),
    discount_codes jsonb,
    discount_applications jsonb,
    shipping_lines jsonb,
    tax_lines jsonb,
    billing_name text,
    billing_address1 text,
    billing_address2 text,
    billing_city text,
    billing_province text,
    billing_country text,
    billing_zip text,
    shipping_name text,
    shipping_address1 text,
    shipping_address2 text,
    shipping_city text,
    shipping_province text,
    shipping_country text,
    shipping_zip text,
    source_name text,
    referring_site text,
    landing_site text,
    tags text[],
    note text,
    test boolean,
    processed_at timestamptz,
    closed_at timestamptz,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    raw_order jsonb not null default '{}'::jsonb,
    unique (shop_id, shopify_gid)
);

create index idx_orders_shop_created on core_warehouse.orders (shop_id, created_at);
create index idx_orders_shop_updated on core_warehouse.orders (shop_id, updated_at);

create table core_warehouse.order_line_items (
    id bigserial primary key,
    shop_id text not null references core_warehouse.shops (id) on delete cascade,
    shopify_gid text not null,
    order_shopify_gid text not null,
    product_gid text,
    variant_gid text,
    sku text,
    title text,
    variant_title text,
    vendor text,
    quantity integer not null,
    price numeric(18, 2),
    total_discount numeric(18, 2),
    taxable boolean,
    requires_shipping boolean,
    fulfillment_status text,
    properties jsonb,
    discount_allocations jsonb,
    tax_lines jsonb,
    created_at timestamptz,
    updated_at timestamptz,
    raw_line_item jsonb not null default '{}'::jsonb,
    unique (shop_id, shopify_gid)
);

create index idx_line_items_order on core_warehouse.order_line_items (shop_id, order_shopify_gid);

create table core_warehouse.transactions (
    id bigserial primary key,
    shop_id text not null references core_warehouse.shops (id) on delete cascade,
    shopify_gid text not null,
    order_shopify_gid text not null,
    kind text,
    status text,
    gateway text,
    amount numeric(18, 2),
    currency text,
    authorization_code text,
    processed_at timestamptz,
    test boolean,
    payment_id text,
    error_code text,
    source_name text,
    raw_transaction jsonb not null default '{}'::jsonb,
    unique (shop_id, shopify_gid)
);

create index idx_transactions_order on core_warehouse.transactions (shop_id, order_shopify_gid);

-- ===============
-- META WAREHOUSE
-- ===============

create table core_warehouse.fact_marketing_daily (
    id bigserial primary key,
    shop_id text not null references core_warehouse.shops (id) on delete cascade,
    date date not null,
    platform text not null default 'META',
    account_id text,
    account_name text,
    currency text,
    impressions bigint,
    reach bigint,
    clicks bigint,
    inline_link_clicks bigint,
    unique_clicks bigint,
    spend numeric(18, 2),
    cpc numeric(18, 4),
    cpm numeric(18, 4),
    ctr numeric(18, 4),
    unique_ctr numeric(18, 4),
    conversions bigint,
    purchases bigint,
    purchase_value numeric(18, 2),
    leads bigint,
    adds_to_cart bigint,
    view_content bigint,
    actions jsonb not null default '[]'::jsonb,
    action_values jsonb not null default '[]'::jsonb,
    objective text,
    buying_type text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (shop_id, date, platform)
);

create index idx_fact_marketing_daily_shop_date on core_warehouse.fact_marketing_daily (shop_id, date);

create table core_warehouse.fact_marketing_campaign_daily (
    id bigserial primary key,
    shop_id text not null references core_warehouse.shops (id) on delete cascade,
    date date not null,
    platform text not null default 'META',
    account_id text,
    account_name text,
    campaign_id text,
    campaign_name text,
    adset_id text,
    adset_name text,
    ad_id text,
    ad_name text,
    impressions bigint,
    reach bigint,
    clicks bigint,
    inline_link_clicks bigint,
    spend numeric(18, 2),
    cpc numeric(18, 4),
    cpm numeric(18, 4),
    ctr numeric(18, 4),
    conversions bigint,
    purchases bigint,
    purchase_value numeric(18, 2),
    actions jsonb not null default '[]'::jsonb,
    action_values jsonb not null default '[]'::jsonb,
    objective text,
    buying_type text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (shop_id, date, ad_id)
);

create index idx_fact_campaign_daily_shop_date on core_warehouse.fact_marketing_campaign_daily (shop_id, date);

-- ==================
-- REPORTING VIEWS
-- ==================

create view reporting.daily_revenue as
    select
        shop_id,
        (coalesce(processed_at, created_at))::date as date,
        count(*) as order_count,
        sum(total_price) as revenue,
        avg(total_price) as aov
    from core_warehouse.orders
    group by shop_id, (coalesce(processed_at, created_at))::date;

create view reporting.marketing_daily as
    select
        shop_id,
        date,
        platform,
        spend,
        impressions,
        clicks,
        conversions,
        purchase_value as revenue,
        currency
    from core_warehouse.fact_marketing_daily;

create view reporting.mer_roas as
    with spend_by_day as (
        select
            shop_id,
            date,
            sum(spend) as total_spend
        from core_warehouse.fact_marketing_daily
        group by shop_id, date
    )
    select
        r.shop_id,
        r.date,
        r.revenue,
        coalesce(s.total_spend, 0) as total_spend,
        m.platform,
        m.spend,
        case when coalesce(s.total_spend, 0) = 0 then null else r.revenue / s.total_spend end as mer,
        case when m.spend = 0 then null else r.revenue / m.spend end as roas
    from reporting.daily_revenue r
    left join spend_by_day s on s.shop_id = r.shop_id and s.date = r.date
    left join core_warehouse.fact_marketing_daily m on m.shop_id = r.shop_id and m.date = r.date;

create view reporting.sync_status as
    select
        j.id as run_id,
        j.shop_id,
        s.name as shop_name,
        s.shopify_domain,
        j.platform,
        j.job_type,
        j.status,
        j.records_synced,
        j.error,
        j.created_at,
        j.started_at,
        j.completed_at,
        c.last_success_at
    updated_at timestamptz not null,
    raw_order jsonb not null default '{}'::jsonb,
    unique (shop_id, shopify_gid)
);

create index idx_orders_shop_created on core_warehouse.orders (shop_id, created_at);
create index idx_orders_shop_updated on core_warehouse.orders (shop_id, updated_at);

create table core_warehouse.order_line_items (
    id bigserial primary key,
    shop_id text not null references core_warehouse.shops (id) on delete cascade,
    shopify_gid text not null,
    order_shopify_gid text not null,
    product_gid text,
    variant_gid text,
    sku text,
    title text,
    variant_title text,
    vendor text,
    quantity integer not null,
    price numeric(18, 2),
    total_discount numeric(18, 2),
    taxable boolean,
    requires_shipping boolean,
    fulfillment_status text,
    properties jsonb,
    discount_allocations jsonb,
    tax_lines jsonb,
    created_at timestamptz,
    updated_at timestamptz,
    raw_line_item jsonb not null default '{}'::jsonb,
    unique (shop_id, shopify_gid)
);

create index idx_line_items_order on core_warehouse.order_line_items (shop_id, order_shopify_gid);

create table core_warehouse.transactions (
    id bigserial primary key,
    shop_id text not null references core_warehouse.shops (id) on delete cascade,
    shopify_gid text not null,
    order_shopify_gid text not null,
    kind text,
    status text,
    gateway text,
    amount numeric(18, 2),
    currency text,
    authorization_code text,
    processed_at timestamptz,
    test boolean,
    payment_id text,
    error_code text,
    source_name text,
    raw_transaction jsonb not null default '{}'::jsonb,
    unique (shop_id, shopify_gid)
);

create index idx_transactions_order on core_warehouse.transactions (shop_id, order_shopify_gid);

-- ===============
-- META WAREHOUSE
-- ===============

create table core_warehouse.fact_marketing_daily (
    id bigserial primary key,
    shop_id text not null references core_warehouse.shops (id) on delete cascade,
    date date not null,
    platform text not null default 'META',
    account_id text,
    account_name text,
    currency text,
    impressions bigint,
    reach bigint,
    clicks bigint,
    inline_link_clicks bigint,
    unique_clicks bigint,
    spend numeric(18, 2),
    cpc numeric(18, 4),
    cpm numeric(18, 4),
    ctr numeric(18, 4),
    unique_ctr numeric(18, 4),
    conversions bigint,
    purchases bigint,
    purchase_value numeric(18, 2),
    leads bigint,
    adds_to_cart bigint,
    view_content bigint,
    actions jsonb not null default '[]'::jsonb,
    action_values jsonb not null default '[]'::jsonb,
    objective text,
    buying_type text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (shop_id, date, platform)
);

create index idx_fact_marketing_daily_shop_date on core_warehouse.fact_marketing_daily (shop_id, date);

create table core_warehouse.fact_marketing_campaign_daily (
    id bigserial primary key,
    shop_id text not null references core_warehouse.shops (id) on delete cascade,
    date date not null,
    platform text not null default 'META',
    account_id text,
    account_name text,
    campaign_id text,
    campaign_name text,
    adset_id text,
    adset_name text,
    ad_id text,
    ad_name text,
    impressions bigint,
    reach bigint,
    clicks bigint,
    inline_link_clicks bigint,
    spend numeric(18, 2),
    cpc numeric(18, 4),
    cpm numeric(18, 4),
    ctr numeric(18, 4),
    conversions bigint,
    purchases bigint,
    purchase_value numeric(18, 2),
    actions jsonb not null default '[]'::jsonb,
    action_values jsonb not null default '[]'::jsonb,
    objective text,
    buying_type text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_fact_campaign_daily_shop_date on core_warehouse.fact_marketing_campaign_daily (shop_id, date);

-- ==================
-- REPORTING VIEWS
-- ==================

create view reporting.daily_revenue as
    select
        shop_id,
        (coalesce(processed_at, created_at))::date as date,
        count(*) as order_count,
        sum(total_price) as revenue,
        avg(total_price) as aov
    from core_warehouse.orders
    group by shop_id, (coalesce(processed_at, created_at))::date;

create view reporting.marketing_daily as
    select
        shop_id,
        date,
        platform,
        spend,
        impressions,
        clicks,
        conversions,
        purchase_value as revenue,
        currency
    from core_warehouse.fact_marketing_daily;

create view reporting.mer_roas as
    with spend_by_day as (
        select
            shop_id,
            date,
            sum(spend) as total_spend
        from core_warehouse.fact_marketing_daily
        group by shop_id, date
    )
    select
        r.shop_id,
        r.date,
        r.revenue,
        coalesce(s.total_spend, 0) as total_spend,
        m.platform,
        m.spend,
        case when coalesce(s.total_spend, 0) = 0 then null else r.revenue / s.total_spend end as mer,
        case when m.spend = 0 then null else r.revenue / m.spend end as roas
    from reporting.daily_revenue r
    left join spend_by_day s on s.shop_id = r.shop_id and s.date = r.date
    left join core_warehouse.fact_marketing_daily m on m.shop_id = r.shop_id and m.date = r.date;

create view reporting.sync_status as
    select
        j.id as run_id,
        j.shop_id,
        s.name as shop_name,
        s.shopify_domain,
        j.platform,
        j.job_type,
        j.status,
        j.records_synced,
        j.error,
        j.created_at,
        j.started_at,
        j.completed_at,
        c.last_success_at
    from core_warehouse.sync_jobs j
    left join core_warehouse.shops s on s.id = j.shop_id
    left join core_warehouse.sync_cursors c on c.shop_id = j.shop_id and c.platform = j.platform
    order by j.created_at desc;


-- ==================
-- RLS POLICIES
-- ==================

-- Enable RLS on all tables
alter table app_dashboard.users enable row level security;
alter table app_dashboard.user_shops enable row level security;
alter table core_warehouse.shops enable row level security;
alter table core_warehouse.shop_credentials enable row level security;
alter table core_warehouse.sync_jobs enable row level security;
alter table core_warehouse.sync_cursors enable row level security;
alter table core_warehouse.orders enable row level security;
alter table core_warehouse.order_line_items enable row level security;
alter table core_warehouse.transactions enable row level security;
alter table core_warehouse.fact_marketing_daily enable row level security;
alter table core_warehouse.fact_marketing_campaign_daily enable row level security;

-- Policies for app_dashboard.users
create policy "Users can view their own data"
    on app_dashboard.users for select
    using (auth.uid() = id);

create policy "Users can update their own data"
    on app_dashboard.users for update
    using (auth.uid() = id);

-- Policies for app_dashboard.user_shops
create policy "Users can view their shop associations"
    on app_dashboard.user_shops for select
    using (auth.uid() = user_id);

-- Policies for core_warehouse.shops
create policy "Users can view shops they belong to"
    on core_warehouse.shops for select
    using (
        exists (
            select 1 from app_dashboard.user_shops us
            where us.shop_id = id
            and us.user_id = auth.uid()
        )
    );

-- Policies for core_warehouse.shop_credentials
create policy "Users can view credentials for their shops"
    on core_warehouse.shop_credentials for select
    using (
        exists (
            select 1 from app_dashboard.user_shops us
            where us.shop_id = shop_id
            and us.user_id = auth.uid()
        )
    );

-- Policies for core_warehouse.sync_jobs
create policy "Users can view sync jobs for their shops"
    on core_warehouse.sync_jobs for select
    using (
        exists (
            select 1 from app_dashboard.user_shops us
            where us.shop_id = shop_id
            and us.user_id = auth.uid()
        )
    );

-- Policies for core_warehouse.sync_cursors
create policy "Users can view sync cursors for their shops"
    on core_warehouse.sync_cursors for select
    using (
        exists (
            select 1 from app_dashboard.user_shops us
            where us.shop_id = shop_id
            and us.user_id = auth.uid()
        )
    );

-- Policies for core_warehouse.orders
create policy "Users can view orders for their shops"
    on core_warehouse.orders for select
    using (
        exists (
            select 1 from app_dashboard.user_shops us
            where us.shop_id = shop_id
            and us.user_id = auth.uid()
        )
    );

-- Policies for core_warehouse.order_line_items
create policy "Users can view line items for their shops"
    on core_warehouse.order_line_items for select
    using (
        exists (
            select 1 from app_dashboard.user_shops us
            where us.shop_id = shop_id
            and us.user_id = auth.uid()
        )
    );

-- Policies for core_warehouse.transactions
create policy "Users can view transactions for their shops"
    on core_warehouse.transactions for select
    using (
        exists (
            select 1 from app_dashboard.user_shops us
            where us.shop_id = shop_id
            and us.user_id = auth.uid()
        )
    );

-- Policies for core_warehouse.fact_marketing_daily
create policy "Users can view marketing facts for their shops"
    on core_warehouse.fact_marketing_daily for select
    using (
        exists (
            select 1 from app_dashboard.user_shops us
            where us.shop_id = shop_id
            and us.user_id = auth.uid()
        )
    );

-- Policies for core_warehouse.fact_marketing_campaign_daily
create policy "Users can view marketing campaign facts for their shops"
    on core_warehouse.fact_marketing_campaign_daily for select
    using (
        exists (
            select 1 from app_dashboard.user_shops us
            where us.shop_id = shop_id
            and us.user_id = auth.uid()
        )
    );

commit;
