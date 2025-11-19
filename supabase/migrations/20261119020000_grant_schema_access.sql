-- Grant schema usage to Supabase API roles
grant usage on schema app_dashboard, core_warehouse, reporting, staging_ingest
  to authenticated, service_role;

-- Grant table privileges (RLS still enforces row-level access)
grant all privileges on all tables in schema app_dashboard  to authenticated, service_role;
grant all privileges on all tables in schema core_warehouse to authenticated, service_role;
grant all privileges on all tables in schema reporting      to authenticated, service_role;
grant all privileges on all tables in schema staging_ingest to authenticated, service_role;

-- Ensure future tables inherit the same privileges
alter default privileges in schema app_dashboard
  grant all on tables to authenticated, service_role;
alter default privileges in schema core_warehouse
  grant all on tables to authenticated, service_role;
alter default privileges in schema reporting
  grant all on tables to authenticated, service_role;
alter default privileges in schema staging_ingest
  grant all on tables to authenticated, service_role;

-- Sequences for serial/bigserial columns
grant usage, select on all sequences in schema app_dashboard  to authenticated, service_role;
grant usage, select on all sequences in schema core_warehouse to authenticated, service_role;
grant usage, select on all sequences in schema reporting      to authenticated, service_role;
grant usage, select on all sequences in schema staging_ingest to authenticated, service_role;

alter default privileges in schema app_dashboard
  grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema core_warehouse
  grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema reporting
  grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema staging_ingest
  grant usage, select on sequences to authenticated, service_role;

