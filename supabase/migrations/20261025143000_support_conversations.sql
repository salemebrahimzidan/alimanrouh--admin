-- Customer support inbox. Apply manually only after reviewing this migration.
-- Existing hajj_inquiries rows remain untouched and are copied into the inbox.
-- Guest RPCs are service_role-only and are reached through the Vercel API
-- documented in docs/public-website-integration.md. That API applies shared
-- Upstash limits using Vercel's trusted client-IP helper; SQL trusts no headers.

begin;

do $legacy_hajj_trigger_check$
begin
  if exists (
    select 1
    from pg_catalog.pg_trigger trigger_row
    join pg_catalog.pg_class relation_row on relation_row.oid = trigger_row.tgrelid
    join pg_catalog.pg_namespace namespace_row on namespace_row.oid = relation_row.relnamespace
    join pg_catalog.pg_proc function_row on function_row.oid = trigger_row.tgfoid
    where namespace_row.nspname = 'public'
      and relation_row.relname = 'hajj_inquiries'
      and not trigger_row.tgisinternal
      and (
        trigger_row.tgname ~* '(support.*status|status.*support|sync.*status|status.*sync)'
        or pg_catalog.pg_get_functiondef(trigger_row.tgfoid) ~* 'support_conversations'
      )
  ) then
    raise exception 'A legacy Hajj trigger may synchronize support status; review and remove it before applying this migration.';
  end if;
end;
$legacy_hajj_trigger_check$;

do $pgcrypto_schema_check$
begin
  if exists (
    select 1
    from pg_catalog.pg_extension extension_row
    join pg_catalog.pg_namespace namespace_row on namespace_row.oid = extension_row.extnamespace
    where extension_row.extname = 'pgcrypto'
      and namespace_row.nspname <> 'extensions'
  ) then
    raise exception 'pgcrypto is installed outside extensions; review its existing dependencies and move/reinstall it in a separately approved migration before applying support.';
  end if;
end;
$pgcrypto_schema_check$;

create extension if not exists pgcrypto with schema extensions;

