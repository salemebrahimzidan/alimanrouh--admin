import { asNumber } from './format'
import { db } from './supabase'
import type { SupportConversationRow, SupportMessageRow } from './api'

export type OwnProfile = {
  id: string
  full_name: string
  mobile: string
  email: string | null
  account_status: string
  created_at: string
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

export async function registerCustomer(input: { fullName: string; mobile: string; email: string; password: string }) {
  const { data, error } = await db().auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
        mobile: input.mobile.trim(),
      },
      emailRedirectTo: `${window.location.origin}/portal/login`,
    },
  })
  if (error) throw new Error(error.message)
  return data
}

export async function sendPasswordReset(email: string) {
  const { error } = await db().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw new Error(error.message)
}

export async function updatePassword(password: string) {
  const { error } = await db().auth.updateUser({ password })
  if (error) throw new Error(error.message)
}

export async function getOwnProfile(userId: string) {
  const { data, error } = await db()
    .from('profiles')
    .select('id, full_name, mobile, email, account_status, created_at')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = asRecord(data)
  return {
    id: String(row.id),
    full_name: String(row.full_name ?? ''),
    mobile: String(row.mobile ?? ''),
    email: row.email == null ? null : String(row.email),
    account_status: String(row.account_status ?? ''),
    created_at: String(row.created_at ?? ''),
  } satisfies OwnProfile
}

export async function updateOwnProfile(userId: string, input: { fullName: string; mobile: string }) {
  const fullName = input.fullName.trim()
  const mobile = input.mobile.trim()
  const { error } = await db().from('profiles').update({ full_name: fullName, mobile }).eq('id', userId)
  if (error) throw new Error(error.message)
  const { error: authError } = await db().auth.updateUser({ data: { full_name: fullName, mobile } })
  if (authError) throw new Error(authError.message)
}

export async function createBooking(input: {
  userId: string
  packageId: string
  travelDate: string
  travelers: number
  note: string
}) {
  const { error } = await db().from('bookings').insert({
    customer_id: input.userId,
    package_id: input.packageId,
    travel_date: input.travelDate,
    travelers_count: input.travelers,
    customer_note: input.note.trim(),
    status: 'pending',
    total_amount: 0,
    package_title_snapshot: '',
  })
  if (error) throw new Error(error.message)
}

export async function createVisa(input: {
  userId: string
  fullName: string
  mobile: string
  passportNumber: string
  nationality: string
  travelDate: string
  note: string
}) {
  const { error } = await db().from('visa_applications').insert({
    customer_id: input.userId,
    full_name: input.fullName.trim(),
    mobile: input.mobile.trim(),
    passport_number: input.passportNumber.trim(),
    nationality: input.nationality.trim(),
    requested_travel_date: input.travelDate || null,
    customer_note: input.note.trim(),
    status: 'submitted',
  })
  if (error) throw new Error(error.message)
}

export async function createCustomerSupportConversation(input: {
  subject: string
  body: string
  topic: string
  context: string | null
}) {
  const { data, error } = await db().rpc('support_create_registered_conversation', {
    p_subject: input.subject,
    p_body: input.body.trim(),
    p_topic: input.topic,
    p_context: input.context,
  })
  if (error) throw new Error(error.message)
  return String(data)
}

export async function listCustomerSupportConversations(): Promise<SupportConversationRow[]> {
  const { data, error } = await db()
    .from('support_conversations')
    .select('id, customer_id, guest_name, guest_email, guest_phone, subject, topic, context, status, last_message, last_message_at, last_message_sender, admin_unread_count, customer_unread_count, linked_hajj_inquiry_id, created_at, updated_at')
    .order('last_message_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    ...row,
    customer_name: null,
    customer_mobile: null,
    customer_email: null,
    status: row.status as SupportConversationRow['status'],
    last_message_sender: row.last_message_sender as SupportConversationRow['last_message_sender'],
  }))
}

export async function listCustomerSupportMessages(conversationId: string): Promise<SupportMessageRow[]> {
  const { data, error } = await db()
    .from('support_messages')
    .select('id, conversation_id, sender, author_user_id, body, read_at, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    ...row,
    sender: row.sender as SupportMessageRow['sender'],
  }))
}

export async function sendCustomerSupportReply(conversationId: string, body: string) {
  const { data, error: authError } = await db().auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!data.user) throw new Error('A customer session is required.')
  const { error } = await db().from('support_messages').insert({
    conversation_id: conversationId,
    sender: 'customer',
    author_user_id: data.user.id,
    body: body.trim(),
  })
  if (error) throw new Error(error.message)
}

export async function uploadCustomerDocument(input: { userId: string; file: File; visaApplicationId: string | null }) {
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  if (!allowed.has(input.file.type)) throw new Error('الملف يجب أن يكون PDF أو صورة JPG أو PNG أو WebP.')
  if (input.file.size > 10 * 1024 * 1024) throw new Error('حجم الملف يجب ألا يتجاوز 10 ميغابايت.')
  const extension =
    input.file.type === 'application/pdf'
      ? 'pdf'
      : input.file.type === 'image/png'
        ? 'png'
        : input.file.type === 'image/webp'
          ? 'webp'
          : 'jpg'
  const path = `${input.userId}/${crypto.randomUUID()}.${extension}`
  const uploaded = await db().storage.from('customer-documents').upload(path, input.file, {
    contentType: input.file.type,
    upsert: false,
  })
  if (uploaded.error) throw new Error(uploaded.error.message)
  const { error } = await db().from('customer_documents').insert({
    customer_id: input.userId,
    visa_application_id: input.visaApplicationId,
    storage_path: path,
    file_name: input.file.name.slice(0, 180),
    mime_type: input.file.type,
  })
  if (error) {
    await db().storage.from('customer-documents').remove([path])
    throw new Error(error.message)
  }
}

export async function removeOwnDocument(path: string, id: string) {
  const removed = await db().storage.from('customer-documents').remove([path])
  if (removed.error) throw new Error(removed.error.message)
  const { error } = await db().from('customer_documents').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export function packageTotal(price: number, travelers: number) {
  return asNumber(price) * travelers
}
