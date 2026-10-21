import { useEffect, useState, type FormEvent } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { listCustomerBookings, listCustomerVisas, listDocuments, listPublishedHajjPrograms, openDocument } from '../lib/api'
import { accountTone, label } from '../lib/labels'
import { errorText, isMobile } from '../lib/format'
import { createHajjInquiry, removeOwnDocument, updateOwnProfile, uploadCustomerDocument, type OwnProfile } from '../lib/portal'
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
  const [programs, setPrograms] = useState<Array<{ id: string; title: string }>>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const disabled = profile.account_status !== 'active'

  useEffect(() => {
    listPublishedHajjPrograms().then((rows) => setPrograms(rows.map((item) => ({ id: item.id, title: item.title })))).catch(() => undefined)
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const text = String(data.get('message') ?? '').trim()
    if (text.length < 5) {
      setError('اكتب رسالة مختصرة عن الاستفسار.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await createHajjInquiry({
        userId: profile.id,
        programId: String(data.get('program_id') ?? '') || null,
        travelers: Number(data.get('travelers') ?? 1),
        message: text,
      })
      form.reset()
      setMessage('تم إرسال الاستفسار، وستتم متابعته داخلياً لدى الوكالة.')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <h2 className="font-semibold text-navy">استفسار عن الحج</h2>
      <p className="mt-1 text-xs leading-6 text-muted">الاستفسار طلب تواصل داخلي، وليس حجزاً أو موافقة رسمية.</p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <label className="block text-sm font-medium">
          البرنامج
          <select name="program_id" className="mt-1.5 h-11 w-full rounded-lg border border-line px-3" disabled={disabled}>
            <option value="">استفسار عام</option>
            {programs.map((program) => <option key={program.id} value={program.id}>{program.title}</option>)}
          </select>
        </label>
        <TextField label="عدد المسافرين" name="travelers" type="number" min="1" max="100" defaultValue={1} disabled={disabled} />
        <TextAreaField label="الرسالة" name="message" rows={4} disabled={disabled} />
        {error ? <ErrorBanner message={error} /> : null}
        {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
        <Button type="submit" disabled={pending || disabled}>{pending ? 'جارٍ الإرسال...' : 'إرسال الاستفسار'}</Button>
      </form>
    </Card>
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
