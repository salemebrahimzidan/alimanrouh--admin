-- An administrator can send a note the customer sees, without moving the booking status.

create function public.admin_add_booking_client_note(
  p_booking_id uuid,
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
  from public.bookings
  where id = p_booking_id;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;

  insert into public.booking_status_history (booking_id, old_status, new_status, note, changed_by)
  values (p_booking_id, v_status, v_status, v_note, auth.uid());

  perform public.write_audit(
    'booking.client_note',
    'booking',
    p_booking_id,
    jsonb_build_object('status', v_status)
  );
end;
$func$;

revoke all on function public.admin_add_booking_client_note(uuid, text) from public;
grant execute on function public.admin_add_booking_client_note(uuid, text) to authenticated;
