-- Public site copy edited from the admin website page.
-- Visitors can read it. Only an administrator can change it.

create table public.site_settings (
  section text primary key,
  content jsonb not null,
  updated_at timestamptz not null default now(),
  constraint site_settings_section_check check (section in ('identity', 'home', 'pages')),
  constraint site_settings_shape_check check (
    jsonb_typeof(content) = 'object'
    and jsonb_typeof(content -> 'ar') = 'object'
    and jsonb_typeof(content -> 'en') = 'object'
  ),
  constraint site_settings_size_check check (octet_length(content::text) <= 100000)
);

revoke all on table public.site_settings from public, anon, authenticated;

grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;

alter table public.site_settings enable row level security;

create policy site_settings_public_select on public.site_settings
for select to anon, authenticated
using (true);

create policy site_settings_admin_insert on public.site_settings
for insert to authenticated
with check (public.is_admin());

create policy site_settings_admin_update on public.site_settings
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create trigger site_settings_set_updated_at before update on public.site_settings
for each row execute function public.set_updated_at();