create table public.support_conversations (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  customer_id uuid references public.profiles (id) on delete restrict,
  guest_name text,
  guest_email text,
  guest_phone text,
  subject text not null default 'استفسار',
  topic text not null default 'general',
  context text,
  status text not null default 'new',
  last_message text not null default '',
  last_message_at timestamptz not null default pg_catalog.now(),
  last_message_sender text not null default 'customer',
  admin_unread_count integer not null default 0,
  customer_unread_count integer not null default 0,
  linked_hajj_inquiry_id uuid unique references public.hajj_inquiries (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint support_conversations_participant_check check (
    (customer_id is not null and guest_name is null and guest_email is null and guest_phone is null)
    or
    (customer_id is null and guest_name is not null)
  ),
  constraint support_conversations_subject_length check (pg_catalog.char_length(subject) between 1 and 160),
  constraint support_conversations_topic_check check (topic in ('general', 'contact', 'hajj', 'umrah', 'booking', 'complaint')),
  constraint support_conversations_context_length check (context is null or pg_catalog.char_length(context) <= 240),
  constraint support_conversations_guest_name_length check (guest_name is null or pg_catalog.char_length(guest_name) between 1 and 120),
  constraint support_conversations_guest_email_length check (guest_email is null or pg_catalog.char_length(guest_email) <= 254),
  constraint support_conversations_guest_phone_length check (guest_phone is null or pg_catalog.char_length(guest_phone) <= 30),
  constraint support_conversations_status_check check (status in ('new', 'in_progress', 'resolved')),
  constraint support_conversations_last_sender_check check (last_message_sender in ('customer', 'admin')),
  constraint support_conversations_unread_check check (admin_unread_count >= 0 and customer_unread_count >= 0)
);

create table public.support_guest_access (
  conversation_id uuid primary key references public.support_conversations (id) on delete cascade,
  access_token_hash text not null,
  created_at timestamptz not null default pg_catalog.now()
);

create table public.support_guest_rate_limits (
  rate_key text not null,
  action text not null,
  attempted_at timestamptz not null default pg_catalog.now(),
  constraint support_guest_rate_limits_action_check check (
    action in ('guest_create_contact', 'guest_reply_token')
  )
);

create table public.support_messages (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations (id) on delete cascade,
  sender text not null,
  author_user_id uuid references auth.users (id) on delete set null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  constraint support_messages_sender_check check (sender in ('customer', 'admin')),
  constraint support_messages_body_length check (pg_catalog.char_length(body) between 1 and 5000)
);

create index support_conversations_last_message_idx on public.support_conversations (last_message_at desc);
create index support_conversations_status_idx on public.support_conversations (status, last_message_at desc);
create index support_conversations_customer_idx on public.support_conversations (customer_id, last_message_at desc);
create index support_messages_conversation_idx on public.support_messages (conversation_id, created_at);
create index support_guest_rate_limits_key_time_idx on public.support_guest_rate_limits (rate_key, attempted_at desc);
create index support_guest_rate_limits_time_idx on public.support_guest_rate_limits (attempted_at);

alter table public.support_conversations enable row level security;
alter table public.support_guest_access enable row level security;
alter table public.support_guest_rate_limits enable row level security;
alter table public.support_messages enable row level security;

revoke all on public.support_conversations, public.support_messages,
  public.support_guest_access, public.support_guest_rate_limits
  from public, anon, authenticated, service_role;
grant select on public.support_conversations to authenticated;
grant select on public.support_messages to authenticated;
grant insert (conversation_id, sender, author_user_id, body)
  on public.support_messages to authenticated;

create policy support_conversations_select on public.support_conversations
for select to authenticated
using (public.is_admin() or customer_id = auth.uid());

create policy support_messages_select on public.support_messages
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.support_conversations c
    where c.id = conversation_id and c.customer_id = auth.uid()
  )
);

create policy support_messages_insert on public.support_messages
for insert to authenticated
with check (
  (
    public.is_admin()
    and sender = 'admin'
    and author_user_id = auth.uid()
  )
  or
  (
    not public.is_admin()
    and sender = 'customer'
    and author_user_id = auth.uid()
    and exists (
      select 1 from public.support_conversations c
      where c.id = conversation_id and c.customer_id = auth.uid()
    )
  )
);

create function public.support_message_added()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $func$
begin
  update public.support_conversations
  set
    last_message = new.body,
    last_message_at = new.created_at,
    last_message_sender = new.sender,
    admin_unread_count = admin_unread_count + case
      when new.sender = 'customer' and new.read_at is null then 1 else 0
    end,
    customer_unread_count = customer_unread_count + case
      when new.sender = 'admin' and new.read_at is null then 1 else 0
    end,
    updated_at = pg_catalog.now()
  where id = new.conversation_id;
  return new;
end;
$func$;

create trigger support_messages_after_insert
after insert on public.support_messages
for each row execute function public.support_message_added();

create function public.support_enforce_guest_rate_limit(p_action text, p_identifier text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $func$
declare
  v_key text := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_action || ':' || p_identifier, 'UTF8'), 'sha256'),
    'hex'
  );
  v_window interval := interval '15 minutes';
  v_maximum integer;
  v_count integer;
begin
  v_maximum := case p_action
    when 'guest_create_contact' then 3
    when 'guest_reply_token' then 20
    else null
  end;
  if v_maximum is null or p_identifier is null or p_identifier = '' then
    raise exception 'invalid rate limit key' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key, 0));
  delete from public.support_guest_rate_limits
  where attempted_at < pg_catalog.now() - interval '1 day';

  select count(*) into v_count
  from public.support_guest_rate_limits
  where rate_key = v_key and attempted_at >= pg_catalog.now() - v_window;
  if v_count >= v_maximum then
    raise exception 'too many support requests; try again later' using errcode = '42501';
  end if;

  insert into public.support_guest_rate_limits (rate_key, action) values (v_key, p_action);
