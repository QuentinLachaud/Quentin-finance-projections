create table if not exists public.account_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  source text not null default 'default' check (source in ('default', 'manual', 'stripe', 'owner')),
  is_admin boolean not null default false,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  subscription_status text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_entitlements enable row level security;

drop policy if exists "Users can read their own entitlement" on public.account_entitlements;
create policy "Users can read their own entitlement"
on public.account_entitlements for select
to authenticated
using ((select auth.uid()) = user_id);

grant select on public.account_entitlements to authenticated;
revoke insert, update, delete on public.account_entitlements from authenticated, anon;
revoke all on public.account_entitlements from anon;

insert into public.account_entitlements (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- This address was supplied by the product owner. Server-side OWNER_EMAIL is
-- checked as well, but this seed ensures the database limit never locks the
-- owner's established portfolio during the first deployment.
update public.account_entitlements entitlement
set plan = 'pro', source = 'owner', is_admin = true, updated_at = now()
from auth.users account
where entitlement.user_id = account.id
  and lower(account.email) = lower('QuentinLachaux@gmail.com');

create or replace function public.create_default_account_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.account_entitlements (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_account_entitlement on auth.users;
create trigger create_account_entitlement
after insert on auth.users
for each row execute function public.create_default_account_entitlement();

create or replace function public.enforce_free_property_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_count integer := 0;
  next_count integer := jsonb_array_length(coalesce(new.portfolio -> 'properties', '[]'::jsonb));
  pro_account boolean := false;
begin
  if tg_op = 'UPDATE' then
    previous_count := jsonb_array_length(coalesce(old.portfolio -> 'properties', '[]'::jsonb));
  end if;

  select coalesce(plan = 'pro', false)
  into pro_account
  from public.account_entitlements
  where user_id = new.user_id;

  if next_count > 1 and next_count > previous_count and not coalesce(pro_account, false) then
    raise exception 'Free accounts can store one BTL. Upgrade to Pro to add another.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_free_property_limit on public.portfolio_states;
create trigger enforce_free_property_limit
before insert or update on public.portfolio_states
for each row execute function public.enforce_free_property_limit();

drop trigger if exists set_account_entitlements_updated_at on public.account_entitlements;
create trigger set_account_entitlements_updated_at
before update on public.account_entitlements
for each row execute function public.set_portfolio_updated_at();
