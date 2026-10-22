import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, BadgeCheck, CalendarCheck, Clock3, Mail, MessageSquare, MoonStar, Phone, Users, type LucideIcon } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { getInquiry, inquiryHistory, setInquiryStatus, type InquiryRow, type StatusEvent } from '../../lib/api'
import { displayName, errorText, formatDateTime } from '../../lib/format'
import { inquiryTone, label, nextInquiryStatus, type HajjInquiryStatus } from '../../lib/labels'
import { Badge, Button, EmptyState, ErrorBanner, LoadingState, cx } from '../../components/ui'

export function InquiryDetailPage() {
  const { id = '' } = useParams()
  const [inquiry, setInquiry] = useState<InquiryRow | null>(null)
  const [history, setHistory] = useState<StatusEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [advancing, setAdvancing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([getInquiry(id), inquiryHistory(id)])
      .then(([row, events]) => {
        if (!active) return
        setInquiry(row)
        setHistory(events)
        setMissing(!row)
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
  }, [id])

  async function advanceStatus() {
    if (!inquiry || advancing) return
    const status = nextInquiryStatus(inquiry.internal_status)
    if (!status) return
    const previous = inquiry.internal_status
    setAdvancing(true)
    setInquiry({ ...inquiry, internal_status: status })
    setError(null)
    try {
      await setInquiryStatus(inquiry.id, status)
      setHistory(await inquiryHistory(inquiry.id))
    } catch (err) {
      setInquiry({ ...inquiry, internal_status: previous })
      setError(errorText(err))
    } finally {
      setAdvancing(false)
    }
  }

  if (loading) return <LoadingState />
  if (error && !inquiry) return <ErrorBanner message={error} />
  if (missing || !inquiry) {
    return (
      <div>
        <BackButton />
        <EmptyState title="الاستفسار غير موجود" body="ربما حُذف هذا الاستفسار." />
      </div>
    )
  }

  const initial = displayName(inquiry.customer_name).trim().charAt(0) || '؟'
  const nextStatus = nextInquiryStatus(inquiry.internal_status)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-semibold text-navy">{inquiry.program_title || 'استفسار عام'}</h2>
          <p className="mt-1 text-sm text-muted">الاستفسارات والشكاوي</p>
        </div>
        <BackButton />
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <div className="flex items-center gap-3 bg-navy px-4 py-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-semibold text-navy">
            {initial}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] text-white/70">العميل</p>
            <Link className="font-semibold text-white hover:text-gold" to={`/customers/${inquiry.customer_id}`}>
              {displayName(inquiry.customer_name)}
            </Link>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/80">
              <span className="inline-flex items-center gap-1.5" dir="ltr">
                <Phone className="h-3.5 w-3.5 text-gold" />
                {inquiry.customer_mobile ? (
                  <a className="hover:text-gold" href={`tel:${inquiry.customer_mobile.replace(/\s/g, '')}`}>{phoneLabel(inquiry.customer_mobile)}</a>
                ) : '—'}
              </span>
              <span className="inline-flex items-center gap-1.5" dir="ltr">
                <Mail className="h-3.5 w-3.5 text-gold" />
                {inquiry.customer_email ? (
                  <a className="hover:text-gold" href={`mailto:${inquiry.customer_email}`}>{inquiry.customer_email}</a>
                ) : '—'}
              </span>
            </p>
          </div>
        </div>
        <dl className="grid gap-3 bg-canvas p-4 sm:grid-cols-3">
          <Detail icon={MoonStar} tone="amber" label="البرنامج">{inquiry.program_title || 'استفسار عام'}</Detail>
          <Detail icon={Users} tone="violet" label="المسافرون">
            <span dir="ltr">{(inquiry.travelers_count ?? 0).toLocaleString('en-GB')}</span>
          </Detail>
          <Detail icon={CalendarCheck} tone="sky" label="التاريخ">{formatDateTime(inquiry.created_at)}</Detail>
        </dl>
        <div className="border-t border-gold/30 bg-gold-soft px-4 py-3">
          <p className="text-[11px] font-medium text-[#6d5420]">الاستفسار</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{inquiry.message || '—'}</p>
        </div>
      </section>
      {error ? <div className="mt-4"><ErrorBanner message={error} /></div> : null}

      <section className="mt-6 overflow-hidden rounded-2xl border border-line bg-white p-5 shadow-sm">
        <div className="-m-5 lg:grid lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-navy">تحديث الحالة</h3>
                <p className="mt-1 text-sm leading-6 text-muted">{inquiryStatusNotes[inquiry.internal_status as HajjInquiryStatus] ?? 'حدّث حالة متابعة هذا الاستفسار.'}</p>
              </div>
              <InquiryStatusBadge status={inquiry.internal_status} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              {nextStatus ? (
                <>
                  <Button disabled={advancing} onClick={() => void advanceStatus()}>
                    {advancing ? 'جارٍ الحفظ...' : 'تغيير الحالة'}
                  </Button>
                  <p className="text-xs text-muted">ينقل الاستفسار إلى {label.inquiry(nextStatus)}</p>
                </>
              ) : (
                <p className="text-xs text-muted">انتهى مسار هذا الاستفسار.</p>
              )}
            </div>
          </div>
          <InquiryStatusHistory history={statusSteps(history, inquiry)} />
        </div>
      </section>
    </div>
  )
}

