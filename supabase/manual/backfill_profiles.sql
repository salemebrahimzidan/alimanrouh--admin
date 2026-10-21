-- Reviewed profile backfill.
-- Run only after the schema migration, and only if Authentication already
-- contains users that signed up before the profile trigger existed.
--
-- What it does:
-- - Inserts a profile for each auth user that does not already have one.
-- - Copies name and mobile from signup metadata when those keys exist.
-- - Marks confirmed emails active, and unconfirmed emails pending verification.
-- - Does not update or delete an existing profile.
-- - Does not insert into admin_accounts.
-- - Does not grant administrator access.
--
-- An administrator Auth user also receives a profile. The customer list
-- excludes every user present in admin_accounts, so that account is not
-- shown as a customer.
--
-- Review the SELECT below before the INSERT. Run both in one transaction.
-- The guard stops the insert until v_apply is changed to true.
-- With the default, the transaction raises and rolls back after the preview.

begin;

-- Preview. These are the only rows the insert can add. No existing profile is included.
select
  u.id,
  u.email,
  left(coalesce(u.raw_user_meta_data ->> 'full_name', ''), 120) as full_name,
  left(coalesce(u.raw_user_meta_data ->> 'mobile', ''), 20) as mobile,
  case
    when u.email_confirmed_at is not null then 'active'
    else 'pending_verification'
  end as account_status,
  u.created_at
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
)
order by u.created_at;

do $guard$
declare
  v_apply boolean := false;
  v_missing integer;
begin
  select count(*) into v_missing
  from auth.users u
  where not exists (
    select 1 from public.profiles p where p.id = u.id
  );

  if not v_apply then
    raise exception
      'Backfill was not applied. % Auth user(s) have no profile. Review the preview, set v_apply to true, and run this file again.',
      v_missing;
  end if;
end;
$guard$;

insert into public.profiles (id, full_name, mobile, email, account_status, created_at)
select
  u.id,
  left(coalesce(u.raw_user_meta_data ->> 'full_name', ''), 120),
  left(coalesce(u.raw_user_meta_data ->> 'mobile', ''), 20),
  u.email,
  case
    when u.email_confirmed_at is not null then 'active'
    else 'pending_verification'
  end,
  u.created_at
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
)
on conflict (id) do nothing;

commit;
