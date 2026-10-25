import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('../supabase/migrations/20261025143000_support_conversations.sql', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

function functionBody(name: string) {
  const match = migration.match(new RegExp(`create function public\\.${name}\\([\\s\\S]*?\\$func\\$;`, 'i'))
  expect(match, `function ${name} exists`).not.toBeNull()
  return match?.[0] ?? ''
}

describe('support inbox authorization and data preservation', () => {
  it('keeps the production preflight strictly read-only', () => {
    const preflight = readFileSync(
      new URL('../supabase/manual/support_preflight_readonly.sql', import.meta.url),
      'utf8',
    ).replace(/\r\n/g, '\n')
    const statements = preflight
      .replace(/--.*$/gm, '')
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean)

    expect(statements.length).toBeGreaterThan(0)
    for (const statement of statements) {
      expect(statement).toMatch(/^(select|with)\b/i)
    }
    expect(preflight).toContain('query_to_xml')
    expect(preflight).toContain('hajj_inquiries_by_status')
    expect(preflight).toContain('supabase_realtime')
    expect(preflight).toContain('public.support_create_registered_conversation(text,text,text,text)')
    expect(preflight).toContain('public.support_create_guest_conversation(text,text,text,text,text,text,text)')
    expect(preflight).toContain('public_role_has_create')
    expect(preflight).toContain('anon_effective_create')
    expect(preflight).toContain('authenticated_effective_create')
    expect(preflight).toContain('potential_support_status_sync')
    expect(preflight).toContain('pg_get_functiondef')
    expect(preflight).not.toContain('support_sync_hajj_inquiry_status')
    expect(preflight).not.toContain('support_sync_legacy_hajj_status')
  })

  it('removes default direct table and service-role grants before granting least privilege', () => {
    expect(migration).toMatch(
      /revoke all on public\.support_conversations,\s*public\.support_messages,\s*public\.support_guest_access,\s*public\.support_guest_rate_limits\s*from public, anon, authenticated, service_role/i,
    )
    expect(migration).toContain('grant select on public.support_conversations to authenticated')
    expect(migration).toContain('grant select on public.support_messages to authenticated')
    for (const name of [
      'support_message_added',
      'support_enforce_guest_rate_limit',
      'support_create_registered_conversation',
      'support_create_guest_conversation',
      'support_guest_get_conversation',
      'support_guest_reply',
      'support_mark_read',
      'support_admin_set_status',
      'support_import_hajj_inquiry',
    ]) {
      const revoke = migration.match(
        new RegExp(`revoke all on function public\\.${name}\\([^;]+? from ([^;]+);`, 'i'),
      )
      expect(revoke, `function ${name} has explicit execute revocations`).not.toBeNull()
      expect(revoke?.[1]).toContain('service_role')
      expect(revoke?.[1]).toContain('public')
    }
  })

  it('allows status changes only through an admin-checked RPC', () => {
    const rpc = functionBody('support_admin_set_status')
    expect(rpc).toContain('if not public.is_admin() then')
    expect(rpc).toContain("p_status not in ('new', 'in_progress', 'resolved')")
    expect(migration).not.toMatch(/grant\s+update\s*\([^)]*status[^)]*\)\s+on public\.support_conversations/i)
    expect(migration).not.toContain('create policy support_conversations_update')
  })

  it('keeps support status authoritative with no legacy status synchronization triggers', () => {
    expect(migration).toContain('create trigger hajj_inquiries_create_support_conversation')
    expect(migration).toContain('after insert on public.hajj_inquiries')
    expect(migration).not.toMatch(/create trigger[^;]*(?:update of internal_status|update of status)[^;]*hajj_inquiries/i)
    expect(migration).not.toContain('support_conversations_sync_legacy_status')
    expect(migration).not.toContain('support_sync_hajj_inquiry_status')
    expect(migration).not.toContain('support_sync_legacy_hajj_status')
  })

  it('does not grant direct unread counter or message read-status updates', () => {
    expect(migration).not.toMatch(/grant\s+update[^;]*admin_unread_count/i)
    expect(migration).not.toMatch(/grant\s+update[^;]*customer_unread_count/i)
    expect(migration).not.toMatch(/grant\s+update\s*\(\s*read_at\s*\)/i)
    expect(migration).not.toContain('create policy support_messages_update_read')
    const markRead = functionBody('support_mark_read')
    expect(markRead).toContain('public.is_admin()')
    expect(markRead).toContain('customer_id = v_customer_id')
    expect(markRead).toContain("sender = 'customer'")
    expect(markRead).toContain("sender = 'admin'")
    expect(markRead).toContain('set admin_unread_count = 0')
    expect(markRead).toContain('set customer_unread_count = 0')
  })

  it('restricts authenticated reads and message inserts to the admin or own customer conversation', () => {
    expect(migration).toContain('using (public.is_admin() or customer_id = auth.uid())')
    const selectPolicy = migration.match(/create policy support_messages_select[\s\S]*?;/i)?.[0] ?? ''
    expect(selectPolicy).toContain('public.is_admin()')
    expect(selectPolicy).toContain('c.customer_id = auth.uid()')
    const insertPolicy = migration.match(/create policy support_messages_insert[\s\S]*?;/i)?.[0] ?? ''
    expect(insertPolicy).toContain("sender = 'admin'")
    expect(insertPolicy).toContain("sender = 'customer'")
    expect(insertPolicy).toContain('author_user_id = auth.uid()')
    expect(insertPolicy).toContain('c.customer_id = auth.uid()')
  })

  it('keeps guest tokens hashed and isolates token reads and replies to one conversation', () => {
    expect(migration).toContain('extensions.gen_random_bytes(32)')
    expect(migration).toMatch(
      /revoke all on public\.support_conversations, public\.support_messages,\s*public\.support_guest_access, public\.support_guest_rate_limits\s*from public, anon, authenticated, service_role/i,
    )
    expect(migration).toContain('access_token_hash')
    const read = functionBody('support_guest_get_conversation')
    const reply = functionBody('support_guest_reply')
    for (const body of [read, reply]) {
      expect(body).toContain('auth.uid() is not null')
      expect(body).toContain('where id = p_conversation_id')
      expect(body).toContain('a.conversation_id = p_conversation_id')
      expect(body).toContain('a.access_token_hash')
      expect(body).toContain('extensions.digest(pg_catalog.convert_to(p_access_token')
    }
  })

  it('never trusts forwarded IP headers in SQL and leaves client-IP limiting to the edge gateway', () => {
    const limiter = functionBody('support_enforce_guest_rate_limit')
    expect(limiter).toContain('pg_advisory_xact_lock')
    expect(limiter).toContain("interval '15 minutes'")
    expect(limiter).toContain("'guest_create_contact' then 3")
    expect(limiter).toContain("'guest_reply_token' then 20")
    const create = functionBody('support_create_guest_conversation')
    const reply = functionBody('support_guest_reply')
    expect(create).not.toMatch(/request\.headers|x-forwarded-for|x-real-ip|cf-connecting-ip/i)
    expect(reply).not.toMatch(/request\.headers|x-forwarded-for|x-real-ip|cf-connecting-ip/i)
    expect(create).toContain("pg_catalog.lower(pg_catalog.btrim(p_email))")
    expect(create).toContain("pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_phone, '')), '[^0-9+]', '', 'g')")
    expect(create).toContain("'guest_create_contact'")
    expect(create).toContain('email or phone is required')
    expect(reply).toContain("support_enforce_guest_rate_limit('guest_reply_token'")
    expect(migration).toMatch(/revoke all on function public\.support_create_guest_conversation[^;]*from public, anon, authenticated, service_role/i)
    expect(migration).toMatch(/grant execute on function public\.support_create_guest_conversation[^;]*to service_role/i)
    expect(migration).not.toMatch(/grant execute on function public\.support_(?:create_guest_conversation|guest_get_conversation|guest_reply)[^;]*to anon/i)
  })

  it('pins every SECURITY DEFINER function to a safe search path and qualifies privileged calls', () => {
    const functionNames = [
      'support_message_added',
      'support_enforce_guest_rate_limit',
      'support_create_registered_conversation',
      'support_create_guest_conversation',
      'support_guest_get_conversation',
      'support_guest_reply',
      'support_mark_read',
      'support_admin_set_status',
      'support_import_hajj_inquiry',
    ]
    for (const name of functionNames) {
      const body = functionBody(name)
      expect(body).toMatch(/security definer[\s\S]*set search_path = pg_catalog, pg_temp/i)
      expect(body).not.toMatch(/set search_path = public(?:,|$)/i)
      for (const builtin of [
        'btrim',
        'char_length',
        'now',
        'encode',
        'convert_to',
        'digest',
        'gen_random_bytes',
        'pg_advisory_xact_lock',
        'hashtextextended',
        'lower',
        'regexp_replace',
        'jsonb_agg',
        'jsonb_build_object',
      ]) {
        expect(body).not.toMatch(new RegExp(`(^|[^.\\w])${builtin}\\s*\\(`, 'i'))
      }
    }
    expect(functionBody('support_create_guest_conversation')).toContain('extensions.gen_random_bytes')
    expect(functionBody('support_guest_reply')).toContain('public.support_enforce_guest_rate_limit')
    expect(functionBody('support_mark_read')).toContain('public.is_admin()')
    expect(functionBody('support_create_registered_conversation')).toContain('auth.uid()')
  })

  it('restricts guest RPC execution to the server-side gateway', () => {
    for (const functionName of [
      'support_create_guest_conversation',
      'support_guest_get_conversation',
      'support_guest_reply',
    ]) {
      expect(migration).toMatch(
        new RegExp(`revoke all on function public\\.${functionName}[^;]*from public, anon, authenticated, service_role`, 'i'),
      )
      expect(migration).toMatch(
        new RegExp(`grant execute on function public\\.${functionName}[^;]*to service_role`, 'i'),
      )
      expect(migration).not.toMatch(
        new RegExp(`grant execute on function public\\.${functionName}[^;]*to (?:public|anon|authenticated)`, 'i'),
      )
    }
    expect(migration).toContain('Vercel API')
    expect(migration).toContain('Vercel')
    expect(migration).not.toContain('Cloudflare')
  })

  it('preserves old inquiries, prevents duplicate linked rows, and initializes unread counts from messages', () => {
    expect(migration).toContain('insert into public.support_conversations')
    expect(migration).toContain('from public.hajj_inquiries i')
    expect(migration).toContain('on conflict (linked_hajj_inquiry_id) do nothing')
    expect(migration).toContain('where not exists (\n  select 1 from public.support_messages m where m.conversation_id = c.id')
    expect(migration).toMatch(
      /admin_unread_count = admin_unread_count \+ case\s+when new\.sender = 'customer' and new\.read_at is null then 1 else 0\s+end/i,
    )
    const messageTrigger = functionBody('support_message_added')
    expect(messageTrigger).not.toContain('status =')
    expect(migration).toContain('created_at, read_at')
    expect(migration).toContain('case when i.internal_status = \'new\' then null else i.updated_at end')
    expect(migration).toContain('where not exists (\n  select 1 from public.support_messages m where m.conversation_id = c.id')
    expect(migration).not.toMatch(/\b(delete|truncate)\s+from\s+public\.hajj_inquiries/i)
  })

  it('records inquiry topics and bounded context in the unified conversation row', () => {
    expect(migration).toContain("topic in ('general', 'contact', 'hajj', 'umrah', 'booking', 'complaint')")
    expect(migration).toContain('context text')
    expect(functionBody('support_create_registered_conversation')).toContain('p_topic')
    expect(functionBody('support_create_guest_conversation')).toContain('p_topic')
    expect(migration).toContain("topic, context, status, linked_hajj_inquiry_id")
  })

  it('keeps admin inquiry routing and notifications on the support inbox', () => {
    const routes = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
    const nav = readFileSync(new URL('../src/components/DashboardLayout.tsx', import.meta.url), 'utf8')
    const notifications = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8')
    const hajjPage = readFileSync(new URL('../src/pages/hajj/HajjPage.tsx', import.meta.url), 'utf8')
    expect(routes).toContain('path="inquiries"')
    expect(routes).toContain('path="hajj/inquiries"')
    expect(nav).toContain("to: '/inquiries', label: 'الاستفسارات'")
    expect(notifications).toContain("entity_type: 'support_conversation'")
    expect(notifications).not.toContain(".from('hajj_inquiry_rows')")
    expect(hajjPage).not.toContain('InquiryTable')
    expect(hajjPage).toContain('<Navigate to="/inquiries" replace />')
  })

  it('includes a rollback-only actor matrix for admin, customer, guest, and unrelated user checks', () => {
    const review = readFileSync(
      new URL('../supabase/manual/support_rls_review.sql', import.meta.url),
      'utf8',
    )
    expect(review).toContain('begin;')
    expect(review).toContain('rollback;')
    expect(review).toContain('set local role authenticated')
    expect(review).toContain('set local role anon')
    expect(review).toContain('support_admin_set_status')
    expect(review).toContain('support_guest_get_conversation')
    expect(review).toContain('unrelated authenticated user')
    expect(review).toContain('unread counter directly')
    expect(review).toContain('marked their own message read')
    expect(review).toContain('Customer reply through row level security')
    expect(review).toContain('Admin reply through row level security')
    expect(review).toContain('customer read receipt did not clear their unread admin replies')
  })
})
