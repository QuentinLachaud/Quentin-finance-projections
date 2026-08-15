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
