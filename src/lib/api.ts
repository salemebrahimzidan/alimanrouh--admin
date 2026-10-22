import { pageSize } from './config'
import { asNumber, englishAmount, ilikeOr, pageRange } from './format'
import { readCopy, normalizeCopy, validateCopy, type SectionCopy, type SiteSectionId } from './site-copy'
import type {
  AccountStatus,
  BookingStatus,
  ContentKind,
  HajjInquiryStatus,
  HajjProgramStatus,
  PaymentMethod,
  VisaStatus,
} from './labels'
import { db } from './supabase'

export type CustomerRow = {
  id: string
  full_name: string
  mobile: string
  email: string | null
  account_status: string
  created_at: string
  bookings_count: number
}

export type BookingRow = {
  id: string
  reference: string
  customer_id: string
  package_id: string | null
  package_title_snapshot: string
  travel_date: string
  travelers_count: number
  total_amount: number
  status: string
  customer_note: string
  created_at: string
  customer_name: string
  customer_mobile: string
  customer_email: string | null
}

export type StatusEvent = {
  id: string
  old_status: string | null
  new_status: string
  note: string | null
  created_at: string
}

export type InternalNote = {
  id: string
  body: string
  created_at: string
}

export type PackageRow = {
  id: string
  title: string
  description: string
  price_sar: number
  duration_days: number
  hotel_info: string
  transportation: string
  image_path: string | null
  is_published: boolean
  created_at: string
}

export type PackageInput = {
  title: string
  description: string
  price_sar: number
  duration_days: number
  hotel_info: string
  transportation: string
  image_path: string | null
  is_published: boolean
}

export type HajjProgramRow = Omit<PackageRow, 'price_sar' | 'duration_days'> & {
  season_label: string
  internal_status: string
  price_sar: number | null
  duration_days: number | null
}

export type HajjProgramInput = {
  title: string
  description: string
  season_label: string
  price_sar: number | null
  duration_days: number | null
  hotel_info: string
  transportation: string
  image_path: string | null
  internal_status: HajjProgramStatus
  is_published: boolean
}

export type InquiryRow = {
  id: string
  customer_id: string
  program_id: string | null
  message: string
  travelers_count: number
  internal_status: string
  created_at: string
  customer_name: string
  customer_mobile: string
  customer_email: string | null
  program_title: string | null
}

export type VisaRow = {
  id: string
  reference: string
  customer_id: string
  full_name: string
  mobile: string
  passport_number: string
  nationality: string
  requested_travel_date: string | null
  customer_note: string
  status: string
  created_at: string
  customer_name: string
  customer_mobile: string
  customer_email: string | null
}

export type DocumentRow = {
  id: string
  customer_id: string
  visa_application_id: string | null
  storage_path: string
  file_name: string
  mime_type: string
  created_at: string
}

export type PaymentRow = {
  id: string
  customer_id: string
  booking_id: string | null
  amount: number
  method: string
  status: string
  paid_on: string
  note: string
  created_at: string
  customer_name: string
  booking_reference: string | null
}

export type BalanceRow = {
  id: string
  reference: string
  customer_id: string
  customer_name: string
  status: string
  total_amount: number
  paid_amount: number
  balance_amount: number
}

export type ContentRow = {
  id: string
  kind: string
  title: string
  body: string
  image_path: string | null
  link_url: string | null
  sort_order: number
  is_published: boolean
  created_at: string
}

export type ContentInput = {
  kind: ContentKind
  title: string
  body: string
  image_path: string | null
  link_url: string | null
  sort_order: number
  is_published: boolean
}

export type AuditRow = {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  created_at: string
  detail?: string
}

export type PaymentSummary = {
  recorded_total: number
  payments_count: number
  outstanding_total: number
  months: { month: string; total: number; payment_count: number }[]
}

export type DashboardData = {
  customers: number
  bookings: number
  pending: number
  underReview: number
  confirmed: number
  completed: number
  cancelled: number
  visas: number
  payments: number
  recentBookings: BookingRow[]
  recentCustomers: CustomerRow[]
  bookingCreatedAt: string[]
  customerCreatedAt: string[]
  visaCreatedAt: string[]
  paymentCreatedAt: string[]
}

