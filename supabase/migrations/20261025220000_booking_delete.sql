-- Administrators can remove a booking.
-- Recorded payments stay; only their booking link is cleared.

create or replace function public.guard_payment_write()
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

  if new.booking_id is null
    and old.booking_id is not null
    and new.id is not distinct from old.id
    and new.amount is not distinct from old.amount
    and new.customer_id is not distinct from old.customer_id
    and new.method is not distinct from old.method
    and new.paid_on is not distinct from old.paid_on
    and new.currency is not distinct from old.currency
    and new.recorded_by is not distinct from old.recorded_by
    and new.created_at is not distinct from old.created_at
    and new.status is not distinct from old.status
    and new.note is not distinct from old.note
  then
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

alter table public.payments drop constraint if exists payments_booking_id_fkey;
alter table public.payments
  add constraint payments_booking_id_fkey
  foreign key (booking_id)
  references public.bookings (id)
  on delete set null;

alter table public.payments drop constraint if exists payments_booking_customer_fk;
alter table public.payments
  add constraint payments_booking_customer_fk
  foreign key (booking_id, customer_id)
  references public.bookings (id, customer_id)
  on delete set null (booking_id);

grant delete on public.bookings to authenticated;

drop policy if exists bookings_delete on public.bookings;

create policy bookings_delete on public.bookings
for delete to authenticated
using (public.is_admin());
