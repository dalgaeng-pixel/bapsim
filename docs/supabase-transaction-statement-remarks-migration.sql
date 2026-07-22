-- Run this once in the Supabase SQL Editor after the transaction-statement migration.
-- One remark belongs to one settlement account, delivery location, and delivery date.
-- It applies to the shared middle/dinner row on the printed transaction statement.

create table if not exists public.transaction_statement_remarks (
  id uuid primary key default gen_random_uuid(),
  settlement_account_id uuid not null references public.settlement_accounts(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  order_date date not null,
  memo text not null default '' check (char_length(memo) <= 300),
  updated_at timestamptz not null default now(),
  unique (settlement_account_id, client_id, order_date)
);

create index if not exists transaction_statement_remarks_lookup_idx
  on public.transaction_statement_remarks (settlement_account_id, client_id, order_date);

alter table public.transaction_statement_remarks enable row level security;

grant all on public.transaction_statement_remarks to service_role;
