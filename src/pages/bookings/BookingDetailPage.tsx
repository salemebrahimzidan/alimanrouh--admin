import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import {
  addNote,
  bookingHistory,
  getBooking,
  listNotes,
  setBookingStatus,
  type BookingRow,
  type InternalNote,
  type StatusEvent,
} from '../../lib/api'
import { displayName, errorText, formatDate, formatDateTime, formatMoney } from '../../lib/format'
import { bookingStatuses, bookingTone, label, type BookingStatus } from '../../lib/labels'
import { BackLink, Badge, Button, Card, EmptyState, ErrorBanner, LoadingState, Notice, TextAreaField } from '../../components/ui'

export function BookingDetailPage() {
  const { id = '' } = useParams()
  const { session } = useAuth()
  const [booking, setBooking] = useState<BookingRow | null>(null)
  const [history, setHistory] = useState<StatusEvent[]>([])
  const [notes, setNotes] = useState<InternalNote[]>([])
  const [status, setStatus] = useState<BookingStatus>('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([getBooking(id), bookingHistory(id), listNotes('booking', id)])
      .then(([row, events, noteRows]) => {
        if (!active) return
        setBooking(row)
        setHistory(events)
        setNotes(noteRows)
        if (row) setStatus(row.status as BookingStatus)
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
    setError(null)
    setMessage(null)
    try {
      await setBookingStatus(id, status, note)
      setMessage('تم تحديث حالة الحجز.')
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
    setError(null)
    try {
      await addNote('booking', id, body, session.user.id)
      event.currentTarget.reset()
      setVersion((current) => current + 1)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  if (loading) return <LoadingState />
  if (error && !booking) return <ErrorBanner message={error} />
  if (!booking) {
    return (
      <div>
        <BackLink to="/bookings">العودة إلى الحجوزات</BackLink>
        <EmptyState title="الحجز غير موجود" />
      </div>
    )
  }

  return (
    <div>
      <BackLink to="/bookings">العودة إلى الحجوزات</BackLink>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-navy">{booking.reference}</h2>
          <p className="mt-1 text-sm text-muted">{booking.package_title_snapshot || 'بدون برنامج'}</p>
        </div>
        <Badge tone={bookingTone(booking.status)}>{label.booking(booking.status)}</Badge>
      </div>
      <Card>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="العميل" value={<Link className="text-navy" to={`/customers/${booking.customer_id}`}>{displayName(booking.customer_name)}</Link>} />
          <Info label="الجوال" value={booking.customer_mobile || '—'} />
          <Info label="البريد" value={booking.customer_email || '—'} />
          <Info label="تاريخ الحجز" value={formatDateTime(booking.created_at)} />
          <Info label="تاريخ السفر" value={formatDate(booking.travel_date)} />
          <Info label="عدد المسافرين" value={booking.travelers_count.toLocaleString('ar-SA')} />
          <Info label="المبلغ الإجمالي" value={formatMoney(booking.total_amount)} />
          <Info label="ملاحظة العميل" value={booking.customer_note || '—'} />
        </dl>
      </Card>
      {error ? <div className="mt-4"><ErrorBanner message={error} /></div> : null}
      {message ? <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="font-semibold text-navy">تحديث الحالة</h3>
          <p className="mt-1 text-xs leading-6 text-muted">الملاحظة هنا تظهر للعميل ضمن سجل الحالة.</p>
          <form onSubmit={saveStatus} className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-ink">
              الحالة
              <select className="mt-1.5 h-11 w-full rounded-lg border border-line px-3" value={status} onChange={(event) => setStatus(event.target.value as BookingStatus)}>
                {bookingStatuses.map((item) => (
                  <option key={item} value={item}>{label.booking(item)}</option>
                ))}
              </select>
            </label>
            <TextAreaField label="ملاحظة للعميل" name="note" rows={3} maxLength={1000} />
            <Button type="submit" disabled={pending}>{pending ? 'جارٍ الحفظ...' : 'حفظ الحالة'}</Button>
          </form>
        </Card>
        <Card>
          <h3 className="font-semibold text-navy">ملاحظات داخلية</h3>
          <p className="mt-1 text-xs leading-6 text-muted">لا يراها العميل.</p>
          <form onSubmit={saveNote} className="mt-4 space-y-4">
            <TextAreaField label="ملاحظة" name="body" rows={3} maxLength={2000} required />
            <Button type="submit" variant="secondary" disabled={pending}>إضافة</Button>
          </form>
          <ul className="mt-4 space-y-3">
            {notes.length === 0 ? <li className="text-sm text-muted">لا توجد ملاحظات داخلية.</li> : null}
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
        <h3 className="font-semibold text-navy">سجل الحالة</h3>
        {history.length === 0 ? <p className="mt-3 text-sm text-muted">لا يوجد سجل.</p> : (
          <ol className="mt-4 space-y-4">
            {history.map((event) => (
              <li key={event.id} className="border-r-2 border-gold pr-4">
                <p className="text-sm font-medium text-navy">
                  {event.old_status ? `من ${label.booking(event.old_status)} إلى ${label.booking(event.new_status)}` : label.booking(event.new_status)}
                </p>
                {event.note ? <p className="mt-1 text-sm text-ink">{event.note}</p> : null}
                <p className="mt-1 text-xs text-muted">{formatDateTime(event.created_at)}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
      <div className="mt-4"><Notice>تغيير الحالة إجراء داخلي لدى الوكالة.</Notice></div>
    </div>
  )
}

function Info({ label: title, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{title}</dt>
      <dd className="mt-1 text-sm text-ink">{value}</dd>
    </div>
  )
}
