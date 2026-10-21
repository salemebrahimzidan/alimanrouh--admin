import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  customerBookingsForPayment,
  listCustomers,
  listOutstanding,
  listPayments,
  paymentSummary,
  recordPayment,
  voidPayment,
  type BalanceRow,
  type CustomerRow,
  type PaymentRow,
  type PaymentSummary,
} from '../../lib/api'
import { pageSize } from '../../lib/config'
import { displayName, errorText, formatDate, formatMoney } from '../../lib/format'
import { label, paymentMethods, type PaymentMethod } from '../../lib/labels'
import { Badge, Button, Card, DataShell, EmptyState, ErrorBanner, LoadingState, PageHeader, Pagination, TextAreaField, TextField } from '../../components/ui'

export function PaymentsPage() {
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [total, setTotal] = useState(0)
  const [outstanding, setOutstanding] = useState<BalanceRow[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([paymentSummary(), listPayments(page), listOutstanding()])
      .then(([summaryRow, paymentRows, balances]) => {
        if (!active) return
        setSummary(summaryRow)
        setPayments(paymentRows.rows)
        setTotal(paymentRows.total)
        setOutstanding(balances)
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
  }, [page, version])

  return (
    <div>
      <PageHeader title="المدفوعات" description="تسجيل المقبوضات يدوياً ومتابعة المتبقي. لا يوجد ربط مع بوابة دفع." />
      {error ? <div className="mb-4"><ErrorBanner message={error} /></div> : null}
      {loading && !summary ? <LoadingState /> : null}
      {summary ? (
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Metric title="إجمالي المقبوضات" value={formatMoney(summary.recorded_total)} />
          <Metric title="إجمالي المتبقي" value={formatMoney(summary.outstanding_total)} />
          <Metric title="عدد القيود المسجلة" value={summary.payments_count.toLocaleString('ar-SA')} />
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <PaymentForm onSaved={() => setVersion((current) => current + 1)} onError={setError} />
        </div>
        <Card className="xl:col-span-3">
          <h3 className="font-semibold text-navy">المتبقي على الحجوزات</h3>
          {loading ? <LoadingState /> : null}
          {!loading && !error && outstanding.length === 0 ? <EmptyState title="لا توجد مبالغ متبقية" /> : null}
          {!loading && outstanding.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="text-muted">
                  <tr>
                    {['الحجز', 'العميل', 'المتبقي'].map((header) => <th key={header} className="py-2 font-medium">{header}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {outstanding.map((row) => (
                    <tr key={row.id} className="border-t border-line">
                      <td className="py-2"><Link className="text-navy" to={`/bookings/${row.id}`}>{row.reference}</Link></td>
                      <td className="py-2">{displayName(row.customer_name)}</td>
                      <td className="py-2">{formatMoney(row.balance_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      </div>
      <div className="mt-6">
        <h3 className="mb-3 font-semibold text-navy">سجل المدفوعات</h3>
        <DataShell>
          {loading ? <LoadingState /> : null}
          {!loading && !error && payments.length === 0 ? <EmptyState title="لا توجد مدفوعات مسجلة" /> : null}
          {payments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-right text-sm">
                <thead className="bg-slate-50 text-muted">
                  <tr>
                    {['التاريخ', 'العميل', 'الحجز', 'الطريقة', 'المبلغ', 'الحالة', ''].map((header) => (
                      <th key={header} className="px-4 py-3 font-medium">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <PaymentLine key={payment.id} payment={payment} onChanged={() => setVersion((current) => current + 1)} onError={setError} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} />
        </DataShell>
      </div>
      {summary && summary.months.length > 0 ? (
        <Card className="mt-6">
          <h3 className="font-semibold text-navy">المقبوضات الشهرية</h3>
          <table className="mt-3 w-full text-right text-sm">
            <tbody>
              {summary.months.map((month) => (
                <tr key={month.month} className="border-t border-line">
                  <td className="py-2">{month.month}</td>
                  <td className="py-2">{month.payment_count.toLocaleString('ar-SA')} قيود</td>
                  <td className="py-2">{formatMoney(month.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  )
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <p className="text-sm text-muted">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-navy">{value}</p>
    </article>
  )
}

function PaymentForm({ onSaved, onError }: { onSaved: () => void; onError: (message: string) => void }) {
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [customerId, setCustomerId] = useState('')
  const [bookings, setBookings] = useState<BalanceRow[]>([])
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (query.trim().length < 2) {
      setCustomers([])
      return
    }
    let active = true
    listCustomers({ search: query, status: '', page: 1 })
      .then((result) => {
        if (active) setCustomers(result.rows)
      })
      .catch((err: unknown) => onError(errorText(err)))
    return () => {
      active = false
    }
  }, [onError, query])

  useEffect(() => {
    if (!customerId) {
      setBookings([])
      return
    }
    let active = true
    customerBookingsForPayment(customerId)
      .then((rows) => {
        if (active) setBookings(rows)
      })
      .catch((err: unknown) => onError(errorText(err)))
    return () => {
      active = false
    }
  }, [customerId, onError])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const amount = Number(form.get('amount'))
    const bookingId = String(form.get('booking_id') ?? '')
    if (!customerId || !Number.isFinite(amount) || amount <= 0) {
      onError('اختر العميل وأدخل مبلغاً أكبر من صفر.')
      return
    }
    setPending(true)
    try {
      await recordPayment({
        customerId,
        bookingId: bookingId || null,
        amount,
        method: String(form.get('method')) as PaymentMethod,
        paidOn: String(form.get('paid_on')),
        note: String(form.get('note') ?? ''),
      })
      event.currentTarget.reset()
      setQuery('')
      setCustomerId('')
      onSaved()
    } catch (err) {
      onError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <h3 className="font-semibold text-navy">تسجيل دفعة</h3>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <TextField label="بحث عن عميل" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="الاسم أو الجوال أو البريد" />
        {customers.length > 0 ? (
          <div className="max-h-40 overflow-auto rounded-lg border border-line">
            {customers.map((customer) => (
              <button
                type="button"
                key={customer.id}
                className={`block w-full px-3 py-2 text-right text-sm hover:bg-slate-50 ${customerId === customer.id ? 'bg-gold-soft' : ''}`}
                onClick={() => setCustomerId(customer.id)}
              >
                {displayName(customer.full_name)} · {customer.mobile || customer.email}
              </button>
            ))}
          </div>
        ) : null}
        <label className="block text-sm font-medium">
          الحجز
          <select name="booking_id" className="mt-1.5 h-11 w-full rounded-lg border border-line px-3" disabled={!customerId}>
            <option value="">بدون ربط بحجز</option>
            {bookings.map((booking) => (
              <option key={booking.id} value={booking.id}>
                {booking.reference} · المتبقي {formatMoney(Math.max(booking.balance_amount, 0))}
              </option>
            ))}
          </select>
        </label>
        <TextField label="المبلغ بالريال" name="amount" type="number" min="0.01" step="0.01" required />
        <label className="block text-sm font-medium">
          طريقة الدفع
          <select name="method" className="mt-1.5 h-11 w-full rounded-lg border border-line px-3" defaultValue="cash">
            {paymentMethods.map((method) => <option key={method} value={method}>{label.paymentMethod(method)}</option>)}
          </select>
        </label>
        <TextField label="تاريخ الدفع" name="paid_on" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
        <TextAreaField label="ملاحظة" name="note" rows={2} maxLength={500} />
        <Button type="submit" disabled={pending || !customerId}>{pending ? 'جارٍ الحفظ...' : 'تسجيل الدفعة'}</Button>
      </form>
    </Card>
  )
}

function PaymentLine({
  payment,
  onChanged,
  onError,
}: {
  payment: PaymentRow
  onChanged: () => void
  onError: (message: string) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)

  async function cancel() {
    setPending(true)
    try {
      await voidPayment(payment.id)
      setConfirming(false)
      onChanged()
    } catch (err) {
      onError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <tr className="border-t border-line">
      <td className="px-4 py-3">{formatDate(payment.paid_on)}</td>
      <td className="px-4 py-3">{displayName(payment.customer_name)}</td>
      <td className="px-4 py-3">{payment.booking_id ? <Link className="text-navy" to={`/bookings/${payment.booking_id}`}>{payment.booking_reference || 'الحجز'}</Link> : '—'}</td>
      <td className="px-4 py-3">{label.paymentMethod(payment.method)}</td>
      <td className="px-4 py-3">{formatMoney(payment.amount)}</td>
      <td className="px-4 py-3"><Badge tone={payment.status === 'recorded' ? 'success' : 'neutral'}>{label.payment(payment.status)}</Badge></td>
      <td className="px-4 py-3">
        {payment.status === 'recorded' && !confirming ? <button type="button" className="text-sm text-rose-700" onClick={() => setConfirming(true)}>إلغاء القيد</button> : null}
        {confirming ? (
          <span className="flex gap-2">
            <Button variant="danger" disabled={pending} onClick={cancel}>تأكيد</Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>تراجع</Button>
          </span>
        ) : null}
      </td>
    </tr>
  )
}
