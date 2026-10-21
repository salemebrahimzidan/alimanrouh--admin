-- An administrator can set any visa status, send a client note on an open request, and delete a request.
-- Linked documents stay on the customer file and lose only the visa link.

create or replace function public.guard_visa_update()
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

create or replace function public.admin_add_visa_client_note(
  p_visa_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_status text;
  v_note text;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is null or char_length(v_note) > 1000 then
    raise exception 'note is required' using errcode = '23514';
  end if;

  select status into v_status
  from public.visa_applications
  where id = p_visa_id;
  if not found then
    raise exception 'visa application not found' using errcode = 'P0002';
  end if;

  if v_status in ('closed', 'cancelled') then
    raise exception 'status must follow the previous step' using errcode = '23514';
  end if;

  perform public.write_audit(
    'visa.client_note',
    'visa_application',
    p_visa_id,
    jsonb_build_object('status', v_status, 'note', v_note)
  );
end;
$func$;

revoke all on function public.admin_add_visa_client_note(uuid, text) from public;
grant execute on function public.admin_add_visa_client_note(uuid, text) to authenticated;

grant delete on public.visa_applications to authenticated;

drop policy if exists visas_delete on public.visa_applications;

create policy visas_delete on public.visa_applications
for delete to authenticated
using (public.is_admin());
