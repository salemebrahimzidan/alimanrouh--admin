import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, CalendarDays, FileText, Users, Wallet, type LucideIcon } from 'lucide-react'
import { Badge, DataShell, EmptyState, EnglishWhen, ErrorBanner, LoadingState, cx } from '../components/ui'
import { Skeleton } from '@/components/ui/skeleton'
import { dashboardData, type DashboardData } from '../lib/api'
import { displayName, englishAmount, errorText } from '../lib/format'
import { accountTone, bookingTone, label } from '../lib/labels'
import { agencyName } from '../lib/config'

const windowDays = [7, 30] as const

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState<(typeof windowDays)[number]>(30)

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

  const today = useMemo(() => new Date(), [])

  return (
    <div className="space-y-6 lg:w-4/5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-navy">مرحباً بك في لوحة التحكم</h2>
          <p className="mt-1 text-sm text-muted">نظرة عامة على نشاط {agencyName} اليوم</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-navy">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-navy">{longDate(today)}</p>
            <p className="mt-0.5 text-xs text-muted">{hijriDate(today)}</p>
          </div>
        </div>
      </section>

      {loading ? (
        <div role="status" aria-busy="true" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <Skeleton className="h-7 w-14 rounded-lg" />
                </div>
                <Skeleton className="mt-4 h-2.5 w-28 rounded-full" />
                <Skeleton className="mt-2 h-2 w-36 rounded-full" />
              </div>
            ))}
          </div>
          <LoadingState />
        </div>
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              to="/bookings"
              icon={CalendarCheck}
              label="الحجوزات"
              hint="كل الحجوزات الواردة من العملاء"
              value={data.bookings}
              dates={data.bookingCreatedAt}
              surface="bg-violet-50"
              iconClass="bg-violet-100 text-violet-700"
              stroke="#7c3aed"
            />
            <MetricCard
              to="/customers"
              icon={Users}
              label="العملاء المسجلون"
              hint="يشمل كل حساب مسجل حتى بدون حجز"
              value={data.customers}
              dates={data.customerCreatedAt}
              surface="bg-sky-50"
              iconClass="bg-sky-100 text-sky-700"
              stroke="#2563eb"
            />
            <MetricCard
              to="/payments"
              icon={Wallet}
              label="المدفوعات المسجلة"
              hint="قيود المقبوضات غير المعلقة"
              value={data.payments}
              dates={data.paymentCreatedAt}
              surface="bg-amber-50"
              iconClass="bg-amber-100 text-amber-800"
              stroke="#d97706"
            />
            <MetricCard
              to="/visas"
              icon={FileText}
              label="طلبات التأشيرات"
              hint="طلبات المتابعة الداخلية للتأشيرة"
              value={data.visas}
              dates={data.visaCreatedAt}
              surface="bg-emerald-50"
              iconClass="bg-emerald-100 text-emerald-700"
              stroke="#16a34a"
            />
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-5">
            <StatusCard data={data} />
            <TrendCard dates={data.bookingCreatedAt} days={days} onDays={setDays} />
          </div>

          <div className="grid min-w-0 gap-4">
            <RecentCustomers customers={data.recentCustomers} />
            <RecentBookings bookings={data.recentBookings} />
          </div>
        </>
      ) : null}
    </div>
  )
}

function MetricCard({
  to,
  icon: Icon,
  label: title,
  hint,
  value,
  dates,
  surface,
  iconClass,
  stroke,
}: {
  to: string
  icon: LucideIcon
  label: string
  hint: string
  value: number
  dates: string[]
  surface: string
  iconClass: string
  stroke: string
}) {
  const series = dailyCounts(dates, 30)
  const recent = series.reduce((sum, item) => sum + item, 0)
  const previous = dailyCounts(dates, 60).slice(0, 30).reduce((sum, item) => sum + item, 0)
  const change = changeText(recent, previous)
  return (
    <Link to={to} className={cx('flex min-h-[168px] flex-col rounded-2xl border border-white p-4 shadow-sm transition hover:shadow-md', surface)}>
      <div className="flex items-center gap-3">
        <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', iconClass)}>
          <Icon className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-navy">{title}</p>
      </div>
      <p className="mt-3 text-3xl font-semibold leading-none text-navy">{statNumber(value)}</p>
      <p className="mt-2 text-xs text-muted">{hint}</p>
      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <p dir="ltr" className={cx('text-xs font-medium', change.tone)} title="مقارنة آخر 30 يوماً بالثلاثين يوماً السابقة">
          {change.label}
        </p>
        <Sparkline values={series} stroke={stroke} />
      </div>
    </Link>
  )
}

