import { NavLink, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { ConfigurationScreen } from '../auth/RequireAdmin'
import { agencyName, customerPortalEnabled, publicSiteUrl } from '../lib/config'
import { getOwnProfile, type OwnProfile } from '../lib/portal'
import { cx, LoadingState } from '../components/ui'
import { CustomerLoginPage, ForgotPasswordPage, RegisterPage } from './AuthPages'
import { AccountHomePage, DocumentsPage, ProfilePage } from './AccountPages'
import { BookingDetailPage, BookingsPage, NewBookingPage, NewVisaPage, VisaDetailPage, VisasPage } from './TravelPages'

export function PortalApp() {
  if (!customerPortalEnabled) {
    return (
      <div className="grid min-h-screen place-items-center bg-white px-6 text-center">
        <div className="max-w-md">
          <h1 className="text-2xl font-semibold text-navy">حساب العميل عبر الموقع الرسمي</h1>
          <p className="mt-3 text-sm leading-7 text-muted">التسجيل ومتابعة الحجوزات يتمان من موقع الوكالة، وليس من لوحة الإدارة.</p>
          <a className="mt-5 inline-flex text-sm font-medium text-navy" href={publicSiteUrl}>الانتقال إلى {publicSiteUrl.replace('https://', '')}</a>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="login" element={<CustomerLoginPage />} />
      <Route path="register" element={<RegisterPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route element={<RequireCustomer />}>
        <Route element={<PortalLayout />}>
          <Route index element={<AccountHomePage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="bookings/new" element={<NewBookingPage />} />
          <Route path="bookings/:id" element={<BookingDetailPage />} />
          <Route path="visas" element={<VisasPage />} />
          <Route path="visas/new" element={<NewVisaPage />} />
          <Route path="visas/:id" element={<VisaDetailPage />} />
          <Route path="documents" element={<DocumentsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/portal" replace />} />
    </Routes>
  )
}

function RequireCustomer() {
  const { configured, loading, session } = useAuth()
  if (!configured) return <ConfigurationScreen />
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas">
        <span role="status" aria-busy="true" className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-navy" />
      </div>
    )
  }
  if (!session) return <Navigate to="/portal/login" replace />
  return <Outlet />
}

function PortalLayout() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<OwnProfile | null>(null)
  const [missing, setMissing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    let active = true
    getOwnProfile(session.user.id)
      .then((row) => {
        if (!active) return
        setProfile(row)
        setMissing(!row)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [session])

  const links = [
    ['/portal', 'حسابي'],
    ['/portal/bookings', 'حجوزاتي'],
    ['/portal/visas', 'التأشيرات'],
    ['/portal/documents', 'مستنداتي'],
    ['/portal/profile', 'الملف الشخصي'],
  ] as const

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs text-gold">حساب العميل</p>
            <p className="font-semibold text-navy">{agencyName}</p>
          </div>
          <button
            type="button"
            className="text-sm text-navy"
            onClick={async () => {
              await signOut()
              navigate('/portal/login')
            }}
          >
            تسجيل الخروج
          </button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 pb-3">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/portal'}
              className={({ isActive }) => cx('rounded-full px-3 py-1.5 text-sm', isActive ? 'bg-navy text-white' : 'text-muted')}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        {loading ? <LoadingState /> : null}
        {!loading && missing ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-800">
            لم يُنشأ ملف العميل في قاعدة البيانات. راجع تفعيل دالة التسجيل ثم أعد تحميل الصفحة.
          </p>
        ) : null}
        {!loading && profile?.account_status === 'suspended' ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-800">
            الحساب موقوف. تواصل مع الوكالة لمتابعة الطلبات.
          </p>
        ) : null}
        {!loading && profile && profile.account_status !== 'suspended' ? <Outlet context={profile} /> : null}
      </main>
    </div>
  )
}
