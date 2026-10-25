import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { deleteVisa, listVisaCustomers, listVisas, type VisaCustomerRow, type VisaRow } from '../../lib/api'
import { pageSize } from '../../lib/config'
import { displayName, errorText } from '../../lib/format'
import { label, visaStatuses, visaTone } from '../../lib/labels'
import { BackLink, Badge, Button, DataShell, EmptyState, EnglishWhen, ErrorBanner, FilterSelect, LoadingState, PageHeader, Pagination, SearchForm } from '../../components/ui'

export function VisasPage() {
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const statusParam = params.get('status') ?? ''
  const status = statusParam === 'processing' ? 'under_review' : statusParam
  const customerId = params.get('customer') ?? ''
  const page = Number(params.get('page') ?? '1') || 1
  const [customers, setCustomers] = useState<VisaCustomerRow[]>([])
  const [visas, setVisas] = useState<VisaRow[]>([])
  const [customerName, setCustomerName] = useState('')
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<VisaRow | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    const request = customerId
      ? listVisas({ search, status, page, customerId })
      : listVisaCustomers({ search, status, page })
    request
      .then((result) => {
        if (!active) return
        if (customerId) {
          const rows = result.rows as VisaRow[]
          setVisas(rows)
          setCustomers([])
          if (rows[0]) setCustomerName(displayName(rows[0].customer_name))
        } else {
          setCustomers(result.rows as VisaCustomerRow[])
          setVisas([])
          setCustomerName('')
        }
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
  }, [customerId, page, search, status, version])

  useEffect(() => {
    if (!confirm || pendingId) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setConfirm(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm, pendingId])

  function update(next: { q?: string; status?: string; page?: number; customer?: string | null }) {
    const query = new URLSearchParams()
    const q = next.q ?? search
    const nextStatus = next.status ?? status
    const nextCustomer = next.customer === undefined ? customerId : next.customer ?? ''
    const nextPage = next.page ?? 1
    if (q) query.set('q', q)
    if (nextStatus) query.set('status', nextStatus)
    if (nextCustomer) query.set('customer', nextCustomer)
    if (nextPage > 1) query.set('page', String(nextPage))
    setParams(query)
  }

  function openCustomer(customer: VisaCustomerRow) {
    setCustomerName(displayName(customer.customer_name))
    update({ customer: customer.customer_id, page: 1 })
  }

  async function remove(visa: VisaRow) {
    setPendingId(visa.id)
    setError(null)
    try {
      await deleteVisa(visa.id)
      setConfirm(null)
      setVersion((current) => current + 1)
    } catch (err) {
      setError(errorText(err))
      setConfirm(null)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div>
      {customerId ? (
        <BackLink to={backHref(search, status)}>العودة إلى العملاء</BackLink>
      ) : null}
      <PageHeader
        title={customerId ? (customerName || 'طلبات العميل') : 'طلبات التأشيرات'}
        description={customerId ? 'كل طلبات تأشيرة هذا العميل في جدول واحد.' : 'كل عميل يظهر مرة واحدة. اضغط الاسم لعرض كل طلباته.'}
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchForm
          initial={search}
          placeholder={customerId ? 'المرجع أو الاسم أو الجنسية' : 'اسم العميل أو الجوال أو المرجع'}
          onSearch={(q) => update({ q, customer: customerId || null })}
        />
        <FilterSelect
          label="حالة الطلب"
          value={status}
          onChange={(next) => update({ status: next, customer: customerId || null })}
          options={visaStatuses.filter((item) => item !== 'processing').map((item) => ({
            value: item,
            label: label.visa(item),
            tone: visaTone(item),
          }))}
        />
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      <DataShell>
        {loading ? <LoadingState plain /> : null}
        {!loading && !error && (customerId ? visas.length === 0 : customers.length === 0) ? (
          <EmptyState
            title={customerId ? 'لا توجد طلبات لهذا العميل' : 'لا توجد طلبات'}
            body={customerId ? 'جرّب حالة أو بحثاً آخر.' : 'ستظهر طلبات التأشيرة هنا عند إرسالها من حساب العميل.'}
          />
        ) : null}
        {!loading && !customerId && customers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-right text-sm">
              <thead className="bg-slate-50 text-muted">
                <tr>
                  {['العميل', 'الجوال', 'عدد الطلبات', 'آخر طلب', 'الحالة'].map((header) => (
                    <th key={header} className="px-4 py-3 font-medium">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.customer_id}
                    className="cursor-pointer border-t border-line hover:bg-slate-50"
                    onClick={() => openCustomer(customer)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-navy">{displayName(customer.customer_name)}</span>
                    </td>
                    <td className="px-4 py-3" dir="ltr">{customer.customer_mobile || '—'}</td>
                    <td className="px-4 py-3 tabular-nums" dir="ltr">{customer.visas_count.toLocaleString('en-GB')}</td>
                    <td className="whitespace-nowrap px-4 py-3" dir="ltr"><EnglishWhen value={customer.latest_created_at} /></td>
                    <td className="px-4 py-3"><Badge tone={visaTone(customer.latest_status)}>{label.visa(customer.latest_status)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!loading && customerId && visas.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-right text-sm">
              <thead className="bg-slate-50 text-muted">
                <tr>
                  {['المرجع', 'الاسم', 'الجنسية', 'تاريخ الطلب', 'الحالة', 'الإجراءات'].map((header) => (
                    <th key={header || 'actions'} className="px-4 py-3 font-medium">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visas.map((visa) => (
                  <tr key={visa.id} className="border-t border-line hover:bg-slate-50">
                    <td className="px-4 py-3"><Link className="font-medium text-navy" to={`/visas/${visa.id}`}>{visa.reference}</Link></td>
                    <td className="px-4 py-3">{displayName(visa.full_name)}</td>
                    <td className="px-4 py-3">{visa.nationality}</td>
                    <td className="whitespace-nowrap px-4 py-3" dir="ltr"><EnglishWhen value={visa.created_at} /></td>
                    <td className="px-4 py-3"><Badge tone={visaTone(visa.status)}>{label.visa(visa.status)}</Badge></td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        aria-label="حذف"
                        disabled={pendingId !== null}
                        onClick={() => setConfirm(visa)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!loading && !error ? (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPage={(next) => update({ page: next, customer: customerId || null })}
          />
        ) : null}
      </DataShell>
      {confirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4"
          onClick={() => { if (!pendingId) setConfirm(null) }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-visa-title"
            className="w-full max-w-sm rounded-2xl border border-line bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 id="delete-visa-title" className="text-base font-semibold text-navy">حذف الطلب</h4>
            <p className="mt-2 text-sm leading-6 text-muted">هل تريد حذف طلب التأشيرة {confirm.reference}؟</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" disabled={pendingId !== null} onClick={() => setConfirm(null)}>إلغاء</Button>
              <Button type="button" variant="danger" disabled={pendingId !== null} onClick={() => remove(confirm)}>
                {pendingId ? 'جارٍ الحذف...' : 'حذف'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function backHref(search: string, status: string) {
  const query = new URLSearchParams()
  if (search) query.set('q', search)
  if (status) query.set('status', status)
  const value = query.toString()
  return value ? `/visas?${value}` : '/visas'
}