function StatusCard({ data }: { data: DashboardData }) {
  const slices = [
    { label: 'مؤكدة', value: data.confirmed, color: '#22c55e', to: '/bookings?status=confirmed' },
    { label: 'قيد المراجعة', value: data.underReview, color: '#3b82f6', to: '/bookings?status=under_review' },
    { label: 'قيد الانتظار', value: data.pending, color: '#f5b942', to: '/bookings?status=pending' },
    { label: 'مكتملة', value: data.completed, color: '#0f766e', to: '/bookings?status=completed' },
    { label: 'ملغاة', value: data.cancelled, color: '#ef4444', to: '/bookings?status=cancelled' },
  ].filter((slice) => slice.label !== 'مكتملة' || slice.value > 0)

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm xl:col-span-2">
      <h3 className="font-semibold text-navy">حالات الحجوزات</h3>
      <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between">
        <ul className="w-full space-y-2 text-sm">
          {slices.map((slice) => (
            <li key={slice.label}>
              <Link to={slice.to} className="flex items-center justify-between gap-3 rounded-lg px-1 py-1 hover:bg-slate-50">
                <span className="flex items-center gap-2 text-muted">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                  {slice.label}
                </span>
                <span className="font-medium text-navy">{statNumber(slice.value)}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Donut total={data.bookings} parts={slices.map((slice) => ({ value: slice.value, color: slice.color }))} />
      </div>
    </section>
  )
}

function TrendCard({
  dates,
  days,
  onDays,
}: {
  dates: string[]
  days: (typeof windowDays)[number]
  onDays: (days: (typeof windowDays)[number]) => void
}) {
  const series = dailyCounts(dates, days)
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-sm xl:col-span-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-navy">الحجوزات خلال الفترة</h3>
        <div className="flex rounded-xl border border-line bg-slate-50 p-1" role="group" aria-label="الفترة">
          {windowDays.map((option) => {
            const selected = option === days
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => onDays(option)}
                className={cx(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                  selected ? 'bg-white text-navy shadow-sm' : 'text-muted hover:text-navy',
                )}
              >
                آخر {statNumber(option)} يوم
              </button>
            )
          })}
        </div>
      </div>
      <TrendChart values={series} />
    </section>
  )
}

