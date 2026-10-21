import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  accountStatuses,
  bookingStatuses,
  hajjInquiryStatuses,
  paymentMethods,
  paymentStatuses,
  visaStatuses,
} from '../src/lib/labels'

const sql = readFileSync(new URL('../supabase/migrations/20261020120000_init_admin_schema.sql', import.meta.url), 'utf8')

describe('schema contract', () => {
  it('keeps application statuses aligned with database checks', () => {
    for (const status of [...accountStatuses, ...bookingStatuses, ...visaStatuses, ...hajjInquiryStatuses, ...paymentMethods, ...paymentStatuses]) {
      expect(sql).toContain(`'${status}'`)
    }
  })

  it('keeps customer views from bypassing row level security', () => {
    for (const name of ['customers', 'booking_rows', 'visa_rows', 'hajj_inquiry_rows', 'booking_balances']) {
      expect(sql).toContain(`create view public.${name}`)
    }
    expect(sql.match(/security_invoker = true/g)?.length).toBe(5)
    expect(sql.match(/security_barrier = true/g)?.length).toBe(5)
  })

  it('does not let the API forge admins, profiles, or audit rows', () => {
    expect(sql).toContain('No metadata key can create an admin account')
    expect(sql).not.toContain('grant insert on public.admin_accounts')
    expect(sql).not.toContain('grant insert on public.profiles')
    expect(sql).not.toContain('grant execute on function public.write_audit')
    expect(sql).not.toContain('app.profile_sync')
    expect(sql).not.toContain('pg_context')
    expect(sql).toContain('grant execute on function public.handle_new_user() to supabase_auth_admin')
    expect(sql).toContain('grant usage on schema public to anon, authenticated, supabase_auth_admin')
    expect(sql).toContain('grant update (full_name, mobile, updated_at) on public.profiles to authenticated')
    expect(sql).toContain("session_user in ('postgres', 'supabase_admin')")
    expect(sql).toContain("session_user = 'supabase_auth_admin'")
    expect(sql).toContain('profile identity is immutable')
    expect(sql).toContain('payments_booking_customer_fk')
    expect(sql).toContain('customer_documents_visa_customer_fk')
  })
})
