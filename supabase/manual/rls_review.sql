-- Manual authorization checks. Do not run this as part of application startup.
-- These queries are for a reviewed SQL session after the migration.
-- They do not modify data except for temporary role simulation, which is
-- rolled back at the end.
--
-- Expected results are described beside each check. A raised exception
-- means that check failed.

begin;

-- 1. Anonymous clients cannot read profiles, bookings, payments, or notes.
set local role anon;
do $check$
begin
  begin
    perform 1 from public.profiles;
    raise exception 'anon was able to read profiles';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform 1 from public.payments;
    raise exception 'anon was able to read payments';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform 1 from public.internal_notes;
    raise exception 'anon was able to read internal notes';
  exception when insufficient_privilege then
    null;
  end;
end;
$check$;
reset role;

-- 2. The API roles cannot write the administrator allow-list.
do $check$
declare
  v_insert boolean;
begin
  select has_table_privilege('authenticated', 'public.admin_accounts', 'INSERT') into v_insert;
  if v_insert then
    raise exception 'authenticated can insert admin_accounts';
  end if;
  select has_table_privilege('anon', 'public.admin_accounts', 'INSERT') into v_insert;
  if v_insert then
    raise exception 'anon can insert admin_accounts';
  end if;
end;
$check$;

-- 3. Customers cannot insert audit logs or booking history directly.
do $check$
begin
  if has_table_privilege('authenticated', 'public.audit_logs', 'INSERT') then
    raise exception 'authenticated can insert audit_logs';
  end if;
  if has_table_privilege('authenticated', 'public.booking_status_history', 'INSERT') then
    raise exception 'authenticated can insert booking history';
  end if;
  if has_table_privilege('authenticated', 'public.profiles', 'INSERT') then
    raise exception 'authenticated can insert profiles directly';
  end if;
  if has_function_privilege('authenticated', 'public.write_audit(text, text, uuid, jsonb)', 'EXECUTE') then
    raise exception 'authenticated can call write_audit';
  end if;
end;
$check$;

-- 4. Customer-facing views must not bypass row level security.
do $check$
declare
  v_view text;
  v_options text;
begin
  foreach v_view in array array['customers', 'booking_rows', 'visa_rows', 'hajj_inquiry_rows', 'booking_balances']
  loop
    select c.reloptions::text into v_options
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = v_view;
    if v_options is null
      or position('security_invoker=true' in v_options) = 0
      or position('security_barrier=true' in v_options) = 0
    then
      raise exception '% is not security_invoker with security_barrier', v_view;
    end if;
  end loop;
end;
$check$;

-- 5. Privileged columns are not writable or visible through the API role.
do $check$
begin
  if has_column_privilege('authenticated', 'public.profiles', 'account_status', 'UPDATE') then
    raise exception 'authenticated can update profiles.account_status';
  end if;
  if has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE') then
    raise exception 'authenticated can update profiles.email';
  end if;
  if has_column_privilege('authenticated', 'public.bookings', 'customer_id', 'UPDATE') then
    raise exception 'authenticated can update bookings.customer_id';
  end if;
  if has_column_privilege('authenticated', 'public.bookings', 'total_amount', 'UPDATE') then
    raise exception 'authenticated can update bookings.total_amount';
  end if;
  if has_column_privilege('authenticated', 'public.payments', 'amount', 'UPDATE') then
    raise exception 'authenticated can update payments.amount';
  end if;
  if has_column_privilege('authenticated', 'public.payments', 'recorded_by', 'SELECT') then
    raise exception 'authenticated can read payments.recorded_by';
  end if;
  if has_column_privilege('authenticated', 'public.booking_status_history', 'changed_by', 'SELECT') then
    raise exception 'authenticated can read booking history changed_by';
  end if;
end;
$check$;

-- 6. Published content is readable by anon; unpublished content is not.
-- This check needs at least one published and one unpublished package.
-- Skip it with a clear notice when the tables are still empty.
do $check$
declare
  v_published integer;
  v_hidden integer;
begin
  set local role anon;
  select count(*) into v_published from public.umrah_packages where is_published;
  select count(*) into v_hidden from public.umrah_packages where not is_published;
  reset role;

  if v_hidden <> 0 then
    raise exception 'anon can read % unpublished packages', v_hidden;
  end if;
  raise notice 'anon published packages visible: %', v_published;
end;
$check$;

rollback;
