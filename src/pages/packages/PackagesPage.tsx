import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2, X } from 'lucide-react'
import { deletePackage, listPackages, setPackagePublished, type PackageRow } from '../../lib/api'
import { englishAmount, errorText } from '../../lib/format'
import { mediaUrl } from '../../lib/supabase'
import { Button, DataShell, EmptyState, ErrorBanner, LoadingState, PageHeader, cx } from '../../components/ui'

export function PackagesPage() {
  const [rows, setRows] = useState<PackageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    listPackages()
      .then((result) => {
        if (!active) return
        setRows(result)
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

  async function togglePublished(item: PackageRow) {
    const next = !item.is_published
    setPublishingId(item.id)
    setError(null)
    setRows((current) => current.map((row) => (row.id === item.id ? { ...row, is_published: next } : row)))
    try {
      await setPackagePublished(item.id, next)
    } catch (err) {
      setRows((current) => current.map((row) => (row.id === item.id ? { ...row, is_published: item.is_published } : row)))
      setError(errorText(err))
    } finally {
      setPublishingId(null)
    }
  }

  async function remove(id: string) {
    setPendingId(id)
    setError(null)
    try {
      await deletePackage(id)
      setRows((current) => current.filter((item) => item.id !== id))
      setConfirmId(null)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="min-w-0">
      <PageHeader
        title="برامج العمرة"
        description="البرامج المنشورة تصبح متاحة للموقع الرسمي بعد الربط. السعر يُحفظ بالريال السعودي."
        action={<Link to="/umrah/new"><Button>إضافة برنامج</Button></Link>}
      />
      {error ? <ErrorBanner message={error} /> : null}
      <DataShell>
        {loading ? <LoadingState plain /> : null}
        {!loading && rows.length === 0 ? <EmptyState title="لا توجد برامج عمرة" body="أضف أول برنامج ثم انشره عندما يجهز." /> : null}
        {!loading && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-right text-sm">
              <thead className="bg-slate-50 text-muted">
                <tr>
                  {['البرنامج', 'المدة', 'السعر', 'النشر', ''].map((header) => (
                    <th key={header || 'actions'} className="px-4 py-3 font-medium">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const image = mediaUrl(item.image_path)
                  return (
                    <tr key={item.id} className="border-t border-line hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {image ? <img src={image} alt="" className="h-12 w-16 rounded-lg object-cover" /> : <span className="h-12 w-16 rounded-lg bg-slate-100" />}
                          <div>
                            <p className="font-medium text-navy">{item.title}</p>
                            <p className="mt-1 line-clamp-1 text-xs text-muted">{item.hotel_info || 'بدون تفاصيل فندق'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3" dir="ltr">{item.duration_days.toLocaleString('en-GB')} days</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-navy" dir="ltr">{englishAmount(item.price_sar)}</td>
                      <td className="px-4 py-3">
                        <PublishSwitch
                          on={item.is_published}
                          disabled={publishingId === item.id}
                          onToggle={() => togglePublished(item)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link to={`/umrah/${item.id}/edit`} aria-label="تعديل" className="rounded-lg p-2 text-navy hover:bg-slate-100">
                            <Pencil className="h-4 w-4" />
                          </Link>
                          {confirmId === item.id ? (
                            <>
                              <button
                                type="button"
                                aria-label="تأكيد الحذف"
                                disabled={pendingId === item.id}
                                onClick={() => remove(item.id)}
                                className="rounded-lg px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                              >
                                {pendingId === item.id ? '...' : 'حذف'}
                              </button>
                              <button type="button" aria-label="تراجع" onClick={() => setConfirmId(null)} className="rounded-lg p-2 text-muted hover:bg-slate-100">
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <button type="button" aria-label="حذف" onClick={() => setConfirmId(item.id)} className="rounded-lg p-2 text-rose-700 hover:bg-rose-50">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </DataShell>
    </div>
  )
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
      className="inline-flex items-center gap-2.5 rounded-full disabled:opacity-60"
    >
      <span dir="ltr" className={cx('relative h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors duration-200', on ? 'bg-emerald-500' : 'bg-slate-200 ring-1 ring-inset ring-slate-300')}>
        <span className={cx('block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out', on ? 'translate-x-5' : 'translate-x-0')} />
      </span>
      <span className={cx('whitespace-nowrap text-xs font-medium', on ? 'text-emerald-700' : 'text-slate-500')}>
        {on ? 'منشور' : 'غير منشور'}
      </span>
    </button>
  )
}