type ListParams = { search: string; status: string; page: number }

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

function asText(value: unknown) {
  return value == null ? '' : String(value)
}

function asNullableText(value: unknown) {
  if (value == null || value === '') return null
  return String(value)
}

function embeddedText(value: unknown, key: string) {
  if (Array.isArray(value)) return asText(asRecord(value[0])[key])
  return asText(asRecord(value)[key])
}

function unwrap<T>(result: { data: T; error: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message)
  return result.data
}

function mapCustomer(value: unknown): CustomerRow {
  const row = asRecord(value)
  return {
    id: asText(row.id),
    full_name: asText(row.full_name),
    mobile: asText(row.mobile),
    email: asNullableText(row.email),
    account_status: asText(row.account_status),
    created_at: asText(row.created_at),
    bookings_count: asNumber(row.bookings_count),
  }
}

function mapBooking(value: unknown): BookingRow {
  const row = asRecord(value)
  return {
    id: asText(row.id),
    reference: asText(row.reference),
    customer_id: asText(row.customer_id),
    package_id: asNullableText(row.package_id),
    package_title_snapshot: asText(row.package_title_snapshot),
    travel_date: asText(row.travel_date),
    travelers_count: asNumber(row.travelers_count),
    total_amount: asNumber(row.total_amount),
    status: asText(row.status),
    customer_note: asText(row.customer_note),
    created_at: asText(row.created_at),
    customer_name: asText(row.customer_name),
    customer_mobile: asText(row.customer_mobile),
    customer_email: asNullableText(row.customer_email),
  }
}

function mapPackage(value: unknown): PackageRow {
  const row = asRecord(value)
  return {
    id: asText(row.id),
    title: asText(row.title),
    description: asText(row.description),
    price_sar: asNumber(row.price_sar),
    duration_days: asNumber(row.duration_days),
    hotel_info: asText(row.hotel_info),
    transportation: asText(row.transportation),
    image_path: asNullableText(row.image_path),
    is_published: Boolean(row.is_published),
    created_at: asText(row.created_at),
  }
}

function mapHajjProgram(value: unknown): HajjProgramRow {
  const row = asRecord(value)
  return {
    ...mapPackage(value),
    season_label: asText(row.season_label),
    internal_status: asText(row.internal_status),
    price_sar: row.price_sar == null ? null : asNumber(row.price_sar),
    duration_days: row.duration_days == null ? null : asNumber(row.duration_days),
  }
}

function mapInquiry(value: unknown): InquiryRow {
  const row = asRecord(value)
  return {
    id: asText(row.id),
    customer_id: asText(row.customer_id),
    program_id: asNullableText(row.program_id),
    message: asText(row.message),
    travelers_count: asNumber(row.travelers_count),
    internal_status: asText(row.internal_status),
    created_at: asText(row.created_at),
    customer_name: asText(row.customer_name),
    customer_mobile: asText(row.customer_mobile),
    customer_email: asNullableText(row.customer_email),
    program_title: asNullableText(row.program_title),
  }
}

function mapVisa(value: unknown): VisaRow {
  const row = asRecord(value)
  return {
    id: asText(row.id),
    reference: asText(row.reference),
    customer_id: asText(row.customer_id),
    full_name: asText(row.full_name),
    mobile: asText(row.mobile),
    passport_number: asText(row.passport_number),
    nationality: asText(row.nationality),
    requested_travel_date: asNullableText(row.requested_travel_date),
    customer_note: asText(row.customer_note),
    status: asText(row.status),
    created_at: asText(row.created_at),
    customer_name: asText(row.customer_name),
    customer_mobile: asText(row.customer_mobile),
    customer_email: asNullableText(row.customer_email),
  }
}

function mapDocument(value: unknown): DocumentRow {
  const row = asRecord(value)
  return {
    id: asText(row.id),
    customer_id: asText(row.customer_id),
    visa_application_id: asNullableText(row.visa_application_id),
    storage_path: asText(row.storage_path),
    file_name: asText(row.file_name),
    mime_type: asText(row.mime_type),
    created_at: asText(row.created_at),
  }
}

