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
import { displayName, errorText, formatDate, formatDateTime, formatMoney } from '../../lib/format'
import { accountTone, bookingTone, label, visaTone } from '../../lib/labels'
import { BackLink, Badge, Button, Card, EmptyState, ErrorBanner, LoadingState } from '../../components/ui'

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

  return (
    <div>
      <BackLink to="/customers">العودة إلى العملاء</BackLink>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-navy">{displayName(customer.full_name)}</h2>
            <p className="mt-2 text-sm text-muted">{customer.email || 'بدون بريد'} · {customer.mobile || 'بدون جوال'}</p>
            <p className="mt-1 text-sm text-muted">تاريخ التسجيل: {formatDateTime(customer.created_at)}</p>
          </div>
          <Badge tone={accountTone(customer.account_status)}>{label.account(customer.account_status)}</Badge>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {confirming ? (
            <>
              <Button variant="danger" disabled={pending} onClick={() => changeStatus(nextStatus)}>
                {pending ? 'جارٍ الحفظ...' : 'تأكيد تغيير الحالة'}
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                تراجع
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setConfirming(true)}>
              {nextStatus === 'suspended' ? 'إيقاف الحساب' : 'تنشيط الحساب'}
            </Button>
          )}
          <span className="text-sm text-muted">عدد الحجوزات: {customer.bookings_count.toLocaleString('ar-SA')}</span>
        </div>
        {error ? <div className="mt-4"><ErrorBanner message={error} /></div> : null}
      </Card>

      <Section title="سجل الحجوزات">
        {bookings.length === 0 ? <EmptyState title="لا توجد حجوزات لهذا العميل" /> : (
          <SimpleTable
            rows={bookings.map((booking) => (
              <tr key={booking.id} className="border-t border-line">
                <td className="px-4 py-3"><Link className="font-medium text-navy" to={`/bookings/${booking.id}`}>{booking.reference}</Link></td>
                <td className="px-4 py-3">{booking.package_title_snapshot || '—'}</td>
                <td className="px-4 py-3">{formatDate(booking.created_at)}</td>
                <td className="px-4 py-3">{formatMoney(booking.total_amount)}</td>
                <td className="px-4 py-3"><Badge tone={bookingTone(booking.status)}>{label.booking(booking.status)}</Badge></td>
              </tr>
            ))}
            headers={['المرجع', 'البرنامج', 'تاريخ الحجز', 'المبلغ', 'الحالة']}
          />
        )}
      </Section>

      <Section title="طلبات التأشيرات">
        {visas.length === 0 ? <EmptyState title="لا توجد طلبات تأشيرة" /> : (
          <SimpleTable
            headers={['المرجع', 'الاسم', 'الجنسية', 'تاريخ الطلب', 'الحالة']}
            rows={visas.map((visa) => (
              <tr key={visa.id} className="border-t border-line">
                <td className="px-4 py-3"><Link className="font-medium text-navy" to={`/visas/${visa.id}`}>{visa.reference}</Link></td>
                <td className="px-4 py-3">{visa.full_name}</td>
                <td className="px-4 py-3">{visa.nationality}</td>
                <td className="px-4 py-3">{formatDateTime(visa.created_at)}</td>
                <td className="px-4 py-3"><Badge tone={visaTone(visa.status)}>{label.visa(visa.status)}</Badge></td>
              </tr>
            ))}
          />
        )}
      </Section>

      <Section title="المستندات">
        {documents.length === 0 ? <EmptyState title="لا توجد مستندات مرفوعة" /> : (
          <ul className="divide-y divide-line">
            {documents.map((document) => (
              <li key={document.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-navy">{document.file_name}</p>
                  <p className="text-xs text-muted">{formatDateTime(document.created_at)}</p>
                </div>
                <Button variant="secondary" onClick={() => openDocument(document.storage_path).catch((err) => setError(errorText(err)))}>
                  عرض
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="mb-3 font-semibold text-navy">{title}</h3>
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">{children}</div>
    </div>
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
