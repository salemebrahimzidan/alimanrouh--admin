-- Allow an administrator to delete an Umrah package.
-- Existing bookings keep their snapshot and lose only the package link.

grant delete on public.umrah_packages to authenticated;

create policy umrah_packages_delete on public.umrah_packages
for delete to authenticated
using (public.is_admin());
