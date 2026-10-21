-- Al Iman Rouh admin schema.
-- Run supabase/manual/preflight_readonly.sql first and read every row.
-- Then review this file and run it once, as the project owner, in the SQL editor.
-- Do not run it from the application, and do not run it automatically.
-- It creates objects only. It does not delete or rewrite existing rows.
-- It revokes privileges only on the objects it creates, plus CREATE on
-- schema public for anon and authenticated.
-- It stops if a reserved name or storage bucket already exists.
-- Requires PostgreSQL 15 or newer (Supabase hosted).

begin;

do $guard$
declare
  v_name text;
begin
  foreach v_name in array array[
    'profiles',
    'admin_accounts',
    'umrah_packages',
    'hajj_programs',
    'bookings',
    'booking_status_history',
    'hajj_inquiries',
    'visa_applications',
    'customer_documents',
    'payments',
    'website_content',
    'internal_notes',
    'audit_logs',
    'customers',
    'booking_rows',
    'visa_rows',
    'hajj_inquiry_rows',
    'booking_balances',
    'booking_ref_seq',
    'visa_ref_seq',
    'profiles_email_unique',
    'profiles_created_at_idx',
    'profiles_status_idx',
    'profiles_search_idx',
    'bookings_customer_idx',
    'bookings_status_idx',
    'booking_history_booking_idx',
    'hajj_inquiries_customer_idx',
    'hajj_inquiries_status_idx',
    'visa_customer_idx',
    'visa_status_idx',
    'documents_customer_idx',
    'documents_visa_idx',
    'payments_customer_idx',
    'payments_booking_idx',
    'website_content_kind_idx',
    'internal_notes_entity_idx',
    'audit_logs_created_idx',
    'umrah_packages_published_idx',
    'hajj_programs_published_idx'
  ]
  loop
    if to_regclass('public.' || v_name) is not null then
      raise exception 'public.% already exists. Run supabase/manual/preflight_readonly.sql. This migration will not replace it.', v_name;
    end if;
  end loop;

  foreach v_name in array array[
    'public.is_admin()',
    'public.set_updated_at()',
    'public.write_audit(text,text,uuid,jsonb)',
    'public.handle_new_user()',
    'public.handle_auth_user_updated()',
    'public.protect_profile_update()',
    'public.audit_profile_status()',
    'public.assign_booking_reference()',
    'public.prepare_customer_booking()',
    'public.record_booking_status()',
    'public.guard_booking_update()',
    'public.assign_visa_reference()',
    'public.prepare_customer_visa()',
    'public.guard_visa_update()',
    'public.audit_visa_status()',
    'public.prepare_hajj_inquiry()',
    'public.guard_hajj_inquiry_update()',
    'public.audit_hajj_inquiry()',
    'public.prepare_customer_document()',
    'public.guard_payment_write()',
    'public.audit_payment()',
    'public.sync_hajj_publication()',
    'public.audit_publication()',
    'public.set_internal_note_author()',
    'public.admin_set_booking_status(uuid,text,text)',
    'public.admin_set_visa_status(uuid,text,text)',
    'public.admin_set_account_status(uuid,text)',
    'public.admin_payment_summary()'
  ]
  loop
    if to_regprocedure(v_name) is not null then
      raise exception '% already exists. This migration will not replace it.', v_name;
    end if;
  end loop;

  if exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth'
      and c.relname = 'users'
      and not t.tgisinternal
      and t.tgname = any (array['on_auth_user_created', 'on_auth_user_updated'])
  ) then
    raise exception 'auth.users already has on_auth_user_created or on_auth_user_updated.';
  end if;

  if exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'storage')
      and p.polname = any (array[
        'profiles_select', 'profiles_update', 'admin_accounts_select',
        'umrah_packages_public_select', 'umrah_packages_admin_select', 'umrah_packages_insert', 'umrah_packages_update',
        'hajj_programs_public_select', 'hajj_programs_admin_select', 'hajj_programs_insert', 'hajj_programs_update',
        'bookings_select', 'bookings_insert', 'bookings_update', 'booking_history_select',
        'hajj_inquiries_select', 'hajj_inquiries_insert', 'hajj_inquiries_update',
        'visas_select', 'visas_insert', 'visas_update',
        'documents_select', 'documents_insert', 'documents_delete',
        'payments_select', 'payments_insert', 'payments_update',
        'website_content_public_select', 'website_content_admin_select', 'website_content_insert', 'website_content_update', 'website_content_delete',
        'internal_notes_select', 'internal_notes_insert', 'audit_logs_select',
        'public_media_read', 'public_media_insert', 'public_media_update', 'public_media_delete',
        'customer_documents_read', 'customer_documents_insert', 'customer_documents_delete'
      ])
  ) then
    raise exception 'A policy name used by this migration already exists.';
  end if;

  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise exception 'role service_role is not available.';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    raise exception 'role supabase_auth_admin is not available.';
  end if;

  if to_regnamespace('storage') is null then
    raise exception 'storage schema is not available.';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage'
      and c.relname = 'objects'
      and c.relrowsecurity
  ) then
    raise exception 'storage.objects does not have row level security enabled.';
  end if;

  if exists (
    select 1
    from storage.buckets
    where id = any (array['public-media', 'customer-documents'])
  ) then
    raise exception 'Bucket public-media or customer-documents already exists. This migration will not change an existing bucket.';
  end if;
end;
$guard$;

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  mobile text not null default '',
  email text,
  account_status text not null default 'pending_verification',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_name_length check (char_length(full_name) <= 120),
  constraint profiles_mobile_length check (char_length(mobile) <= 20),
  constraint profiles_account_status_check check (
    account_status in ('pending_verification', 'active', 'suspended')
  )
);