end;
$func$;

create function public.support_create_registered_conversation(
  p_subject text,
  p_body text,
  p_topic text default 'general',
  p_context text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $func$
declare
  v_customer_id uuid := auth.uid();
  v_conversation_id uuid;
  v_status text;
begin
  if v_customer_id is null or public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select account_status into v_status from public.profiles where id = v_customer_id;
  if v_status is distinct from 'active' then
    raise exception 'account cannot create support conversations' using errcode = '42501';
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_subject, ''))) not between 1 and 160 then
    raise exception 'subject must be between 1 and 160 characters' using errcode = '22023';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_body, ''))) not between 1 and 5000 then
    raise exception 'message must be between 1 and 5000 characters' using errcode = '22023';
  end if;
  if p_topic is null or p_topic not in ('general', 'contact', 'hajj', 'umrah', 'booking', 'complaint')
    or pg_catalog.char_length(coalesce(p_context, '')) > 240 then
    raise exception 'invalid support conversation context' using errcode = '22023';
  end if;

  insert into public.support_conversations (customer_id, subject, topic, context)
  values (v_customer_id, pg_catalog.btrim(p_subject), p_topic, nullif(pg_catalog.btrim(p_context), ''))
  returning id into v_conversation_id;

  insert into public.support_messages (conversation_id, sender, author_user_id, body)
  values (v_conversation_id, 'customer', v_customer_id, pg_catalog.btrim(p_body));
  return v_conversation_id;
end;
$func$;

create function public.support_create_guest_conversation(
  p_name text,
  p_email text,
  p_phone text,
  p_subject text,
  p_body text,
  p_topic text default 'general',
  p_context text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $func$
declare
  v_token text := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  v_conversation_id uuid;
begin
  if auth.uid() is not null then
    raise exception 'use the registered customer support endpoint' using errcode = '42501';
  end if;

  if nullif(pg_catalog.btrim(coalesce(p_email, '')), '') is null
    and nullif(pg_catalog.btrim(coalesce(p_phone, '')), '') is null
  then
    raise exception 'email or phone is required' using errcode = '22023';
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_name, ''))) not between 1 and 120
    or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_email, ''))) > 254
    or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_phone, ''))) > 30
    or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_subject, ''))) not between 1 and 160
    or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_body, ''))) not between 1 and 5000
    or p_topic is null
    or p_topic not in ('general', 'contact', 'hajj', 'umrah', 'booking', 'complaint')
    or pg_catalog.char_length(coalesce(p_context, '')) > 240
  then
    raise exception 'invalid support conversation details' using errcode = '22023';
  end if;

  perform public.support_enforce_guest_rate_limit(
    'guest_create_contact',
    coalesce(
      nullif(pg_catalog.lower(pg_catalog.btrim(p_email)), ''),
      pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_phone, '')), '[^0-9+]', '', 'g')
    )
  );

  insert into public.support_conversations (
    guest_name, guest_email, guest_phone, subject, topic, context
  )
  values (
    pg_catalog.btrim(p_name),
    nullif(pg_catalog.btrim(coalesce(p_email, '')), ''),
    nullif(pg_catalog.btrim(coalesce(p_phone, '')), ''),
    pg_catalog.btrim(p_subject),
    p_topic,
    nullif(pg_catalog.btrim(p_context), '')
  )
  returning id into v_conversation_id;

  insert into public.support_guest_access (conversation_id, access_token_hash)
  values (
    v_conversation_id,
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256'), 'hex')
  );

  insert into public.support_messages (conversation_id, sender, body)
  values (v_conversation_id, 'customer', pg_catalog.btrim(p_body));

  return pg_catalog.jsonb_build_object('conversation_id', v_conversation_id, 'access_token', v_token);
end;
$func$;