function mapPayment(value: unknown): PaymentRow {
  const row = asRecord(value)
  return {
    id: asText(row.id),
    customer_id: asText(row.customer_id),
    booking_id: asNullableText(row.booking_id),
    amount: asNumber(row.amount),
    method: asText(row.method),
    status: asText(row.status),
    paid_on: asText(row.paid_on),
    note: asText(row.note),
    created_at: asText(row.created_at),
    customer_name: embeddedText(row.profiles, 'full_name'),
    booking_reference: embeddedText(row.bookings, 'reference') || null,
  }
}

function mapBalance(value: unknown): BalanceRow {
  const row = asRecord(value)
  return {
    id: asText(row.id),
    reference: asText(row.reference),
    customer_id: asText(row.customer_id),
    customer_name: asText(row.customer_name),
    status: asText(row.status),
    total_amount: asNumber(row.total_amount),
    paid_amount: asNumber(row.paid_amount),
    balance_amount: asNumber(row.balance_amount),
  }
}

function mapContent(value: unknown): ContentRow {
  const row = asRecord(value)
  return {
    id: asText(row.id),
    kind: asText(row.kind),
    title: asText(row.title),
    body: asText(row.body),
    image_path: asNullableText(row.image_path),
    link_url: asNullableText(row.link_url),
    sort_order: asNumber(row.sort_order),
    is_published: Boolean(row.is_published),
    created_at: asText(row.created_at),
  }
}

async function exactCount(table: string, column?: string, value?: string) {
  let query = db().from(table).select('id', { count: 'exact', head: true })
  if (column && value) query = query.eq(column, value)
  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function countCustomers() {
  return exactCount('customers')
}

export async function listCustomers({ search, status, page }: ListParams) {
  let query = db()
    .from('customers')
    .select('id, full_name, mobile, email, account_status, created_at, bookings_count', { count: 'exact' })
    .order('created_at', { ascending: false })
  if (status) query = query.eq('account_status', status)
  const filter = ilikeOr(['full_name', 'mobile', 'email'], search)
  if (filter) query = query.or(filter)
  const { from, to } = pageRange(page, pageSize)
  const { data, error, count } = await query.range(from, to)
  if (error) throw new Error(error.message)
  return { rows: (data ?? []).map(mapCustomer), total: count ?? 0 }
}

export async function getCustomer(id: string) {
  const data = unwrap(
    await db()
      .from('customers')
      .select('id, full_name, mobile, email, account_status, created_at, bookings_count')
      .eq('id', id)
      .maybeSingle(),
  )
  return data ? mapCustomer(data) : null
}

export async function setAccountStatus(id: string, status: Extract<AccountStatus, 'active' | 'suspended'>) {
  unwrap(await db().rpc('admin_set_account_status', { p_customer_id: id, p_status: status }))
}

export async function listBookings({ search, status, page }: ListParams) {
  let query = db()
    .from('booking_rows')
    .select(
      'id, reference, customer_id, package_id, package_title_snapshot, travel_date, travelers_count, total_amount, status, customer_note, created_at, customer_name, customer_mobile, customer_email',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const filter = ilikeOr(['reference', 'customer_name', 'customer_mobile', 'customer_email', 'package_title_snapshot'], search)
  if (filter) query = query.or(filter)
  const { from, to } = pageRange(page, pageSize)
  const { data, error, count } = await query.range(from, to)
  if (error) throw new Error(error.message)
  return { rows: (data ?? []).map(mapBooking), total: count ?? 0 }
}

export async function listCustomerBookings(customerId: string) {
  const { data, error } = await db()
    .from('booking_rows')
    .select(
      'id, reference, customer_id, package_id, package_title_snapshot, travel_date, travelers_count, total_amount, status, customer_note, created_at, customer_name, customer_mobile, customer_email',
    )
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapBooking)
}

export async function getBooking(id: string) {
  const data = unwrap(
    await db()
      .from('booking_rows')
      .select(
        'id, reference, customer_id, package_id, package_title_snapshot, travel_date, travelers_count, total_amount, status, customer_note, created_at, customer_name, customer_mobile, customer_email',
      )
      .eq('id', id)
      .maybeSingle(),
  )
  return data ? mapBooking(data) : null
}

export async function bookingHistory(id: string) {
  const { data, error } = await db()
    .from('booking_status_history')
    .select('id, old_status, new_status, note, created_at')
    .eq('booking_id', id)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((item) => {
    const row = asRecord(item)
    return {
      id: asText(row.id),
      old_status: asNullableText(row.old_status),
      new_status: asText(row.new_status),
      note: asNullableText(row.note),
      created_at: asText(row.created_at),
    } satisfies StatusEvent
  })
}

export async function setBookingStatus(id: string, status: BookingStatus, note: string) {
  unwrap(await db().rpc('admin_set_booking_status', { p_booking_id: id, p_status: status, p_note: note || null }))
}

export async function addBookingClientNote(id: string, note: string) {
  unwrap(await db().rpc('admin_add_booking_client_note', { p_booking_id: id, p_note: note }))
}

export async function listNotes(entityType: 'booking' | 'visa_application' | 'hajj_inquiry', entityId: string) {
  const { data, error } = await db()
    .from('internal_notes')
    .select('id, body, created_at')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((item) => {
    const row = asRecord(item)
    return { id: asText(row.id), body: asText(row.body), created_at: asText(row.created_at) } satisfies InternalNote
  })
}

export async function addNote(
  entityType: 'booking' | 'visa_application' | 'hajj_inquiry',
  entityId: string,
  body: string,
  authorId: string,
) {
  unwrap(
    await db().from('internal_notes').insert({
      entity_type: entityType,
      entity_id: entityId,
      body,
      author_id: authorId,
    }),
  )
}

export async function updateNote(id: string, body: string) {
  const trimmed = body.trim()
  if (trimmed.length < 1 || trimmed.length > 2000) throw new Error('note is required')
  const data = unwrap(await db().from('internal_notes').update({ body: trimmed }).eq('id', id).select('id'))
  if (!Array.isArray(data) || data.length === 0) throw new Error('note not found')
}

export async function deleteNote(id: string) {
  const data = unwrap(await db().from('internal_notes').delete().eq('id', id).select('id'))
  if (!Array.isArray(data) || data.length === 0) throw new Error('note not found')
}

export async function listPackages() {
  const { data, error } = await db()
    .from('umrah_packages')
    .select('id, title, description, price_sar, duration_days, hotel_info, transportation, image_path, is_published, created_at')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapPackage)
}

