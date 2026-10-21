import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listVisas, type VisaRow } from '../../lib/api'
import { pageSize, visaDisclaimer } from '../../lib/config'
import { displayName, errorText, formatDateTime } from '../../lib/format'
import { label, visaStatuses, visaTone } from '../../lib/labels'
import { Badge, DataShell, EmptyState, ErrorBanner, LoadingState, Notice, PageHeader, Pagination, SearchForm, fieldClass } from '../../components/ui'

export function VisasPage() {
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const status = params.get('status') ?? ''
  const page = Number(params.get('page') ?? '1') || 1
  const [rows, setRows] = useState<VisaRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    listVisas({ search, status, page })
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
      <PageHeader title="طلبات التأشيرات" description="متابعة طلبات تأشيرة العمرة التي يرسلها العملاء، مع مستنداتهم وحالتهم الداخلية." />
      <div className="mb-4"><Notice>{visaDisclaimer}</Notice></div>
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchForm initial={search} placeholder="المرجع أو الاسم أو الجوال" onSearch={(q) => update({ q })} />
        <select className={`${fieldClass} max-w-64`} value={status} onChange={(event) => update({ status: event.target.value })}>
          <option value="">كل الحالات</option>
          {visaStatuses.map((item) => (
            <option key={item} value={item}>{label.visa(item)}</option>
          ))}
        </select>
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      <DataShell>
        {loading ? <LoadingState /> : null}
        {!loading && !error && rows.length === 0 ? <EmptyState title="لا توجد طلبات" body="ستظهر طلبات التأشيرة هنا عند إرسالها من حساب العميل." /> : null}
        {!loading && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-right text-sm">
              <thead className="bg-slate-50 text-muted">
                <tr>
                  {['المرجع', 'العميل', 'الجنسية', 'تاريخ الطلب', 'الحالة'].map((header) => (
                    <th key={header} className="px-4 py-3 font-medium">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((visa) => (
                  <tr key={visa.id} className="border-t border-line hover:bg-slate-50">
                    <td className="px-4 py-3"><Link className="font-medium text-navy" to={`/visas/${visa.id}`}>{visa.reference}</Link></td>
                    <td className="px-4 py-3">{displayName(visa.customer_name)}</td>
                    <td className="px-4 py-3">{visa.nationality}</td>
                    <td className="px-4 py-3">{formatDateTime(visa.created_at)}</td>
                    <td className="px-4 py-3"><Badge tone={visaTone(visa.status)}>{label.visa(visa.status)}</Badge></td>
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