create function public.support_guest_get_conversation(p_conversation_id uuid, p_access_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $func$
declare
  v_conversation public.support_conversations%rowtype;
  v_result jsonb;
begin
  if auth.uid() is not null or p_access_token is null or pg_catalog.char_length(p_access_token) <> 64 then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into v_conversation
  from public.support_conversations
  where id = p_conversation_id and exists (
    select 1
    from public.support_guest_access a
    where a.conversation_id = p_conversation_id
      and a.access_token_hash = pg_catalog.encode(
        extensions.digest(pg_catalog.convert_to(p_access_token, 'UTF8'), 'sha256'),
        'hex'
      )
  )
  for update;

  if not found then
    raise exception 'conversation not found' using errcode = '42501';
  end if;

  update public.support_messages
  set read_at = pg_catalog.now()
  where conversation_id = p_conversation_id and sender = 'admin' and read_at is null;
  update public.support_conversations set customer_unread_count = 0 where id = p_conversation_id;

  select pg_catalog.jsonb_build_object(
    'id', c.id,
    'subject', c.subject,
    'topic', c.topic,
    'context', c.context,
    'status', c.status,
    'last_message', c.last_message,
    'last_message_at', c.last_message_at,
    'messages', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', m.id,
        'sender', m.sender,
        'body', m.body,
        'created_at', m.created_at
      ) order by m.created_at)
      from public.support_messages m
      where m.conversation_id = c.id
    ), '[]'::jsonb)
  ) into v_result
  from public.support_conversations c
  where c.id = p_conversation_id;

  return v_result;
end;
$func$;

create function public.support_guest_reply(p_conversation_id uuid, p_access_token text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $func$
declare
  v_message_id uuid;
  v_found_id uuid;
  v_token_key text;
begin
  if auth.uid() is not null or p_access_token is null or pg_catalog.char_length(p_access_token) <> 64 then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_body, ''))) not between 1 and 5000 then
    raise exception 'message must be between 1 and 5000 characters' using errcode = '22023';
  end if;
  v_token_key := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_access_token, 'UTF8'), 'sha256'),
    'hex'
  );
  select id into v_found_id
  from public.support_conversations
    where id = p_conversation_id
      and exists (
        select 1 from public.support_guest_access a
        where a.conversation_id = p_conversation_id
          and a.access_token_hash = v_token_key
      )
  for update;
  if not found then
    raise exception 'conversation not found' using errcode = '42501';
  end if;

  perform public.support_enforce_guest_rate_limit('guest_reply_token', p_conversation_id::text || ':' || v_token_key);

  insert into public.support_messages (conversation_id, sender, body)
  values (p_conversation_id, 'customer', pg_catalog.btrim(p_body))
  returning id into v_message_id;
  return v_message_id;
end;
$func$;

create function public.support_mark_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $func$
declare
  v_is_admin boolean := public.is_admin();
  v_customer_id uuid := auth.uid();
