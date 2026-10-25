import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, BadgeCheck, Ban, CalendarCheck, CalendarDays, Check, CheckCircle2, ClipboardList, Clock3, Copy, Mail, Pencil, Phone, Search, Trash2, Users, Wallet, type LucideIcon } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import {
  addBookingClientNote,
  addNote,
  bookingHistory,
  deleteNote,
  getBooking,
  listNotes,
  setBookingStatus,
  updateNote,
  type BookingRow,
  type InternalNote,
  type StatusEvent,
} from '../../lib/api'
import { displayName, englishAmount, errorText, formatDate, formatDateTime } from '../../lib/format'
import { bookingTone, label, nextBookingStatuses, type BookingStatus } from '../../lib/labels'
import { BackLink, Badge, Button, Card, EmptyState, ErrorBanner, LoadingState, cx } from '../../components/ui'

export function BookingDetailPage() {
  const { id = '' } = useParams()
  const { session } = useAuth()
  const [booking, setBooking] = useState<BookingRow | null>(null)
  const [history, setHistory] = useState<StatusEvent[]>([])
  const [notes, setNotes] = useState<InternalNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState<'advance' | 'cancel' | 'note' | 'client-note' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  const [copied, setCopied] = useState(false)
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

  useEffect(() => {
    if (pending !== null || (!confirmId && !adding && !editingId)) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setConfirmId(null)
      setAdding(false)
      setNoteBody('')
      setEditingId(null)
      setDraft('')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmId, adding, editingId, pending])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function saveStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const action = data.get('action') === 'cancel' ? 'cancel' : 'advance'
    const note = String(data.get('note') ?? '')
    const next = action === 'cancel' ? 'cancelled' : forwardBookingStatus(booking?.status ?? '')
    if (!booking || !next || !nextBookingStatuses(booking.status).includes(next)) {
      setError('لا يمكن تجاوز حالة. انتقل إلى الخطوة التالية فقط.')
      return
    }
    setPending(action)
    setError(null)
    setMessage(null)
    try {
      await setBookingStatus(id, next, note)
      form.reset()
      setMessage(action === 'cancel' ? 'تم إلغاء الحجز.' : 'تم تحديث حالة الحجز.')
      setVersion((current) => current + 1)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(null)
    }
  }

  async function saveClientNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const note = String(new FormData(form).get('note') ?? '').trim()
    if (!note || !booking || booking.status === 'completed' || booking.status === 'cancelled') return
    setPending('client-note')
    setError(null)
    setMessage(null)
    try {
      await addBookingClientNote(id, note)
      form.reset()
      setMessage('تم إرسال الملاحظة للعميل.')
      setVersion((current) => current + 1)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(null)
    }
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = noteBody.trim()
    if (!body || !session) return
    setPending('note')
    setError(null)
    try {
      await addNote('booking', id, body, session.user.id)
      setNoteBody('')
      setAdding(false)
      setVersion((current) => current + 1)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(null)
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = draft.trim()
    if (!editingId || !body) return
    setPending('note')
    setError(null)
    try {
      await updateNote(editingId, body)
      setEditingId(null)
      setDraft('')
      setVersion((current) => current + 1)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(null)
    }
  }

  async function removeNote(noteId: string) {
    setPending('note')
    setError(null)
    try {
      await deleteNote(noteId)
      setConfirmId(null)
      if (editingId === noteId) {
        setEditingId(null)
        setDraft('')
      }
      setVersion((current) => current + 1)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(null)
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-semibold text-navy">{booking.package_title_snapshot || 'بدون برنامج'}</h2>
          <div className="mt-2 inline-flex items-center gap-2">
            <span className="text-lg font-semibold text-navy">رقم الحجز</span>
            <span className="text-sm font-medium tracking-wide text-muted" dir="ltr">{booking.reference}</span>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition hover:bg-slate-100 hover:text-navy"
              aria-label={copied ? 'تم النسخ' : 'نسخ المرجع'}
              onClick={() => {
                void navigator.clipboard.writeText(booking.reference).then(() => setCopied(true)).catch(() => setCopied(false))
              }}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/bookings?customer=${booking.customer_id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-medium text-navy shadow-sm transition hover:border-gold hover:text-gold"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            العودة إلى الحجوزات
          </Link>
        </div>
      </div>
      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <div className="flex items-center gap-3 bg-navy px-4 py-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-semibold text-navy">
            {displayName(booking.customer_name).trim().charAt(0) || '؟'}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] text-white/70">العميل</p>
            <Link className="font-semibold text-white hover:text-gold" to={`/customers/${booking.customer_id}`}>{displayName(booking.customer_name)}</Link>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/80">
              <span className="inline-flex items-center gap-1.5" dir="ltr">
                <Phone className="h-3.5 w-3.5 text-gold" />
                {booking.customer_mobile || '—'}
              </span>
              <span className="inline-flex items-center gap-1.5" dir="ltr">
                <Mail className="h-3.5 w-3.5 text-gold" />
                {booking.customer_email || '—'}
              </span>
            </p>
          </div>
        </div>
        <dl className="grid gap-3 bg-canvas p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Detail icon={CalendarCheck} tone="sky" label="تاريخ الحجز">{formatDateTime(booking.created_at)}</Detail>
          <Detail icon={CalendarDays} tone="amber" label="تاريخ السفر">{formatDate(booking.travel_date)}</Detail>
          <Detail icon={Users} tone="violet" label="عدد المسافرين">{booking.travelers_count.toLocaleString('ar-SA')}</Detail>
          <Detail icon={Wallet} tone="emerald" label="المبلغ الإجمالي"><span className="tabular-nums" dir="ltr">{englishAmount(booking.total_amount)} SAR</span></Detail>
        </dl>
        <div className="border-t border-gold/30 bg-gold-soft px-4 py-3">
          <p className="text-[11px] font-medium text-[#6d5420]">ملاحظة العميل</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{booking.customer_note || '—'}</p>
        </div>
      </section>
      {error ? <div className="mt-4"><ErrorBanner message={error} /></div> : null}
      {message ? <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
      <Card className="mt-6 overflow-hidden">
        <StatusActions
          status={booking.status}
          history={history}
          pending={pending === 'advance' || pending === 'cancel' ? pending : null}
          savingNote={pending === 'client-note'}
          locked={pending !== null}
          onSubmit={saveStatus}
          onNote={saveClientNote}
        />
      </Card>
      <section className="mt-6 rounded-2xl border border-line bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-navy">ملاحظات داخلية</h3>
          <Button type="button" variant="secondary" disabled={pending !== null} onClick={() => { setAdding(true); setNoteBody(''); setConfirmId(null); setEditingId(null); setDraft('') }}>إضافة</Button>
        </div>
        {notes.length === 0 ? (
          <p className="mt-2 text-xs text-muted">لا توجد ملاحظات داخلية.</p>
        ) : (
          <ul className="mt-2.5 divide-y divide-line border-t border-line">
            {notes.map((note) => (
              <li key={note.id} className="py-2">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap text-sm leading-5">{note.body}</p>
                    <p className="mt-0.5 text-[11px] text-muted">{formatDateTime(note.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-slate-100 hover:text-navy disabled:opacity-60" aria-label="تعديل" disabled={pending !== null} onClick={() => { setEditingId(note.id); setDraft(note.body); setAdding(false); setNoteBody(''); setConfirmId(null) }}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60" aria-label="حذف" disabled={pending !== null} onClick={() => { setConfirmId(note.id); setEditingId(null); setDraft(''); setAdding(false); setNoteBody('') }}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {adding ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4"
          onClick={() => {
            if (pending !== null) return
            setAdding(false)
            setNoteBody('')
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-note-title"
            className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 id="add-note-title" className="text-base font-semibold text-navy">إضافة ملاحظة</h4>
            <form onSubmit={saveNote} className="mt-3">
              <textarea
                value={noteBody}
                onChange={(event) => setNoteBody(event.target.value)}
                required
                maxLength={2000}
                rows={4}
                autoFocus
                placeholder="ملاحظة جديدة"
                disabled={pending !== null}
                className="w-full resize-y rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-gold focus:ring-2 focus:ring-gold/25 disabled:bg-slate-50"
              />
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending !== null}
                  onClick={() => { setAdding(false); setNoteBody('') }}
                >
                  إلغاء
                </Button>
                <Button type="submit" variant="secondary" disabled={pending !== null || noteBody.trim() === ''}>
                  {pending === 'note' ? 'جارٍ الحفظ...' : 'إضافة'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {editingId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4"
          onClick={() => {
            if (pending !== null) return
            setEditingId(null)
            setDraft('')
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-note-title"
            className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 id="edit-note-title" className="text-base font-semibold text-navy">تعديل الملاحظة</h4>
            <form onSubmit={saveEdit} className="mt-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                required
                maxLength={2000}
                rows={4}
                autoFocus
                disabled={pending !== null}
                className="w-full resize-y rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-gold focus:ring-2 focus:ring-gold/25 disabled:bg-slate-50"
              />
              <div className="mt-5 flex justify-end gap-2">
                <Button type="button" variant="ghost" disabled={pending !== null} onClick={() => { setEditingId(null); setDraft('') }}>إلغاء</Button>
                <Button type="submit" variant="secondary" disabled={pending !== null || draft.trim() === ''}>
                  {pending === 'note' ? 'جارٍ الحفظ...' : 'حفظ'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {confirmId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4"
          onClick={() => { if (pending === null) setConfirmId(null) }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-note-title"
            className="w-full max-w-sm rounded-2xl border border-line bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 id="delete-note-title" className="text-base font-semibold text-navy">حذف الملاحظة</h4>
            <p className="mt-2 text-sm leading-6 text-muted">هل تريد حذف هذه الملاحظة الداخلية؟</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" disabled={pending !== null} onClick={() => setConfirmId(null)}>إلغاء</Button>
              <Button type="button" variant="danger" disabled={pending !== null} onClick={() => removeNote(confirmId)}>
                {pending === 'note' ? 'جارٍ الحذف...' : 'حذف'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const bookingStatusNotes: Record<BookingStatus, string> = {
  pending: 'تم استلام الطلب وجاري مراجعته.',
  under_review: 'جاري مراجعة البيانات والتأكد من المتطلبات.',
  confirmed: 'تم تأكيد الطلب ومطابقة البيانات.',
  completed: 'تم إنجاز الطلب بنجاح.',
  cancelled: 'تم إلغاء الحجز.',
}

function forwardBookingStatus(current: string): BookingStatus | null {
  return nextBookingStatuses(current).find((item) => item !== 'cancelled') ?? null
}

function StatusActions({
  status,
  history,
  pending,
  savingNote,
  locked,
  onSubmit,
  onNote,
}: {
  status: string
  history: StatusEvent[]
  pending: 'advance' | 'cancel' | null
  savingNote: boolean
  locked: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onNote: (event: FormEvent<HTMLFormElement>) => void
}) {
  const forward = forwardBookingStatus(status)
  const canCancel = nextBookingStatuses(status).includes('cancelled')
  const closed = status === 'completed' || status === 'cancelled'
  const summary = bookingStatusNotes[status as BookingStatus]
  const steps = history.filter((event) => event.old_status !== event.new_status)
  const clientNotes = history.filter((event) => event.note?.trim())
  const hasHistory = steps.length > 0

  return (
    <div className={cx(hasHistory && '-m-5 lg:grid lg:grid-cols-[minmax(0,1fr)_380px]')}>
      <div className={cx(hasHistory && 'p-5')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-navy">تحديث الحالة</h3>
            {summary ? <p className="mt-1 text-sm leading-6 text-muted">{summary}</p> : null}
          </div>
          <BookingStatusBadge status={status} />
        </div>
        <form onSubmit={onNote} className="mt-4 flex gap-2">
          <input
            name="note"
            required
            maxLength={1000}
            placeholder="ملاحظة للعميل"
            disabled={locked || closed}
            className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-gold focus:ring-2 focus:ring-gold/25 disabled:bg-slate-50"
          />
          <Button type="submit" disabled={locked || closed}>{savingNote ? 'جارٍ الإرسال...' : 'إرسال'}</Button>
        </form>
        {clientNotes.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {clientNotes.map((event) => (
              <li key={event.id} className="rounded-lg bg-gold-soft px-3 py-2">
                <p className="whitespace-pre-wrap text-sm leading-5 text-ink">{event.note}</p>
                <p className="mt-0.5 text-[11px] text-muted">{formatDateTime(event.created_at)}</p>
              </li>
            ))}
          </ul>
        ) : null}
        {forward || canCancel ? (
          <form onSubmit={onSubmit} className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            {forward ? (
              <Button type="submit" name="action" value="advance" disabled={locked}>
                {pending === 'advance' ? 'جارٍ الحفظ...' : 'تغيير الحالة'}
              </Button>
            ) : null}
            {canCancel ? (
              <Button type="submit" name="action" value="cancel" variant="danger" disabled={locked}>
                {pending === 'cancel' ? 'جارٍ الحفظ...' : 'إلغاء الحجز'}
              </Button>
            ) : null}
            {forward ? <p className="text-xs text-muted">ينقل الحجز إلى {label.booking(forward)}</p> : null}
          </form>
        ) : (
          <p className="mt-4 border-t border-line pt-3 text-xs text-muted">انتهى مسار هذا الحجز.</p>
        )}
      </div>
      {hasHistory ? <StatusHistory history={steps} /> : null}
    </div>
  )
}

function historyStamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return {
    day: new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date),
    time: new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(date),
  }
}

const historyMarks: Record<BookingStatus, { icon: LucideIcon; bubble: string }> = {
  pending: { icon: ClipboardList, bubble: 'bg-slate-100 text-slate-500' },
  under_review: { icon: Search, bubble: 'bg-orange-50 text-orange-500' },
  confirmed: { icon: Check, bubble: 'bg-sky-100 text-sky-600' },
  completed: { icon: BadgeCheck, bubble: 'bg-emerald-100 text-emerald-600' },
  cancelled: { icon: Ban, bubble: 'bg-rose-100 text-rose-600' },
}

function StatusHistory({ history }: { history: StatusEvent[] }) {
  return (
    <aside className="flex flex-col border-t border-line bg-white px-5 py-5 lg:border-t-0 lg:border-s">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-bold text-[#d4893a]">سجل الحالة</h4>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fff1e4] text-[#e08a3c]" aria-hidden="true">
          <Clock3 className="h-3.5 w-3.5" />
        </span>
      </div>
      <ol className="mt-6">
        {history.map((event, index) => {
          const mark = historyMarks[event.new_status as BookingStatus] ?? historyMarks.pending
          const Icon = mark.icon
          const stamp = historyStamp(event.created_at)
          const caption = event.note?.trim() || bookingStatusNotes[event.new_status as BookingStatus]
          const last = index === history.length - 1
          return (
            <li key={event.id} className="flex items-start gap-3 pb-6 last:pb-0">
              <div className="relative flex w-8 shrink-0 justify-center self-stretch">
                {last ? null : <span className="absolute top-8 bottom-0 left-1/2 w-px -translate-x-1/2 bg-[#f3d3b0]" aria-hidden="true" />}
                <span className={cx('relative z-10 flex h-8 w-8 items-center justify-center rounded-full', mark.bubble)}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-bold text-navy">{label.booking(event.new_status)}</p>
                {caption ? (
                  <p className="mt-0.5 line-clamp-2 break-words text-xs leading-5 text-slate-400" title={caption}>
                    {caption}
                  </p>
                ) : null}
              </div>
              {stamp ? (
                <time className="w-[4.75rem] shrink-0 pt-0.5 text-[11px] leading-4 text-slate-400" dateTime={event.created_at} dir="ltr">
                  <span className="block">{stamp.day}</span>
                  <span className="block">{stamp.time}</span>
                </time>
              ) : null}
            </li>
          )
        })}
      </ol>
    </aside>
  )
}

const bookingStatusIcons: Record<string, LucideIcon> = {
  pending: Clock3,
  under_review: Search,
  confirmed: CheckCircle2,
  completed: BadgeCheck,
  cancelled: Ban,
}

function bookingStatusIcon(status: string) {
  return bookingStatusIcons[status] ?? Clock3
}

function BookingStatusBadge({ status }: { status: string }) {
  const Icon = bookingStatusIcon(status)
  return (
    <Badge tone={bookingTone(status)}>
      <Icon className="me-1 h-3.5 w-3.5" aria-hidden="true" />
      {label.booking(status)}
    </Badge>
  )
}

const detailTones = {
  sky: 'bg-sky-100 text-sky-700',
  amber: 'bg-amber-100 text-amber-800',
  violet: 'bg-violet-100 text-violet-700',
  emerald: 'bg-emerald-100 text-emerald-700',
}

function Detail({
  icon: Icon,
  tone,
  label: title,
  children,
}: {
  icon: LucideIcon
  tone: keyof typeof detailTones
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-line bg-white px-3 py-3">
      <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', detailTones[tone])}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] text-muted">{title}</dt>
        <dd className="mt-0.5 text-sm font-semibold text-navy">{children}</dd>
      </div>
    </div>
  )
}
