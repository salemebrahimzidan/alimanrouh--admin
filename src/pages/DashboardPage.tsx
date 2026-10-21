import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Card, EmptyState, ErrorBanner, LoadingState, PageHeader } from '../components/ui'
import { dashboardData, type DashboardData } from '../lib/api'
import { formatDateTime, formatMoney, displayName, errorText } from '../lib/format'
import { bookingTone, label } from '../lib/labels'

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    dashboardData()
      .then((result) => {
        if (!active) return
        setData(result)
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
      <PageHeader title="الرئيسية" description="أرقام التشغيل تُقرأ مباشرة من قاعدة البيانات، وتبقى فارغة إلى أن تكتمل التهيئة." />
      {loading ? <LoadingState /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="العملاء المسجلون" value={data.customers.toLocaleString('ar-SA')} hint="يشمل كل حساب مسجّل حتى بدون حجز" />
            <Stat label="الحجوزات" value={data.bookings.toLocaleString('ar-SA')} hint={`${data.pending.toLocaleString('ar-SA')} قيد الانتظار`} />
            <Stat label="طلبات التأشيرات" value={data.visas.toLocaleString('ar-SA')} />
            <Stat label="المدفوعات المسجلة" value={data.payments.toLocaleString('ar-SA')} />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Stat label="قيد الانتظار" value={data.pending.toLocaleString('ar-SA')} />
            <Stat label="قيد المراجعة" value={data.underReview.toLocaleString('ar-SA')} />
            <Stat label="مؤكدة" value={data.confirmed.toLocaleString('ar-SA')} />
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-navy">أحدث الحجوزات</h3>
                <Link to="/bookings" className="text-sm text-navy">
                  عرض الكل
                </Link>
              </div>
              {data.recentBookings.length === 0 ? (
                <EmptyState title="لا توجد حجوزات بعد" body="ستظهر هنا الحجوزات التي يرسلها العملاء من الموقع." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {data.recentBookings.map((booking) => (
                        <tr key={booking.id} className="border-t border-line">
                          <td className="py-3">
                            <Link to={`/bookings/${booking.id}`} className="font-medium text-navy">
                              {booking.reference}
                            </Link>
                            <p className="mt-1 text-muted">{displayName(booking.customer_name)}</p>
                          </td>
                          <td className="py-3 text-muted">{formatMoney(booking.total_amount)}</td>
                          <td className="py-3">
                            <Badge tone={bookingTone(booking.status)}>{label.booking(booking.status)}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card className="xl:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-navy">أحدث العملاء</h3>
                <Link to="/customers" className="text-sm text-navy">
                  عرض الكل
                </Link>
              </div>
              {data.recentCustomers.length === 0 ? (
                <EmptyState title="لا يوجد عملاء مسجلون" body="يظهر العميل هنا فور إنشاء حسابه، حتى لو لم يحجز." />
              ) : (
                <ul>
                  {data.recentCustomers.map((customer) => (
                    <li key={customer.id} className="border-t border-line py-3">
                      <Link to={`/customers/${customer.id}`} className="font-medium text-navy">
                        {displayName(customer.full_name)}
                      </Link>
                      <p className="mt-1 text-xs text-muted">
                        {customer.mobile || '—'} · {formatDateTime(customer.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}

function Stat({ label: title, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <article className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <p className="text-sm text-muted">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-navy">{value}</p>
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </article>
  )
}
