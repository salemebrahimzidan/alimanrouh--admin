import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { addNote, getVisa, listDocuments, listNotes, openDocument, setVisaStatus, type DocumentRow, type InternalNote, type VisaRow } from '../../lib/api'
import { visaDisclaimer } from '../../lib/config'
import { errorText, formatDate, formatDateTime } from '../../lib/format'
import { label, visaStatuses, visaTone, type VisaStatus } from '../../lib/labels'
import { BackLink, Badge, Button, Card, EmptyState, ErrorBanner, LoadingState, Notice, TextAreaField } from '../../components/ui'

export function VisaDetailPage() {
  const { id = '' } = useParams()
  const { session } = useAuth()
  const [visa, setVisa] = useState<VisaRow | null>(null)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [notes, setNotes] = useState<InternalNote[]>([])
  const [status, setStatus] = useState<VisaStatus>('submitted')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    getVisa(id)
      .then(async (row) => {
        if (!active) return
        setVisa(row)
        if (!row) return
        const [docs, noteRows] = await Promise.all([listDocuments(row.customer_id), listNotes('visa_application', id)])
        if (!active) return
        setDocuments(docs.filter((item) => item.visa_application_id === id || item.visa_application_id == null))
        setNotes(noteRows)
        setStatus(row.status as VisaStatus)
        setError(null)
      })
      .catch((err: unknown) => {
        if (active) setError(errorText(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, version])

  async function saveStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const note = String(new FormData(event.currentTarget).get('note') ?? '')
    setPending(true)
    setMessage(null)
    setError(null)
    try {
      await setVisaStatus(id, status, note)
      setMessage('تم تحديث الحالة الداخلية.')
      setVersion((current) => current + 1)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = String(new FormData(event.currentTarget).get('body') ?? '').trim()
    if (!body || !session) return
    setPending(true)
    try {
      await addNote('visa_application', id, body, session.user.id)
      event.currentTarget.reset()
      setVersion((current) => current + 1)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  if (loading) return <LoadingState />
  if (error && !visa) return <ErrorBanner message={error} />
  if (!visa) {
    return (
      <div>
        <BackLink to="/visas">العودة إلى الطلبات</BackLink>
        <EmptyState title="الطلب غير موجود" />
      </div>
    )
  }

  return (
    <div>
      <BackLink to="/visas">العودة إلى الطلبات</BackLink>
      <div className="mb-4"><Notice>{visaDisclaimer}</Notice></div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-navy">{visa.reference}</h2>
          <p className="mt-1 text-sm text-muted">{visa.full_name}</p>
        </div>
        <Badge tone={visaTone(visa.status)}>{label.visa(visa.status)}</Badge>
      </div>
      <Card>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field title="العميل" value={<Link className="text-navy" to={`/customers/${visa.customer_id}`}>{visa.customer_name}</Link>} />
          <Field title="الجوال" value={visa.mobile} />
          <Field title="البريد" value={visa.customer_email || '—'} />
          <Field title="رقم الجواز" value={visa.passport_number} />
          <Field title="الجنسية" value={visa.nationality} />
          <Field title="تاريخ السفر المطلوب" value={formatDate(visa.requested_travel_date)} />
          <Field title="تاريخ الطلب" value={formatDateTime(visa.created_at)} />
          <Field title="ملاحظة العميل" value={visa.customer_note || '—'} />
        </dl>
      </Card>
      {error ? <div className="mt-4"><ErrorBanner message={error} /></div> : null}
      {message ? <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="font-semibold text-navy">الحالة الداخلية</h3>
          <form onSubmit={saveStatus} className="mt-4 space-y-4">
            <label className="block text-sm font-medium">
              الحالة
              <select className="mt-1.5 h-11 w-full rounded-lg border border-line px-3" value={status} onChange={(event) => setStatus(event.target.value as VisaStatus)}>
                {visaStatuses.map((item) => <option key={item} value={item}>{label.visa(item)}</option>)}
              </select>
            </label>
            <TextAreaField label="ملاحظة داخلية للحالة" name="note" rows={3} maxLength={1000} />
            <Button type="submit" disabled={pending}>{pending ? 'جارٍ الحفظ...' : 'حفظ الحالة'}</Button>
          </form>
        </Card>
        <Card>
          <h3 className="font-semibold text-navy">ملاحظات داخلية</h3>
          <form onSubmit={saveNote} className="mt-4 space-y-4">
            <TextAreaField label="ملاحظة" name="body" rows={3} required maxLength={2000} />
            <Button type="submit" variant="secondary" disabled={pending}>إضافة</Button>
          </form>
          <ul className="mt-4 space-y-3">
            {notes.length === 0 ? <li className="text-sm text-muted">لا توجد ملاحظات.</li> : null}
            {notes.map((note) => (
              <li key={note.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <p className="whitespace-pre-wrap">{note.body}</p>
                <p className="mt-1 text-xs text-muted">{formatDateTime(note.created_at)}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card className="mt-6">
        <h3 className="font-semibold text-navy">المستندات</h3>
        {documents.length === 0 ? <p className="mt-3 text-sm text-muted">لم يرفع العميل مستندات بعد.</p> : (
          <ul className="mt-4 divide-y divide-line">
            {documents.map((document) => (
              <li key={document.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{document.file_name}</p>
                  <p className="text-xs text-muted">{document.visa_application_id === id ? 'مرتبط بهذا الطلب' : 'من ملف العميل'} · {formatDateTime(document.created_at)}</p>
                </div>
                <Button variant="secondary" onClick={() => openDocument(document.storage_path).catch((err) => setError(errorText(err)))}>عرض</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function Field({ title, value }: { title: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{title}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  )
}
