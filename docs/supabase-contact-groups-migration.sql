-- Run this once in the Supabase SQL Editor before deploying contact-group features.
-- It preserves existing client links and PINs by creating one settlement account
-- and one contact access group for every current delivery location.

create table if not exists public.settlement_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients
  add column if not exists settlement_account_id uuid references public.settlement_accounts(id) on delete restrict;

create table if not exists public.contact_access_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  manager_name text not null,
  manager_phone text not null,
  invite_code text not null unique,
  invite_pin text not null,
  status text not null default 'active' check (status in ('active', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_access_group_members (
  id uuid primary key default gen_random_uuid(),
  contact_access_group_id uuid not null references public.contact_access_groups(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (contact_access_group_id, client_id)
);

create table if not exists public.monthly_settlement_adjustments (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  settlement_account_id uuid not null references public.settlement_accounts(id) on delete restrict,
  final_quantity integer not null check (final_quantity >= 0),
  memo text,
  updated_at timestamptz not null default now(),
  unique (month, settlement_account_id)
);

-- Preserve all existing client URLs and PINs. Existing locations become one-location
-- settlement and contact groups until an admin explicitly combines them.
insert into public.settlement_accounts (id, name, status)
select id, name, case when status = 'active' then 'active' else 'paused' end
from public.clients
where settlement_account_id is null
on conflict (id) do nothing;

update public.clients
set settlement_account_id = id
where settlement_account_id is null;

alter table public.clients
  alter column settlement_account_id set not null;

insert into public.contact_access_groups (
  id,
  name,
  manager_name,
  manager_phone,
  invite_code,
  invite_pin,
  status
)
select
  id,
  name || ' 담당자',
  manager_name,
  manager_phone,
  invite_code,
  invite_pin,
  case when status = 'active' then 'active' else 'paused' end
from public.clients
on conflict (id) do nothing;

insert into public.contact_access_group_members (contact_access_group_id, client_id)
select id, id
from public.clients
on conflict (contact_access_group_id, client_id) do nothing;

create index if not exists clients_settlement_account_idx
  on public.clients (settlement_account_id);

create index if not exists contact_access_group_members_group_idx
  on public.contact_access_group_members (contact_access_group_id);

create index if not exists contact_access_group_members_client_idx
  on public.contact_access_group_members (client_id);

create index if not exists monthly_settlement_adjustments_account_month_idx
  on public.monthly_settlement_adjustments (settlement_account_id, month desc);

alter table public.settlement_accounts enable row level security;
alter table public.contact_access_groups enable row level security;
alter table public.contact_access_group_members enable row level security;
alter table public.monthly_settlement_adjustments enable row level security;

grant all on public.settlement_accounts to service_role;
grant all on public.contact_access_groups to service_role;
grant all on public.contact_access_group_members to service_role;
grant all on public.monthly_settlement_adjustments to service_role;