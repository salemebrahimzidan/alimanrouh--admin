-- Read-only preflight for 20261025143000_support_conversations.sql.
-- Run in the Supabase SQL Editor against the intended project before approval.
-- Every top-level statement is SELECT-only. The dynamic queries below use
-- query_to_xml only to count rows after confirming the required objects exist.
-- This script does not change rows, schema, grants, or Supabase configuration.
-- Review every result. Resolve missing prerequisites and name conflicts before
-- considering the support migration.

-- 1. Connection, required roles, schemas, and the Realtime publication.
select
  current_database() as database_name,
  current_user as executing_role,
  current_setting('server_version') as postgres_version,
  to_regnamespace('auth') is not null as auth_schema_exists,
  to_regnamespace('extensions') is not null as extensions_schema_exists,
  exists (select 1 from pg_roles where rolname = 'anon') as anon_role_exists,
  exists (select 1 from pg_roles where rolname = 'authenticated') as authenticated_role_exists,
  exists (select 1 from pg_roles where rolname = 'service_role') as service_role_exists,
  exists (select 1 from pg_publication where pubname = 'supabase_realtime') as realtime_publication_exists;

-- 2. Required base relations and columns. Check every required row is present
-- with the expected type; absent or mismatched rows are deployment blockers.
with required_columns(schema_name, table_name, column_name, expected_type) as (
  values
    ('auth', 'users', 'id', 'uuid'),
    ('public', 'profiles', 'id', 'uuid'),
    ('public', 'admin_accounts', 'user_id', 'uuid'),
    ('public', 'hajj_programs', 'id', 'uuid'),
    ('public', 'hajj_programs', 'title', 'text'),
    ('public', 'hajj_inquiries', 'id', 'uuid'),
    ('public', 'hajj_inquiries', 'customer_id', 'uuid'),
    ('public', 'hajj_inquiries', 'program_id', 'uuid'),
    ('public', 'hajj_inquiries', 'message', 'text'),
    ('public', 'hajj_inquiries', 'internal_status', 'text'),
    ('public', 'hajj_inquiries', 'created_at', 'timestamp with time zone'),
    ('public', 'hajj_inquiries', 'updated_at', 'timestamp with time zone')
)
select
  required.schema_name,
  required.table_name,
  required.column_name,
  required.expected_type,
  actual.data_type as actual_type,
  actual.udt_name as actual_udt_name,
  actual.column_name is not null
    and actual.data_type = required.expected_type as prerequisite_matches
from required_columns required
left join information_schema.columns actual
  on actual.table_schema = required.schema_name
  and actual.table_name = required.table_name
  and actual.column_name = required.column_name
order by required.schema_name, required.table_name, required.column_name;

-- 3. Foreign-key dependencies used when the support tables are created.
with required_foreign_keys(
  constraint_label,
  source_schema,
  source_table,
  source_column,
  target_schema,
  target_table,
  target_column
) as (
  values
    ('profiles.id -> auth.users.id', 'public', 'profiles', 'id', 'auth', 'users', 'id'),
    ('hajj_inquiries.customer_id -> profiles.id', 'public', 'hajj_inquiries', 'customer_id', 'public', 'profiles', 'id'),
    ('hajj_inquiries.program_id -> hajj_programs.id', 'public', 'hajj_inquiries', 'program_id', 'public', 'hajj_programs', 'id')
)
select
  required.constraint_label,
  exists (
    select 1
    from pg_constraint constraint_row
    join pg_attribute source_column
      on source_column.attrelid = constraint_row.conrelid
      and source_column.attname = required.source_column
      and not source_column.attisdropped
    join pg_attribute target_column
      on target_column.attrelid = constraint_row.confrelid
      and target_column.attname = required.target_column
      and not target_column.attisdropped
    where constraint_row.contype = 'f'
      and constraint_row.conrelid = to_regclass(required.source_schema || '.' || required.source_table)
      and constraint_row.confrelid = to_regclass(required.target_schema || '.' || required.target_table)
      and constraint_row.conkey = array[source_column.attnum]::smallint[]
      and constraint_row.confkey = array[target_column.attnum]::smallint[]
  ) as foreign_key_exists
from required_foreign_keys required
order by required.constraint_label;