create table public.admin_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  note text,
  constraint admin_accounts_note_length check (note is null or char_length(note) <= 300)
);

create table public.umrah_packages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  price_sar numeric(12, 2) not null,
  duration_days integer not null,
  hotel_info text not null default '',
  transportation text not null default '',
  image_path text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint umrah_packages_title_length check (char_length(title) between 2 and 160),
  constraint umrah_packages_description_length check (char_length(description) <= 5000),
  constraint umrah_packages_price_check check (price_sar >= 0),
  constraint umrah_packages_duration_check check (duration_days between 1 and 60),
  constraint umrah_packages_hotel_length check (char_length(hotel_info) <= 2000),
  constraint umrah_packages_transport_length check (char_length(transportation) <= 2000),
  constraint umrah_packages_image_length check (image_path is null or char_length(image_path) <= 300),
  constraint umrah_packages_image_path_check check (
    image_path is null
    or image_path ~ '^(umrah|hajj|website)/[A-Za-z0-9][A-Za-z0-9._-]{0,200}$'
  )
);

create table public.hajj_programs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  season_label text not null default '',
  price_sar numeric(12, 2),
  duration_days integer,
  hotel_info text not null default '',
  transportation text not null default '',
  image_path text,
  internal_status text not null default 'draft',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hajj_programs_title_length check (char_length(title) between 2 and 160),
  constraint hajj_programs_description_length check (char_length(description) <= 5000),
  constraint hajj_programs_season_length check (char_length(season_label) <= 80),
  constraint hajj_programs_price_check check (price_sar is null or price_sar >= 0),
  constraint hajj_programs_duration_check check (duration_days is null or duration_days between 1 and 60),
  constraint hajj_programs_hotel_length check (char_length(hotel_info) <= 2000),
  constraint hajj_programs_transport_length check (char_length(transportation) <= 2000),
  constraint hajj_programs_image_length check (image_path is null or char_length(image_path) <= 300),
  constraint hajj_programs_image_path_check check (
    image_path is null
    or image_path ~ '^(umrah|hajj|website)/[A-Za-z0-9][A-Za-z0-9._-]{0,200}$'
  ),
  constraint hajj_programs_internal_status_check check (
    internal_status in ('draft', 'published', 'closed')
  )
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  package_id uuid references public.umrah_packages (id) on delete set null,
  package_title_snapshot text not null default '',
  travel_date date not null,
  travelers_count integer not null,
  total_amount numeric(12, 2) not null default 0,
  status text not null default 'pending',
  customer_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_reference_unique unique (reference),
  constraint bookings_id_customer_unique unique (id, customer_id),
  constraint bookings_reference_length check (char_length(reference) between 4 and 40),
  constraint bookings_title_length check (char_length(package_title_snapshot) <= 160),
  constraint bookings_travelers_check check (travelers_count between 1 and 100),
  constraint bookings_amount_check check (total_amount >= 0),
  constraint bookings_note_length check (char_length(customer_note) <= 1000),
  constraint bookings_status_check check (
    status in ('pending', 'under_review', 'confirmed', 'completed', 'cancelled')
  )
);

create table public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  old_status text,
  new_status text not null,
  note text,
  changed_by uuid,
  created_at timestamptz not null default now(),
  constraint booking_history_note_length check (note is null or char_length(note) <= 1000),
  constraint booking_history_status_check check (
    new_status in ('pending', 'under_review', 'confirmed', 'completed', 'cancelled')
  )
);

create table public.hajj_inquiries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  program_id uuid references public.hajj_programs (id) on delete set null,
  message text not null default '',
  travelers_count integer not null default 1,
  internal_status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hajj_inquiries_message_length check (char_length(message) <= 2000),
  constraint hajj_inquiries_travelers_check check (travelers_count between 1 and 100),
  constraint hajj_inquiries_status_check check (
    internal_status in ('new', 'contacted', 'in_progress', 'closed')
  )
);

create table public.visa_applications (
  id uuid primary key default gen_random_uuid(),
  reference text not null,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  full_name text not null,
  mobile text not null,
  passport_number text not null,
  nationality text not null,
  requested_travel_date date,
  customer_note text not null default '',
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visa_reference_unique unique (reference),
  constraint visa_id_customer_unique unique (id, customer_id),
  constraint visa_reference_length check (char_length(reference) between 4 and 40),
  constraint visa_name_length check (char_length(full_name) between 2 and 120),
  constraint visa_mobile_length check (char_length(mobile) between 8 and 20),
  constraint visa_passport_length check (char_length(passport_number) between 4 and 20),
  constraint visa_nationality_length check (char_length(nationality) between 2 and 80),
  constraint visa_note_length check (char_length(customer_note) <= 1000),
  constraint visa_status_check check (
    status in (
      'submitted',
      'under_review',
      'documents_requested',
      'processing',
      'ready_for_collection',
      'closed',
      'cancelled'
    )
  )
);

create table public.customer_documents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  visa_application_id uuid references public.visa_applications (id) on delete set null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  created_at timestamptz not null default now(),
  constraint customer_documents_path_unique unique (storage_path),
  constraint customer_documents_path_length check (char_length(storage_path) between 3 and 300),
  constraint customer_documents_path_shape_check check (
    storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9][A-Za-z0-9._-]{0,180}$'
  ),
  constraint customer_documents_visa_customer_fk
    foreign key (visa_application_id, customer_id)
    references public.visa_applications (id, customer_id)
    on delete set null (visa_application_id),
  constraint customer_documents_name_length check (char_length(file_name) between 1 and 180),
  constraint customer_documents_mime_check check (
    mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  )
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  booking_id uuid references public.bookings (id) on delete restrict,
  amount numeric(12, 2) not null,
  currency text not null default 'SAR',
  method text not null,
  status text not null default 'recorded',
  paid_on date not null default current_date,
  note text not null default '',
  recorded_by uuid,
  created_at timestamptz not null default now(),
  constraint payments_amount_check check (amount > 0),
  constraint payments_currency_check check (currency = 'SAR'),
  constraint payments_method_check check (method in ('cash', 'bank_transfer', 'pos', 'other')),
  constraint payments_status_check check (status in ('recorded', 'void')),
  constraint payments_note_length check (char_length(note) <= 500),
  constraint payments_booking_customer_fk
    foreign key (booking_id, customer_id)
    references public.bookings (id, customer_id)
    on delete restrict
);