function BackButton() {
  return (
    <Link
      to="/hajj/inquiries"
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-medium text-navy shadow-sm transition hover:border-gold hover:text-gold"
    >
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
      العودة إلى الاستفسارات
    </Link>
  )
}

const detailTones = {
  sky: 'bg-sky-100 text-sky-700',
  amber: 'bg-amber-100 text-amber-800',
  violet: 'bg-violet-100 text-violet-700',
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

const inquiryStatusNotes: Record<HajjInquiryStatus, string> = {
  new: 'تم استلام الاستفسار.',
  contacted: 'تم التواصل مع العميل.',
  in_progress: 'الاستفسار قيد المتابعة.',
  closed: 'تم إغلاق الاستفسار.',
}

const historyMarks: Record<HajjInquiryStatus, { icon: LucideIcon; bubble: string }> = {
  new: { icon: MessageSquare, bubble: 'bg-amber-50 text-amber-700' },
  contacted: { icon: Phone, bubble: 'bg-sky-100 text-sky-600' },
  in_progress: { icon: Clock3, bubble: 'bg-orange-50 text-orange-500' },
  closed: { icon: BadgeCheck, bubble: 'bg-emerald-100 text-emerald-600' },
}

function statusSteps(history: StatusEvent[], inquiry: InquiryRow) {
  if (history.length > 0) return history
  return [{
    id: inquiry.id,
    old_status: null,
    new_status: inquiry.internal_status || 'new',
    note: null,
    created_at: inquiry.created_at,
  } satisfies StatusEvent]
}

function historyStamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return {
    day: new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date),
    time: new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(date),
  }
}

function InquiryStatusBadge({ status }: { status: string }) {
  const mark = historyMarks[status as HajjInquiryStatus] ?? historyMarks.new
  const Icon = mark.icon
  return (
    <Badge tone={inquiryTone(status)}>
      <Icon className="me-1 h-3.5 w-3.5" aria-hidden="true" />
      {label.inquiry(status)}
    </Badge>
  )
}

function InquiryStatusHistory({ history }: { history: StatusEvent[] }) {
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
          const mark = historyMarks[event.new_status as HajjInquiryStatus] ?? historyMarks.new
          const Icon = mark.icon
          const stamp = historyStamp(event.created_at)
          const caption = inquiryStatusNotes[event.new_status as HajjInquiryStatus]
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
                <p className="text-sm font-bold text-navy">{label.inquiry(event.new_status)}</p>
                {caption ? <p className="mt-0.5 line-clamp-2 break-words text-xs leading-5 text-slate-400">{caption}</p> : null}
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

function phoneLabel(value: string | null) {
  if (!value) return '—'
  const compact = value.replace(/\s/g, '')
  const local = /^\+966(\d{9})$/.exec(compact)
  if (!local) return value
  const digits = local[1]
  return `+966 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`
}