-- 4. Functions and extension used by the migration. The migration qualifies
-- pgcrypto calls in extensions and uses pg_catalog, pg_temp search paths.
select
  to_regprocedure('auth.uid()') is not null as auth_uid_exists,
  to_regprocedure('public.is_admin()') is not null as public_is_admin_exists,
  coalesce((
    select p.prosecdef
    from pg_proc p
    where p.oid = to_regprocedure('public.is_admin()')
  ), false) as public_is_admin_is_security_definer,
  extension.extname as pgcrypto_extension,
  extension_schema.nspname as pgcrypto_schema,
  (extension.extname = 'pgcrypto' and extension_schema.nspname = 'extensions') as pgcrypto_in_required_schema,
  to_regprocedure('extensions.digest(bytea,text)') is not null as pgcrypto_digest_available,
  to_regprocedure('extensions.gen_random_bytes(integer)') is not null as pgcrypto_random_bytes_available,
  to_regprocedure('pg_catalog.gen_random_uuid()') is not null as gen_random_uuid_available
from (values (1)) as singleton(dummy)
left join pg_extension extension on extension.extname = 'pgcrypto'
left join pg_namespace extension_schema on extension_schema.oid = extension.extnamespace;

-- 5. Effective CREATE privileges on schemas searched by the migration's
-- SECURITY DEFINER routines. Any CREATE privilege for PUBLIC, anon, or
-- authenticated is a deployment blocker; named-role checks include inherited
-- PUBLIC privileges and role memberships.
with required_schemas(schema_name) as (
  values ('public'), ('extensions')
)
select
  required.schema_name,
  pg_catalog.has_schema_privilege(current_user, namespace.oid, 'USAGE') as current_role_has_usage,
  pg_catalog.has_schema_privilege(current_user, namespace.oid, 'CREATE') as current_role_has_create,
  exists (
    select 1
    from pg_catalog.aclexplode(coalesce(
      namespace.nspacl,
      pg_catalog.acldefault('n', namespace.nspowner)
    )) acl
    where acl.grantee = 0
      and acl.privilege_type = 'CREATE'
  ) as public_role_has_create,
  case when anon_role.oid is null then null
    else pg_catalog.has_schema_privilege(anon_role.oid, namespace.oid, 'CREATE')
  end as anon_effective_create,
  case when authenticated_role.oid is null then null
    else pg_catalog.has_schema_privilege(authenticated_role.oid, namespace.oid, 'CREATE')
  end as authenticated_effective_create
from required_schemas required
left join pg_catalog.pg_namespace namespace on namespace.nspname = required.schema_name
left join pg_catalog.pg_roles anon_role on anon_role.rolname = 'anon'
left join pg_catalog.pg_roles authenticated_role on authenticated_role.rolname = 'authenticated'
order by required.schema_name;

-- 6. Relations (including tables, views, indexes, and sequences) whose names
-- the migration creates in public. Any returned row is a name conflict.
with reserved_names(name) as (
  values
    ('support_conversations'),
    ('support_guest_access'),
    ('support_guest_rate_limits'),
    ('support_messages'),
    ('support_conversations_last_message_idx'),
    ('support_conversations_status_idx'),
    ('support_conversations_customer_idx'),
    ('support_messages_conversation_idx'),
    ('support_guest_rate_limits_key_time_idx'),
    ('support_guest_rate_limits_time_idx')
)
select
  n.nspname as schema_name,
  c.relname as conflicting_relation,
  c.relkind as relation_kind
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join reserved_names reserved on reserved.name = c.relname
where n.nspname = 'public'
order by c.relname;

-- 7. Exact function signatures created by the migration. Any returned row is
-- a conflict; other overloads with different signatures do not conflict.
with reserved_functions(signature) as (
  values
    ('public.support_message_added()'),
    ('public.support_enforce_guest_rate_limit(text,text)'),
    ('public.support_create_registered_conversation(text,text,text,text)'),
    ('public.support_create_guest_conversation(text,text,text,text,text,text,text)'),
    ('public.support_guest_get_conversation(uuid,text)'),
    ('public.support_guest_reply(uuid,text,text)'),
    ('public.support_mark_read(uuid)'),
    ('public.support_admin_set_status(uuid,text)'),
    ('public.support_import_hajj_inquiry()')
)
select
  reserved.signature as conflicting_function,
  p.proowner::regrole as function_owner,
  p.prosecdef as is_security_definer
from reserved_functions reserved
join pg_proc p on p.oid = to_regprocedure(reserved.signature)
order by reserved.signature;