create table public.website_content (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  title text not null,
  body text not null default '',
  image_path text,
  link_url text,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_content_kind_check check (kind in ('banner', 'offer', 'announcement')),
  constraint website_content_title_length check (char_length(title) between 2 and 160),
  constraint website_content_body_length check (char_length(body) <= 5000),
  constraint website_content_image_length check (image_path is null or char_length(image_path) <= 300),
  constraint website_content_image_path_check check (
    image_path is null
    or image_path ~ '^(umrah|hajj|website)/[A-Za-z0-9][A-Za-z0-9._-]{0,200}$'
  ),
  constraint website_content_link_check check (link_url is null or link_url ~ '^https://'),
  constraint website_content_sort_check check (sort_order between 0 and 9999)
);

create table public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  body text not null,
  author_id uuid not null,
  created_at timestamptz not null default now(),
  constraint internal_notes_entity_check check (
    entity_type in ('booking', 'visa_application', 'hajj_inquiry')
  ),
  constraint internal_notes_body_length check (char_length(body) between 1 and 2000)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index profiles_email_unique on public.profiles (email) where email is not null;
create index profiles_created_at_idx on public.profiles (created_at desc);
create index profiles_status_idx on public.profiles (account_status);
do $idx$
declare
  v_schema text;
begin
  select n.nspname into v_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pg_trgm';

  if v_schema is null then
    raise exception 'pg_trgm extension is required';
  end if;

  execute format(
    'create index profiles_search_idx on public.profiles using gin ((full_name || %L || mobile || %L || coalesce(email, %L)) %I.gin_trgm_ops)',
    ' ',
    ' ',
    '',
    v_schema
  );
end;
$idx$;
create index bookings_customer_idx on public.bookings (customer_id, created_at desc);
create index bookings_status_idx on public.bookings (status, created_at desc);
create index booking_history_booking_idx on public.booking_status_history (booking_id, created_at desc);
create index hajj_inquiries_customer_idx on public.hajj_inquiries (customer_id, created_at desc);
create index hajj_inquiries_status_idx on public.hajj_inquiries (internal_status, created_at desc);
create index visa_customer_idx on public.visa_applications (customer_id, created_at desc);
create index visa_status_idx on public.visa_applications (status, created_at desc);
create index documents_customer_idx on public.customer_documents (customer_id, created_at desc);
create index documents_visa_idx on public.customer_documents (visa_application_id);
create index payments_customer_idx on public.payments (customer_id, paid_on desc);
create index payments_booking_idx on public.payments (booking_id);
create index website_content_kind_idx on public.website_content (kind, sort_order);
create index internal_notes_entity_idx on public.internal_notes (entity_type, entity_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index umrah_packages_published_idx on public.umrah_packages (is_published, created_at desc);
create index hajj_programs_published_idx on public.hajj_programs (is_published, created_at desc);

create sequence public.booking_ref_seq;
create sequence public.visa_ref_seq;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- security definer is required. An invoker function would recurse through the
-- admin_accounts row level security policy, which calls this function.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $func$
  select exists (
    select 1
    from public.admin_accounts
    where user_id = auth.uid()
  );
$func$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $func$
begin
  new.updated_at = now();
  return new;
end;
$func$;

create function public.write_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$func$;

-- Customer registration metadata is limited to name and mobile.
-- No metadata key can create an admin account.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_status text;
begin
  v_status := case
    when new.email_confirmed_at is not null then 'active'
    else 'pending_verification'
  end;

  insert into public.profiles (id, full_name, mobile, email, account_status)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    left(coalesce(new.raw_user_meta_data ->> 'mobile', ''), 20),
    new.email,
    v_status
  )
  on conflict (id) do nothing;

  return new;
end;
$func$;

create function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  update public.profiles
  set
    email = new.email,
    full_name = case
      when coalesce(new.raw_user_meta_data ->> 'full_name', '') <> ''
        then left(new.raw_user_meta_data ->> 'full_name', 120)
      else full_name
    end,
    mobile = case
      when coalesce(new.raw_user_meta_data ->> 'mobile', '') <> ''
        then left(new.raw_user_meta_data ->> 'mobile', 20)
      else mobile
    end,
    account_status = case
      when account_status = 'suspended' then account_status
      when new.email_confirmed_at is not null and account_status = 'pending_verification' then 'active'
      else account_status
    end
  where id = new.id;

  return new;
end;
$func$;

create function public.protect_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  -- The profile id is the Auth user id. Rewriting it would move another person's data.
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'profile identity is immutable' using errcode = '42501';
  end if;

  -- SQL-editor repair. API sessions keep session_user = authenticator, so they
  -- do not enter this branch. This branch can change status and email.
  if session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  -- GoTrue updates auth.users as supabase_auth_admin. Allow the sync this
  -- trigger's companion function performs, and no other status transition.
  if session_user = 'supabase_auth_admin' then
    if old.account_status = 'suspended' and new.account_status is distinct from old.account_status then
      raise exception 'suspended profiles are not restored by auth sync' using errcode = '42501';
    end if;
    if new.account_status is distinct from old.account_status
      and not (
        old.account_status = 'pending_verification'
        and new.account_status = 'active'
      )
    then
      raise exception 'invalid auth profile status change' using errcode = '42501';
    end if;
    return new;
  end if;

  -- An administrator may change only the status, and only to active or suspended.
  -- Any other role keeps the stored email and status.
  if new.account_status is distinct from old.account_status
    or new.email is distinct from old.email
  then
    if public.is_admin()
      and new.account_status in ('active', 'suspended')
      and new.email is not distinct from old.email
      and new.full_name is not distinct from old.full_name
      and new.mobile is not distinct from old.mobile
    then
      return new;
    end if;
    raise exception 'profile status and email are immutable' using errcode = '42501';
  end if;

  return new;
