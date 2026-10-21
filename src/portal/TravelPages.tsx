import { useEffect, useState, type FormEvent } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import {
  bookingHistory,
  getBooking,
  getVisa,
  listCustomerBookings,
  listCustomerVisas,
  listPublishedPackages,
  type BookingRow,
  type PackageRow,
  type StatusEvent,
  type VisaRow,
} from '../lib/api'
import { visaDisclaimer } from '../lib/config'
import { errorText, formatDate, formatDateTime, formatMoney, isMobile } from '../lib/format'
import { bookingTone, label, visaTone } from '../lib/labels'
import { createBooking, createVisa, packageTotal, type OwnProfile } from '../lib/portal'
import { Badge, Button, Card, EmptyState, ErrorBanner, LoadingState, Notice, TextAreaField, TextField } from '../components/ui'

export function BookingsPage() {
  const profile = useOutletContext<OwnProfile>()
  const [rows, setRows] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    listCustomerBookings(profile.id)
      .then((result) => {
        if (active) setRows(result)
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
  }, [profile.id])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">حجوزاتي</h1>
        <Link to="/portal/bookings/new"><Button>حجز جديد</Button></Link>
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? <LoadingState /> : null}
      {!loading && rows.length === 0 ? <Card><EmptyState title="لا توجد حجوزات" /></Card> : null}
      <div className="space-y-3">
        {rows.map((booking) => (
          <Link key={booking.id} to={`/portal/bookings/${booking.id}`} className="block rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-navy">{booking.reference}</p>
                <p className="mt-1 text-sm text-muted">{booking.package_title_snapshot} · {formatMoney(booking.total_amount)}</p>
              </div>
              <Badge tone={bookingTone(booking.status)}>{label.booking(booking.status)}</Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export function NewBookingPage() {
  const profile = useOutletContext<OwnProfile>()
  const [packages, setPackages] = useState<PackageRow[]>([])
  const [packageId, setPackageId] = useState('')
  const [travelers, setTravelers] = useState(1)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const disabled = profile.account_status !== 'active'

  useEffect(() => {
    listPublishedPackages().then(setPackages).catch((err: unknown) => setError(errorText(err)))
  }, [])

  const selected = packages.find((item) => item.id === packageId)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const travelDate = String(new FormData(event.currentTarget).get('travel_date') ?? '')
    const note = String(new FormData(event.currentTarget).get('note') ?? '')
    if (!packageId || !travelDate) {
      setError('اختر البرنامج وتاريخ السفر.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await createBooking({ userId: profile.id, packageId, travelDate, travelers, note })
      setDone(true)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <Card>
        <h1 className="text-xl font-semibold text-navy">تم إرسال الحجز</h1>
        <p className="mt-2 text-sm leading-7 text-muted">الحجز الآن قيد الانتظار. يمكنك متابعة حالته من قائمة الحجوزات.</p>
        <Link to="/portal/bookings" className="mt-4 inline-flex text-sm text-navy">العودة للحجوزات</Link>
      </Card>
    )
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold text-navy">حجز عمرة</h1>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block text-sm font-medium">
          البرنامج
          <select className="mt-1.5 h-11 w-full rounded-lg border border-line px-3" value={packageId} onChange={(event) => setPackageId(event.target.value)} disabled={disabled}>
            <option value="">اختر برنامجاً منشوراً</option>
            {packages.map((item) => <option key={item.id} value={item.id}>{item.title} · {formatMoney(item.price_sar)}</option>)}
          </select>
        </label>
        <TextField label="تاريخ السفر" name="travel_date" type="date" required disabled={disabled} />
        <TextField label="عدد المسافرين" type="number" min="1" max="100" value={travelers} onChange={(event) => setTravelers(Number(event.target.value))} disabled={disabled} />
        <TextAreaField label="ملاحظة" name="note" rows={3} disabled={disabled} />
        {selected ? <p className="text-sm text-navy">المبلغ المتوقع: {formatMoney(packageTotal(selected.price_sar, travelers))}. السعر النهائي يُحسب من البرنامج المنشور.</p> : null}
        {packages.length === 0 ? <p className="text-sm text-muted">لا توجد برامج منشورة حالياً.</p> : null}
        {error ? <ErrorBanner message={error} /> : null}
        <Button type="submit" disabled={pending || disabled || packages.length === 0}>{pending ? 'جارٍ الإرسال...' : 'إرسال الحجز'}</Button>
      </form>
    </Card>
  )
}

export function BookingDetailPage() {
  const { id = '' } = useParams()
  const [booking, setBooking] = useState<BookingRow | null>(null)
  const [history, setHistory] = useState<StatusEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([getBooking(id), bookingHistory(id)])
      .then(([row, events]) => {
        if (!active) return
        setBooking(row)
        setHistory(events)
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
  }, [id])

  if (loading) return <LoadingState />
  if (error) return <ErrorBanner message={error} />
  if (!booking) return <EmptyState title="الحجز غير موجود" />
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-navy">{booking.reference}</h1>
          <p className="mt-1 text-sm text-muted">{booking.package_title_snapshot}</p>
        </div>
        <Badge tone={bookingTone(booking.status)}>{label.booking(booking.status)}</Badge>
      </div>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-muted">تاريخ الحجز</dt><dd>{formatDateTime(booking.created_at)}</dd></div>
        <div><dt className="text-muted">تاريخ السفر</dt><dd>{formatDate(booking.travel_date)}</dd></div>
        <div><dt className="text-muted">المسافرون</dt><dd>{booking.travelers_count.toLocaleString('ar-SA')}</dd></div>
        <div><dt className="text-muted">المبلغ</dt><dd>{formatMoney(booking.total_amount)}</dd></div>
      </dl>
      <h2 className="mt-6 font-semibold text-navy">سجل الحالة</h2>
      <ol className="mt-3 space-y-3">
        {history.map((event) => (
          <li key={event.id} className="text-sm">
            <p>{event.old_status ? `من ${label.booking(event.old_status)} إلى ${label.booking(event.new_status)}` : label.booking(event.new_status)}</p>
            {event.note ? <p className="text-muted">{event.note}</p> : null}
            <p className="text-xs text-muted">{formatDateTime(event.created_at)}</p>
          </li>
        ))}
      </ol>
    </Card>
  )
}

export function VisasPage() {
  const profile = useOutletContext<OwnProfile>()
  const [rows, setRows] = useState<VisaRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    listCustomerVisas(profile.id)
      .then((result) => {
        if (active) setRows(result)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [profile.id])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">طلبات التأشيرات</h1>
        <Link to="/portal/visas/new"><Button>طلب جديد</Button></Link>
      </div>
      <div className="mb-4"><Notice>{visaDisclaimer}</Notice></div>
      {loading ? <LoadingState /> : null}
      {!loading && rows.length === 0 ? <Card><EmptyState title="لا توجد طلبات" /></Card> : null}
      <div className="space-y-3">
        {rows.map((visa) => (
          <Link key={visa.id} to={`/portal/visas/${visa.id}`} className="flex items-center justify-between rounded-2xl border border-line bg-white p-4">
            <span className="font-medium text-navy">{visa.reference}</span>
            <Badge tone={visaTone(visa.status)}>{label.visa(visa.status)}</Badge>
          </Link>
        ))}
      </div>
    </div>
  )
}

export function NewVisaPage() {
  const profile = useOutletContext<OwnProfile>()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const disabled = profile.account_status !== 'active'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const fullName = String(form.get('full_name') ?? '').trim()
    const mobile = String(form.get('mobile') ?? '').trim()
    const passport = String(form.get('passport_number') ?? '').trim()
    const nationality = String(form.get('nationality') ?? '').trim()
    if (fullName.length < 2 || !isMobile(mobile) || passport.length < 4 || nationality.length < 2) {
      setError('أكمل الاسم والجوال ورقم الجواز والجنسية.')
      return
    }
    setPending(true)
    try {
      await createVisa({
        userId: profile.id,
        fullName,
        mobile,
        passportNumber: passport,
        nationality,
        travelDate: String(form.get('travel_date') ?? ''),
        note: String(form.get('note') ?? ''),
      })
      setDone(true)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <Card>
        <h1 className="text-xl font-semibold text-navy">تم استلام الطلب</h1>
        <p className="mt-2 text-sm leading-7 text-muted">الطلب دخل المتابعة الداخلية. حالته لا تعني صدور التأشيرة.</p>
        <Link to="/portal/visas" className="mt-4 inline-flex text-sm text-navy">العودة للطلبات</Link>
      </Card>
    )
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold text-navy">طلب تأشيرة عمرة</h1>
      <div className="mt-3"><Notice>{visaDisclaimer}</Notice></div>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <TextField label="الاسم في الجواز" name="full_name" defaultValue={profile.full_name} required disabled={disabled} />
        <TextField label="الجوال" name="mobile" defaultValue={profile.mobile} required disabled={disabled} />
        <TextField label="رقم الجواز" name="passport_number" required disabled={disabled} />
        <TextField label="الجنسية" name="nationality" required disabled={disabled} />
        <TextField label="تاريخ السفر المطلوب" name="travel_date" type="date" disabled={disabled} />
        <TextAreaField label="ملاحظة" name="note" rows={3} disabled={disabled} />
        {error ? <ErrorBanner message={error} /> : null}
        <Button type="submit" disabled={pending || disabled}>{pending ? 'جارٍ الإرسال...' : 'إرسال الطلب'}</Button>
      </form>
    </Card>
  )
}

export function VisaDetailPage() {
  const { id = '' } = useParams()
  const [visa, setVisa] = useState<VisaRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getVisa(id)
      .then((row) => {
        if (active) setVisa(row)
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
  }, [id])

  if (loading) return <LoadingState />
  if (error) return <ErrorBanner message={error} />
  if (!visa) return <EmptyState title="الطلب غير موجود" />
  return (
    <Card>
      <Notice>{visaDisclaimer}</Notice>
      <div className="mt-4 flex items-start justify-between gap-3">
        <h1 className="text-xl font-semibold text-navy">{visa.reference}</h1>
        <Badge tone={visaTone(visa.status)}>{label.visa(visa.status)}</Badge>
      </div>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-muted">الاسم</dt><dd>{visa.full_name}</dd></div>
        <div><dt className="text-muted">الجنسية</dt><dd>{visa.nationality}</dd></div>
        <div><dt className="text-muted">تاريخ السفر</dt><dd>{formatDate(visa.requested_travel_date)}</dd></div>
        <div><dt className="text-muted">تاريخ الطلب</dt><dd>{formatDateTime(visa.created_at)}</dd></div>
      </dl>
    </Card>
  )
}