-- 8. Trigger-name conflicts on the relations where the migration creates
-- triggers. Also list every current Hajj inquiry trigger. Review all Hajj
-- triggers and resolve any status-sync candidate before applying the migration.
with target_triggers(schema_name, table_name, trigger_name) as (
  values
    ('public', 'support_messages', 'support_messages_after_insert'),
    ('public', 'hajj_inquiries', 'hajj_inquiries_create_support_conversation')
)
select
  n.nspname as schema_name,
  c.relname as table_name,
  t.tgname as trigger_name,
  p.proname as trigger_function,
  pg_catalog.pg_get_triggerdef(t.oid, true) as trigger_definition,
  pg_catalog.pg_get_functiondef(p.oid) as trigger_function_definition,
  t.tgenabled as enabled_state,
  (target.trigger_name is not null) as name_conflict,
  (
    t.tgname ~* '(support.*status|status.*support|sync.*status|status.*sync)'
    or pg_catalog.pg_get_functiondef(p.oid) ~* 'support_conversations'
  ) as potential_support_status_sync
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
left join target_triggers target
  on target.schema_name = n.nspname
  and target.table_name = c.relname
  and target.trigger_name = t.tgname
where not t.tgisinternal
  and (
    target.trigger_name is not null
    or (n.nspname = 'public' and c.relname = 'hajj_inquiries')
  )
order by n.nspname, c.relname, t.tgname;

-- 9. Policy-name conflicts on support tables, plus existing policies on the
-- base tables whose behavior must remain unchanged.
with target_policies(table_name, policy_name) as (
  values
    ('support_conversations', 'support_conversations_select'),
    ('support_messages', 'support_messages_select'),
    ('support_messages', 'support_messages_insert')
)
select
  n.nspname as schema_name,
  c.relname as table_name,
  p.polname as policy_name,
  p.polcmd as command,
  case when target.policy_name is null then false else true end as name_conflict
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
left join target_policies target
  on target.table_name = c.relname
  and target.policy_name = p.polname
where n.nspname = 'public'
  and (
    target.policy_name is not null
    or c.relname in ('profiles', 'admin_accounts', 'hajj_programs', 'hajj_inquiries')
  )
order by c.relname, p.polname;

-- 10. Baseline data counts and Hajj status distribution. Dynamic SELECTs are
-- invoked only if the required relations/columns exist. The output contains
-- aggregate counts only, not customer names, contact details, or message text.
select
  case
    when to_regclass('auth.users') is not null
      and to_regclass('public.profiles') is not null
      and to_regclass('public.admin_accounts') is not null
      and to_regclass('public.hajj_inquiries') is not null
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'hajj_inquiries'
          and column_name = 'internal_status'
      )
    then query_to_xml(
      'select
         (select count(*) from auth.users) as auth_user_count,
         (select count(*) from public.profiles) as profile_count,
         (select count(*) from public.admin_accounts) as admin_account_count,
         (select count(*) from public.hajj_inquiries) as hajj_inquiry_count',
      true, false, ''
    )
    else '<preflight status="blocked: required relations or columns are missing" />'::xml
  end as aggregate_baseline_counts,
  case
    when to_regclass('public.hajj_inquiries') is not null
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'hajj_inquiries'
          and column_name = 'internal_status'
      )
    then query_to_xml(
      'select internal_status, count(*) as inquiry_count
       from public.hajj_inquiries
       group by internal_status
       order by internal_status',
      true, false, ''
    )
    else '<preflight status="blocked: hajj_inquiries.internal_status is missing" />'::xml
  end as hajj_inquiries_by_status;

-- 11. Realtime publication prerequisites and existing membership. The support
-- migration requires the publication; existing support membership is reported
-- because this migration adds either table only if it is not already present.
select
  publication.pubname,
  publication.pubowner::regrole as publication_owner,
  pg_has_role(current_user, publication.pubowner, 'MEMBER') as can_assume_publication_owner,
  publication.puballtables as publishes_all_tables,
  publication.pubinsert as publishes_inserts,
  publication.pubupdate as publishes_updates,
  publication.pubdelete as publishes_deletes,
  member.schemaname,
  member.tablename,
  member.attnames as published_columns,
  member.rowfilter
from pg_publication publication
left join pg_publication_tables member
  on member.pubname = publication.pubname
  and member.schemaname = 'public'
  and member.tablename in ('support_conversations', 'support_messages')
where publication.pubname = 'supabase_realtime'
order by member.tablename;