begin
  if v_customer_id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not v_is_admin and not exists (
    select 1 from public.support_conversations
    where id = p_conversation_id and customer_id = v_customer_id
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  perform 1 from public.support_conversations where id = p_conversation_id for update;
  if not found then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;
  if v_is_admin then
    update public.support_messages
    set read_at = pg_catalog.now()
    where conversation_id = p_conversation_id and sender = 'customer' and read_at is null;
    update public.support_conversations set admin_unread_count = 0 where id = p_conversation_id;
  else
    update public.support_messages
    set read_at = pg_catalog.now()
    where conversation_id = p_conversation_id and sender = 'admin' and read_at is null;
    update public.support_conversations set customer_unread_count = 0 where id = p_conversation_id;
  end if;
end;
$func$;

create function public.support_admin_set_status(p_conversation_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $func$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('new', 'in_progress', 'resolved') then
    raise exception 'invalid conversation status' using errcode = '22023';
  end if;

  update public.support_conversations
  set status = p_status
  where id = p_conversation_id;
  if not found then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;
end;
$func$;

create function public.support_import_hajj_inquiry()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $func$
declare
  v_conversation_id uuid;
  v_status text;
begin
  v_status := case
    when new.internal_status = 'closed' then 'resolved'
    when new.internal_status in ('contacted', 'in_progress') then 'in_progress'
    else 'new'
  end;

  insert into public.support_conversations (
    customer_id, subject, topic, context, status, linked_hajj_inquiry_id
  )
  values (
    new.customer_id,
    coalesce(nullif(pg_catalog.btrim((select title from public.hajj_programs where id = new.program_id)), ''), 'استفسار حج'),
    'hajj',
    new.program_id::text,
    v_status,
    new.id
  )
  on conflict (linked_hajj_inquiry_id) do nothing
  returning id into v_conversation_id;

  if v_conversation_id is null then
    return new;
  end if;

  insert into public.support_messages (conversation_id, sender, author_user_id, body)
  values (
    v_conversation_id,
    'customer',
    new.customer_id,
    coalesce(nullif(pg_catalog.btrim(new.message), ''), 'استفسار من نموذج الحج.')
  );

  return new;
end;
$func$;

create trigger hajj_inquiries_create_support_conversation
after insert on public.hajj_inquiries
for each row execute function public.support_import_hajj_inquiry();

insert into public.support_conversations (
  customer_id, subject, topic, context, status, linked_hajj_inquiry_id, created_at, updated_at
)
select
  i.customer_id,
  coalesce(nullif(pg_catalog.btrim(h.title), ''), 'استفسار حج'),
  'hajj',
  i.program_id::text,
  case
    when i.internal_status = 'closed' then 'resolved'
    when i.internal_status in ('contacted', 'in_progress') then 'in_progress'
    else 'new'
  end,
  i.id,
  i.created_at,
  i.updated_at
from public.hajj_inquiries i
left join public.hajj_programs h on h.id = i.program_id
on conflict (linked_hajj_inquiry_id) do nothing;

insert into public.support_messages (
  conversation_id, sender, author_user_id, body, created_at, read_at
)
select
  c.id,
  'customer',
  c.customer_id,
  coalesce(nullif(pg_catalog.btrim(i.message), ''), 'استفسار من نموذج الحج.'),
  i.created_at,
  case when i.internal_status = 'new' then null else i.updated_at end
from public.support_conversations c
join public.hajj_inquiries i on i.id = c.linked_hajj_inquiry_id
where not exists (
  select 1 from public.support_messages m where m.conversation_id = c.id
);

revoke all on function public.support_message_added() from public, anon, authenticated, service_role;
revoke all on function public.support_enforce_guest_rate_limit(text, text) from public, anon, authenticated, service_role;
revoke all on function public.support_create_registered_conversation(text, text, text, text) from public, anon, service_role;
revoke all on function public.support_create_guest_conversation(text, text, text, text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.support_guest_get_conversation(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.support_guest_reply(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.support_mark_read(uuid) from public, anon, service_role;
revoke all on function public.support_admin_set_status(uuid, text) from public, anon, service_role;
revoke all on function public.support_import_hajj_inquiry() from public, anon, authenticated, service_role;

grant execute on function public.support_create_registered_conversation(text, text, text, text) to authenticated;
grant execute on function public.support_create_guest_conversation(text, text, text, text, text, text, text) to service_role;
grant execute on function public.support_guest_get_conversation(uuid, text) to service_role;
grant execute on function public.support_guest_reply(uuid, text, text) to service_role;
grant execute on function public.support_mark_read(uuid) to authenticated;
grant execute on function public.support_admin_set_status(uuid, text) to authenticated;

do $realtime$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'supabase_realtime publication is missing; enable Supabase Realtime before applying this migration';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_conversations'
  ) then
    alter publication supabase_realtime add table public.support_conversations;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_messages'
  ) then
    alter publication supabase_realtime add table public.support_messages;
  end if;
end;
$realtime$;

commit;
