import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Banknote, CalendarDays, MoonStar, Pencil, Plane } from 'lucide-react'
import { listHajjPrograms, setHajjProgramPublished, type HajjProgramRow } from '../../lib/api'
import { englishAmount, errorText } from '../../lib/format'
import { mediaUrl } from '../../lib/supabase'
import { Button, DataShell, EmptyState, ErrorBanner, LoadingState, PageHeader, cx } from '../../components/ui'

export function HajjPage() {
  const [searchParams] = useSearchParams()
  const [programs, setPrograms] = useState<HajjProgramRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    listHajjPrograms()
      .then((programRows) => {
        if (!active) return
        setPrograms(programRows)
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
  }, [])

  if (searchParams.get('tab') === 'inquiries') return <Navigate to="/inquiries" replace />

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

  return (
    <div>
      <PageHeader
        title="برامج الحج"
        description="إدارة برامج الحج، ثم انشر البرنامج عندما يكون جاهزاً للظهور في الموقع."
        action={<Link to="/hajj/new"><Button>إضافة برنامج</Button></Link>}
      />
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? <LoadingState /> : null}
      {!loading && !error ? (
        <ProgramCards rows={programs} publishingId={publishingId} onToggle={togglePublished} />
      ) : null}
    </div>
  )
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