function RecentCustomers({ customers }: { customers: DashboardData['recentCustomers'] }) {
  return (
    <section className="min-w-0">
      <DataShell>
        <div className="border-b border-line px-4 py-3">
          <h3 className="font-semibold text-navy">أحدث العملاء</h3>
        </div>
        {customers.length === 0 ? (
          <EmptyState title="لا يوجد عملاء مسجلون" body="يظهر العميل هنا فور إنشاء حسابه." />
        ) : (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-muted">
                <tr>
                  {['اسم العميل', 'الجوال', 'البريد', 'تاريخ التسجيل', 'عدد الحجوزات', 'حالة الحساب'].map((header) => (
                    <th key={header} className="whitespace-nowrap px-4 py-3 font-medium">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-t border-line hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link to={`/customers/${customer.id}`} className="font-medium text-navy">{displayName(customer.full_name)}</Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{customer.mobile || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">{customer.email || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3" dir="ltr"><EnglishWhen value={customer.created_at} /></td>
                    <td className="whitespace-nowrap px-4 py-3" dir="ltr">{customer.bookings_count.toLocaleString('en-GB')}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={accountTone(customer.account_status)}>{label.account(customer.account_status)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataShell>
    </section>
  )
}

function RecentBookings({ bookings }: { bookings: DashboardData['recentBookings'] }) {
  return (
    <section className="min-w-0">
      <DataShell>
        <div className="border-b border-line px-4 py-3">
          <h3 className="font-semibold text-navy">أحدث الحجوزات</h3>
        </div>
        {bookings.length === 0 ? (
          <EmptyState title="لا توجد حجوزات بعد" body="ستظهر هنا الحجوزات التي يرسلها العملاء." />
        ) : (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-muted">
                <tr>
                  {['المرجع', 'العميل', 'البرنامج', 'تاريخ الحجز', 'المسافرون', 'المبلغ', 'الحالة'].map((header) => (
                    <th key={header} className="whitespace-nowrap px-4 py-3 font-medium">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id} className="border-t border-line hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link to={`/bookings/${booking.id}`} className="font-medium text-navy">{booking.reference}</Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{displayName(booking.customer_name)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{booking.package_title_snapshot || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3" dir="ltr"><EnglishWhen value={booking.created_at} /></td>
                    <td className="whitespace-nowrap px-4 py-3">{booking.travelers_count.toLocaleString('ar-SA')}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-navy" dir="ltr">{englishAmount(booking.total_amount)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={bookingTone(booking.status)}>{label.booking(booking.status)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataShell>
    </section>
  )
}

function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  const width = 112
  const height = 36
  const max = Math.max(1, ...values)
  const step = values.length > 1 ? width / (values.length - 1) : width
  const points = values.map((value, index) => {
    const x = index * step
    const y = height - 4 - (value / max) * (height - 8)
    return [x, y] as const
  })
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0].toFixed(1)},${point[1].toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-28" aria-hidden="true">
      <path d={area} fill={stroke} opacity="0.16" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function Donut({ total, parts }: { total: number; parts: { value: number; color: string }[] }) {
  const radius = 48
  const circumference = 2 * Math.PI * radius
  const active = parts.filter((part) => part.value > 0)
  const sum = active.reduce((count, part) => count + part.value, 0)
  let cursor = 0
  const rings = active.length > 0 ? active : [{ value: 1, color: '#e5eaf1' }]
  const base = active.length > 0 ? sum : 1
  return (
    <svg viewBox="0 0 140 140" className="h-40 w-40 shrink-0" role="img" aria-label={`إجمالي الحجوزات ${statNumber(total)}`}>
      <g transform="rotate(-90 70 70)">
        {rings.map((part) => {
          const length = (part.value / base) * circumference
          const ring = (
            <circle
              key={`${part.color}-${cursor}`}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={part.color}
              strokeWidth="14"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-cursor}
            />
          )
          cursor += length
          return ring
        })}
      </g>
      <text x="70" y="68" textAnchor="middle" fill="#0b1f3a" fontSize="28" fontWeight="700">
        {statNumber(total)}
      </text>
      <text x="70" y="88" textAnchor="middle" fill="#5d6b7c" fontSize="11">
        إجمالي الحجوزات
      </text>
    </svg>
  )
}

function TrendChart({ values }: { values: number[] }) {
  const width = 560
  const height = 210
  const pad = { left: 28, right: 12, top: 16, bottom: 32 }
  const max = Math.max(1, ...values)
  const innerWidth = width - pad.left - pad.right
  const innerHeight = height - pad.top - pad.bottom
  const coords = values.map((value, index) => {
    const x = pad.left + (values.length === 1 ? innerWidth / 2 : (index / (values.length - 1)) * innerWidth)
    const y = pad.top + innerHeight - (value / max) * innerHeight
    return [x, y] as const
  })
  const line = coords.map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0].toFixed(1)},${point[1].toFixed(1)}`).join(' ')
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${pad.top + innerHeight} L${coords[0][0].toFixed(1)},${pad.top + innerHeight} Z`
  const ticks = [...new Set([0, Math.ceil(max / 2), max])]
  const labelIndexes = [0, Math.floor((values.length - 1) / 2), values.length - 1]
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-52 w-full" role="img" aria-label="حجوزات الفترة">
      {ticks.map((tick) => {
        const y = pad.top + innerHeight - (tick / max) * innerHeight
        return (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#e5eaf1" />
            <text x={4} y={y + 4} fill="#5d6b7c" fontSize="11">
              {statNumber(tick)}
            </text>
          </g>
        )
      })}
      <path d={area} fill="#7c3aed" opacity="0.12" />
      <path d={line} fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {labelIndexes.map((index) => (
        <text key={index} x={coords[index][0]} y={height - 8} textAnchor="middle" fill="#5d6b7c" fontSize="11">
          {axisDate(index, values.length)}
        </text>
      ))}
    </svg>
  )
}

function statNumber(value: number) {
  return new Intl.NumberFormat('ar-SA', { numberingSystem: 'latn' }).format(value)
}

function longDate(date: Date) {
  return new Intl.DateTimeFormat('ar-SA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    numberingSystem: 'latn',
  }).format(date)
}

function hijriDate(date: Date) {
  return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    numberingSystem: 'latn',
  }).format(date)
}

function axisDate(index: number, length: number) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - (length - 1 - index))
  return new Intl.DateTimeFormat('ar-SA', { day: 'numeric', month: 'short', numberingSystem: 'latn' }).format(date)
}

function dailyCounts(dates: string[], days: number) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (days - 1))
  const buckets = Array.from({ length: days }, () => 0)
  for (const value of dates) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) continue
    date.setHours(0, 0, 0, 0)
    const index = Math.round((date.getTime() - start.getTime()) / 86_400_000)
    if (index >= 0 && index < days) buckets[index] += 1
  }
  return buckets
}

function changeText(recent: number, previous: number) {
  if (previous === 0) {
    return recent === 0
      ? { label: '0%', tone: 'text-muted' }
      : { label: '+100%', tone: 'text-emerald-700' }
  }
  const percent = Math.round(((recent - previous) / previous) * 100)
  if (percent > 0) return { label: `+${statNumber(percent)}%`, tone: 'text-emerald-700' }
  if (percent < 0) return { label: `${statNumber(percent)}%`, tone: 'text-rose-700' }
  return { label: '0%', tone: 'text-muted' }
}
