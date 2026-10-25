import { useEffect, useState, type FormEvent } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { listCustomerBookings, listCustomerVisas, listDocuments, openDocument, type SupportConversationRow, type SupportMessageRow } from '../lib/api'
import { accountTone, label } from '../lib/labels'
import { errorText, formatDateTime, isMobile } from '../lib/format'
import {
  createCustomerSupportConversation,
  listCustomerSupportConversations,
  listCustomerSupportMessages,
  sendCustomerSupportReply,
  removeOwnDocument,
  updateOwnProfile,
  uploadCustomerDocument,
  type OwnProfile,
} from '../lib/portal'
import { db } from '../lib/supabase'
import { Badge, Button, Card, ErrorBanner, TextAreaField, TextField } from '../components/ui'

export function AccountHomePage() {
  const profile = useOutletContext<OwnProfile>()
  const [bookings, setBookings] = useState(0)
  const [visas, setVisas] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([listCustomerBookings(profile.id), listCustomerVisas(profile.id)])
      .then(([bookingRows, visaRows]) => {
        if (!active) return
        setBookings(bookingRows.length)
        setVisas(visaRows.length)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [profile.id])

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-navy">{profile.full_name || 'حسابي'}</h1>
            <p className="mt-2 text-sm text-muted">{profile.email} · {profile.mobile || 'بدون جوال'}</p>
          </div>
          <Badge tone={accountTone(profile.account_status)}>{label.account(profile.account_status)}</Badge>
        </div>
        {profile.account_status === 'pending_verification' ? (
          <p className="mt-4 text-sm leading-6 text-muted">بانتظار تأكيد البريد الإلكتروني. بعد التأكيد يمكنك إرسال الحجوزات والطلبات.</p>
        ) : null}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link to="/portal/bookings" className="rounded-xl border border-line px-4 py-3 text-sm">حجوزاتي: {bookings.toLocaleString('ar-SA')}</Link>
          <Link to="/portal/visas" className="rounded-xl border border-line px-4 py-3 text-sm">طلبات التأشيرة: {visas.toLocaleString('ar-SA')}</Link>
        </div>
      </Card>
      <InquiryForm profile={profile} />
    </div>
  )
}

