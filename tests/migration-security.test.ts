import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
}

const migration = read('../supabase/migrations/20261020120000_init_admin_schema.sql')
const preflight = read('../supabase/manual/preflight_readonly.sql')
const backfill = read('../supabase/manual/backfill_profiles.sql')
const customersPage = read('../src/pages/customers/CustomersPage.tsx')
const api = read('../src/lib/api.ts')
const portal = read('../src/lib/portal.ts')

function withoutComments(sql: string) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '')
}

function withoutCommentsOrStrings(sql: string) {
  return withoutComments(sql).replace(/'(?:''|[^'])*'/g, "''")
}

const documentPath =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/
const mediaPath = /^(umrah|hajj|website)\/[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/
const userId = '11111111-2222-4333-8444-555555555555'

describe('migration privileges', () => {
  it('revokes only named objects and does not trust a client-controlled setting', () => {
    const source = migration.toLowerCase()
    expect(source).not.toContain('revoke all on all tables')
    expect(source).not.toContain('revoke all on all sequences')
    expect(source).not.toContain('revoke all on all functions')
    expect(source).not.toContain('pg_context')
    expect(source).not.toContain('app.profile_sync')
    expect(source).not.toContain('do update')
    expect(migration).toContain('revoke create on schema public from anon, authenticated')
    expect(migration).toContain('from public, anon, authenticated, service_role')
    expect(migration).not.toContain('grant execute on function public.write_audit')
    expect(migration).not.toContain('grant insert on public.admin_accounts')
    expect(migration).not.toContain('grant insert on public.profiles')
  })

  it('keeps profile identity fixed and limits auth status changes', () => {
    expect(migration).toContain('profile identity is immutable')
    expect(migration).toContain('suspended profiles are not restored by auth sync')
    expect(migration).toContain('invalid auth profile status change')
    expect(migration).toContain('profile status and email are immutable')
    const metadataKeys = [...migration.matchAll(/raw_user_meta_data ->> '([^']+)'/g)].map((match) => match[1])
    expect(new Set(metadataKeys)).toEqual(new Set(['full_name', 'mobile']))
  })

  it('creates a customer row for every new auth user and hides administrators', () => {
    expect(migration).toContain('create trigger on_auth_user_created')
    expect(migration).toContain('grant execute on function public.handle_new_user() to supabase_auth_admin')
    expect(migration).toContain('grant execute on function public.handle_auth_user_updated() to supabase_auth_admin')
    expect(migration).toContain('where not exists (\n  select 1 from public.admin_accounts a where a.user_id = p.id\n)')
    expect(customersPage).toContain('حتى إذا لم يُنشئ أي حجز')
    expect(api).toContain(".from('customers')")
    expect(api).not.toContain(".gt('bookings_count'")
    expect(portal).toContain('full_name: input.fullName.trim()')
    expect(portal).toContain('mobile: input.mobile.trim()')
    expect(portal).not.toContain('role:')
  })
})

describe('storage path rules', () => {
  it('uses the same document and media patterns as the migration', () => {
    expect(migration).toContain(
      "storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9][A-Za-z0-9._-]{0,180}$'",
    )
    expect(migration).toContain("name ~ '^(umrah|hajj|website)/[A-Za-z0-9][A-Za-z0-9._-]{0,200}$'")
    expect(migration).toContain("    'customer-documents',\n    'customer-documents',\n    false,")
  })

  it('accepts one folder and one file name, and rejects traversal', () => {
    expect(documentPath.test(`${userId}/passport.pdf`)).toBe(true)
    expect(documentPath.test(`${userId}/a.b_c-1.webp`)).toBe(true)
    expect(documentPath.test(`${userId}/nested/passport.pdf`)).toBe(false)
    expect(documentPath.test(`${userId}/../${userId}/passport.pdf`)).toBe(false)
    expect(documentPath.test(`${userId}/%2e%2e`)).toBe(false)
    expect(documentPath.test(`${userId}/`)).toBe(false)
    expect(documentPath.test(`AAAA1111-2222-4333-8444-555555555555/file.pdf`)).toBe(false)
    expect(mediaPath.test(`umrah/${userId}.jpg`)).toBe(true)
    expect(mediaPath.test('website/hero.png')).toBe(true)
    expect(mediaPath.test('../umrah/hero.jpg')).toBe(false)
    expect(mediaPath.test('https://example.com/hero.jpg')).toBe(false)
    expect(mediaPath.test('umrah/nested/hero.jpg')).toBe(false)
  })
})

describe('manual scripts', () => {
  it('keeps the preflight read only', () => {
    const source = withoutCommentsOrStrings(preflight)
    expect(source.toLowerCase()).toContain('begin read only')
    expect(source.toLowerCase()).toContain('rollback')
    expect(source).not.toMatch(/\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|merge|copy)\b/i)
    expect(source).not.toMatch(/\b(from|join)\s+(public\.profiles|storage\.buckets|auth\.users)\b/i)
    expect(preflight).toContain("to_regclass('public.profiles')")
    expect(preflight).toContain("to_regclass('storage.buckets')")
    expect(preflight).toContain("to_regclass('auth.users')")
    expect(preflight).toContain('expected-fresh')
    expect(preflight).not.toContain('auth.users u')
    expect(preflight).not.toContain('u.email')
  })

  it('does not backfill until the operator turns the flag on', () => {
    const source = withoutComments(backfill)
    expect(source).toContain('v_apply boolean := false')
    expect(source).toContain('on conflict (id) do nothing')
    expect(source).not.toMatch(/\b(delete|drop|truncate)\b/i)
    expect(source).not.toContain('admin_accounts')
    expect(backfill).toContain("raw_user_meta_data ->> 'full_name'")
    expect(backfill).toContain("raw_user_meta_data ->> 'mobile'")
  })
})