end;
$func$;

create function public.audit_profile_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if new.account_status is distinct from old.account_status then
    perform public.write_audit(
      'profile.account_status',
      'profile',
      new.id,
      jsonb_build_object('from', old.account_status, 'to', new.account_status)
    );
  end if;
  return new;
end;
$func$;

create function public.assign_booking_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  new.reference := 'UM-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.booking_ref_seq')::text, 5, '0');
  return new;
end;
$func$;

create function public.prepare_customer_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_price numeric(12, 2);
  v_title text;
  v_status text;
begin
  if public.is_admin() then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  new.customer_id := auth.uid();
  new.status := 'pending';

  select account_status into v_status
  from public.profiles
  where id = auth.uid();

  if v_status is distinct from 'active' then
    raise exception 'account cannot create bookings' using errcode = '42501';
  end if;

  if new.package_id is null then
    raise exception 'package is required' using errcode = '23514';
  end if;

  select price_sar, title
  into v_price, v_title
  from public.umrah_packages
  where id = new.package_id
    and is_published = true;

  if v_price is null then
    raise exception 'package is not available' using errcode = '42501';
  end if;

  new.total_amount := round(v_price * new.travelers_count, 2);
  new.package_title_snapshot := v_title;
  return new;
end;
$func$;

create function public.record_booking_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_note text;
begin
  if tg_op = 'UPDATE' and not public.is_admin() and new.status is distinct from old.status then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    -- Only an administrator transaction may attach the status note.
    -- A client-supplied custom setting is ignored for customer inserts.
    if public.is_admin() then
      v_note := nullif(current_setting('app.status_note', true), '');
      perform set_config('app.status_note', '', true);
    else
      v_note := null;
    end if;
    insert into public.booking_status_history (booking_id, old_status, new_status, note, changed_by)
    values (
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      v_note,
      auth.uid()
    );
    perform public.write_audit(
      case when tg_op = 'INSERT' then 'booking.created' else 'booking.status_change' end,
      'booking',
      new.id,
      jsonb_build_object(
        'from', case when tg_op = 'INSERT' then null else old.status end,
        'to', new.status
      )
    );
  end if;
  return new;
end;
$func$;

create function public.guard_booking_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if new.id is distinct from old.id
    or new.customer_id is distinct from old.customer_id
    or new.reference is distinct from old.reference
    or new.package_id is distinct from old.package_id
    or new.package_title_snapshot is distinct from old.package_title_snapshot
    or new.travel_date is distinct from old.travel_date
    or new.travelers_count is distinct from old.travelers_count
    or new.total_amount is distinct from old.total_amount
    or new.customer_note is distinct from old.customer_note
    or new.created_at is distinct from old.created_at
  then
    raise exception 'booking fields are immutable' using errcode = '42501';
  end if;

  return new;
end;
$func$;

create function public.assign_visa_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  new.reference := 'VS-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.visa_ref_seq')::text, 5, '0');
  return new;
end;
$func$;

create function public.prepare_customer_visa()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_status text;
begin
  if public.is_admin() then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select account_status into v_status
  from public.profiles
  where id = auth.uid();

  if v_status is distinct from 'active' then
    raise exception 'account cannot submit visa applications' using errcode = '42501';
  end if;

  new.customer_id := auth.uid();
  new.status := 'submitted';
  return new;
end;
$func$;

create function public.guard_visa_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if new.id is distinct from old.id
    or new.customer_id is distinct from old.customer_id
    or new.reference is distinct from old.reference
    or new.full_name is distinct from old.full_name
    or new.mobile is distinct from old.mobile
    or new.passport_number is distinct from old.passport_number
    or new.nationality is distinct from old.nationality
    or new.requested_travel_date is distinct from old.requested_travel_date
    or new.customer_note is distinct from old.customer_note
    or new.created_at is distinct from old.created_at
  then
    raise exception 'visa fields are immutable' using errcode = '42501';
  end if;

  return new;
end;
$func$;

create function public.audit_visa_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('visa.created', 'visa_application', new.id, jsonb_build_object('status', new.status));
  elsif new.status is distinct from old.status then
    perform public.write_audit(
      'visa.status_change',
      'visa_application',
      new.id,
      jsonb_build_object(
        'from', old.status,
        'to', new.status,
        'note', case
          when public.is_admin() then nullif(current_setting('app.status_note', true), '')
          else null
        end
      )
    );
    if public.is_admin() then
      perform set_config('app.status_note', '', true);
    end if;
  end if;
  return new;
end;
$func$;

create function public.prepare_hajj_inquiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_status text;
begin
  if public.is_admin() then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select account_status into v_status from public.profiles where id = auth.uid();
  if v_status is distinct from 'active' then
    raise exception 'account cannot submit inquiries' using errcode = '42501';
  end if;

  if new.program_id is not null and not exists (
    select 1
    from public.hajj_programs
    where id = new.program_id
      and is_published = true
  ) then
    raise exception 'program is not available' using errcode = '42501';
  end if;

  new.customer_id := auth.uid();
  new.internal_status := 'new';
  return new;
end;
$func$;

