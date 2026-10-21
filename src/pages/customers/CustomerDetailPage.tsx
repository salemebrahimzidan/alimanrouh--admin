import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getCustomer,
  listCustomerBookings,
  listCustomerVisas,
  listDocuments,
  openDocument,
  setAccountStatus,
  type BookingRow,
  type CustomerRow,
  type DocumentRow,
  type VisaRow,
} from '../../lib/api'
import { displayName, englishAmount, errorText } from '../../lib/format'
import { accountTone, bookingTone, label, visaTone } from '../../lib/labels'
import { BackLink, Badge, Button, DataShell, EmptyState, EnglishWhen, ErrorBanner, LoadingState } from '../../components/ui'

export function CustomerDetailPage() {
  const { id = '' } = useParams()
  const [customer, setCustomer] = useState<CustomerRow | null>(null)
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [visas, setVisas] = useState<VisaRow[]>([])
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    getCustomer(id)
      .then(async (profile) => {
        if (!active) return
        setCustomer(profile)
        setError(null)
        if (!profile) {
          setBookings([])
          setVisas([])
          setDocuments([])
          return
        }
        const [bookingRows, visaRows, documentRows] = await Promise.all([
          listCustomerBookings(id),
          listCustomerVisas(id),
          listDocuments(id),
        ])
        if (!active) return
        setBookings(bookingRows)
        setVisas(visaRows)
        setDocuments(documentRows)
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
  }, [id, version])

  async function changeStatus(status: 'active' | 'suspended') {
    setPending(true)
    setError(null)
    try {
      await setAccountStatus(id, status)
      setConfirming(false)
      setVersion((current) => current + 1)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  if (loading) return <LoadingState />
  if (error && !customer) return <ErrorBanner message={error} />
  if (!customer) {
    return (
      <div>
        <BackLink to="/customers">العودة إلى العملاء</BackLink>
        <EmptyState title="العميل غير موجود" body="قد يكون الحساب حساب إدارة، أو أن الرابط غير صحيح." />
      </div>
    )
  }

  const nextStatus = customer.account_status === 'suspended' ? 'active' : 'suspended'
  const initial = displayName(customer.full_name).trim().charAt(0) || '؟'

  return (
    <div className="min-w-0 space-y-5">
      <BackLink to="/customers">العودة إلى العملاء</BackLink>
      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold-soft text-sm font-semibold text-navy">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-navy">{displayName(customer.full_name)}</h2>
              <Badge tone={accountTone(customer.account_status)}>{label.account(customer.account_status)}</Badge>
            </div>
          </div>
          {confirming ? null : (
            <Button variant="secondary" className="h-9 px-3" onClick={() => setConfirming(true)}>
              {nextStatus === 'suspended' ? 'إيقاف الحساب' : 'تنشيط الحساب'}
            </Button>
          )}
        </div>
        <dl className="grid grid-cols-2 border-t border-line sm:grid-cols-4">
          <Detail label="البريد" dir="ltr">{customer.email || '—'}</Detail>
          <Detail label="الجوال" dir="ltr">{customer.mobile || '—'}</Detail>
          <Detail label="تاريخ التسجيل" dir="ltr"><EnglishWhen value={customer.created_at} inline /></Detail>
          <Detail label="الحجوزات" dir="ltr">{customer.bookings_count.toLocaleString('en-GB')}</Detail>
        </dl>
        {confirming ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-rose-50 px-4 py-2.5">
            <p className="text-sm text-rose-800">
              {nextStatus === 'suspended' ? 'إيقاف الحساب يمنع العميل من إرسال حجوزات جديدة.' : 'تنشيط الحساب يعيد للعميل إمكانية الحجز.'}
            </p>
            <div className="flex gap-2">
              <Button variant="danger" className="h-9 px-3" disabled={pending} onClick={() => changeStatus(nextStatus)}>
                {pending ? 'جارٍ الحفظ...' : 'تأكيد'}
              </Button>
              <Button variant="secondary" className="h-9 px-3" onClick={() => setConfirming(false)}>تراجع</Button>
            </div>
          </div>
        ) : null}
        {error ? <div className="px-4 pb-3"><ErrorBanner message={error} /></div> : null}
      </section>

      <RecordPanel title="سجل الحجوزات" count={bookings.length} empty={bookings.length === 0} emptyText="لا توجد حجوزات لهذا العميل">
        <SimpleTable
          rows={bookings.map((booking) => (
            <tr key={booking.id} className="border-t border-line hover:bg-slate-50">
              <td className="px-4 py-3"><Link className="font-medium text-navy" to={`/bookings/${booking.id}`}>{booking.reference}</Link></td>
              <td className="px-4 py-3">{booking.package_title_snapshot || '—'}</td>
              <td className="whitespace-nowrap px-4 py-3" dir="ltr"><EnglishWhen value={booking.created_at} /></td>
              <td className="px-4 py-3 font-medium tabular-nums text-navy" dir="ltr">{englishAmount(booking.total_amount)}</td>
              <td className="px-4 py-3"><Badge tone={bookingTone(booking.status)}>{label.booking(booking.status)}</Badge></td>
            </tr>
          ))}
          headers={['المرجع', 'البرنامج', 'تاريخ الحجز', 'المبلغ', 'الحالة']}
        />
      </RecordPanel>

      <div className="grid min-w-0 gap-5">
        <RecordPanel title="طلبات التأشيرات" count={visas.length} empty={visas.length === 0} emptyText="لا توجد طلبات تأشيرة">
          <SimpleTable
            headers={['المرجع', 'الاسم', 'الجنسية', 'تاريخ الطلب', 'الحالة']}
            rows={visas.map((visa) => (
              <tr key={visa.id} className="border-t border-line hover:bg-slate-50">
                <td className="px-4 py-3"><Link className="font-medium text-navy" to={`/visas/${visa.id}`}>{visa.reference}</Link></td>
                <td className="px-4 py-3">{visa.full_name}</td>
                <td className="px-4 py-3">{visa.nationality}</td>
                <td className="whitespace-nowrap px-4 py-3" dir="ltr"><EnglishWhen value={visa.created_at} /></td>
                <td className="px-4 py-3"><Badge tone={visaTone(visa.status)}>{label.visa(visa.status)}</Badge></td>
              </tr>
            ))}
          />
        </RecordPanel>
        <RecordPanel title="المستندات" count={documents.length} empty={documents.length === 0} emptyText="لا توجد مستندات مرفوعة">
          <ul className="divide-y divide-line">
            {documents.map((document) => (
              <li key={document.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-navy">{document.file_name}</p>
                  <div className="text-muted" dir="ltr"><EnglishWhen value={document.created_at} /></div>
                </div>
                <Button variant="secondary" onClick={() => openDocument(document.storage_path).catch((err) => setError(errorText(err)))}>
                  عرض
                </Button>
              </li>
            ))}
          </ul>
        </RecordPanel>
      </div>
    </div>
  )
}

function Detail({ label: title, dir, children }: { label: string; dir?: 'ltr'; children: ReactNode }) {
  return (
    <div className="min-w-0 border-line px-3 py-2 [&:not(:last-child)]:border-e">
      <dt className="text-[11px] text-muted">{title}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-navy"><span dir={dir}>{children}</span></dd>
    </div>
  )
}

function RecordPanel({
  title,
  count,
  empty,
  emptyText,
  children,
}: {
  title: string
  count: number
  empty: boolean
  emptyText: string
  children: ReactNode
}) {
  return (
    <DataShell>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h3 className="font-semibold text-navy">{title}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-navy" dir="ltr">{count.toLocaleString('en-GB')}</span>
      </div>
      {empty ? <p className="px-4 py-4 text-sm text-muted">{emptyText}</p> : children}
    </DataShell>
  )
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-right text-sm">
        <thead className="bg-slate-50 text-muted">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 font-medium">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  )
}
