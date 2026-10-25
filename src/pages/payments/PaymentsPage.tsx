import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, Calendar, Receipt, Search, Trash2, Wallet, type LucideIcon } from 'lucide-react'
import {
  customerBookingsForPayment,
  deletePayment,
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
import { displayName, englishAmount, errorText } from '../../lib/format'
import { label, paymentMethods, type PaymentMethod } from '../../lib/labels'
import { Badge, Button, Card, DataShell, EmptyState, ErrorBanner, LoadingState, PageHeader, Pagination, SelectField, TextAreaField, TextField } from '../../components/ui'

export function PaymentsPage() {
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [total, setTotal] = useState(0)
  const [outstanding, setOutstanding] = useState<BalanceRow[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [confirm, setConfirm] = useState<PaymentRow | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

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

  useEffect(() => {
    if (!confirm || pendingId) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setConfirm(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm, pendingId])

  async function remove(payment: PaymentRow) {
    setPendingId(payment.id)
    setError(null)
    try {
      await deletePayment(payment.id)
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
      <PageHeader title="المدفوعات" description="تسجيل المقبوضات يدوياً ومتابعة المتبقي. لا يوجد ربط مع بوابة دفع." />
      {error ? <div className="mb-6"><ErrorBanner message={error} /></div> : null}
      {loading && !summary ? <LoadingState /> : null}
      {summary ? (
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Metric icon={Wallet} title="إجمالي المقبوضات" value={money(summary.recorded_total)} surface="bg-emerald-50" iconClass="bg-emerald-100 text-emerald-700" />
          <Metric icon={Receipt} title="إجمالي المتبقي" value={money(summary.outstanding_total)} surface="bg-amber-50" iconClass="bg-amber-100 text-amber-800" />
          <Metric icon={Banknote} title="عدد القيود المسجلة" value={summary.payments_count.toLocaleString('en-GB')} surface="bg-sky-50" iconClass="bg-sky-100 text-sky-700" />
        </div>
      ) : null}
      <div className="mb-6 grid items-start gap-6 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <PaymentForm onSaved={() => setVersion((current) => current + 1)} onError={setError} />
        </div>
        <div className="xl:col-span-3">
        <DataShell>
          <div className="border-b border-line px-5 py-4">
            <h3 className="font-semibold text-navy">المتبقي على الحجوزات</h3>
            <p className="mt-1 text-sm text-muted">الحجوزات التي ما زال عليها مبلغ.</p>
          </div>
          {loading ? <LoadingState plain /> : null}
          {!loading && !error && outstanding.length === 0 ? <EmptyState title="لا توجد مبالغ متبقية" body="ستظهر الحجوزات هنا عندما يبقى عليها رصيد." /> : null}
          {!loading && outstanding.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-right text-sm">
                <thead className="bg-slate-50 text-muted">
                  <tr>
                    {['الحجز', 'العميل', 'المتبقي'].map((header) => <th key={header} className="px-4 py-3 font-medium">{header}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {outstanding.map((row) => (
                    <tr key={row.id} className="border-t border-line hover:bg-slate-50">
                      <td className="px-4 py-3"><Link className="font-medium text-navy" to={`/bookings/${row.id}`}>{row.reference}</Link></td>
                      <td className="px-4 py-3">{displayName(row.customer_name)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-navy" dir="ltr">{money(row.balance_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </DataShell>
        </div>
      </div>
      <div className={summary && summary.months.length > 0 ? 'mb-6' : undefined}>
      <DataShell>
        <div className="border-b border-line px-5 py-4">
          <h3 className="font-semibold text-navy">سجل المدفوعات</h3>
        </div>
        {loading ? <LoadingState plain /> : null}
        {!loading && !error && payments.length === 0 ? <EmptyState title="لا توجد مدفوعات مسجلة" body="سجّل أول دفعة من النموذج أعلاه." /> : null}
        {payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-right text-sm">
              <thead className="bg-slate-50 text-muted">
                <tr>
                  {['التاريخ', 'العميل', 'الحجز', 'الطريقة', 'المبلغ', 'الحالة', 'الإجراءات'].map((header) => (
                    <th key={header} className="px-4 py-3 font-medium">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <PaymentLine
                    key={payment.id}
                    payment={payment}
                    onChanged={() => setVersion((current) => current + 1)}
                    onError={setError}
                    onDelete={() => setConfirm(payment)}
                    deletePending={pendingId !== null}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!loading && !error ? <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} /> : null}
      </DataShell>
      </div>
      {summary && summary.months.length > 0 ? (
        <DataShell>
          <div className="border-b border-line px-5 py-4">
            <h3 className="font-semibold text-navy">المقبوضات الشهرية</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-muted">
                <tr>
                  {['الشهر', 'القيود', 'المبلغ'].map((header) => <th key={header} className="px-4 py-3 font-medium">{header}</th>)}
                </tr>
              </thead>
              <tbody>
                {summary.months.map((month) => (
                  <tr key={month.month} className="border-t border-line">
                    <td className="px-4 py-3" dir="ltr">{month.month}</td>
                    <td className="px-4 py-3 tabular-nums" dir="ltr">{month.payment_count.toLocaleString('en-GB')}</td>
                    <td className="px-4 py-3 font-medium tabular-nums text-navy" dir="ltr">{money(month.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataShell>
      ) : null}
      {confirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4"
          onClick={() => { if (!pendingId) setConfirm(null) }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-payment-title"
            className="w-full max-w-sm rounded-2xl border border-line bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 id="delete-payment-title" className="text-base font-semibold text-navy">حذف الدفعة</h4>
            <p className="mt-2 text-sm leading-6 text-muted">
              هل تريد حذف دفعة {displayName(confirm.customer_name)} بمبلغ {money(confirm.amount)}؟
            </p>
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

function money(value: number) {
  return englishAmount(value)
}

function todayValue() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function englishDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value || '—'
  return `${match[3]}/${match[2]}/${match[1]}`
}

function Metric({ icon: Icon, title, value, surface, iconClass }: { icon: LucideIcon; title: string; value: string; surface: string; iconClass: string }) {
  return (
    <article className={`rounded-2xl border border-line p-5 shadow-sm ${surface}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{title}</p>
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-navy" dir="ltr">{value}</p>
    </article>
  )
}

function PaymentForm({ onSaved, onError }: { onSaved: () => void; onError: (message: string) => void }) {
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [customer, setCustomer] = useState<CustomerRow | null>(null)
  const [bookings, setBookings] = useState<BalanceRow[]>([])
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const customerId = customer?.id ?? ''

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
    const form = event.currentTarget
    const data = new FormData(form)
    const amount = Number(data.get('amount'))
    const bookingId = String(data.get('booking_id') ?? '')
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
        method: String(data.get('method')) as PaymentMethod,
        paidOn: String(data.get('paid_on')),
        note,
      })
      form.reset()
      setQuery('')
      setNote('')
      setCustomer(null)
      onSaved()
    } catch (err) {
      onError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-navy">تسجيل دفعة</h3>
          <p className="mt-1 text-sm text-muted">اختر العميل، ثم سجّل المبلغ واربطه بحجز عند الحاجة.</p>
        </div>
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-navy">
          <Wallet className="h-5 w-5" aria-hidden="true" />
        </span>
      </header>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextField label="بحث عن عميل" icon={<Search className="h-4 w-4" />} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="الاسم أو الجوال أو البريد" />
        </div>
        {customer ? (
          <p className="rounded-xl bg-gold-soft px-3 py-2 text-sm font-medium text-navy sm:col-span-2">
            {displayName(customer.full_name)} · {customer.mobile || customer.email || '—'}
          </p>
        ) : null}
        {customers.length > 0 ? (
          <div className="max-h-40 overflow-auto rounded-xl border border-line sm:col-span-2">
            {customers.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`block w-full px-3 py-2 text-right text-sm hover:bg-slate-50 ${customerId === item.id ? 'bg-gold-soft font-medium text-navy' : ''}`}
                onClick={() => {
                  setCustomer(item)
                  setQuery('')
                }}
              >
                {displayName(item.full_name)} · {item.mobile || item.email}
              </button>
            ))}
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <SelectField label="الحجز" name="booking_id" disabled={!customerId}>
            <option value="">بدون ربط بحجز</option>
            {bookings.map((booking) => (
              <option key={booking.id} value={booking.id}>
                {booking.reference} · {money(Math.max(booking.balance_amount, 0))}
              </option>
            ))}
          </SelectField>
        </div>
        <TextField label="المبلغ بالريال" name="amount" type="number" min="0.01" step="0.01" placeholder="مثال: 500" required />
        <TextField label="تاريخ الدفع" name="paid_on" type="date" icon={<Calendar className="h-4 w-4" />} required defaultValue={todayValue()} />
        <div className="sm:col-span-2">
          <SelectField label="طريقة الدفع" name="method" defaultValue="cash">
            {paymentMethods.map((method) => <option key={method} value={method}>{label.paymentMethod(method)}</option>)}
          </SelectField>
        </div>
        <div className="sm:col-span-2">
          <TextAreaField label="ملاحظة" name="note" rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="ملاحظة داخلية عن الدفعة" />
        </div>
        <Button type="submit" className="h-11 rounded-xl" disabled={pending || !customerId}>{pending ? 'جارٍ الحفظ...' : 'تسجيل الدفعة'}</Button>
      </form>
    </Card>
  )
}

function PaymentLine({
  payment,
  onChanged,
  onError,
  onDelete,
  deletePending,
}: {
  payment: PaymentRow
  onChanged: () => void
  onError: (message: string) => void
  onDelete: () => void
  deletePending: boolean
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
    <tr className="border-t border-line hover:bg-slate-50">
      <td className="whitespace-nowrap px-4 py-3 tabular-nums" dir="ltr">{englishDay(payment.paid_on)}</td>
      <td className="px-4 py-3">{displayName(payment.customer_name)}</td>
      <td className="px-4 py-3">{payment.booking_id ? <Link className="font-medium text-navy" to={`/bookings/${payment.booking_id}`}>{payment.booking_reference || 'الحجز'}</Link> : '—'}</td>
      <td className="px-4 py-3">{label.paymentMethod(payment.method)}</td>
      <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-navy" dir="ltr">{money(payment.amount)}</td>
      <td className="px-4 py-3"><Badge tone={payment.status === 'recorded' ? 'success' : 'neutral'}>{label.payment(payment.status)}</Badge></td>
      <td className="px-4 py-3">
        {confirming ? (
          <span className="flex gap-2">
            <Button variant="danger" disabled={pending} onClick={cancel}>تأكيد</Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>تراجع</Button>
          </span>
        ) : (
          <span className="flex items-center gap-2">
            {payment.status === 'recorded' ? (
              <button type="button" className="text-sm text-rose-700" onClick={() => setConfirming(true)}>إلغاء القيد</button>
            ) : null}
            <button
              type="button"
              aria-label="حذف"
              disabled={deletePending}
              onClick={onDelete}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
        )}
      </td>
    </tr>
  )
}
