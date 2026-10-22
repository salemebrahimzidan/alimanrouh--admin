import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Banknote, CalendarDays, MoonStar, Pencil, Plane, Trash2 } from 'lucide-react'
import { deleteInquiry, listHajjPrograms, listInquiries, setHajjProgramPublished, type HajjProgramRow, type InquiryRow } from '../../lib/api'
import { displayName, englishAmount, errorText } from '../../lib/format'
import { hajjInquiryStatuses, inquiryTone, label } from '../../lib/labels'
import { mediaUrl } from '../../lib/supabase'
import { Badge, Button, DataShell, EmptyState, ErrorBanner, FilterSelect, LoadingState, PageHeader, SearchForm, cx } from '../../components/ui'

export function HajjPage() {
  const location = useLocation()
  const inquiriesView = location.pathname.startsWith('/hajj/inquiries')
  const [programs, setPrograms] = useState<HajjProgramRow[]>([])
  const [inquiries, setInquiries] = useState<InquiryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<InquiryRow | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [version] = useState(0)
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const status = params.get('status') ?? ''
  const visibleInquiries = useMemo(
    () => inquiries.filter((item) => matchesInquiry(item, search, status)),
    [inquiries, search, status],
  )

  function updateFilters(next: { q?: string; status?: string }) {
    const query = new URLSearchParams(params)
    const q = next.q ?? search
    const nextStatus = next.status ?? status
    if (q) query.set('q', q)
    else query.delete('q')
    if (nextStatus) query.set('status', nextStatus)
    else query.delete('status')
    query.delete('tab')
    setParams(query)
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([listHajjPrograms(), listInquiries()])
      .then(([programRows, inquiryRows]) => {
        if (!active) return
        setPrograms(programRows)
        setInquiries(inquiryRows)
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
  }, [version])

  async function togglePublished(item: HajjProgramRow) {
    const next = !item.is_published
    setPublishingId(item.id)
    setError(null)
    setPrograms((current) => current.map((row) => (
      row.id === item.id
        ? { ...row, is_published: next, internal_status: next ? 'published' : 'draft' }
        : row
    )))
    try {
      await setHajjProgramPublished(item.id, next)
    } catch (err) {
      setPrograms((current) => current.map((row) => (
        row.id === item.id ? { ...row, is_published: item.is_published, internal_status: item.internal_status } : row
      )))
      setError(errorText(err))
    } finally {
      setPublishingId(null)
    }
  }

  if (new URLSearchParams(location.search).get('tab') === 'inquiries') {
    return <Navigate to="/hajj/inquiries" replace />
  }

  return (
    <div>
      <PageHeader
        title={inquiriesView ? 'الاستفسارات والشكاوي' : 'برامج الحج'}
        description={inquiriesView ? 'استفسارات العملاء. الحالات هنا داخلية ولا تمثل توفر مقاعد رسمية.' : 'إدارة برامج الحج، ثم انشر البرنامج عندما يكون جاهزاً للظهور في الموقع.'}
        action={inquiriesView ? undefined : <Link to="/hajj/new"><Button>إضافة برنامج</Button></Link>}
      />
      {inquiriesView ? (
        <div className="mb-4 flex flex-wrap gap-3">
          <SearchForm initial={search} placeholder="الاسم أو الجوال أو البرنامج" onSearch={(q) => updateFilters({ q })} />
          <FilterSelect
            label="حالة الاستفسار"
            value={status}
            onChange={(next) => updateFilters({ status: next })}
            options={inquiryFilters}
          />
        </div>
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? <LoadingState /> : null}
      {!loading && !error && !inquiriesView ? (
        <ProgramCards rows={programs} publishingId={publishingId} onToggle={togglePublished} />
      ) : null}
      {!loading && !error && inquiriesView ? (
        <InquiryTable
          rows={visibleInquiries}
          filtered={Boolean(search.trim() || status)}
          pendingId={pendingId}
          onDelete={setConfirm}
        />
      ) : null}
      {confirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4"
          onClick={() => { if (!pendingId) setConfirm(null) }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-inquiry-title"
            className="w-full max-w-sm rounded-2xl border border-line bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 id="delete-inquiry-title" className="text-base font-semibold text-navy">حذف الاستفسار</h4>
            <p className="mt-2 text-sm leading-6 text-muted">هل تريد حذف استفسار {displayName(confirm.customer_name)}؟</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" disabled={pendingId !== null} onClick={() => setConfirm(null)}>إلغاء</Button>
              <Button type="button" variant="danger" disabled={pendingId !== null} onClick={() => void removeInquiry(confirm)}>
                {pendingId ? 'جارٍ الحذف...' : 'حذف'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )

  async function removeInquiry(item: InquiryRow) {
    setPendingId(item.id)
    setError(null)
    try {
      await deleteInquiry(item.id)
      setInquiries((current) => current.filter((row) => row.id !== item.id))
      setConfirm(null)
    } catch (err) {
      setError(errorText(err))
      setConfirm(null)
    } finally {
      setPendingId(null)
    }
  }
}

function ProgramCards({
  rows,
  onToggle,
  publishingId,
}: {
  rows: HajjProgramRow[]
  onToggle: (item: HajjProgramRow) => void
  publishingId: string | null
}) {
  if (rows.length === 0) return <DataShell><EmptyState title="لا توجد برامج حج" body="أضف أول برنامج ثم انشره عندما يجهز." /></DataShell>
  return (
    <div className="grid items-stretch gap-5 sm:grid-cols-2">
      {rows.map((item) => {
        const image = mediaUrl(item.image_path)
        const copy = cardCopy(item)
        return (
          <article key={item.id} className="flex h-full flex-col rounded-[28px] border border-[#ece7df] bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <div className="relative h-44 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
              {image ? (
                <img src={image} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center bg-gold-soft text-navy">
                  <MoonStar className="h-8 w-8" aria-hidden="true" />
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col px-3 pb-2 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-xl font-bold text-navy">{item.title}</h3>
                  <p className="mt-1 truncate text-sm text-muted">{copy.subtitle}</p>
                </div>
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f8f1e4] text-[#b0893e]">
                  <Plane className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
              {copy.body ? <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">{copy.body}</p> : null}
              <dl className="mt-4 grid grid-cols-2 rounded-2xl bg-[#fbf7f1] py-3">
                <div className="px-4">
                  <dt className="flex items-center justify-end gap-1.5 text-xs text-slate-500">
                    الموسم
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white text-[#b0893e]">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </dt>
                  <dd className="mt-2 line-clamp-2 text-end text-lg font-bold text-navy">{item.season_label || '—'}</dd>
                </div>
                <div className="border-s border-[#eadfcd] px-4">
                  <dt className="flex items-center justify-end gap-1.5 text-xs text-slate-500">
                    السعر
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white text-[#b0893e]">
                      <Banknote className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </dt>
                  <dd className="mt-2 text-end text-2xl font-bold tabular-nums text-navy" dir="ltr">
                    {item.price_sar == null ? '—' : `${englishAmount(item.price_sar)} SAR`}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex items-center justify-between gap-2">
                <PublishSwitch
                  on={item.is_published}
                  disabled={publishingId === item.id}
                  onToggle={() => onToggle(item)}
                />
                <Link to={`/hajj/${item.id}/edit`} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-navy hover:bg-slate-50">
                  <Pencil className="h-4 w-4" />
                  تعديل
                </Link>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function cardCopy(item: HajjProgramRow) {
  const hotel = item.hotel_info.trim()
  const transport = item.transportation.trim()
  const description = item.description.trim()
  const subtitle = hotel || transport || 'برنامج حج'
  const body = description && description !== subtitle ? description : ''
  return { subtitle, body }
}

function PublishSwitch({ on, disabled, onToggle }: { on: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? 'منشور' : 'غير منشور'}
      disabled={disabled}
      onClick={onToggle}
      className="inline-flex items-center gap-2.5 text-right disabled:opacity-60"
    >
      <span dir="ltr" className={cx('relative h-7 w-12 shrink-0 rounded-full p-0.5 transition-colors duration-200', on ? 'bg-emerald-500' : 'bg-slate-200')}>
        <span className={cx('block h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out', on ? 'translate-x-5' : 'translate-x-0')} />
      </span>
      <span>
        <span className={cx('block text-sm font-semibold', on ? 'text-emerald-600' : 'text-slate-500')}>{on ? 'منشور' : 'مغلق'}</span>
        <span className="block text-[11px] text-slate-400">إظهار البرنامج في الموقع</span>
      </span>
    </button>
  )
}

const inquiryFilters = hajjInquiryStatuses.map((status) => ({
  value: status,
  label: label.inquiry(status),
  tone: inquiryTone(status),
}))

function matchesInquiry(item: InquiryRow, query: string, status: string) {
  if (status && item.internal_status !== status) return false
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const text = [item.customer_name, item.customer_email ?? '', item.program_title || 'استفسار عام', item.message]
    .join(' ')
    .toLowerCase()
  if (text.includes(needle)) return true
  const needleDigits = needle.replace(/\D/g, '')
  if (!needleDigits) return false
  const mobileDigits = item.customer_mobile.replace(/\D/g, '')
  const local = mobileDigits.startsWith('966') ? mobileDigits.slice(3) : mobileDigits
  return mobileDigits.includes(needleDigits) || local.includes(needleDigits.replace(/^0/, ''))
}

function InquiryTable({
  rows,
  filtered,
  pendingId,
  onDelete,
}: {
  rows: InquiryRow[]
  filtered: boolean
  pendingId: string | null
  onDelete: (item: InquiryRow) => void
}) {
  const navigate = useNavigate()

  if (rows.length === 0) {
    return (
      <DataShell>
        <EmptyState
          title={filtered ? 'لا توجد نتائج مطابقة' : 'لا توجد استفسارات'}
          body={filtered ? 'جرّب عبارة بحث أو حالة أخرى.' : 'تظهر استفسارات الحج التي يرسلها العملاء من حساباتهم.'}
        />
      </DataShell>
    )
  }
  return (
    <div className="min-w-0 max-w-full overflow-visible rounded-2xl border border-line bg-white shadow-sm">
      <div className="hidden border-b border-line px-5 py-2.5 text-xs font-medium text-muted sm:grid sm:grid-cols-[minmax(0,1.5fr)_11rem_7.5rem_auto] sm:items-center sm:gap-6">
        <span>العميل</span>
        <span>الرقم</span>
        <span>التاريخ</span>
        <span>الحالة</span>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((item) => {
          const contact = item.customer_mobile || item.customer_email
          return (
            <li key={item.id}>
              <div
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/hajj/inquiries/${item.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') navigate(`/hajj/inquiries/${item.id}`)
                }}
                className="grid cursor-pointer items-center gap-2 px-5 py-3.5 transition hover:bg-[#fbf7f1] sm:grid-cols-[minmax(0,1.5fr)_11rem_7.5rem_auto] sm:gap-6"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f8f1e4] text-sm font-bold text-[#8a6a2f]">
                    {displayName(item.customer_name).trim().charAt(0) || '؟'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy">{displayName(item.customer_name)}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">{item.program_title || 'استفسار عام'}</p>
                  </div>
                </div>
                <span className="text-sm font-medium tabular-nums text-navy" dir="ltr">{phoneLabel(contact)}</span>
                <InquiryWhen value={item.created_at} />
                <div className="flex items-center gap-2 justify-self-start" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                  <Badge tone={inquiryTone(item.internal_status)}>{label.inquiry(item.internal_status)}</Badge>
                  <button
                    type="button"
                    aria-label="حذف"
                    disabled={pendingId !== null}
                    onClick={() => onDelete(item)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function InquiryWhen({ value }: { value: string }) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return <span className="text-sm text-muted">—</span>
  const day = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
  const time = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).format(date)
  return (
    <div dir="ltr" className="text-end leading-tight">
      <p className="text-sm text-navy">{day}</p>
      <p className="text-xs text-muted">{time}</p>
    </div>
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
