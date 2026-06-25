create extension if not exists pgcrypto;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  address_detail text not null default '',
  manager_name text not null,
  manager_phone text not null,
  delivery_memo text not null default '',
  delivery_order integer not null,
  status text not null default 'active' check (status in ('active', 'paused')),
  invite_code text not null unique,
  invite_pin text not null,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meal_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cutoff_time time not null default '10:00',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.default_meal_quantities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  meal_type_id uuid not null references public.meal_types(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  quantity integer not null check (quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, meal_type_id, weekday)
);

create table if not exists public.daily_meal_orders (
  id uuid primary key default gen_random_uuid(),
  order_date date not null,
  client_id uuid not null references public.clients(id) on delete cascade,
  meal_type_id uuid not null references public.meal_types(id) on delete restrict,
  base_quantity integer not null check (base_quantity >= 0),
  final_quantity integer not null check (final_quantity >= 0),
  status text not null default 'normal' check (status in ('normal', 'changed', 'rejected', 'pending', 'holiday')),
  memo text,
  requires_review boolean not null default false,
  acknowledged boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (order_date, client_id, meal_type_id)
);

create table if not exists public.order_change_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.daily_meal_orders(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  meal_type_id uuid not null references public.meal_types(id) on delete restrict,
  order_date date not null,
  actor_type text not null check (actor_type in ('client', 'admin')),
  actor_name text not null,
  before_quantity integer not null check (before_quantity >= 0),
  after_quantity integer not null check (after_quantity >= 0),
  memo text,
  created_at timestamptz not null default now()
);

create table if not exists public.change_requests (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('late_quantity', 'late_rejection', 'address_update', 'contact_update')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  client_id uuid not null references public.clients(id) on delete cascade,
  order_id uuid references public.daily_meal_orders(id) on delete set null,
  meal_type_id uuid references public.meal_types(id) on delete set null,
  order_date date,
  current_quantity integer check (current_quantity >= 0),
  requested_quantity integer check (requested_quantity >= 0),
  current_address text,
  requested_address text,
  current_address_detail text,
  requested_address_detail text,
  current_manager_name text,
  requested_manager_name text,
  current_manager_phone text,
  requested_manager_phone text,
  memo text,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null,
  name text not null,
  client_id uuid references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (holiday_date, client_id)
);

create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.client_devices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  label text,
  push_endpoint text,
  push_key_p256dh text,
  push_key_auth text,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_devices (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.admins(id) on delete cascade,
  label text,
  push_endpoint text,
  push_key_p256dh text,
  push_key_auth text,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  target text not null check (target in ('admin', 'client')),
  client_id uuid references public.clients(id) on delete cascade,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  admin_name text not null,
  target_label text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_order_overrides (
  id uuid primary key default gen_random_uuid(),
  order_date date not null,
  meal_type_id uuid not null references public.meal_types(id) on delete cascade,
  client_order uuid[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_date, meal_type_id)
);

create index if not exists clients_status_delivery_order_idx
  on public.clients (status, delivery_order);

create index if not exists clients_name_idx
  on public.clients (name);

create index if not exists daily_meal_orders_date_meal_idx
  on public.daily_meal_orders (order_date, meal_type_id);

create index if not exists daily_meal_orders_client_date_idx
  on public.daily_meal_orders (client_id, order_date desc);

create index if not exists change_requests_status_requested_idx
  on public.change_requests (status, requested_at desc);

create index if not exists order_change_logs_client_date_idx
  on public.order_change_logs (client_id, order_date desc);

create index if not exists notifications_target_read_idx
  on public.notifications (target, read, created_at desc);

alter table public.clients enable row level security;
alter table public.meal_types enable row level security;
alter table public.default_meal_quantities enable row level security;
alter table public.daily_meal_orders enable row level security;
alter table public.order_change_logs enable row level security;
alter table public.change_requests enable row level security;
alter table public.holidays enable row level security;
alter table public.admins enable row level security;
alter table public.client_devices enable row level security;
alter table public.admin_devices enable row level security;
alter table public.notifications enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.delivery_order_overrides enable row level security;

insert into public.meal_types (name, cutoff_time, enabled)
select '점심', '10:00', true
where not exists (select 1 from public.meal_types where name = '점심');
