-- Transactional support inbox authorization checks.
-- Run only on a disposable/local database or a reviewed test project after the
-- support migration. All test rows and changes are rolled back.
-- Requires one existing admin account and one active non-admin customer.

begin;

create temporary table support_test_fixtures (
  name text primary key,
  user_id uuid,
  conversation_id uuid,
  access_token text
);
grant select, insert on support_test_fixtures to anon, authenticated, service_role;

insert into support_test_fixtures (name, user_id)
select 'admin', user_id from public.admin_accounts limit 1;

insert into support_test_fixtures (name, user_id)
select 'customer', p.id
from public.profiles p
where p.account_status = 'active'
  and not exists (select 1 from public.admin_accounts a where a.user_id = p.id)
limit 1;

do $preflight$
begin
  if not exists (select 1 from pg_temp.support_test_fixtures where name = 'admin') then
    raise exception 'support RLS review needs an admin_accounts row';
  end if;
  if not exists (select 1 from pg_temp.support_test_fixtures where name = 'customer') then
    raise exception 'support RLS review needs one active non-admin profile';
  end if;
end;
$preflight$;

set local role authenticated;
select set_config('request.jwt.claim.sub', user_id::text, true)
from pg_temp.support_test_fixtures where name = 'customer';
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into pg_temp.support_test_fixtures (name, conversation_id)
values (
  'registered_conversation',
  public.support_create_registered_conversation('RLS test', 'Registered customer test message')
);

do $customer_checks$
declare
  v_own uuid;
  v_visible integer;
begin
  select conversation_id into v_own
  from pg_temp.support_test_fixtures where name = 'registered_conversation';

  select count(*) into v_visible from public.support_conversations;
  if v_visible < 1 or exists (
    select 1 from public.support_conversations where customer_id is distinct from (
      select user_id from pg_temp.support_test_fixtures where name = 'customer'
    )
  ) then
    raise exception 'registered customer can see a conversation outside their own account';
  end if;
  if not exists (
    select 1 from public.support_messages
    where conversation_id = v_own and sender = 'customer'
  ) then
    raise exception 'registered customer cannot read their own message';
  end if;

  insert into public.support_messages (conversation_id, sender, author_user_id, body)
  values (v_own, 'customer', auth.uid(), 'Customer reply through row level security');
  if not exists (
    select 1 from public.support_messages
    where conversation_id = v_own
      and sender = 'customer'
      and body = 'Customer reply through row level security'
  ) then
    raise exception 'registered customer cannot send a message to their own conversation';
  end if;

  begin
    perform public.support_admin_set_status(v_own, 'resolved');
    raise exception 'registered customer changed conversation status';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.support_conversations set admin_unread_count = 99 where id = v_own;
    raise exception 'registered customer changed an unread counter directly';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.support_messages set read_at = now()
    where conversation_id = v_own and sender = 'customer';
    raise exception 'registered customer marked their own message read';
  exception when insufficient_privilege then
    null;
  end;

  if has_column_privilege(current_user, 'public.support_conversations', 'admin_unread_count', 'UPDATE')
    or has_column_privilege(current_user, 'public.support_conversations', 'customer_unread_count', 'UPDATE')
    or has_column_privilege(current_user, 'public.support_conversations', 'status', 'UPDATE')
    or has_column_privilege(current_user, 'public.support_messages', 'read_at', 'UPDATE')
  then
    raise exception 'authenticated role has direct access to protected support fields';
  end if;
end;
$customer_checks$;

-- A different authenticated identity must not see the customer's conversation.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
do $other_customer_check$
declare
  v_visible integer;
begin
  select count(*) into v_visible from public.support_conversations;
  if v_visible <> 0 then
    raise exception 'unrelated authenticated user can see % conversations', v_visible;
  end if;
end;
$other_customer_check$;

-- The administrator can see all conversations and change status through RPC.
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from pg_temp.support_test_fixtures where name = 'admin'),
  true
);
do $admin_checks$
declare
  v_conversation_id uuid;
  v_visible integer;
begin
  select conversation_id into v_conversation_id
  from pg_temp.support_test_fixtures where name = 'registered_conversation';
  select count(*) into v_visible from public.support_conversations;
  if v_visible < 1 then raise exception 'admin cannot read the support inbox'; end if;
  perform public.support_admin_set_status(v_conversation_id, 'in_progress');
  if not exists (
    select 1 from public.support_conversations
    where id = v_conversation_id and status = 'in_progress'
  ) then
    raise exception 'admin status change was not saved';
  end if;
  if has_column_privilege(current_user, 'public.support_conversations', 'status', 'UPDATE') then
    raise exception 'admin received direct status update privilege; status changes must use the verified RPC';
  end if;
  begin
    update public.support_conversations set status = 'resolved' where id = v_conversation_id;
    raise exception 'admin changed status without the admin RPC';
  exception when insufficient_privilege then
    null;
  end;
  perform public.support_mark_read(v_conversation_id);
  if exists (
    select 1 from public.support_conversations
    where id = v_conversation_id and (admin_unread_count <> 0 or customer_unread_count <> 0)
  ) then
    raise exception 'admin read receipt did not clear only admin-side unread count';
  end if;

  insert into public.support_messages (conversation_id, sender, author_user_id, body)
  values (v_conversation_id, 'admin', auth.uid(), 'Admin reply through row level security');
  if not exists (
    select 1 from public.support_conversations
    where id = v_conversation_id and customer_unread_count = 1
  ) then
    raise exception 'admin reply did not increment the customer unread count';
  end if;
