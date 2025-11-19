alter table core_warehouse.sync_jobs
    add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on column core_warehouse.sync_jobs.metadata is
    'Arbitrary job metadata such as lookback days or follow-up instructions';

