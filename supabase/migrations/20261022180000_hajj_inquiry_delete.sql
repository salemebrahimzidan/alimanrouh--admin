-- Administrators can remove a hajj inquiry. Customers still cannot delete one.

grant delete on public.hajj_inquiries to authenticated;

drop policy if exists hajj_inquiries_delete on public.hajj_inquiries;

create policy hajj_inquiries_delete on public.hajj_inquiries
for delete to authenticated
using (public.is_admin());
