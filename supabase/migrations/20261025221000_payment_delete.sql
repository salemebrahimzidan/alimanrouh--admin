-- Administrators can remove a payment. Customers still cannot delete one.

grant delete on public.payments to authenticated;

drop policy if exists payments_delete on public.payments;

create policy payments_delete on public.payments
for delete to authenticated
using (public.is_admin());
