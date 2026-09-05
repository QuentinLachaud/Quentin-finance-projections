-- Banking statement imports and Performance treatment metadata.
-- Additive only: existing GoCardless rows remain valid and default to automatic treatment.

create table if not exists public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.bank_accounts(id) on delete cascade,
  file_name text not null,
  file_hash text not null,
  statement_from date,
  statement_to date,
  transaction_count integer not null default 0 check (transaction_count >= 0),
  imported_at timestamptz not null default now(),
  unique (user_id, file_hash)
);

alter table public.bank_statement_imports enable row level security;
revoke all on table public.bank_statement_imports from anon, authenticated;
grant select, insert, update, delete on table public.bank_statement_imports to authenticated;

drop policy if exists "Users manage their own bank statement imports" on public.bank_statement_imports;
create policy "Users manage their own bank statement imports"
on public.bank_statement_imports
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

alter table public.bank_transactions
  add column if not exists source_type text not null default 'gocardless',
  add column if not exists import_id uuid references public.bank_statement_imports(id) on delete set null,
  add column if not exists property_id text,
  add column if not exists performance_treatment text not null default 'auto',
  add column if not exists exclude_from_performance boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bank_transactions_source_type_check'
  ) then
    alter table public.bank_transactions
      add constraint bank_transactions_source_type_check
      check (source_type in ('gocardless', 'tide_statement'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'bank_transactions_performance_treatment_check'
  ) then
    alter table public.bank_transactions
      add constraint bank_transactions_performance_treatment_check
      check (performance_treatment in ('auto', 'operating', 'company', 'investor', 'exclude'));
  end if;
end $$;

create index if not exists bank_statement_imports_user_date_idx
  on public.bank_statement_imports(user_id, statement_to desc);
create index if not exists bank_transactions_user_property_date_idx
  on public.bank_transactions(user_id, property_id, booked_at desc);
