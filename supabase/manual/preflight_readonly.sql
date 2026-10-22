-- Read-only preflight for the admin schema migration.
-- Run this in the Supabase SQL editor as the project owner before
-- 20261020120000_init_admin_schema.sql.
-- The transaction is READ ONLY. It cannot add, change, or remove data.
-- Relations that may be absent, including public.profiles, are never named
-- directly. PostgreSQL resolves every real table reference while parsing,
-- including references hidden in an unused CASE branch. Optional row counts
-- run from a query string only after to_regclass() finds the relation.
-- Read every returned row. severity "block" means do not run the migration
-- until that condition is resolved outside this script.
-- severity "review" needs a human decision. severity "info" is context.

begin read only;

select check_id, severity, status, detail
from (
  select
    'reserved-relation' as check_id,
    'block' as severity,
    'conflict' as status,
    n.nspname || '.' || c.relname || ' already exists' as detail
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = any (array[
      'profiles', 'admin_accounts', 'umrah_packages', 'hajj_programs', 'bookings',
      'booking_status_history', 'hajj_inquiries', 'visa_applications', 'customer_documents',
      'payments', 'website_content', 'internal_notes', 'audit_logs', 'customers',
      'booking_rows', 'visa_rows', 'hajj_inquiry_rows', 'booking_balances',
      'booking_ref_seq', 'visa_ref_seq', 'profiles_email_unique', 'profiles_created_at_idx',
      'profiles_status_idx', 'profiles_search_idx', 'bookings_customer_idx', 'bookings_status_idx',
      'booking_history_booking_idx', 'hajj_inquiries_customer_idx', 'hajj_inquiries_status_idx',
      'visa_customer_idx', 'visa_status_idx', 'documents_customer_idx', 'documents_visa_idx',
      'payments_customer_idx', 'payments_booking_idx', 'website_content_kind_idx',
      'internal_notes_entity_idx', 'audit_logs_created_idx', 'umrah_packages_published_idx',
      'hajj_programs_published_idx'
    ])

  union all

  select
    'reserved-function',
    'block',
    'conflict',
    p.proname || ' already exists in public'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any (array[
      'is_admin', 'set_updated_at', 'write_audit', 'handle_new_user', 'handle_auth_user_updated',
      'protect_profile_update', 'audit_profile_status', 'assign_booking_reference',
      'prepare_customer_booking', 'record_booking_status', 'guard_booking_update',
      'assign_visa_reference', 'prepare_customer_visa', 'guard_visa_update', 'audit_visa_status',
      'prepare_hajj_inquiry', 'guard_hajj_inquiry_update', 'audit_hajj_inquiry',
      'prepare_customer_document', 'guard_payment_write', 'audit_payment', 'sync_hajj_publication',
      'audit_publication', 'set_internal_note_author', 'admin_set_booking_status',
      'admin_set_visa_status', 'admin_set_account_status', 'admin_payment_summary'
    ])

  union all

  select
    'reserved-policy',
    'block',
    'conflict',
    n.nspname || '.' || c.relname || '.' || pol.polname || ' already exists'
  from pg_policy pol
  join pg_class c on c.oid = pol.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'storage')
    and pol.polname = any (array[
      'profiles_select', 'profiles_update', 'admin_accounts_select',
      'umrah_packages_public_select', 'umrah_packages_admin_select', 'umrah_packages_insert', 'umrah_packages_update',
      'hajj_programs_public_select', 'hajj_programs_admin_select', 'hajj_programs_insert', 'hajj_programs_update',
      'bookings_select', 'bookings_insert', 'bookings_update', 'booking_history_select',
      'hajj_inquiries_select', 'hajj_inquiries_insert', 'hajj_inquiries_update', 'hajj_inquiries_delete',
      'visas_select', 'visas_insert', 'visas_update',
      'documents_select', 'documents_insert', 'documents_delete',
      'payments_select', 'payments_insert', 'payments_update',
      'website_content_public_select', 'website_content_admin_select', 'website_content_insert',
      'website_content_update', 'website_content_delete',
      'internal_notes_select', 'internal_notes_insert', 'audit_logs_select',
      'public_media_read', 'public_media_insert', 'public_media_update', 'public_media_delete',
      'customer_documents_read', 'customer_documents_insert', 'customer_documents_delete'
    ])

  union all

  select
    'auth-trigger-name',
    'block',
    'conflict',
    t.tgname || ' already exists on auth.users'
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'auth'
    and c.relname = 'users'
    and not t.tgisinternal
    and t.tgname = any (array['on_auth_user_created', 'on_auth_user_updated'])

  union all

  select
    'auth-trigger-other',
    'review',
    'present',
    t.tgname || ' is an existing trigger on auth.users. This migration does not remove it. Confirm it will not compete with profile creation.'
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'auth'
    and c.relname = 'users'
    and not t.tgisinternal
    and t.tgname <> all (array['on_auth_user_created', 'on_auth_user_updated'])

  union all

  select
    'storage-rls',
    case when c.relrowsecurity then 'info' else 'block' end,
    case when c.relrowsecurity then 'enabled' else 'disabled' end,
    'storage.objects row level security'
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'storage'
    and c.relname = 'objects'

  union all

  select
    'storage-schema',
    'block',
    'missing',
    'The storage schema is not available.'
  where to_regnamespace('storage') is null

  union all

  select
    'storage-buckets-table',
    case when to_regclass('storage.buckets') is null then 'block' else 'info' end,
    case when to_regclass('storage.buckets') is null then 'missing' else 'present' end,
    case
      when to_regclass('storage.buckets') is null then 'storage.buckets is not available.'
      else 'storage.buckets is available. Matching bucket ids are reported below.'
    end

  union all

  select
    'storage-bucket',
    'block',
    (xpath('/row/visibility/text()', bucket_row))[1]::text,
    (xpath('/row/detail/text()', bucket_row))[1]::text
  from (
    select case
      when to_regclass('storage.buckets') is null then null::xml
      else query_to_xml(
        'select case when public then ''public'' else ''private'' end as visibility, id || '' already exists. The migration will stop rather than change its visibility, size, or allowed types.'' as detail from storage.buckets where id in (''public-media'', ''customer-documents'')',
        true,
        false,
        ''
      )
    end as doc
  ) found
  cross join lateral unnest(xpath('/table/row', found.doc)) as bucket_row

  union all

  select
    'existing-public-table',
    'review',
    'pre-existing',
    'public.' || c.relname || ' is outside this migration. Its current privileges are left in place.'
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname <> all (array[
      'profiles', 'admin_accounts', 'umrah_packages', 'hajj_programs', 'bookings',
      'booking_status_history', 'hajj_inquiries', 'visa_applications', 'customer_documents',
      'payments', 'website_content', 'internal_notes', 'audit_logs'
    ])

  union all

  select
    'anon-select-existing',
    'review',
    'grant-remains',
    'anon can read public.' || c.relname || '. The migration does not take that privilege away.'
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'v')
    and has_table_privilege('anon', c.oid, 'SELECT')
    and c.relname <> all (array[
      'profiles', 'admin_accounts', 'umrah_packages', 'hajj_programs', 'bookings',
      'booking_status_history', 'hajj_inquiries', 'visa_applications', 'customer_documents',
      'payments', 'website_content', 'internal_notes', 'audit_logs', 'customers',
      'booking_rows', 'visa_rows', 'hajj_inquiry_rows', 'booking_balances'
    ])

  union all

  select
    'schema-create-anon',
    'review',
    case when has_schema_privilege('anon', 'public', 'CREATE') then 'will-be-removed' else 'already-absent' end,
    'anon CREATE on schema public. The migration removes it from anon and authenticated.'
  union all
  select
    'schema-create-authenticated',
    'review',
    case when has_schema_privilege('authenticated', 'public', 'CREATE') then 'will-be-removed' else 'already-absent' end,
    'authenticated CREATE on schema public. The migration removes it from anon and authenticated.'

  union all

  select
    'required-role',
    case when exists (select 1 from pg_roles where rolname = 'service_role')
      and exists (select 1 from pg_roles where rolname = 'supabase_auth_admin')
      then 'info' else 'block' end,
    case when exists (select 1 from pg_roles where rolname = 'service_role')
      and exists (select 1 from pg_roles where rolname = 'supabase_auth_admin')
      then 'present' else 'missing' end,
    'service_role and supabase_auth_admin are required by the migration grants.'

  union all

  select
    'pg-trgm',
    'info',
    coalesce(
      (select n.nspname
       from pg_extension e
       join pg_namespace n on n.oid = e.extnamespace
       where e.extname = 'pg_trgm'),
      'not-installed'
    ),
    'The migration installs pg_trgm only when it is missing, then uses the schema where it actually lives.'

  union all

  select
    'application-tables',
    'info',
    case when count(*) = 0 then 'expected-fresh' else 'present' end,
    count(*)::text || ' reserved application tables already exist in public.'
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname = any (array[
      'profiles', 'admin_accounts', 'umrah_packages', 'hajj_programs', 'bookings',
      'booking_status_history', 'hajj_inquiries', 'visa_applications', 'customer_documents',
      'payments', 'website_content', 'internal_notes', 'audit_logs'
    ])

  union all

  select
    'auth-users-without-profile',
    case when to_regclass('public.profiles') is null then 'info' else 'review' end,
    case
      when to_regclass('auth.users') is null then 'auth-users-absent'
      when to_regclass('public.profiles') is null then 'expected-fresh'
      else 'counted'
    end,
    case
      when to_regclass('auth.users') is null then
        'auth.users is not available, so existing registrations cannot be counted.'
      when to_regclass('public.profiles') is null then
        (xpath('/table/row/total/text()', query_to_xml('select count(*)::text as total from auth.users', true, false, '')))[1]::text
        || ' Auth users currently exist. public.profiles is absent, which is expected before the migration. Registration after the migration creates a profile automatically. Older users need the separate backfill script, which does not apply until its flag is enabled.'
      else
        (xpath('/table/row/missing/text()', query_to_xml('select count(*)::text as missing from auth.users au where not exists (select 1 from public.profiles pr where pr.id = au.id)', true, false, '')))[1]::text
        || ' Auth users have no profile row.'
    end

  union all

  select
    'name-conflicts',
    'info',
    'none',
    'No reserved relation, core function, or storage bucket was found.'
  where not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any (array[
        'profiles', 'admin_accounts', 'umrah_packages', 'hajj_programs', 'bookings',
        'booking_status_history', 'hajj_inquiries', 'visa_applications', 'customer_documents',
        'payments', 'website_content', 'internal_notes', 'audit_logs', 'customers',
        'booking_rows', 'visa_rows', 'hajj_inquiry_rows', 'booking_balances',
        'booking_ref_seq', 'visa_ref_seq'
      ])
  )
  and not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array['is_admin', 'handle_new_user', 'protect_profile_update', 'write_audit'])
  )
  and case
    when to_regclass('storage.buckets') is null then true
    else not xpath_exists(
      '/table/row',
      query_to_xml(
        'select id from storage.buckets where id in (''public-media'', ''customer-documents'')',
        true,
        false,
        ''
      )
    )
  end
) report
order by
  case severity when 'block' then 1 when 'review' then 2 else 3 end,
  check_id;

rollback;
