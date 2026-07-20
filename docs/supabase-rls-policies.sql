-- 밥심 앱: service_role 키를 통한 전체 접근 권한 부여
-- RLS가 활성화된 테이블에 대해 service_role이 모든 작업을 수행할 수 있도록 합니다.

-- 1. service_role에 테이블 권한 부여
grant all on public.clients to service_role;
grant all on public.meal_types to service_role;
grant all on public.default_meal_quantities to service_role;
grant all on public.daily_meal_orders to service_role;
grant all on public.order_change_logs to service_role;
grant all on public.change_requests to service_role;
grant all on public.holidays to service_role;
grant all on public.admins to service_role;
grant all on public.client_devices to service_role;
grant all on public.admin_devices to service_role;
grant all on public.notifications to service_role;
grant all on public.admin_audit_logs to service_role;
grant all on public.delivery_order_overrides to service_role;

-- 2. RLS 정책: service_role은 bypass하므로 별도 정책 불필요
-- 하지만 anon/authenticated 역할도 사용할 경우를 대비해
-- service_role 전용 정책을 추가합니다.

create policy "service_role_all_clients" on public.clients
  for all to service_role using (true) with check (true);

create policy "service_role_all_meal_types" on public.meal_types
  for all to service_role using (true) with check (true);

create policy "service_role_all_default_meal_quantities" on public.default_meal_quantities
  for all to service_role using (true) with check (true);

create policy "service_role_all_daily_meal_orders" on public.daily_meal_orders
  for all to service_role using (true) with check (true);

create policy "service_role_all_order_change_logs" on public.order_change_logs
  for all to service_role using (true) with check (true);

create policy "service_role_all_change_requests" on public.change_requests
  for all to service_role using (true) with check (true);

create policy "service_role_all_holidays" on public.holidays
  for all to service_role using (true) with check (true);

create policy "service_role_all_admins" on public.admins
  for all to service_role using (true) with check (true);

create policy "service_role_all_client_devices" on public.client_devices
  for all to service_role using (true) with check (true);

create policy "service_role_all_admin_devices" on public.admin_devices
  for all to service_role using (true) with check (true);

create policy "service_role_all_notifications" on public.notifications
  for all to service_role using (true) with check (true);

create policy "service_role_all_admin_audit_logs" on public.admin_audit_logs
  for all to service_role using (true) with check (true);

create policy "service_role_all_delivery_order_overrides" on public.delivery_order_overrides
  for all to service_role using (true) with check (true);

grant all on public.settlement_accounts to service_role;
grant all on public.contact_access_groups to service_role;
grant all on public.contact_access_group_members to service_role;
grant all on public.monthly_settlement_adjustments to service_role;

create policy "service_role_all_settlement_accounts" on public.settlement_accounts
  for all to service_role using (true) with check (true);

create policy "service_role_all_contact_access_groups" on public.contact_access_groups
  for all to service_role using (true) with check (true);

create policy "service_role_all_contact_access_group_members" on public.contact_access_group_members
  for all to service_role using (true) with check (true);

create policy "service_role_all_monthly_settlement_adjustments" on public.monthly_settlement_adjustments
  for all to service_role using (true) with check (true);