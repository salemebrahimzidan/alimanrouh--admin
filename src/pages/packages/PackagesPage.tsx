import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listPackages, type PackageRow } from '../../lib/api'
import { errorText, formatMoney } from '../../lib/format'
import { mediaUrl } from '../../lib/supabase'
import { Badge, Button, DataShell, EmptyState, ErrorBanner, LoadingState, PageHeader } from '../../components/ui'

export function PackagesPage() {
  const [rows, setRows] = useState<PackageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div>
      <PageHeader
        title="برامج العمرة"
        description="البرامج المنشورة تصبح متاحة للموقع الرسمي بعد الربط. السعر يُحفظ بالريال السعودي."
        action={<Link to="/umrah/new"><Button>إضافة برنامج</Button></Link>}
      />
      {error ? <ErrorBanner message={error} /> : null}
      <DataShell>
        {loading ? <LoadingState /> : null}
        {!loading && !error && rows.length === 0 ? <EmptyState title="لا توجد برامج عمرة" body="أضف أول برنامج ثم انشره عندما يجهز." /> : null}
        {!loading && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-right text-sm">
              <thead className="bg-slate-50 text-muted">
                <tr>
                  {['البرنامج', 'المدة', 'السعر', 'النشر', ''].map((header) => (
                    <th key={header} className="px-4 py-3 font-medium">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const image = mediaUrl(item.image_path)
                  return (
                    <tr key={item.id} className="border-t border-line">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {image ? <img src={image} alt="" className="h-12 w-16 rounded-lg object-cover" /> : <span className="h-12 w-16 rounded-lg bg-slate-100" />}
                          <div>
                            <p className="font-medium text-navy">{item.title}</p>
                            <p className="mt-1 line-clamp-1 text-xs text-muted">{item.hotel_info || 'بدون تفاصيل فندق'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{item.duration_days.toLocaleString('ar-SA')} أيام</td>
                      <td className="px-4 py-3">{formatMoney(item.price_sar)}</td>
                      <td className="px-4 py-3">
                        <Badge tone={item.is_published ? 'success' : 'neutral'}>{item.is_published ? 'منشور' : 'غير منشور'}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Link className="text-navy" to={`/umrah/${item.id}/edit`}>تعديل</Link>
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
