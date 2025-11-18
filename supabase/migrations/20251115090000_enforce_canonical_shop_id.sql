-- Enforce canonical shop_id formatting and relational integrity
-- Canonical rules:
--   - shop_id is always the Shopify subdomain (lowercase, no dots)
--   - shopify_domain is the full domain (subdomain + .myshopify.com)

--------------------------------------------------------------------------------
-- Helper functions
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION core_warehouse.normalize_shop_id(p_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    lower(
      split_part(
        split_part(
          split_part(
            split_part(
              regexp_replace(trim(coalesce(p_input, '')), '^https?://', '', 'i'),
              '/',
              1
            ),
            '?',
            1
          ),
          '#',
          1
        ),
        '.',
        1
      )
    ),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION core_warehouse.shop_id_to_domain(p_shop_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN core_warehouse.normalize_shop_id(p_shop_id) IS NULL THEN NULL
    ELSE core_warehouse.normalize_shop_id(p_shop_id) || '.myshopify.com'
  END;
$$;

--------------------------------------------------------------------------------
-- Seed canonical shop rows (insert/update) so references can migrate safely
--------------------------------------------------------------------------------

WITH source_shops AS (
  SELECT
    shop_id AS original_shop_id,
    core_warehouse.normalize_shop_id(COALESCE(NULLIF(trim(shopify_domain), ''), shop_id)) AS canonical_shop_id,
    currency,
    timezone,
    metadata,
    created_at,
    updated_at
  FROM core_warehouse.shops
),
prepared AS (
  SELECT
    original_shop_id,
    canonical_shop_id,
    core_warehouse.shop_id_to_domain(canonical_shop_id) AS canonical_domain,
    currency,
    timezone,
    metadata,
    created_at,
    updated_at
  FROM source_shops
  WHERE canonical_shop_id IS NOT NULL
)
INSERT INTO core_warehouse.shops AS dst (
  shop_id,
  shopify_domain,
  currency,
  timezone,
  metadata,
  created_at,
  updated_at
)
SELECT
  canonical_shop_id,
  canonical_domain,
  currency,
  timezone,
  metadata,
  created_at,
  updated_at
FROM prepared
ON CONFLICT (shop_id) DO UPDATE
SET
  shopify_domain = COALESCE(EXCLUDED.shopify_domain, dst.shopify_domain),
  currency = COALESCE(EXCLUDED.currency, dst.currency),
  timezone = COALESCE(EXCLUDED.timezone, dst.timezone),
  metadata = COALESCE(EXCLUDED.metadata, dst.metadata),
  created_at = LEAST(dst.created_at, EXCLUDED.created_at),
  updated_at = GREATEST(dst.updated_at, EXCLUDED.updated_at);

--------------------------------------------------------------------------------
-- Update dependent tables to use canonical shop identifiers
--------------------------------------------------------------------------------

UPDATE core_warehouse.orders
SET shop_id = canonical.new_shop_id
FROM (
  SELECT id, core_warehouse.normalize_shop_id(shop_id) AS new_shop_id
  FROM core_warehouse.orders
) AS canonical
WHERE orders.id = canonical.id
  AND canonical.new_shop_id IS NOT NULL
  AND orders.shop_id IS DISTINCT FROM canonical.new_shop_id;

UPDATE core_warehouse.order_line_items
SET shop_id = canonical.new_shop_id
FROM (
  SELECT id, core_warehouse.normalize_shop_id(shop_id) AS new_shop_id
  FROM core_warehouse.order_line_items
) AS canonical
WHERE order_line_items.id = canonical.id
  AND canonical.new_shop_id IS NOT NULL
  AND order_line_items.shop_id IS DISTINCT FROM canonical.new_shop_id;

UPDATE core_warehouse.transactions
SET shop_id = canonical.new_shop_id
FROM (
  SELECT id, core_warehouse.normalize_shop_id(shop_id) AS new_shop_id
  FROM core_warehouse.transactions
) AS canonical
WHERE transactions.id = canonical.id
  AND canonical.new_shop_id IS NOT NULL
  AND transactions.shop_id IS DISTINCT FROM canonical.new_shop_id;

UPDATE core_warehouse.payouts
SET shop_id = canonical.new_shop_id
FROM (
  SELECT id, core_warehouse.normalize_shop_id(shop_id) AS new_shop_id
  FROM core_warehouse.payouts
) AS canonical
WHERE payouts.id = canonical.id
  AND canonical.new_shop_id IS NOT NULL
  AND payouts.shop_id IS DISTINCT FROM canonical.new_shop_id;

UPDATE core_warehouse.customers
SET shop_id = canonical.new_shop_id
FROM (
  SELECT id, core_warehouse.normalize_shop_id(shop_id) AS new_shop_id
  FROM core_warehouse.customers
) AS canonical
WHERE customers.id = canonical.id
  AND canonical.new_shop_id IS NOT NULL
  AND customers.shop_id IS DISTINCT FROM canonical.new_shop_id;

UPDATE core_warehouse.shopify_analytics_daily
SET shop_id = canonical.new_shop_id
FROM (
  SELECT id, core_warehouse.normalize_shop_id(shop_id) AS new_shop_id
  FROM core_warehouse.shopify_analytics_daily
) AS canonical
WHERE shopify_analytics_daily.id = canonical.id
  AND canonical.new_shop_id IS NOT NULL
  AND shopify_analytics_daily.shop_id IS DISTINCT FROM canonical.new_shop_id;

UPDATE core_warehouse.fact_marketing_daily
SET shop_id = canonical.new_shop_id
FROM (
  SELECT id, core_warehouse.normalize_shop_id(shop_id) AS new_shop_id
  FROM core_warehouse.fact_marketing_daily
) AS canonical
WHERE fact_marketing_daily.id = canonical.id
  AND canonical.new_shop_id IS NOT NULL
  AND fact_marketing_daily.shop_id IS DISTINCT FROM canonical.new_shop_id;

UPDATE core_warehouse.fact_ga4_daily
SET shop_id = canonical.new_shop_id
FROM (
  SELECT id, core_warehouse.normalize_shop_id(shop_id) AS new_shop_id
  FROM core_warehouse.fact_ga4_daily
) AS canonical
WHERE fact_ga4_daily.id = canonical.id
  AND canonical.new_shop_id IS NOT NULL
  AND fact_ga4_daily.shop_id IS DISTINCT FROM canonical.new_shop_id;

UPDATE core_warehouse.fact_email_daily
SET shop_id = canonical.new_shop_id
FROM (
  SELECT id, core_warehouse.normalize_shop_id(shop_id) AS new_shop_id
  FROM core_warehouse.fact_email_daily
) AS canonical
WHERE fact_email_daily.id = canonical.id
  AND canonical.new_shop_id IS NOT NULL
  AND fact_email_daily.shop_id IS DISTINCT FROM canonical.new_shop_id;

UPDATE core_warehouse.etl_runs
SET shop_id = canonical.new_shop_id
FROM (
  SELECT id, core_warehouse.normalize_shop_id(shop_id) AS new_shop_id
  FROM core_warehouse.etl_runs
) AS canonical
WHERE etl_runs.id = canonical.id
  AND canonical.new_shop_id IS NOT NULL
  AND etl_runs.shop_id IS DISTINCT FROM canonical.new_shop_id;

UPDATE core_warehouse.sync_cursors
SET shop_id = canonical.new_shop_id
FROM (
  SELECT id, core_warehouse.normalize_shop_id(shop_id) AS new_shop_id
  FROM core_warehouse.sync_cursors
) AS canonical
WHERE sync_cursors.id = canonical.id
  AND canonical.new_shop_id IS NOT NULL
  AND sync_cursors.shop_id IS DISTINCT FROM canonical.new_shop_id;

UPDATE core_warehouse.shop_credentials
SET shop_id = canonical.new_shop_id
FROM (
  SELECT id, core_warehouse.normalize_shop_id(shop_id) AS new_shop_id
  FROM core_warehouse.shop_credentials
) AS canonical
WHERE shop_credentials.id = canonical.id
  AND canonical.new_shop_id IS NOT NULL
  AND shop_credentials.shop_id IS DISTINCT FROM canonical.new_shop_id;

--------------------------------------------------------------------------------
-- Remove legacy/duplicate shop rows and enforce canonical formatting
--------------------------------------------------------------------------------

DELETE FROM core_warehouse.shops AS s
WHERE core_warehouse.normalize_shop_id(s.shop_id) IS NULL
   OR s.shop_id IS DISTINCT FROM core_warehouse.normalize_shop_id(s.shop_id);

WITH canonical_shops AS (
  SELECT
    shop_id AS original_shop_id,
    core_warehouse.normalize_shop_id(shop_id) AS new_shop_id
  FROM core_warehouse.shops
)
UPDATE core_warehouse.shops AS s
SET
  shop_id = canonical.new_shop_id,
  shopify_domain = core_warehouse.shop_id_to_domain(canonical.new_shop_id)
FROM canonical_shops AS canonical
WHERE s.shop_id = canonical.original_shop_id
  AND canonical.new_shop_id IS NOT NULL
  AND (
    s.shop_id IS DISTINCT FROM canonical.new_shop_id
    OR s.shopify_domain IS DISTINCT FROM core_warehouse.shop_id_to_domain(canonical.new_shop_id)
  );

--------------------------------------------------------------------------------
-- Constraints and indexes
--------------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shops_shop_id_canonical_check'
      AND conrelid = 'core_warehouse.shops'::regclass
  ) THEN
    ALTER TABLE core_warehouse.shops
      ADD CONSTRAINT shops_shop_id_canonical_check
      CHECK (
        shop_id = lower(shop_id)
        AND shop_id !~ '\\.'
      );
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS shops_shopify_domain_key
  ON core_warehouse.shops (shopify_domain)
  WHERE shopify_domain IS NOT NULL;

--------------------------------------------------------------------------------
-- Foreign keys referencing shops (added idempotently)
--------------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_shop_id_fkey'
      AND conrelid = 'core_warehouse.orders'::regclass
  ) THEN
    ALTER TABLE core_warehouse.orders
      ADD CONSTRAINT orders_shop_id_fkey
      FOREIGN KEY (shop_id)
      REFERENCES core_warehouse.shops (shop_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_line_items_shop_id_fkey'
      AND conrelid = 'core_warehouse.order_line_items'::regclass
  ) THEN
    ALTER TABLE core_warehouse.order_line_items
      ADD CONSTRAINT order_line_items_shop_id_fkey
      FOREIGN KEY (shop_id)
      REFERENCES core_warehouse.shops (shop_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transactions_shop_id_fkey'
      AND conrelid = 'core_warehouse.transactions'::regclass
  ) THEN
    ALTER TABLE core_warehouse.transactions
      ADD CONSTRAINT transactions_shop_id_fkey
      FOREIGN KEY (shop_id)
      REFERENCES core_warehouse.shops (shop_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payouts_shop_id_fkey'
      AND conrelid = 'core_warehouse.payouts'::regclass
  ) THEN
    ALTER TABLE core_warehouse.payouts
      ADD CONSTRAINT payouts_shop_id_fkey
      FOREIGN KEY (shop_id)
      REFERENCES core_warehouse.shops (shop_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_shop_id_fkey'
      AND conrelid = 'core_warehouse.customers'::regclass
  ) THEN
    ALTER TABLE core_warehouse.customers
      ADD CONSTRAINT customers_shop_id_fkey
      FOREIGN KEY (shop_id)
      REFERENCES core_warehouse.shops (shop_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shopify_analytics_daily_shop_id_fkey'
      AND conrelid = 'core_warehouse.shopify_analytics_daily'::regclass
  ) THEN
    ALTER TABLE core_warehouse.shopify_analytics_daily
      ADD CONSTRAINT shopify_analytics_daily_shop_id_fkey
      FOREIGN KEY (shop_id)
      REFERENCES core_warehouse.shops (shop_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fact_marketing_daily_shop_id_fkey'
      AND conrelid = 'core_warehouse.fact_marketing_daily'::regclass
  ) THEN
    ALTER TABLE core_warehouse.fact_marketing_daily
      ADD CONSTRAINT fact_marketing_daily_shop_id_fkey
      FOREIGN KEY (shop_id)
      REFERENCES core_warehouse.shops (shop_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fact_ga4_daily_shop_id_fkey'
      AND conrelid = 'core_warehouse.fact_ga4_daily'::regclass
  ) THEN
    ALTER TABLE core_warehouse.fact_ga4_daily
      ADD CONSTRAINT fact_ga4_daily_shop_id_fkey
      FOREIGN KEY (shop_id)
      REFERENCES core_warehouse.shops (shop_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fact_email_daily_shop_id_fkey'
      AND conrelid = 'core_warehouse.fact_email_daily'::regclass
  ) THEN
    ALTER TABLE core_warehouse.fact_email_daily
      ADD CONSTRAINT fact_email_daily_shop_id_fkey
      FOREIGN KEY (shop_id)
      REFERENCES core_warehouse.shops (shop_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'etl_runs_shop_id_fkey'
      AND conrelid = 'core_warehouse.etl_runs'::regclass
  ) THEN
    ALTER TABLE core_warehouse.etl_runs
      ADD CONSTRAINT etl_runs_shop_id_fkey
      FOREIGN KEY (shop_id)
      REFERENCES core_warehouse.shops (shop_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sync_cursors_shop_id_fkey'
      AND conrelid = 'core_warehouse.sync_cursors'::regclass
  ) THEN
    ALTER TABLE core_warehouse.sync_cursors
      ADD CONSTRAINT sync_cursors_shop_id_fkey
      FOREIGN KEY (shop_id)
      REFERENCES core_warehouse.shops (shop_id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

--------------------------------------------------------------------------------
-- app_dashboard.user_shops mapping table
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS app_dashboard.user_shops (
  user_id uuid NOT NULL,
  shop_id text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, shop_id),
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id) REFERENCES core_warehouse.shops (shop_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS user_shops_default_unique
  ON app_dashboard.user_shops (user_id)
  WHERE is_default;

CREATE INDEX IF NOT EXISTS idx_user_shops_shop
  ON app_dashboard.user_shops (shop_id);

ALTER TABLE app_dashboard.user_shops ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'app_dashboard'
      AND tablename = 'user_shops'
      AND policyname = 'Users manage own shop mappings'
  ) THEN
    CREATE POLICY "Users manage own shop mappings"
      ON app_dashboard.user_shops
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'app_dashboard'
      AND tablename = 'user_shops'
      AND policyname = 'Service role manage user shops'
  ) THEN
    CREATE POLICY "Service role manage user shops"
      ON app_dashboard.user_shops
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON app_dashboard.user_shops TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_dashboard.user_shops TO service_role;

