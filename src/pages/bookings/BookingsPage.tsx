import { useEffect, useState } from 'react'
import { ArrowRight, Trash2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { deleteBooking, listBookingCustomers, listBookings, type BookingCustomerRow, type BookingRow } from '../../lib/api'
import { pageSize } from '../../lib/config'
import { displayName, englishAmount, errorText } from '../../lib/format'
import { bookingStatuses, bookingTone, label } from '../../lib/labels'
import { Badge, Button, DataShell, EmptyState, EnglishWhen, ErrorBanner, FilterSelect, LoadingState, PageHeader, Pagination, SearchForm } from '../../components/ui'

export function BookingsPage() {
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const status = params.get('status') ?? ''
  const customerId = params.get('customer') ?? ''
  const page = Number(params.get('page') ?? '1') || 1
  const [customers, setCustomers] = useState<BookingCustomerRow[]>([])
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [customerName, setCustomerName] = useState('')
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<BookingRow | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    const request = customerId
      ? listBookings({ search, status, page, customerId })
      : listBookingCustomers({ search, status, page })
    request
      .then((result) => {
        if (!active) return
        if (customerId) {
          const rows = result.rows as BookingRow[]
          setBookings(rows)
          setCustomers([])
          if (rows[0]) setCustomerName(displayName(rows[0].customer_name))
        } else {
          setCustomers(result.rows as BookingCustomerRow[])
          setBookings([])
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

  function openCustomer(customer: BookingCustomerRow) {
    setCustomerName(displayName(customer.customer_name))
    update({ customer: customer.customer_id, page: 1 })
  }

  async function remove(booking: BookingRow) {
    setPendingId(booking.id)
    setError(null)
    try {
      await deleteBooking(booking.id)
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
      <PageHeader
        title={customerId ? (customerName || 'حجوزات العميل') : 'الحجوزات'}
        description={customerId ? 'كل حجوزات هذا العميل في جدول واحد.' : 'كل عميل يظهر مرة واحدة. اضغط الاسم لعرض كل حجوزاته.'}
        action={
          customerId ? (
            <Link
              to="/bookings"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-medium text-navy shadow-sm transition hover:border-gold hover:text-gold"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              العودة إلى الحجوزات
            </Link>
          ) : null
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchForm
          initial={search}
          placeholder={customerId ? 'المرجع أو البرنامج' : 'اسم العميل أو الجوال أو المرجع'}
          onSearch={(q) => update({ q, customer: customerId || null })}
        />
        <FilterSelect
          label="حالة الحجز"
          value={status}
          onChange={(next) => update({ status: next, customer: customerId || null })}
          options={bookingStatuses.map((item) => ({
            value: item,
            label: label.booking(item),
            tone: bookingTone(item),
          }))}
        />
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      <DataShell>
        {loading ? <LoadingState plain /> : null}
        {!loading && !error && (customerId ? bookings.length === 0 : customers.length === 0) ? (
          <EmptyState
            title={customerId ? 'لا توجد حجوزات لهذا العميل' : 'لا توجد حجوزات'}
            body={customerId ? 'جرّب حالة أو بحثاً آخر.' : 'ستظهر الحجوزات هنا عند إرسالها من حساب العميل.'}
          />
        ) : null}
        {!loading && !customerId && customers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-right text-sm">
              <thead className="bg-slate-50 text-muted">
                <tr>
                  {['العميل', 'الجوال', 'عدد الحجوزات', 'آخر حجز', 'الحالة'].map((header) => (
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
                      <Link
                        to={`/bookings?customer=${customer.customer_id}`}
                        className="font-medium text-navy hover:text-gold"
                        onClick={() => setCustomerName(displayName(customer.customer_name))}
                      >
                        {displayName(customer.customer_name)}
                      </Link>
                    </td>
                    <td className="px-4 py-3" dir="ltr">{customer.customer_mobile || '—'}</td>
                    <td className="px-4 py-3 tabular-nums" dir="ltr">{customer.bookings_count.toLocaleString('en-GB')}</td>
                    <td className="whitespace-nowrap px-4 py-3" dir="ltr"><EnglishWhen value={customer.latest_created_at} /></td>
                    <td className="px-4 py-3"><Badge tone={bookingTone(customer.latest_status)}>{label.booking(customer.latest_status)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!loading && customerId && bookings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-right text-sm">
              <thead className="bg-slate-50 text-muted">
                <tr>
                  {['المرجع', 'البرنامج', 'تاريخ الحجز', 'المسافرون', 'المبلغ', 'الحالة', 'الإجراءات'].map((header) => (
                    <th key={header} className="px-4 py-3 font-medium">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id} className="border-t border-line hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/bookings/${booking.id}`} className="font-medium text-navy">{booking.reference}</Link>
                    </td>
                    <td className="px-4 py-3">{booking.package_title_snapshot || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3" dir="ltr"><EnglishWhen value={booking.created_at} /></td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums" dir="ltr">{booking.travelers_count.toLocaleString('en-GB')}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-navy" dir="ltr">{englishAmount(booking.total_amount)}</td>
                    <td className="px-4 py-3"><Badge tone={bookingTone(booking.status)}>{label.booking(booking.status)}</Badge></td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        aria-label="حذف"
                        disabled={pendingId !== null}
                        onClick={() => setConfirm(booking)}
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
            aria-labelledby="delete-booking-title"
            className="w-full max-w-sm rounded-2xl border border-line bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 id="delete-booking-title" className="text-base font-semibold text-navy">حذف الحجز</h4>
            <p className="mt-2 text-sm leading-6 text-muted">هل تريد حذف الحجز {confirm.reference}؟</p>
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