export async function listPublishedPackages() {
  const { data, error } = await db()
    .from('umrah_packages')
    .select('id, title, description, price_sar, duration_days, hotel_info, transportation, image_path, is_published, created_at')
    .eq('is_published', true)
    .order('title', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapPackage)
}

export async function getPackage(id: string) {
  const data = unwrap(
    await db()
      .from('umrah_packages')
      .select('id, title, description, price_sar, duration_days, hotel_info, transportation, image_path, is_published, created_at')
      .eq('id', id)
      .maybeSingle(),
  )
  return data ? mapPackage(data) : null
}

export async function savePackage(input: PackageInput, id?: string) {
  if (id) {
    unwrap(await db().from('umrah_packages').update(input).eq('id', id))
    return id
  }
  const data = unwrap(await db().from('umrah_packages').insert(input).select('id').single())
  return asText(asRecord(data).id)
}

export async function setPackagePublished(id: string, isPublished: boolean) {
  const { error } = await db().from('umrah_packages').update({ is_published: isPublished }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deletePackage(id: string) {
  const { error } = await db().from('umrah_packages').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteVisa(id: string) {
  const notes = await db().from('internal_notes').delete().eq('entity_type', 'visa_application').eq('entity_id', id)
  if (notes.error) throw new Error(notes.error.message)
  const { data, error } = await db().from('visa_applications').delete().eq('id', id).select('id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('permission denied')
}

export async function listHajjPrograms() {
  const { data, error } = await db()
    .from('hajj_programs')
    .select('id, title, description, season_label, price_sar, duration_days, hotel_info, transportation, image_path, internal_status, is_published, created_at')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapHajjProgram)
}

export async function listPublishedHajjPrograms() {
  const { data, error } = await db()
    .from('hajj_programs')
    .select('id, title, description, season_label, price_sar, duration_days, hotel_info, transportation, image_path, internal_status, is_published, created_at')
    .eq('is_published', true)
    .order('title', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapHajjProgram)
}

export async function getHajjProgram(id: string) {
  const data = unwrap(
    await db()
      .from('hajj_programs')
      .select('id, title, description, season_label, price_sar, duration_days, hotel_info, transportation, image_path, internal_status, is_published, created_at')
      .eq('id', id)
      .maybeSingle(),
  )
  return data ? mapHajjProgram(data) : null
}

export async function saveHajjProgram(input: HajjProgramInput, id?: string) {
  if (id) {
    unwrap(await db().from('hajj_programs').update(input).eq('id', id))
    return id
  }
  const data = unwrap(await db().from('hajj_programs').insert(input).select('id').single())
  return asText(asRecord(data).id)
}

export async function setHajjProgramPublished(id: string, isPublished: boolean) {
  const { error } = await db()
    .from('hajj_programs')
    .update({ is_published: isPublished, internal_status: isPublished ? 'published' : 'draft' })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listInquiries() {
  const { data, error } = await db()
    .from('hajj_inquiry_rows')
    .select('id, customer_id, program_id, message, travelers_count, internal_status, created_at, customer_name, customer_mobile, customer_email, program_title')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapInquiry)
}

export async function getInquiry(id: string) {
  const data = unwrap(
    await db()
      .from('hajj_inquiry_rows')
      .select('id, customer_id, program_id, message, travelers_count, internal_status, created_at, customer_name, customer_mobile, customer_email, program_title')
      .eq('id', id)
      .maybeSingle(),
  )
  return data ? mapInquiry(data) : null
}

export async function setInquiryStatus(id: string, status: HajjInquiryStatus) {
  unwrap(await db().from('hajj_inquiries').update({ internal_status: status }).eq('id', id))
}

export async function deleteInquiry(id: string) {
  const notes = await db().from('internal_notes').delete().eq('entity_type', 'hajj_inquiry').eq('entity_id', id)
  if (notes.error) throw new Error(notes.error.message)
  const { data, error } = await db().from('hajj_inquiries').delete().eq('id', id).select('id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('permission denied')
}

export async function listVisas({ search, status, page }: ListParams) {
  let query = db()
    .from('visa_rows')
    .select(
      'id, reference, customer_id, full_name, mobile, passport_number, nationality, requested_travel_date, customer_note, status, created_at, customer_name, customer_mobile, customer_email',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
  if (status === 'under_review' || status === 'processing') query = query.in('status', ['under_review', 'processing'])
  else if (status) query = query.eq('status', status)
  const filter = ilikeOr(['reference', 'full_name', 'mobile', 'customer_email', 'nationality'], search)
  if (filter) query = query.or(filter)
  const { from, to } = pageRange(page, pageSize)
  const { data, error, count } = await query.range(from, to)
  if (error) throw new Error(error.message)
  return { rows: (data ?? []).map(mapVisa), total: count ?? 0 }
}

export async function listCustomerVisas(customerId: string) {
  const { data, error } = await db()
    .from('visa_rows')
    .select(
      'id, reference, customer_id, full_name, mobile, passport_number, nationality, requested_travel_date, customer_note, status, created_at, customer_name, customer_mobile, customer_email',
    )
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapVisa)
}

export async function getVisa(id: string) {
  const data = unwrap(
    await db()
      .from('visa_rows')
      .select(
        'id, reference, customer_id, full_name, mobile, passport_number, nationality, requested_travel_date, customer_note, status, created_at, customer_name, customer_mobile, customer_email',
      )
      .eq('id', id)
      .maybeSingle(),
  )
  return data ? mapVisa(data) : null
}

export async function setVisaStatus(id: string, status: VisaStatus, note: string) {
  unwrap(await db().rpc('admin_set_visa_status', { p_visa_id: id, p_status: status, p_note: note || null }))
}

export async function addVisaClientNote(id: string, note: string) {
  unwrap(await db().rpc('admin_add_visa_client_note', { p_visa_id: id, p_note: note }))
}

export async function inquiryHistory(id: string) {
  const { data, error } = await db()
    .from('audit_logs')
    .select('id, action, metadata, created_at')
    .eq('entity_type', 'hajj_inquiry')
    .eq('entity_id', id)
    .in('action', ['hajj_inquiry.created', 'hajj_inquiry.status_change'])
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).flatMap((item) => {
    const row = asRecord(item)
    const action = asText(row.action)
    const meta = asRecord(row.metadata)
    const created_at = asText(row.created_at)
    const eventId = asText(row.id)
    if (action === 'hajj_inquiry.created') {
      return [{
        id: eventId,
        old_status: null,
        new_status: 'new',
        note: null,
        created_at,
      } satisfies StatusEvent]
    }
    const next = asText(meta.to)
    if (!next) return []
    return [{
      id: eventId,
      old_status: asNullableText(meta.from),
      new_status: next,
      note: null,
      created_at,
    } satisfies StatusEvent]
  })
}

export async function visaHistory(id: string) {
  const { data, error } = await db()
    .from('audit_logs')
    .select('id, action, metadata, created_at')
    .eq('entity_type', 'visa_application')
    .eq('entity_id', id)
    .in('action', ['visa.created', 'visa.status_change', 'visa.client_note'])
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).flatMap((item) => {
    const row = asRecord(item)
    const action = asText(row.action)
    const meta = asRecord(row.metadata)
    const created_at = asText(row.created_at)
    const eventId = asText(row.id)
    if (action === 'visa.client_note') {
      const status = asText(meta.status)
      const note = asNullableText(meta.note)
      if (!status || !note) return []
      return [{ id: eventId, old_status: status, new_status: status, note, created_at } satisfies StatusEvent]
    }
    if (action === 'visa.created') {
      return [{
        id: eventId,
        old_status: null,
        new_status: asText(meta.status) || 'submitted',
        note: null,
        created_at,
      } satisfies StatusEvent]
    }
    const next = asText(meta.to)
    if (!next) return []
    return [{
      id: eventId,
      old_status: asNullableText(meta.from),
      new_status: next,
      note: asNullableText(meta.note),
      created_at,
    } satisfies StatusEvent]
  })
}

export async function listDocuments(customerId: string) {
  const { data, error } = await db()
    .from('customer_documents')
    .select('id, customer_id, visa_application_id, storage_path, file_name, mime_type, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapDocument)
}

export async function openDocument(path: string) {
  const { data, error } = await db().storage.from('customer-documents').createSignedUrl(path, 120)
  if (error) throw new Error(error.message)
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}

export async function listPayments(page: number) {
  const { from, to } = pageRange(page, pageSize)
  const { data, error, count } = await db()
    .from('payments')
    .select(
      'id, customer_id, booking_id, amount, method, status, paid_on, note, created_at, profiles!payments_customer_id_fkey(full_name), bookings!payments_booking_id_fkey(reference)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) throw new Error(error.message)
  return { rows: (data ?? []).map(mapPayment), total: count ?? 0 }
}

export async function listOutstanding() {
  const { data, error } = await db()
    .from('booking_balances')
    .select('id, reference, customer_id, customer_name, status, total_amount, paid_amount, balance_amount')
    .neq('status', 'cancelled')
    .gt('balance_amount', 0)
    .order('balance_amount', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapBalance)
}

export async function customerBookingsForPayment(customerId: string) {
  const { data, error } = await db()
    .from('booking_balances')
    .select('id, reference, customer_id, customer_name, status, total_amount, paid_amount, balance_amount')
    .eq('customer_id', customerId)
    .neq('status', 'cancelled')
    .order('reference', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapBalance)
}

export async function recordPayment(input: {
  customerId: string
  bookingId: string | null
  amount: number
  method: PaymentMethod
  paidOn: string
  note: string
}) {
  unwrap(
    await db().from('payments').insert({
      customer_id: input.customerId,
      booking_id: input.bookingId,
      amount: input.amount,
      method: input.method,
      paid_on: input.paidOn,
      note: input.note,
      status: 'recorded',
      currency: 'SAR',
    }),
  )
}

export async function voidPayment(id: string) {
  unwrap(await db().from('payments').update({ status: 'void' }).eq('id', id).eq('status', 'recorded'))
}

export async function paymentSummary(): Promise<PaymentSummary> {
  const data = unwrap(await db().rpc('admin_payment_summary'))
  const raw = asRecord(data)
  const months = Array.isArray(raw.months) ? raw.months : []
  return {
    recorded_total: asNumber(raw.recorded_total),
    payments_count: asNumber(raw.payments_count),
    outstanding_total: asNumber(raw.outstanding_total),
    months: months.map((item) => {
      const row = asRecord(item)
      return {
        month: asText(row.month),
        total: asNumber(row.total),
        payment_count: asNumber(row.payment_count),
      }
    }),
  }
}

export async function listContent() {
  const { data, error } = await db()
    .from('website_content')
    .select('id, kind, title, body, image_path, link_url, sort_order, is_published, created_at')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapContent)
}

export async function saveContent(input: ContentInput, id?: string) {
  if (id) {
    unwrap(await db().from('website_content').update(input).eq('id', id))
    return id
  }
  const data = unwrap(await db().from('website_content').insert(input).select('id').single())
  return asText(asRecord(data).id)
}

export async function deleteContent(id: string) {
  unwrap(await db().from('website_content').delete().eq('id', id))
}

export async function loadSiteSection(section: SiteSectionId) {
  const { data, error } = await db().from('site_settings').select('content').eq('section', section).maybeSingle()
  if (error) throw new Error(error.message)
  return readCopy(section, asRecord(data).content)
}

export async function saveSiteSection(section: SiteSectionId, copy: SectionCopy) {
  const problem = validateCopy(section, copy)
  if (problem) throw new Error(problem)
  const content = normalizeCopy(section, copy)
  unwrap(await db().from('site_settings').upsert({ section, content }, { onConflict: 'section' }))
}

export async function listAuditLogs() {
  const { data, error } = await db()
    .from('audit_logs')
    .select('id, action, entity_type, entity_id, created_at')
    .order('created_at', { ascending: false })
    .limit(40)
  if (error) throw new Error(error.message)
  return (data ?? []).map((item) => {
    const row = asRecord(item)
    return {
      id: asText(row.id),
      action: asText(row.action),
      entity_type: asText(row.entity_type),
      entity_id: asNullableText(row.entity_id),
      created_at: asText(row.created_at),
    } satisfies AuditRow
  })
}

export async function listNotifications() {
  const limit = 100
  const [customers, bookings, visas, inquiries, payments] = await Promise.all([
    db().from('customers').select('id, full_name, mobile, created_at').order('created_at', { ascending: false }).limit(limit),
    db().from('booking_rows').select('id, reference, customer_name, created_at').order('created_at', { ascending: false }).limit(limit),
    db().from('visa_rows').select('id, reference, full_name, customer_name, created_at').order('created_at', { ascending: false }).limit(limit),
    db().from('hajj_inquiry_rows').select('id, customer_name, program_title, created_at').order('created_at', { ascending: false }).limit(limit),
    db().from('payments').select('id, amount, status, created_at, profiles!payments_customer_id_fkey(full_name)').order('created_at', { ascending: false }).limit(limit),
  ])
  for (const result of [customers, bookings, visas, inquiries, payments]) {
    if (result.error) throw new Error(result.error.message)
  }
  const rows: AuditRow[] = []
  for (const item of customers.data ?? []) {
    const row = asRecord(item)
    const id = asText(row.id)
    rows.push({
      id: `client:${id}`,
      action: 'client.created',
      entity_type: 'profile',
      entity_id: id,
      created_at: asText(row.created_at),
      detail: asText(row.full_name) || asText(row.mobile),
    })
  }
  for (const item of bookings.data ?? []) {
    const row = asRecord(item)
    const id = asText(row.id)
    rows.push({
      id: `booking:${id}`,
      action: 'booking.created',
      entity_type: 'booking',
      entity_id: id,
      created_at: asText(row.created_at),
      detail: [asText(row.reference), asText(row.customer_name)].filter(Boolean).join(' · '),
    })
  }
  for (const item of visas.data ?? []) {
    const row = asRecord(item)
    const id = asText(row.id)
    rows.push({
      id: `visa:${id}`,
      action: 'visa.created',
      entity_type: 'visa_application',
      entity_id: id,
      created_at: asText(row.created_at),
      detail: [asText(row.reference), asText(row.full_name) || asText(row.customer_name)].filter(Boolean).join(' · '),
    })
  }
  for (const item of inquiries.data ?? []) {
    const row = asRecord(item)
    const id = asText(row.id)
    rows.push({
      id: `inquiry:${id}`,
      action: 'inquiry.created',
      entity_type: 'hajj_inquiry',
      entity_id: id,
      created_at: asText(row.created_at),
      detail: [asText(row.customer_name), asText(row.program_title)].filter(Boolean).join(' · '),
    })
  }
  for (const item of payments.data ?? []) {
    const row = asRecord(item)
    const id = asText(row.id)
    const status = asText(row.status)
    rows.push({
      id: `payment:${id}`,
      action: status === 'void' ? 'payment.voided' : 'payment.recorded',
      entity_type: 'payment',
      entity_id: id,
      created_at: asText(row.created_at),
      detail: [embeddedText(row.profiles, 'full_name'), englishAmount(asNumber(row.amount))].filter(Boolean).join(' · '),
    })
  }
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

async function createdSince(table: string, since: string, column?: string, value?: string) {
  let query = db().from(table).select('created_at').gte('created_at', since)
  if (column && value) query = query.eq(column, value)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => asText(asRecord(row).created_at)).filter(Boolean)
}

export async function dashboardData(): Promise<DashboardData> {
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
  const [customers, bookings, pending, underReview, confirmed, completed, cancelled, visas, payments, recentBookingData, recentCustomerData, bookingCreatedAt, customerCreatedAt, visaCreatedAt, paymentCreatedAt] =
    await Promise.all([
      exactCount('customers'),
      exactCount('bookings'),
      exactCount('bookings', 'status', 'pending'),
      exactCount('bookings', 'status', 'under_review'),
      exactCount('bookings', 'status', 'confirmed'),
      exactCount('bookings', 'status', 'completed'),
      exactCount('bookings', 'status', 'cancelled'),
      exactCount('visa_applications'),
      exactCount('payments', 'status', 'recorded'),
      db()
        .from('booking_rows')
        .select(
          'id, reference, customer_id, package_id, package_title_snapshot, travel_date, travelers_count, total_amount, status, customer_note, created_at, customer_name, customer_mobile, customer_email',
        )
        .order('created_at', { ascending: false })
        .limit(5),
      db()
        .from('customers')
        .select('id, full_name, mobile, email, account_status, created_at, bookings_count')
        .order('created_at', { ascending: false })
        .limit(5),
      createdSince('bookings', since),
      createdSince('customers', since),
      createdSince('visa_applications', since),
      createdSince('payments', since, 'status', 'recorded'),
    ])
  if (recentBookingData.error) throw new Error(recentBookingData.error.message)
  if (recentCustomerData.error) throw new Error(recentCustomerData.error.message)
  return {
    customers,
    bookings,
    pending,
    underReview,
    confirmed,
    completed,
    cancelled,
    visas,
    payments,
    recentBookings: (recentBookingData.data ?? []).map(mapBooking),
    recentCustomers: (recentCustomerData.data ?? []).map(mapCustomer),
    bookingCreatedAt,
    customerCreatedAt,
    visaCreatedAt,
    paymentCreatedAt,
  }
}

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function uploadPublicImage(folder: 'umrah' | 'hajj' | 'website', file: File) {
  if (!imageTypes.has(file.type)) throw new Error('الصورة يجب أن تكون بصيغة JPG أو PNG أو WebP.')
  if (file.size > 5 * 1024 * 1024) throw new Error('حجم الصورة يجب ألا يتجاوز 5 ميغابايت.')
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${folder}/${crypto.randomUUID()}.${extension}`
  const { error } = await db().storage.from('public-media').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return path
}