end;
$admin_checks$;

-- Anon clients cannot invoke the privileged guest RPCs directly.
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

do $anonymous_guest_checks$
begin
  if has_table_privilege(current_user, 'public.support_conversations', 'SELECT')
    or has_table_privilege(current_user, 'public.support_messages', 'SELECT')
    or has_table_privilege(current_user, 'public.support_guest_access', 'SELECT')
  then
    raise exception 'anonymous role can read support tables or token hashes directly';
  end if;
  if has_function_privilege(
    current_user,
    'public.support_create_guest_conversation(text,text,text,text,text,text,text)',
    'EXECUTE'
  ) or has_function_privilege(
    current_user,
    'public.support_guest_get_conversation(uuid,text)',
    'EXECUTE'
  ) or has_function_privilege(
    current_user,
    'public.support_guest_reply(uuid,text,text)',
    'EXECUTE'
  ) then
    raise exception 'anon can execute a service-role-only guest RPC directly';
  end if;
end;
$anonymous_guest_checks$;

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

insert into pg_temp.support_test_fixtures (name, conversation_id, access_token)
select
  'guest_one',
  (result ->> 'conversation_id')::uuid,
  result ->> 'access_token'
from (
  select public.support_create_guest_conversation(
    'Guest One', 'guest-one@example.test', null, 'Guest test one', 'Guest message one'
  ) as result
) created;

insert into pg_temp.support_test_fixtures (name, conversation_id, access_token)
select
  'guest_two',
  (result ->> 'conversation_id')::uuid,
  result ->> 'access_token'
from (
  select public.support_create_guest_conversation(
    'Guest Two', 'guest-two@example.test', null, 'Guest test two', 'Guest message two'
  ) as result
) created;

do $guest_checks$
declare
  v_one uuid;
  v_two uuid;
  v_one_token text;
  v_two_token text;
  v_data jsonb;
  v_index integer;
begin
  select conversation_id, access_token into v_one, v_one_token
  from pg_temp.support_test_fixtures where name = 'guest_one';
  select conversation_id, access_token into v_two, v_two_token
  from pg_temp.support_test_fixtures where name = 'guest_two';

  v_data := public.support_guest_get_conversation(v_one, v_one_token);
  if v_data ->> 'id' <> v_one::text then
    raise exception 'guest token failed to retrieve its own conversation';
  end if;

  begin
    perform public.support_guest_get_conversation(v_two, v_one_token);
    raise exception 'guest token exposed a different guest conversation';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.support_guest_get_conversation(v_one, v_two_token);
    raise exception 'another guest token exposed this conversation';
  exception when insufficient_privilege then
    null;
  end;

  perform public.support_guest_reply(v_one, v_one_token, 'Guest reply test');

  for v_index in 1..19 loop
    perform public.support_guest_reply(v_one, v_one_token, 'Guest rate limit test');
  end loop;
  begin
    perform public.support_guest_reply(v_one, v_one_token, 'Reply beyond limit');
    raise exception 'guest reply rate limit was not enforced';
  exception when insufficient_privilege then
    null;
  end;

  for v_index in 1..2 loop
    perform public.support_create_guest_conversation(
      'Guest One', 'guest-one@example.test', null, 'Guest repeated test', 'Repeated message'
    );
  end loop;
  begin
    perform public.support_create_guest_conversation(
      'Guest One', 'guest-one@example.test', null, 'Guest repeated test', 'Over limit'
    );
    raise exception 'guest conversation creation rate limit was not enforced';
  exception when insufficient_privilege then
    null;
  end;
end;
$guest_checks$;

-- Registered customers cannot access guest conversations, even with an id.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from pg_temp.support_test_fixtures where name = 'customer'),
  true
);
do $guest_isolation$
declare
  v_guest_id uuid;
  v_visible integer;
begin
  select conversation_id into v_guest_id
  from pg_temp.support_test_fixtures where name = 'guest_one';
  select count(*) into v_visible from public.support_conversations where id = v_guest_id;
  if v_visible <> 0 then
    raise exception 'registered customer can read a guest conversation';
  end if;
  begin
    perform public.support_mark_read(v_guest_id);
    raise exception 'registered customer marked a guest conversation read';
  exception when insufficient_privilege then
    null;
  end;
end;
$guest_isolation$;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from pg_temp.support_test_fixtures where name = 'customer'),
  true
);
do $customer_receipt$
declare
  v_conversation_id uuid;
begin
  select conversation_id into v_conversation_id
  from pg_temp.support_test_fixtures where name = 'registered_conversation';
  perform public.support_mark_read(v_conversation_id);
  if exists (
    select 1 from public.support_conversations
    where id = v_conversation_id and customer_unread_count <> 0
  ) then
    raise exception 'customer read receipt did not clear their unread admin replies';
  end if;
end;
$customer_receipt$;

rollback;
