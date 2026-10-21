import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listBookings, type BookingRow } from '../../lib/api'
import { pageSize } from '../../lib/config'
import { displayName, errorText, formatDateTime, formatMoney } from '../../lib/format'
import { bookingStatuses, bookingTone, label } from '../../lib/labels'
import { Badge, DataShell, EmptyState, ErrorBanner, LoadingState, PageHeader, Pagination, SearchForm, fieldClass } from '../../components/ui'

export function BookingsPage() {
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const status = params.get('status') ?? ''
  const page = Number(params.get('page') ?? '1') || 1
  const [rows, setRows] = useState<BookingRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    listBookings({ search, status, page })
      .then((result) => {
        if (!active) return
        setRows(result.rows)
        setTotal(result.total)
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
  }, [page, search, status])

  function update(next: { q?: string; status?: string; page?: number }) {
    const query = new URLSearchParams()
    const q = next.q ?? search
    const nextStatus = next.status ?? status
    const nextPage = next.page ?? 1
    if (q) query.set('q', q)
    if (nextStatus) query.set('status', nextStatus)
    if (nextPage > 1) query.set('page', String(nextPage))
    setParams(query)
  }

  return (
    <div>
      <PageHeader title="الحجوزات" description="حجوزات العمرة التي يرسلها العملاء من الموقع، مع متابعة الحالة والمبلغ وعدد المسافرين." />
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchForm initial={search} placeholder="المرجع أو اسم العميل أو الجوال" onSearch={(q) => update({ q })} />
        <select className={`${fieldClass} max-w-56`} value={status} onChange={(event) => update({ status: event.target.value })}>
          <option value="">كل الحالات</option>
          {bookingStatuses.map((item) => (
            <option key={item} value={item}>
              {label.booking(item)}
            </option>
          ))}
        </select>
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      <DataShell>
        {loading ? <LoadingState /> : null}
        {!loading && !error && rows.length === 0 ? (
          <EmptyState title="لا توجد حجوزات" body="ستظهر الحجوزات هنا عند إرسالها من حساب العميل." />
        ) : null}
        {!loading && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-right text-sm">
              <thead className="bg-slate-50 text-muted">
                <tr>
                  {['المرجع', 'العميل', 'البرنامج', 'تاريخ الحجز', 'المسافرون', 'المبلغ', 'الحالة'].map((header) => (
                    <th key={header} className="px-4 py-3 font-medium">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((booking) => (
                  <tr key={booking.id} className="border-t border-line hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/bookings/${booking.id}`} className="font-medium text-navy">{booking.reference}</Link>
                    </td>
                    <td className="px-4 py-3">{displayName(booking.customer_name)}</td>
                    <td className="px-4 py-3">{booking.package_title_snapshot || '—'}</td>
                    <td className="px-4 py-3">{formatDateTime(booking.created_at)}</td>
                    <td className="px-4 py-3">{booking.travelers_count.toLocaleString('ar-SA')}</td>
                    <td className="px-4 py-3">{formatMoney(booking.total_amount)}</td>
                    <td className="px-4 py-3"><Badge tone={bookingTone(booking.status)}>{label.booking(booking.status)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!loading && !error ? <Pagination page={page} pageSize={pageSize} total={total} onPage={(next) => update({ q: search, status, page: next })} /> : null}
      </DataShell>
    </div>
  )
}
