import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, BadgeCheck, Ban, CalendarCheck, CalendarDays, Check, ChevronDown, ClipboardList, Clock3, Copy, Files, Globe, IdCard, Mail, Pencil, Phone, Search, Trash2, type LucideIcon } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import {
  addNote,
  addVisaClientNote,
  deleteNote,
  getVisa,
  listDocuments,
  listNotes,
  openDocument,
  setVisaStatus,
  updateNote,
  visaHistory,
  type DocumentRow,
  type InternalNote,
  type StatusEvent,
  type VisaRow,
} from '../../lib/api'
import { displayName, errorText, formatDate, formatDateTime } from '../../lib/format'
import { label, visaStatuses, visaTone, type Tone, type VisaStatus } from '../../lib/labels'
import { BackLink, Badge, Button, Card, EmptyState, ErrorBanner, LoadingState, cx } from '../../components/ui'

export function VisaDetailPage() {
  const { id = '' } = useParams()
  const { session } = useAuth()
  const [visa, setVisa] = useState<VisaRow | null>(null)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [notes, setNotes] = useState<InternalNote[]>([])
  const [history, setHistory] = useState<StatusEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState<'advance' | 'cancel' | 'client-note' | 'note' | null>(null)
  const [adding, setAdding] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    getVisa(id)
      .then(async (row) => {
        if (!active) return
        setVisa(row)
        if (!row) return
        const [docs, noteRows, events] = await Promise.all([
          listDocuments(row.customer_id),
          listNotes('visa_application', id),
          visaHistory(id),
        ])
        if (!active) return
        setDocuments(docs.filter((item) => item.visa_application_id === id || item.visa_application_id == null))
        setNotes(noteRows)
        setHistory(events)
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
    const next = String(new FormData(event.currentTarget).get('status') ?? '') as VisaStatus
    const action = next === 'cancelled' ? 'cancel' : 'advance'
    if (!visa || !(visaStatuses as readonly string[]).includes(next) || next === visa.status) {
      setError('اختر حالة مختلفة من القائمة.')
      return
    }
    setPending(action)
    setMessage(null)
    setError(null)
    try {
      await setVisaStatus(id, next, '')
      setMessage(action === 'cancel' ? 'تم إلغاء الطلب.' : 'تم تحديث حالة الطلب.')
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
    if (!note || !visa || visa.status === 'closed' || visa.status === 'cancelled') return
    setPending('client-note')
    setError(null)
    setMessage(null)
    try {
      await addVisaClientNote(id, note)
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
      await addNote('visa_application', id, body, session.user.id)
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-semibold text-navy">{displayName(visa.full_name)}</h2>
          <div className="mt-2 inline-flex items-center gap-2">
            <span className="text-lg font-semibold text-navy">رقم الطلب</span>
            <span className="text-sm font-medium tracking-wide text-muted" dir="ltr">{visa.reference}</span>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition hover:bg-slate-100 hover:text-navy"
              aria-label={copied ? 'تم النسخ' : 'نسخ المرجع'}
              onClick={() => {
                void navigator.clipboard.writeText(visa.reference).then(() => setCopied(true)).catch(() => setCopied(false))
              }}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/visas"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-medium text-navy shadow-sm transition hover:border-gold hover:text-gold"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            العودة إلى الطلبات
          </Link>
        </div>
      </div>
      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <div className="flex items-center gap-3 bg-navy px-4 py-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-semibold text-navy">
            {displayName(visa.customer_name).trim().charAt(0) || '؟'}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] text-white/70">العميل</p>
            <Link className="font-semibold text-white hover:text-gold" to={`/customers/${visa.customer_id}`}>{displayName(visa.customer_name)}</Link>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/80">
              <span className="inline-flex items-center gap-1.5" dir="ltr">
                <Phone className="h-3.5 w-3.5 text-gold" />
                {visa.mobile || visa.customer_mobile || '—'}
              </span>
              <span className="inline-flex items-center gap-1.5" dir="ltr">
                <Mail className="h-3.5 w-3.5 text-gold" />
                {visa.customer_email || '—'}
              </span>
            </p>
          </div>
        </div>
        <dl className="grid gap-3 bg-canvas p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Detail icon={CalendarCheck} tone="sky" label="تاريخ الطلب">{formatDateTime(visa.created_at)}</Detail>
          <Detail icon={CalendarDays} tone="amber" label="تاريخ السفر المطلوب">{formatDate(visa.requested_travel_date)}</Detail>
          <Detail icon={IdCard} tone="violet" label="رقم الجواز"><span dir="ltr">{visa.passport_number || '—'}</span></Detail>
          <Detail icon={Globe} tone="emerald" label="الجنسية">{visa.nationality || '—'}</Detail>
        </dl>
        <div className="border-t border-gold/30 bg-gold-soft px-4 py-3">
          <p className="text-[11px] font-medium text-[#6d5420]">ملاحظة العميل</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{visa.customer_note || '—'}</p>
        </div>
      </section>
      {error ? <div className="mt-4"><ErrorBanner message={error} /></div> : null}
      {message ? <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
      <Card className="mt-6 overflow-visible">
        <VisaStatusActions
          status={visa.status}
          history={history}
          pending={pending === 'advance' || pending === 'cancel' ? pending : null}
          savingNote={pending === 'client-note'}
          locked={pending !== null}
          onSubmit={saveStatus}
          onNote={saveClientNote}
        />
      </Card>
      <section className="mt-6 rounded-2xl border border-line bg-white px-4 py-3 shadow-sm">
        <h3 className="text-sm font-semibold text-navy">المستندات</h3>
        {documents.length === 0 ? (
          <p className="mt-2 text-xs text-muted">لم يرفع العميل مستندات بعد.</p>
        ) : (
          <ul className="mt-2.5 divide-y divide-line border-t border-line">
            {documents.map((document) => (
              <li key={document.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-navy">{document.file_name}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{document.visa_application_id === id ? 'مرتبط بهذا الطلب' : 'من ملف العميل'} · {formatDateTime(document.created_at)}</p>
                </div>
                <Button variant="secondary" disabled={pending !== null} onClick={() => openDocument(document.storage_path).catch((err) => setError(errorText(err)))}>عرض</Button>
              </li>
            ))}
          </ul>
        )}
      </section>
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
            aria-labelledby="add-visa-note-title"
            className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 id="add-visa-note-title" className="text-base font-semibold text-navy">إضافة ملاحظة</h4>
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
                <Button type="button" variant="ghost" disabled={pending !== null} onClick={() => { setAdding(false); setNoteBody('') }}>إلغاء</Button>
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
            aria-labelledby="edit-visa-note-title"
            className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 id="edit-visa-note-title" className="text-base font-semibold text-navy">تعديل الملاحظة</h4>
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
            aria-labelledby="delete-visa-note-title"
            className="w-full max-w-sm rounded-2xl border border-line bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 id="delete-visa-note-title" className="text-base font-semibold text-navy">حذف الملاحظة</h4>
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

function choiceFor(status: string): VisaStatus {
  if (status === 'processing') return 'under_review'
  return visaStatuses.includes(status as VisaStatus) ? (status as VisaStatus) : 'submitted'
}

function sameChoice(status: string, chosen: VisaStatus | '') {
  return chosen === status || (status === 'processing' && chosen === 'under_review')
}

const visaStatusNotes: Record<VisaStatus, string> = {
  submitted: 'تم استلام طلب التأشيرة وجاري تسجيله.',
  under_review: 'جاري مراجعة الطلب.',
  documents_requested: 'بانتظار استكمال المستندات من العميل.',
  processing: 'جاري مراجعة الطلب.',
  ready_for_collection: 'الطلب جاهز للمتابعة مع العميل.',
  closed: 'تم إنجاز الطلب بنجاح.',
  cancelled: 'تم إلغاء الطلب.',
}

const toneDots: Record<Tone, string> = {
  neutral: 'bg-slate-400',
  info: 'bg-sky-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-400',
  danger: 'bg-rose-500',
  gold: 'bg-gold',
}

function StatusChoice({
  value,
  options,
  disabled,
  onChange,
}: {
  value: VisaStatus | ''
  options: VisaStatus[]
  disabled: boolean
  onChange: (value: VisaStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const current = options.find((item) => item === value) ?? options[0]
  const currentTone = current ? visaTone(current) : 'neutral'

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative min-w-[16rem] flex-1">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 text-sm text-ink shadow-sm outline-none transition hover:border-gold focus:border-gold focus:ring-2 focus:ring-gold/25 disabled:bg-slate-50"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', toneDots[currentTone])} />
          <span className="truncate font-medium">{current ? label.visa(current) : 'اختر الحالة'}</span>
        </span>
        <ChevronDown className={cx('h-4 w-4 shrink-0 text-muted transition', open && 'rotate-180')} />
      </button>
      {open ? (
        <ul id={listId} role="listbox" aria-label="الحالة" className="absolute top-full z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-line bg-white p-1.5 shadow-lg">
          {options.map((item) => {
            const selected = item === current
            return (
              <li key={item}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(item)
                    setOpen(false)
                  }}
                  className={cx(
                    'flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm transition',
                    selected ? 'bg-slate-50 font-medium text-navy' : 'text-ink hover:bg-slate-50',
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', toneDots[visaTone(item)])} />
                    {label.visa(item)}
                  </span>
                  {selected ? <Check className="h-4 w-4 shrink-0 text-gold" /> : <span className="h-4 w-4 shrink-0" />}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

function VisaStatusActions({
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
  const choices = visaStatuses.filter((item) => item !== 'processing')
  const [chosen, setChosen] = useState<VisaStatus | ''>(choiceFor(status))
  const closed = status === 'closed' || status === 'cancelled'
  const summary = visaStatusNotes[status as VisaStatus]
  const steps = history.filter((event) => event.old_status !== event.new_status)
  const clientNotes = history.filter((event) => event.note?.trim() && event.old_status === event.new_status)
  const hasHistory = steps.length > 0

  useEffect(() => {
    setChosen(choiceFor(status))
  }, [status])

  return (
    <div className={cx(hasHistory && '-m-5 lg:grid lg:grid-cols-[minmax(0,1fr)_380px]')}>
      <div className={cx(hasHistory && 'p-5')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-navy">تحديث الحالة</h3>
            {summary ? <p className="mt-1 text-sm leading-6 text-muted">{summary}</p> : null}
          </div>
          <VisaStatusBadge status={status} />
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
        <form onSubmit={onSubmit} className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <input type="hidden" name="status" value={chosen} />
          <StatusChoice value={chosen} options={choices} disabled={locked} onChange={setChosen} />
            <Button type="submit" variant={chosen === 'cancelled' ? 'danger' : 'primary'} disabled={locked || chosen === '' || sameChoice(status, chosen)}>
            {pending ? 'جارٍ الحفظ...' : 'حفظ الحالة'}
          </Button>
        </form>
      </div>
      {hasHistory ? <VisaStatusHistory history={steps} /> : null}
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

const historyMarks: Record<VisaStatus, { icon: LucideIcon; bubble: string }> = {
  submitted: { icon: ClipboardList, bubble: 'bg-slate-100 text-slate-500' },
  under_review: { icon: Search, bubble: 'bg-orange-50 text-orange-500' },
  documents_requested: { icon: Files, bubble: 'bg-amber-100 text-amber-700' },
  processing: { icon: Search, bubble: 'bg-orange-50 text-orange-500' },
  ready_for_collection: { icon: BadgeCheck, bubble: 'bg-emerald-100 text-emerald-600' },
  closed: { icon: BadgeCheck, bubble: 'bg-emerald-100 text-emerald-600' },
  cancelled: { icon: Ban, bubble: 'bg-rose-100 text-rose-600' },
}

function VisaStatusHistory({ history }: { history: StatusEvent[] }) {
  return (
    <aside className="flex flex-col border-t border-line bg-white px-5 py-5 lg:border-t-0 lg:border-s">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-bold text-[#d4893a]">سجل الحالة</h4>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fff1e4] text-[#e08a3c]" aria-hidden="true">
          <Clock3 className="h-3.5 w-3.5" />
        </span>
      </div>
      <ol className="mt-5">
        {history.map((event, index) => {
          const mark = historyMarks[event.new_status as VisaStatus] ?? historyMarks.submitted
          const Icon = mark.icon
          const stamp = historyStamp(event.created_at)
          const note = event.note?.trim()
          const current = index === 0
          const last = index === history.length - 1
          return (
            <li key={event.id} className="flex items-start gap-3 pb-4 last:pb-0">
              <div className="relative flex w-8 shrink-0 justify-center self-stretch">
                {last ? null : <span className="absolute top-8 bottom-0 left-1/2 w-px -translate-x-1/2 bg-[#f3d3b0]" aria-hidden="true" />}
                <span className={cx('relative z-10 flex h-8 w-8 items-center justify-center rounded-full', mark.bubble, current && 'ring-2 ring-[#e08a3c]/40')}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <div className={cx('min-w-0 flex-1 rounded-xl px-2.5 py-2', current ? 'bg-[#fff7ee]' : 'bg-transparent')}>
                <div className="flex flex-wrap items-center gap-2">
                  <VisaStatusBadge status={event.new_status} />
                  {current ? <span className="text-[11px] font-semibold text-[#d4893a]">الحالية</span> : null}
                </div>
                {note ? <p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-ink">{note}</p> : null}
                {stamp ? (
                  <time className="mt-1 block text-[11px] leading-4 text-slate-400" dateTime={event.created_at} dir="ltr">
                    {stamp.day} · {stamp.time}
                  </time>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}

const visaStatusIcons: Record<string, LucideIcon> = {
  submitted: ClipboardList,
  under_review: Search,
  documents_requested: Files,
  processing: Search,
  ready_for_collection: BadgeCheck,
  closed: BadgeCheck,
  cancelled: Ban,
}

function VisaStatusBadge({ status }: { status: string }) {
  const Icon = visaStatusIcons[status] ?? Clock3
  return (
    <Badge tone={visaTone(status)}>
      <Icon className="me-1 h-3.5 w-3.5" aria-hidden="true" />
      {label.visa(status)}
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
        <dd className="mt-0.5 break-words text-sm font-semibold text-navy">{children}</dd>
      </div>
    </div>
  )
}