function InquiryForm({ profile }: { profile: OwnProfile }) {
  const [conversations, setConversations] = useState<SupportConversationRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<SupportMessageRow[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const disabled = profile.account_status !== 'active'
  const selected = conversations.find((item) => item.id === selectedId) ?? null

  useEffect(() => {
    let active = true
    const refresh = () => listCustomerSupportConversations()
      .then((rows) => {
        if (active) setConversations(rows)
      })
      .catch((err: unknown) => {
        if (active) setError(errorText(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    void refresh()
    const channel = db().channel(`portal-support-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations', filter: `customer_id=eq.${profile.id}` }, () => void refresh())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, () => void refresh())
      .subscribe()
    return () => {
      active = false
      void db().removeChannel(channel)
    }
  }, [profile.id])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }
    let active = true
    db().rpc('support_mark_read', { p_conversation_id: selectedId }).then(({ error: readError }) => {
      if (readError && active) setError(readError.message)
    })
    listCustomerSupportMessages(selectedId)
      .then((rows) => {
        if (active) setMessages(rows)
      })
      .catch((err: unknown) => {
        if (active) setError(errorText(err))
      })
    return () => {
      active = false
    }
  }, [selectedId])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const text = String(data.get('message') ?? '').trim()
    const topic = String(data.get('topic') ?? 'general')
    const topics: Record<string, string> = {
      general: 'استفسار عام',
      hajj: 'استفسار عن الحج',
      umrah: 'استفسار عن العمرة',
      booking: 'استفسار عن حجز',
      complaint: 'شكوى',
    }
    if (text.length < 5) {
      setError('اكتب رسالة مختصرة عن الاستفسار.')
      return
    }
    setPending(true)
    setError(null)
    try {
      const id = await createCustomerSupportConversation({
        subject: topics[topic] ?? topics.general,
        body: text,
        topic,
        context: null,
      })
      form.reset()
      const rows = await listCustomerSupportConversations()
      setConversations(rows)
      setSelectedId(id)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !draft.trim() || pending) return
    setPending(true)
    setError(null)
    try {
      await sendCustomerSupportReply(selected.id, draft)
      setDraft('')
      setMessages(await listCustomerSupportMessages(selected.id))
      setConversations(await listCustomerSupportConversations())
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-semibold text-navy">الاستفسارات والمحادثات</h2>
        <p className="mt-1 text-xs leading-6 text-muted">أرسل سؤالاً أو شكوى، ثم تابع الردود في المحادثة نفسها.</p>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <label className="block text-sm font-medium">
            نوع الاستفسار
            <select name="topic" className="mt-1.5 h-11 w-full rounded-lg border border-line px-3" disabled={disabled}>
              <option value="general">استفسار عام عن الموقع</option>
              <option value="hajj">الحج</option>
              <option value="umrah">العمرة</option>
              <option value="booking">حجز قائم أو استفسار حجز</option>
              <option value="complaint">شكوى</option>
            </select>
          </label>
          <TextAreaField label="الرسالة" name="message" rows={4} disabled={disabled} />
          {error ? <ErrorBanner message={error} /> : null}
          <Button type="submit" disabled={pending || disabled}>{pending ? 'جارٍ الإرسال...' : 'بدء محادثة'}</Button>
        </form>
      </Card>
      <Card>
        <h3 className="font-semibold text-navy">محادثاتي</h3>
        {loading ? <p className="mt-3 text-sm text-muted">جارٍ تحميل المحادثات...</p> : conversations.length === 0 ? <p className="mt-3 text-sm text-muted">لا توجد محادثات بعد.</p> : (
          <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.3fr)]">
            <ul className="space-y-2">
              {conversations.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => setSelectedId(item.id)} className={`w-full rounded-lg border px-3 py-2 text-start ${selectedId === item.id ? 'border-gold bg-gold-soft/40' : 'border-line'}`}>
                    <span className="block font-medium">{item.subject}</span>
                    <span className="mt-1 block truncate text-xs text-muted">{item.last_message}</span>
                    {item.customer_unread_count > 0 ? <Badge tone="warning">{item.customer_unread_count} غير مقروء</Badge> : null}
                  </button>
                </li>
              ))}
            </ul>
            {selected ? (
              <div className="min-w-0 rounded-xl border border-line">
                <div className="max-h-80 space-y-3 overflow-y-auto p-3">
                  <p className="text-xs text-muted">{selected.status === 'resolved' ? 'تم الحل' : selected.status === 'in_progress' ? 'قيد المتابعة' : 'جديد'}</p>
                  {messages.map((item) => (
                    <article key={item.id} className={`max-w-[90%] rounded-xl px-3 py-2 ${item.sender === 'admin' ? 'ms-auto bg-navy text-white' : 'me-auto bg-canvas text-ink'}`}>
                      <p className="whitespace-pre-wrap text-sm">{item.body}</p>
                      <time className="mt-1 block text-[10px] opacity-70" dir="ltr">{formatDateTime(item.created_at)}</time>
                    </article>
                  ))}
                </div>
                <form onSubmit={reply} className="flex gap-2 border-t border-line p-3">
                  <textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={5000} rows={2} placeholder="اكتب ردك..." className="min-w-0 flex-1 rounded-lg border border-line p-2 text-sm" />
                  <Button type="submit" disabled={pending || !draft.trim()}>إرسال</Button>
                </form>
              </div>
            ) : <p className="text-sm text-muted">اختر محادثة لعرض الرسائل والرد عليها.</p>}
          </div>
        )}
      </Card>
    </div>
  )
}

export function ProfilePage() {
  const profile = useOutletContext<OwnProfile>()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const fullName = String(form.get('full_name') ?? '').trim()
    const mobile = String(form.get('mobile') ?? '').trim()
    if (fullName.length < 2 || !isMobile(mobile)) {
      setError('أدخل الاسم ورقم الجوال بشكل صحيح.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await updateOwnProfile(profile.id, { fullName, mobile })
      setNotice('تم تحديث الملف.')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold text-navy">الملف الشخصي</h1>
      <form onSubmit={submit} className="mt-5 max-w-lg space-y-4">
        <TextField label="الاسم الكامل" name="full_name" defaultValue={profile.full_name} required />
        <TextField label="رقم الجوال" name="mobile" defaultValue={profile.mobile} required />
        <TextField label="البريد الإلكتروني" value={profile.email ?? ''} disabled />
        {error ? <ErrorBanner message={error} /> : null}
        {notice ? <p className="text-sm text-emerald-800">{notice}</p> : null}
        <Button type="submit" disabled={pending}>{pending ? 'جارٍ الحفظ...' : 'حفظ'}</Button>
      </form>
    </Card>
  )
}

export function DocumentsPage() {
  const profile = useOutletContext<OwnProfile>()
  const { session } = useAuth()
  const [rows, setRows] = useState<Array<{ id: string; file_name: string; storage_path: string }>>([])
  const [visas, setVisas] = useState<Array<{ id: string; reference: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([listDocuments(profile.id), listCustomerVisas(profile.id)])
      .then(([documents, applications]) => {
        if (!active) return
        setRows(documents.map((item) => ({ id: item.id, file_name: item.file_name, storage_path: item.storage_path })))
        setVisas(applications.map((item) => ({ id: item.id, reference: item.reference })))
      })
      .catch((err: unknown) => {
        if (active) setError(errorText(err))
      })
    return () => {
      active = false
    }
  }, [profile.id, version])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session) return
    const form = event.currentTarget
    const file = (form.elements.namedItem('file') as HTMLInputElement).files?.[0]
    const visaId = String(new FormData(form).get('visa_id') ?? '')
    if (!file) return
    setPending(true)
    setError(null)
    try {
      await uploadCustomerDocument({ userId: session.user.id, file, visaApplicationId: visaId || null })
      form.reset()
      setVersion((current) => current + 1)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h1 className="text-xl font-semibold text-navy">مستنداتي</h1>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <label className="block text-sm font-medium">
            ربط بطلب تأشيرة
            <select name="visa_id" className="mt-1.5 h-11 w-full rounded-lg border border-line px-3">
              <option value="">بدون ربط</option>
              {visas.map((visa) => <option key={visa.id} value={visa.id}>{visa.reference}</option>)}
            </select>
          </label>
          <input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required className="block text-sm" />
          {error ? <ErrorBanner message={error} /> : null}
          <Button type="submit" disabled={pending || profile.account_status !== 'active'}>{pending ? 'جارٍ الرفع...' : 'رفع المستند'}</Button>
        </form>
      </Card>
      <Card>
        {rows.length === 0 ? <p className="text-sm text-muted">لا توجد مستندات.</p> : (
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span>{row.file_name}</span>
                <span className="flex gap-3">
                  <button type="button" className="text-navy" onClick={() => openDocument(row.storage_path)}>عرض</button>
                  <button
                    type="button"
                    className="text-rose-700"
                    onClick={() => removeOwnDocument(row.storage_path, row.id).then(() => setVersion((current) => current + 1)).catch((err) => setError(errorText(err)))}
                  >
                    حذف
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