--------------------------------------------------------------------------------
-- RPC updates for canonical shop enforcement
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION register_shop(
  p_shopify_domain text,
  p_currency text DEFAULT 'USD',
  p_timezone text DEFAULT 'UTC'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shop_id text;
  v_shopify_domain text;
BEGIN
  IF p_shopify_domain IS NULL OR trim(p_shopify_domain) = '' THEN
    RAISE EXCEPTION 'shopify_domain is required and cannot be empty'
      USING ERRCODE = '22023';
  END IF;

  v_shop_id := core_warehouse.normalize_shop_id(p_shopify_domain);

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Invalid Shopify domain "%": unable to derive canonical shop_id', p_shopify_domain
      USING ERRCODE = '22023';
  END IF;

  v_shopify_domain := core_warehouse.shop_id_to_domain(v_shop_id);

  INSERT INTO core_warehouse.shops (
    shop_id,
    shopify_domain,
    currency,
    timezone,
    updated_at
  )
  VALUES (
    v_shop_id,
    v_shopify_domain,
    p_currency,
    p_timezone,
    now()
  )
  ON CONFLICT (shop_id)
  DO UPDATE SET
    shopify_domain = EXCLUDED.shopify_domain,
    currency = EXCLUDED.currency,
    timezone = EXCLUDED.timezone,
    updated_at = now();

  RETURN json_build_object(
    'shop_id', v_shop_id,
    'shopify_domain', v_shopify_domain,
    'currency', p_currency,
    'timezone', p_timezone
  );
END;
$$;

CREATE OR REPLACE FUNCTION enqueue_etl_job(
  p_shop_id text,
  p_job_type text,
  p_platform text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_run_id uuid;
  v_shop_id text;
  v_job_type text;
  v_platform text;
  v_exists boolean;
BEGIN
  IF p_shop_id IS NULL OR trim(p_shop_id) = '' THEN
    RAISE EXCEPTION 'shop_id is required'
      USING ERRCODE = '22023';
  END IF;

  v_shop_id := core_warehouse.normalize_shop_id(p_shop_id);

  IF v_shop_id IS NULL OR v_shop_id <> lower(trim(p_shop_id)) THEN
    RAISE EXCEPTION 'shop_id must be the canonical Shopify subdomain (lowercase, no dots). Received "%"', p_shop_id
      USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM core_warehouse.shops
    WHERE shop_id = v_shop_id
  )
  INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'Invalid shop_id "%": register the shop before enqueuing jobs', p_shop_id
      USING ERRCODE = '22023';
  END IF;

  v_job_type := upper(p_job_type);
  v_platform := upper(p_platform);

  IF v_job_type NOT IN ('HISTORICAL', 'INCREMENTAL') THEN
    RAISE EXCEPTION 'Invalid job_type: "%". Must be HISTORICAL or INCREMENTAL', p_job_type
      USING ERRCODE = '22023';
  END IF;

  IF v_platform NOT IN ('SHOPIFY', 'META', 'GA4', 'KLAVIYO') THEN
    RAISE EXCEPTION 'Invalid platform: "%". Must be SHOPIFY, META, GA4, or KLAVIYO', p_platform
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO core_warehouse.etl_runs (
    shop_id,
    status,
    job_type,
    platform
  )
  VALUES (
    v_shop_id,
    'QUEUED',
    v_job_type,
    v_platform
  )
  RETURNING id INTO v_run_id;

  RETURN json_build_object('run_id', v_run_id);

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Job already in progress for shop_id "%" and platform "%"', v_shop_id, v_platform
      USING ERRCODE = '23505',
            HINT = 'Wait for the current job to complete before enqueuing a new one';
END;
$$;

CREATE OR REPLACE FUNCTION upsert_shop_credential(
  p_shop_id text,
  p_platform text,
  p_access_token text,
  p_refresh_token text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shop_id text;
  v_platform text;
  v_exists boolean;
BEGIN
  v_shop_id := core_warehouse.normalize_shop_id(p_shop_id);

  IF v_shop_id IS NULL OR v_shop_id <> lower(trim(p_shop_id)) THEN
    RAISE EXCEPTION 'shop_id must be canonical (lowercase Shopify subdomain without dots). Received "%"', p_shop_id
      USING ERRCODE = '22023';
  END IF;

  v_platform := upper(p_platform);

  IF v_platform NOT IN ('SHOPIFY', 'META', 'GA4', 'KLAVIYO') THEN
    RAISE EXCEPTION 'Invalid platform: "%". Must be SHOPIFY, META, GA4, or KLAVIYO', p_platform
      USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM core_warehouse.shops
    WHERE shop_id = v_shop_id
  )
  INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'Shop "%" not found. Register the shop before storing credentials.', v_shop_id
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO core_warehouse.shop_credentials (
    shop_id,
    platform,
    access_token,
    refresh_token,
    expires_at,
    last_validated_at
  )
  VALUES (
    v_shop_id,
    v_platform,
    p_access_token,
    p_refresh_token,
    p_expires_at,
    now()
  )
  ON CONFLICT (shop_id, platform)
  DO UPDATE SET
    access_token = EXCLUDED.access_token,
    refresh_token = EXCLUDED.refresh_token,
    expires_at = EXCLUDED.expires_at,
    last_validated_at = now(),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION update_shop_metadata(
  p_shop_id text,
  p_shopify_domain text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shop_id text;
  v_domain text;
BEGIN
  v_shop_id := core_warehouse.normalize_shop_id(p_shop_id);

  IF v_shop_id IS NULL OR v_shop_id <> lower(trim(p_shop_id)) THEN
    RAISE EXCEPTION 'shop_id must be canonical (lowercase Shopify subdomain without dots). Received "%"', p_shop_id
      USING ERRCODE = '22023';
  END IF;

  IF p_shopify_domain IS NOT NULL AND trim(p_shopify_domain) <> '' THEN
    IF core_warehouse.normalize_shop_id(p_shopify_domain) IS NULL THEN
      RAISE EXCEPTION 'Invalid Shopify domain "%": unable to derive canonical shop_id', p_shopify_domain
        USING ERRCODE = '22023';
    END IF;

    IF core_warehouse.normalize_shop_id(p_shopify_domain) <> v_shop_id THEN
      RAISE EXCEPTION 'Provided Shopify domain "%" does not match shop_id "%"', p_shopify_domain, v_shop_id
        USING ERRCODE = '22023';
    END IF;

    v_domain := core_warehouse.shop_id_to_domain(v_shop_id);
  END IF;

  UPDATE core_warehouse.shops
  SET
    shopify_domain = COALESCE(v_domain, shopify_domain),
    metadata = COALESCE(p_metadata, metadata),
    updated_at = now()
  WHERE shop_id = v_shop_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop "%" not found', v_shop_id
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION register_shop(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION enqueue_etl_job(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION upsert_shop_credential(text, text, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION update_shop_metadata(text, text, jsonb) TO service_role;