create function public.guard_hajj_inquiry_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if new.id is distinct from old.id
    or new.customer_id is distinct from old.customer_id
    or new.program_id is distinct from old.program_id
    or new.message is distinct from old.message
    or new.travelers_count is distinct from old.travelers_count
    or new.created_at is distinct from old.created_at
  then
    raise exception 'inquiry fields are immutable' using errcode = '42501';
  end if;

  return new;
end;
$func$;

create function public.audit_hajj_inquiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('hajj_inquiry.created', 'hajj_inquiry', new.id, '{}'::jsonb);
  elsif new.internal_status is distinct from old.internal_status then
    perform public.write_audit(
      'hajj_inquiry.status_change',
      'hajj_inquiry',
      new.id,
      jsonb_build_object('from', old.internal_status, 'to', new.internal_status)
    );
  end if;
  return new;
end;
$func$;

create function public.prepare_customer_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if public.is_admin() or auth.uid() is null then
    raise exception 'documents are uploaded by the customer' using errcode = '42501';
  end if;

  new.customer_id := auth.uid();
  if new.storage_path !~ ('^' || auth.uid()::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,180}$') then
    raise exception 'invalid document path' using errcode = '42501';
  end if;

  if new.visa_application_id is not null and not exists (
    select 1
    from public.visa_applications
    where id = new.visa_application_id
      and customer_id = auth.uid()
  ) then
    raise exception 'visa application not found' using errcode = '42501';
  end if;

  return new;
end;
$func$;

create function public.guard_payment_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_customer uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'recorded' then
      raise exception 'new payments must be recorded' using errcode = '23514';
    end if;
    new.recorded_by := auth.uid();
    new.currency := 'SAR';
    if new.booking_id is not null then
      select customer_id into v_customer from public.bookings where id = new.booking_id;
      if v_customer is null then
        raise exception 'booking not found' using errcode = '23503';
      end if;
      new.customer_id := v_customer;
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
    or new.amount is distinct from old.amount
    or new.customer_id is distinct from old.customer_id
    or new.booking_id is distinct from old.booking_id
    or new.method is distinct from old.method
    or new.paid_on is distinct from old.paid_on
    or new.currency is distinct from old.currency
    or new.recorded_by is distinct from old.recorded_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'recorded payments are immutable' using errcode = '42501';
  end if;

  if new.note is distinct from old.note
    and not (old.status = 'recorded' and new.status = 'void')
  then
    raise exception 'recorded payments are immutable' using errcode = '42501';
  end if;

  if new.status is distinct from old.status
    and not (old.status = 'recorded' and new.status = 'void')
  then
    raise exception 'invalid payment status change' using errcode = '42501';
  end if;

  return new;
end;
$func$;

