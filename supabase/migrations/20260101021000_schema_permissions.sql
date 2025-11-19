-- Grant usage on schemas to service_role and authenticated roles
GRANT USAGE ON SCHEMA app_dashboard TO service_role, authenticated, anon;
GRANT USAGE ON SCHEMA core_warehouse TO service_role, authenticated, anon;
GRANT USAGE ON SCHEMA reporting TO service_role, authenticated, anon;
GRANT USAGE ON SCHEMA staging_ingest TO service_role, authenticated, anon;

-- Grant all privileges on all tables in these schemas to service_role
GRANT ALL ON ALL TABLES IN SCHEMA app_dashboard TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA core_warehouse TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA reporting TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA staging_ingest TO service_role;

-- Grant select on reporting views to authenticated users (for dashboard)
GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO authenticated;

-- Grant all privileges on sequences to service_role (for serial IDs)
GRANT ALL ON ALL SEQUENCES IN SCHEMA app_dashboard TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA core_warehouse TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA reporting TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA staging_ingest TO service_role;

-- Ensure future tables get these privileges automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA app_dashboard GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA core_warehouse GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA reporting GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging_ingest GRANT ALL ON TABLES TO service_role;

