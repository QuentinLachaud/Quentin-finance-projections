alter table public.bank_transactions
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;

comment on column public.bank_transactions.source_metadata is
  'Original provider/import metadata retained for audit and reclassification; never used as an authorization source.';