create function public.audit_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit(
      'payment.recorded',
      'payment',
      new.id,
      jsonb_build_object('amount', new.amount, 'booking_id', new.booking_id, 'customer_id', new.customer_id)
    );
  elsif new.status is distinct from old.status then
    perform public.write_audit(
      'payment.voided',
      'payment',
      new.id,
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;
  return new;
end;
$func$;

create function public.sync_hajj_publication()
returns trigger
language plpgsql
set search_path = public
as $func$
begin
  if new.internal_status = 'closed' then
    new.is_published := false;
  elsif new.is_published then
    new.internal_status := 'published';
  elsif new.internal_status = 'published' then
    new.internal_status := 'draft';
  end if;
  return new;
end;
$func$;

create function public.audit_publication()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if tg_op = 'INSERT' or new.is_published is distinct from old.is_published then
    perform public.write_audit(
      tg_table_name || '.publication',
      tg_table_name,
      new.id,
      jsonb_build_object('is_published', new.is_published)
    );
  end if;
  return new;
end;
$func$;

create function public.set_internal_note_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  new.author_id := auth.uid();
  return new;
end;
$func$;

create function public.admin_set_booking_status(
  p_booking_id uuid,
  p_status text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'under_review', 'confirmed', 'completed', 'cancelled') then
    raise exception 'invalid status' using errcode = '23514';
  end if;

  perform set_config('app.status_note', left(coalesce(p_note, ''), 1000), true);
  update public.bookings
  set status = p_status
  where id = p_booking_id;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
end;
$func$;

create function public.admin_set_visa_status(
  p_visa_id uuid,
  p_status text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_status not in (
    'submitted',
    'under_review',
    'documents_requested',
    'processing',
    'ready_for_collection',
    'closed',
    'cancelled'
  ) then
    raise exception 'invalid status' using errcode = '23514';
  end if;

  perform set_config('app.status_note', left(coalesce(p_note, ''), 1000), true);
  update public.visa_applications
  set status = p_status
  where id = p_visa_id;
  if not found then
    raise exception 'visa application not found' using errcode = 'P0002';
  end if;
end;
$func$;

create function public.admin_set_account_status(
  p_customer_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $func$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'invalid status' using errcode = '23514';
  end if;
  if exists (select 1 from public.admin_accounts where user_id = p_customer_id) then
    raise exception 'administrator accounts are not managed here' using errcode = '42501';
  end if;

  update public.profiles
  set account_status = p_status
  where id = p_customer_id;
  if not found then
    raise exception 'customer not found' using errcode = 'P0002';
  end if;
end;
$func$;

create function public.admin_payment_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $func$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'recorded_total', coalesce((
      select sum(amount) from public.payments where status = 'recorded'
    ), 0),
    'payments_count', (
      select count(*) from public.payments where status = 'recorded'
    ),
    'outstanding_total', coalesce((
      select sum(greatest(b.total_amount - coalesce(p.paid, 0), 0))
      from public.bookings b
      left join (
        select booking_id, sum(amount) as paid
        from public.payments
        where status = 'recorded' and booking_id is not null
        group by booking_id
      ) p on p.booking_id = b.id
      where b.status <> 'cancelled'
    ), 0),
    'months', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.month desc)
      from (
        select
          to_char(date_trunc('month', paid_on), 'YYYY-MM') as month,
          sum(amount) as total,
          count(*) as payment_count
        from public.payments
        where status = 'recorded'
          and paid_on >= (date_trunc('month', current_date) - interval '11 months')::date
        group by date_trunc('month', paid_on)
      ) m
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$func$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger profiles_protect before update on public.profiles
for each row execute function public.protect_profile_update();
create trigger profiles_audit_status after update on public.profiles
for each row execute function public.audit_profile_status();

create trigger umrah_packages_set_updated_at before update on public.umrah_packages
for each row execute function public.set_updated_at();
create trigger umrah_packages_audit_publication after insert or update on public.umrah_packages
for each row execute function public.audit_publication();

create trigger hajj_programs_sync_publication before insert or update on public.hajj_programs
for each row execute function public.sync_hajj_publication();
create trigger hajj_programs_set_updated_at before update on public.hajj_programs
for each row execute function public.set_updated_at();
create trigger hajj_programs_audit_publication after insert or update on public.hajj_programs
for each row execute function public.audit_publication();

create trigger website_content_set_updated_at before update on public.website_content
for each row execute function public.set_updated_at();
create trigger website_content_audit_publication after insert or update on public.website_content
for each row execute function public.audit_publication();

create trigger bookings_assign_reference before insert on public.bookings
for each row execute function public.assign_booking_reference();
create trigger bookings_prepare_customer before insert on public.bookings
for each row execute function public.prepare_customer_booking();
create trigger bookings_guard_update before update on public.bookings
for each row execute function public.guard_booking_update();
create trigger bookings_set_updated_at before update on public.bookings
for each row execute function public.set_updated_at();
create trigger bookings_record_status after insert or update on public.bookings
for each row execute function public.record_booking_status();

create trigger hajj_inquiries_prepare before insert on public.hajj_inquiries
for each row execute function public.prepare_hajj_inquiry();
create trigger hajj_inquiries_guard before update on public.hajj_inquiries
for each row execute function public.guard_hajj_inquiry_update();
create trigger hajj_inquiries_set_updated_at before update on public.hajj_inquiries
for each row execute function public.set_updated_at();
create trigger hajj_inquiries_audit after insert or update on public.hajj_inquiries
for each row execute function public.audit_hajj_inquiry();

create trigger visas_assign_reference before insert on public.visa_applications
for each row execute function public.assign_visa_reference();
create trigger visas_prepare_customer before insert on public.visa_applications
for each row execute function public.prepare_customer_visa();
create trigger visas_guard_update before update on public.visa_applications
for each row execute function public.guard_visa_update();
create trigger visas_set_updated_at before update on public.visa_applications
for each row execute function public.set_updated_at();
create trigger visas_audit_status after insert or update on public.visa_applications
for each row execute function public.audit_visa_status();

create trigger documents_prepare before insert on public.customer_documents
for each row execute function public.prepare_customer_document();

create trigger payments_guard before insert or update on public.payments
for each row execute function public.guard_payment_write();
create trigger payments_audit after insert or update on public.payments
for each row execute function public.audit_payment();

create trigger internal_notes_author before insert on public.internal_notes
for each row execute function public.set_internal_note_author();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create trigger on_auth_user_updated
after update on auth.users
for each row execute function public.handle_auth_user_updated();

-- ---------------------------------------------------------------------------
-- Views. security_invoker keeps the underlying row level security in force.
-- security_barrier stops outside filters from being pushed under that policy.
-- A default security-definer view would leak every customer to the browser.
-- Counts are correlated so each total is computed only for the visible row.
-- ---------------------------------------------------------------------------

create view public.customers
with (security_invoker = true, security_barrier = true) as
select
  p.id,
  p.full_name,
  p.mobile,
  p.email,
  p.account_status,
  p.created_at,
  p.updated_at,
  (
    select count(*)::integer
    from public.bookings b
    where b.customer_id = p.id
  ) as bookings_count
from public.profiles p
where not exists (
  select 1 from public.admin_accounts a where a.user_id = p.id
);

create view public.booking_rows
with (security_invoker = true, security_barrier = true) as
select
  b.id,
  b.reference,
  b.customer_id,
  b.package_id,
  b.package_title_snapshot,
  b.travel_date,
  b.travelers_count,
  b.total_amount,
  b.status,
  b.customer_note,
  b.created_at,
  b.updated_at,
  p.full_name as customer_name,
  p.mobile as customer_mobile,
  p.email as customer_email
from public.bookings b
join public.profiles p on p.id = b.customer_id;

create view public.visa_rows
with (security_invoker = true, security_barrier = true) as
select
  v.id,
  v.reference,
  v.customer_id,
  v.full_name,
  v.mobile,
  v.passport_number,
  v.nationality,
  v.requested_travel_date,
  v.customer_note,
  v.status,
  v.created_at,
  v.updated_at,
  p.full_name as customer_name,
  p.mobile as customer_mobile,
  p.email as customer_email
from public.visa_applications v
join public.profiles p on p.id = v.customer_id;

create view public.hajj_inquiry_rows
with (security_invoker = true, security_barrier = true) as
select
  i.id,
  i.customer_id,
  i.program_id,
  i.message,
  i.travelers_count,
  i.internal_status,
  i.created_at,
  i.updated_at,
  p.full_name as customer_name,
  p.mobile as customer_mobile,
  p.email as customer_email,
  h.title as program_title
from public.hajj_inquiries i
join public.profiles p on p.id = i.customer_id
left join public.hajj_programs h on h.id = i.program_id;

create view public.booking_balances
with (security_invoker = true, security_barrier = true) as
select
  b.id,
  b.reference,
  b.customer_id,
  b.status,
  b.total_amount,
  p.full_name as customer_name,
  coalesce(pay.paid, 0)::numeric(12, 2) as paid_amount,
  (b.total_amount - coalesce(pay.paid, 0))::numeric(12, 2) as balance_amount
from public.bookings b
join public.profiles p on p.id = b.customer_id
left join lateral (
  select sum(payment.amount) as paid
  from public.payments payment
  where payment.booking_id = b.id
    and payment.status = 'recorded'
) pay on true;

-- ---------------------------------------------------------------------------
-- Grants. Privileges are narrow; row level security still applies.
-- ---------------------------------------------------------------------------

-- These revokes name only the objects created above.
-- They do not remove grants on tables or functions that already belonged to the project.
revoke all on table
  public.profiles,
  public.admin_accounts,
  public.umrah_packages,
  public.hajj_programs,
  public.bookings,
  public.booking_status_history,
  public.hajj_inquiries,
  public.visa_applications,
  public.customer_documents,
  public.payments,
  public.website_content,
  public.internal_notes,
  public.audit_logs,
  public.customers,
  public.booking_rows,
  public.visa_rows,
  public.hajj_inquiry_rows,
  public.booking_balances
from public, anon, authenticated;

revoke all on sequence public.booking_ref_seq, public.visa_ref_seq
from public, anon, authenticated, service_role;

revoke all on function
  public.is_admin(),
  public.set_updated_at(),
  public.write_audit(text, text, uuid, jsonb),
  public.handle_new_user(),
  public.handle_auth_user_updated(),
  public.protect_profile_update(),
  public.audit_profile_status(),
  public.assign_booking_reference(),
  public.prepare_customer_booking(),
  public.record_booking_status(),
  public.guard_booking_update(),
  public.assign_visa_reference(),
  public.prepare_customer_visa(),
  public.guard_visa_update(),
  public.audit_visa_status(),
  public.prepare_hajj_inquiry(),
  public.guard_hajj_inquiry_update(),
  public.audit_hajj_inquiry(),
  public.prepare_customer_document(),
  public.guard_payment_write(),
  public.audit_payment(),
  public.sync_hajj_publication(),
  public.audit_publication(),
  public.set_internal_note_author(),
  public.admin_set_booking_status(uuid, text, text),
  public.admin_set_visa_status(uuid, text, text),
  public.admin_set_account_status(uuid, text),
  public.admin_payment_summary()
from public, anon, authenticated, service_role;

revoke create on schema public from anon, authenticated;

grant usage on schema public to anon, authenticated, supabase_auth_admin;

grant select on public.umrah_packages to anon, authenticated;
grant select on public.hajj_programs to anon, authenticated;
grant select on public.website_content to anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, mobile, updated_at) on public.profiles to authenticated;
grant select on public.admin_accounts to authenticated;
grant select, insert, update on public.umrah_packages to authenticated;
grant select, insert, update on public.hajj_programs to authenticated;
grant select, insert on public.bookings to authenticated;
grant update (status, updated_at) on public.bookings to authenticated;
grant select (id, booking_id, old_status, new_status, note, created_at) on public.booking_status_history to authenticated;
grant select, insert on public.hajj_inquiries to authenticated;
grant update (internal_status, updated_at) on public.hajj_inquiries to authenticated;
grant select, insert on public.visa_applications to authenticated;
grant update (status, updated_at) on public.visa_applications to authenticated;
grant select, insert, delete on public.customer_documents to authenticated;
grant select (
  id, customer_id, booking_id, amount, currency, method, status, paid_on, note, created_at
) on public.payments to authenticated;
grant insert on public.payments to authenticated;
grant update (status, note) on public.payments to authenticated;
grant select, insert, update, delete on public.website_content to authenticated;
grant select, insert on public.internal_notes to authenticated;
grant select on public.audit_logs to authenticated;

grant select on public.customers to authenticated;
grant select on public.booking_rows to authenticated;
grant select on public.visa_rows to authenticated;
grant select on public.hajj_inquiry_rows to authenticated;
grant select on public.booking_balances to authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_set_booking_status(uuid, text, text) to authenticated;
grant execute on function public.admin_set_visa_status(uuid, text, text) to authenticated;
grant execute on function public.admin_set_account_status(uuid, text) to authenticated;
grant execute on function public.admin_payment_summary() to authenticated;

grant execute on function public.handle_new_user() to supabase_auth_admin;
grant execute on function public.handle_auth_user_updated() to supabase_auth_admin;

-- Trigger functions must be executable by the signed-in user who causes them.
-- write_audit stays revoked so the API cannot forge audit rows.
grant execute on function public.set_updated_at() to authenticated;
grant execute on function public.protect_profile_update() to authenticated;
grant execute on function public.audit_profile_status() to authenticated;
grant execute on function public.sync_hajj_publication() to authenticated;
grant execute on function public.audit_publication() to authenticated;
grant execute on function public.assign_booking_reference() to authenticated;
grant execute on function public.prepare_customer_booking() to authenticated;
grant execute on function public.guard_booking_update() to authenticated;
grant execute on function public.record_booking_status() to authenticated;
grant execute on function public.assign_visa_reference() to authenticated;
grant execute on function public.prepare_customer_visa() to authenticated;
grant execute on function public.guard_visa_update() to authenticated;
grant execute on function public.audit_visa_status() to authenticated;
grant execute on function public.prepare_hajj_inquiry() to authenticated;
grant execute on function public.guard_hajj_inquiry_update() to authenticated;
grant execute on function public.audit_hajj_inquiry() to authenticated;
grant execute on function public.prepare_customer_document() to authenticated;
grant execute on function public.guard_payment_write() to authenticated;
grant execute on function public.audit_payment() to authenticated;
grant execute on function public.set_internal_note_author() to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.admin_accounts enable row level security;
alter table public.umrah_packages enable row level security;
alter table public.hajj_programs enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_status_history enable row level security;
alter table public.hajj_inquiries enable row level security;
alter table public.visa_applications enable row level security;
alter table public.customer_documents enable row level security;
alter table public.payments enable row level security;
alter table public.website_content enable row level security;
alter table public.internal_notes enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy profiles_update on public.profiles
for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy admin_accounts_select on public.admin_accounts
for select to authenticated
using (public.is_admin());

create policy umrah_packages_public_select on public.umrah_packages
for select to anon, authenticated
using (is_published);

create policy umrah_packages_admin_select on public.umrah_packages
for select to authenticated
using (public.is_admin());

create policy umrah_packages_insert on public.umrah_packages
for insert to authenticated
with check (public.is_admin());

create policy umrah_packages_update on public.umrah_packages
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy hajj_programs_public_select on public.hajj_programs
for select to anon, authenticated
using (is_published);

create policy hajj_programs_admin_select on public.hajj_programs
for select to authenticated
using (public.is_admin());

create policy hajj_programs_insert on public.hajj_programs
for insert to authenticated
with check (public.is_admin());

create policy hajj_programs_update on public.hajj_programs
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy bookings_select on public.bookings
for select to authenticated
using (customer_id = auth.uid() or public.is_admin());

create policy bookings_insert on public.bookings
for insert to authenticated
with check (public.is_admin() or customer_id = auth.uid());

create policy bookings_update on public.bookings
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy booking_history_select on public.booking_status_history
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.bookings b
    where b.id = booking_id and b.customer_id = auth.uid()
  )
);

