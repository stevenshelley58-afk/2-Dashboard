-- Hard-reset baseline migration.
-- Drops all prior schemas and recreates empty shells for the rebuild.
begin;

drop schema if exists staging_ingest cascade;
drop schema if exists core_warehouse cascade;
drop schema if exists reporting cascade;
drop schema if exists app_dashboard cascade;

create schema staging_ingest;
create schema core_warehouse;
create schema reporting;
create schema app_dashboard;

commit;

