-- Run this once in the Supabase SQL Editor after the current settlement migrations.
-- It adds supplier/settlement details used only by the separate transaction statement tab.

alter table public.settlement_accounts
  add column if not exists billing_address text not null default '',
  add column if not exists default_unit_price integer not null default 8000 check (default_unit_price >= 0);

update public.settlement_accounts as account
set billing_address = coalesce((
  select trim(concat_ws(' ', client.address, client.address_detail))
  from public.clients as client
  where client.settlement_account_id = account.id
  order by client.delivery_order
  limit 1
), '')
where account.billing_address = '';

create table if not exists public.supplier_profiles (
  id text primary key default 'primary' check (id = 'primary'),
  business_name text not null default '밥심',
  business_registration_number text not null default '',
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  bank_name text not null default '',
  bank_account_number text not null default '',
  account_holder text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.supplier_profiles (id, business_name)
values ('primary', '밥심')
on conflict (id) do nothing;

alter table public.supplier_profiles enable row level security;
grant all on public.supplier_profiles to service_role;