create policy hajj_inquiries_select on public.hajj_inquiries
for select to authenticated
using (customer_id = auth.uid() or public.is_admin());

create policy hajj_inquiries_insert on public.hajj_inquiries
for insert to authenticated
with check (customer_id = auth.uid() or public.is_admin());

create policy hajj_inquiries_update on public.hajj_inquiries
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy visas_select on public.visa_applications
for select to authenticated
using (customer_id = auth.uid() or public.is_admin());

create policy visas_insert on public.visa_applications
for insert to authenticated
with check (customer_id = auth.uid() or public.is_admin());

create policy visas_update on public.visa_applications
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy documents_select on public.customer_documents
for select to authenticated
using (customer_id = auth.uid() or public.is_admin());

create policy documents_insert on public.customer_documents
for insert to authenticated
with check (customer_id = auth.uid());

create policy documents_delete on public.customer_documents
for delete to authenticated
using (customer_id = auth.uid());

create policy payments_select on public.payments
for select to authenticated
using (customer_id = auth.uid() or public.is_admin());

create policy payments_insert on public.payments
for insert to authenticated
with check (public.is_admin());

create policy payments_update on public.payments
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy website_content_public_select on public.website_content
for select to anon, authenticated
using (is_published);

create policy website_content_admin_select on public.website_content
for select to authenticated
using (public.is_admin());

