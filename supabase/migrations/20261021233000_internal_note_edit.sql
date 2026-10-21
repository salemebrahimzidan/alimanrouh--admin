-- Administrators can correct or remove an internal note.
-- Only the text is writable. The note stays attached to the same record.

grant update (body) on public.internal_notes to authenticated;
grant delete on public.internal_notes to authenticated;

create policy internal_notes_update on public.internal_notes
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy internal_notes_delete on public.internal_notes
for delete to authenticated
using (public.is_admin());
