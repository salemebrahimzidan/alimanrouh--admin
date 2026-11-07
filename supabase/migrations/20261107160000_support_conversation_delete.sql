-- Administrators can delete resolved support conversations only.
-- Messages and guest access rows cascade from support_conversations.

create or replace function public.support_admin_delete(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $func$
declare
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select status
  into v_status
  from public.support_conversations
  where id = p_conversation_id
  for update;

  if not found then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;

  if v_status is distinct from 'resolved' then
    raise exception 'only resolved conversations can be deleted' using errcode = '22023';
  end if;

  delete from public.support_conversations
  where id = p_conversation_id;
end;
$func$;

revoke all on function public.support_admin_delete(uuid) from public, anon, service_role;
grant execute on function public.support_admin_delete(uuid) to authenticated;