create policy website_content_insert on public.website_content
for insert to authenticated
with check (public.is_admin());

create policy website_content_update on public.website_content
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy website_content_delete on public.website_content
for delete to authenticated
using (public.is_admin());

create policy internal_notes_select on public.internal_notes
for select to authenticated
using (public.is_admin());

create policy internal_notes_insert on public.internal_notes
for insert to authenticated
with check (public.is_admin());

create policy audit_logs_select on public.audit_logs
for select to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage. Package and website images are public. Customer documents are not.
-- ---------------------------------------------------------------------------

-- The opening guard already refused these ids. There is no update clause:
-- an existing bucket must not have its public flag or file rules rewritten.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'public-media',
    'public-media',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'customer-documents',
    'customer-documents',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  );

create policy public_media_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'public-media');

create policy public_media_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'public-media'
  and public.is_admin()
  and name ~ '^(umrah|hajj|website)/[A-Za-z0-9][A-Za-z0-9._-]{0,200}$'
);

create policy public_media_update on storage.objects
for update to authenticated
using (bucket_id = 'public-media' and public.is_admin())
with check (
  bucket_id = 'public-media'
  and public.is_admin()
  and name ~ '^(umrah|hajj|website)/[A-Za-z0-9][A-Za-z0-9._-]{0,200}$'
);

create policy public_media_delete on storage.objects
for delete to authenticated
using (bucket_id = 'public-media' and public.is_admin());

create policy customer_documents_read on storage.objects
for select to authenticated
using (
  bucket_id = 'customer-documents'
  and (
    public.is_admin()
    or (
      auth.uid() is not null
      and name ~ ('^' || auth.uid()::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,180}$')
    )
  )
);

create policy customer_documents_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'customer-documents'
  and auth.uid() is not null
  and name ~ ('^' || auth.uid()::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,180}$')
);

create policy customer_documents_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'customer-documents'
  and auth.uid() is not null
  and name ~ ('^' || auth.uid()::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,180}$')
);

comment on table public.profiles is
  'One row per auth user, created by the auth trigger. Customers are profiles that are not in admin_accounts.';
comment on table public.admin_accounts is
  'Manual administrator allow-list. No client insert, update, or delete policy exists.';
comment on table public.visa_applications is
  'Internal visa-processing records. Statuses are not official government decisions.';
comment on table public.hajj_programs is
  'Agency program information. Publication is not an official Hajj quota or license.';
comment on table public.audit_logs is
  'Append-only log written by database triggers. Clients cannot insert rows.';

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
      raise exception '% view must use security_invoker and security_barrier', v_view;
    end if;
  end loop;
end;
$check$;

commit;
