-- A booking moves one status at a time. Cancellation is allowed from any open step.

create or replace function public.guard_booking_update()
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

  if new.status is distinct from old.status
    and not (
      (old.status = 'pending' and new.status in ('under_review', 'cancelled'))
      or (old.status = 'under_review' and new.status in ('confirmed', 'cancelled'))
      or (old.status = 'confirmed' and new.status in ('completed', 'cancelled'))
    )
  then
    raise exception 'status must follow the previous step' using errcode = '23514';
  end if;

  return new;
end;
$func$;
