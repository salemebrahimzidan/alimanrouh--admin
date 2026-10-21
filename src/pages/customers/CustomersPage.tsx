import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { countCustomers, listCustomers, type CustomerRow } from '../../lib/api'
import { pageSize } from '../../lib/config'
import { displayName, errorText, formatDateTime } from '../../lib/format'
import { accountStatuses, accountTone, label } from '../../lib/labels'
import { Badge, DataShell, EmptyState, ErrorBanner, LoadingState, PageHeader, Pagination, SearchForm, fieldClass } from '../../components/ui'

export function CustomersPage() {
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const status = params.get('status') ?? ''
  const page = Number(params.get('page') ?? '1') || 1
  const [rows, setRows] = useState<CustomerRow[]>([])
  const [total, setTotal] = useState(0)
  const [registered, setRegistered] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([listCustomers({ search, status, page }), countCustomers()])
      .then(([list, count]) => {
        if (!active) return
        setRows(list.rows)
        setTotal(list.total)
        setRegistered(count)
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
    const query = new URLSearchParams(params)
    const q = next.q ?? search
    const nextStatus = next.status ?? status
    const nextPage = next.page ?? 1
    if (q) query.set('q', q)
    else query.delete('q')
    if (nextStatus) query.set('status', nextStatus)
    else query.delete('status')
    if (nextPage > 1) query.set('page', String(nextPage))
    else query.delete('page')
    setParams(query)
  }

  return (
    <div>
      <PageHeader
        title="العملاء"
        description="كل عميل سجّل حساباً في الموقع يظهر هنا تلقائياً، حتى إذا لم يُنشئ أي حجز."
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchForm initial={search} placeholder="الاسم أو الجوال أو البريد" onSearch={(q) => update({ q })} />
        <select className={fieldClass + ' max-w-56'} value={status} onChange={(event) => update({ status: event.target.value })}>
          <option value="">كل الحالات</option>
          {accountStatuses.map((item) => (
            <option key={item} value={item}>
              {label.account(item)}
            </option>
          ))}
        </select>
      </div>
      <p className="mb-4 text-sm text-muted">
        إجمالي العملاء المسجلين:{' '}
        <span className="font-semibold text-navy">{registered == null ? '—' : registered.toLocaleString('ar-SA')}</span>
        {search || status ? ` · نتائج التصفية: ${loading ? '...' : total.toLocaleString('ar-SA')}` : null}
      </p>
      {error ? <ErrorBanner message={error} /> : null}
      <DataShell>
        {loading ? <LoadingState /> : null}
        {!loading && !error && rows.length === 0 ? (
          <EmptyState
            title={search || status ? 'لا توجد نتائج مطابقة' : 'لا يوجد عملاء مسجلون بعد'}
            body={search || status ? 'جرّب عبارة بحث أو حالة أخرى.' : 'سيظهر العميل هنا مباشرة بعد تسجيله في الموقع.'}
          />
        ) : null}
        {!loading && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-right text-sm">
              <thead className="bg-slate-50 text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">اسم العميل</th>
                  <th className="px-4 py-3 font-medium">الجوال</th>
                  <th className="px-4 py-3 font-medium">البريد</th>
                  <th className="px-4 py-3 font-medium">تاريخ التسجيل</th>
                  <th className="px-4 py-3 font-medium">عدد الحجوزات</th>
                  <th className="px-4 py-3 font-medium">حالة الحساب</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((customer) => (
                  <tr key={customer.id} className="border-t border-line hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/customers/${customer.id}`} className="font-medium text-navy">
                        {displayName(customer.full_name)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{customer.mobile || '—'}</td>
                    <td className="px-4 py-3">{customer.email || '—'}</td>
                    <td className="px-4 py-3">{formatDateTime(customer.created_at)}</td>
                    <td className="px-4 py-3">{customer.bookings_count.toLocaleString('ar-SA')}</td>
                    <td className="px-4 py-3">
                      <Badge tone={accountTone(customer.account_status)}>{label.account(customer.account_status)}</Badge>
                    </td>
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
