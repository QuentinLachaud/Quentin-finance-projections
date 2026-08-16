create table if not exists public.portfolio_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  portfolio jsonb not null default '{"properties":[],"settings":{}}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.portfolio_states enable row level security;

create policy "Users can read their own portfolio"
on public.portfolio_states for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own portfolio"
on public.portfolio_states for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own portfolio"
on public.portfolio_states for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.set_portfolio_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_portfolio_updated_at on public.portfolio_states;
create trigger set_portfolio_updated_at
before update on public.portfolio_states
for each row execute function public.set_portfolio_updated_at();

grant select, insert, update on public.portfolio_states to authenticated;
revoke all on public.portfolio_states from anon;

create table if not exists public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requisition_id text not null,
  institution_id text not null,
  institution_name text not null,
  institution_logo text,
  agreement_id text,
  status text not null default 'CR',
  access_expires_at timestamptz,
  connected_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, requisition_id)
);

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.bank_connections(id) on delete cascade,
  external_account_id text not null,
  display_name text not null default 'Bank account',
  owner_name text,
  iban_last4 text,
  currency text not null default 'GBP',
  account_type text,
  current_balance numeric(18,2) not null default 0,
  available_balance numeric(18,2),
  balance_updated_at timestamptz,
  include_in_cash boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, external_account_id)
);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.bank_accounts(id) on delete cascade,
  transaction_key text not null,
  booked_at date,
  value_at date,
  amount numeric(18,2) not null,
  currency text not null default 'GBP',
  description text not null default 'Bank transaction',
  counterparty text,
  bank_code text,
  status text not null default 'booked',
  balance_after numeric(18,2),
  category text not null default 'other',
  is_transfer boolean not null default false,
  category_overridden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, account_id, transaction_key)
);

create table if not exists public.bank_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.bank_accounts(id) on delete cascade,
  captured_on date not null default current_date,
  balance numeric(18,2) not null,
  available_balance numeric(18,2),
  currency text not null default 'GBP',
  created_at timestamptz not null default now(),
  unique (user_id, account_id, captured_on)
);

alter table public.bank_connections enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.bank_balance_snapshots enable row level security;

create policy "Users manage their own bank connections" on public.bank_connections
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their own bank accounts" on public.bank_accounts
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their own bank transactions" on public.bank_transactions
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their own bank balance snapshots" on public.bank_balance_snapshots
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop trigger if exists set_bank_connections_updated_at on public.bank_connections;
create trigger set_bank_connections_updated_at before update on public.bank_connections
for each row execute function public.set_portfolio_updated_at();
drop trigger if exists set_bank_accounts_updated_at on public.bank_accounts;
create trigger set_bank_accounts_updated_at before update on public.bank_accounts
for each row execute function public.set_portfolio_updated_at();
drop trigger if exists set_bank_transactions_updated_at on public.bank_transactions;
create trigger set_bank_transactions_updated_at before update on public.bank_transactions
for each row execute function public.set_portfolio_updated_at();

create index if not exists bank_connections_user_idx on public.bank_connections(user_id);
create index if not exists bank_accounts_user_idx on public.bank_accounts(user_id);
create index if not exists bank_transactions_user_date_idx on public.bank_transactions(user_id, booked_at desc);
create index if not exists bank_balance_snapshots_user_date_idx on public.bank_balance_snapshots(user_id, captured_on desc);

grant select, insert, update, delete on public.bank_connections to authenticated;
grant select, insert, update, delete on public.bank_accounts to authenticated;
grant select, insert, update, delete on public.bank_transactions to authenticated;
grant select, insert, update, delete on public.bank_balance_snapshots to authenticated;
revoke all on public.bank_connections, public.bank_accounts, public.bank_transactions, public.bank_balance_snapshots from anon;
