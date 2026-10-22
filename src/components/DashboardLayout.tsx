import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  CalendarCheck,
  FileText,
  Globe,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  MoonStar,
  Settings,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { agencyName } from '../lib/config'
import { NotificationBell, NotificationsProvider } from './Notifications'
import { cx } from './ui'

const items = [
  { to: '/', label: 'الرئيسية', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'العملاء', icon: Users, end: false },
  { to: '/bookings', label: 'الحجوزات', icon: CalendarCheck, end: false },
  { to: '/umrah', label: 'برامج العمرة', icon: MoonStar, end: false },
  { to: '/hajj', label: 'برامج الحج', icon: Landmark, end: false },
  { to: '/hajj/inquiries', label: 'الاستفسارات والشكاوي', icon: MessageSquare, end: true },
  { to: '/visas', label: 'طلبات التأشيرات', icon: FileText, end: false },
  { to: '/payments', label: 'المدفوعات', icon: Wallet, end: false },
  { to: '/website', label: 'إدارة الموقع', icon: Globe, end: false },
  { to: '/settings', label: 'الإعدادات', icon: Settings, end: false },
]

function itemActive(to: string, pathname: string, end: boolean) {
  if (to === '/hajj') return pathname === '/hajj' || (pathname.startsWith('/hajj/') && !pathname.startsWith('/hajj/inquiries'))
  if (to === '/hajj/inquiries') return pathname === '/hajj/inquiries' || pathname.startsWith('/hajj/inquiries/')
  if (end) return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function DashboardLayout() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  async function logout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <NotificationsProvider>
    <div className="min-h-screen bg-canvas text-ink">
      {open ? <button className="fixed inset-0 z-30 bg-navy/40 lg:hidden" aria-label="إغلاق القائمة" onClick={() => setOpen(false)} /> : null}
      <aside
        className={cx(
          'fixed inset-y-0 right-0 z-40 flex w-[272px] flex-col bg-navy text-white transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : 'translate-x-full lg:translate-x-0',
        )}
      >
        <div className="border-b border-white/10 px-5 py-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold text-gold">
              <MoonStar className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-gold">لوحة الإدارة</p>
                <NotificationBell />
              </div>
              <h1 className="mt-1 text-sm font-semibold leading-6">{agencyName}</h1>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => {
            const active = itemActive(item.to, location.pathname, item.end)
            return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                active ? 'bg-[#1f4f86] text-white shadow-sm' : 'text-white/75 hover:bg-white/5 hover:text-white',
              )}
            >
              <span>{item.label}</span>
              <item.icon className="h-[18px] w-[18px]" />
            </Link>
            )
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <p className="truncate text-xs text-white/70">{session?.user.email}</p>
          <button type="button" onClick={logout} className="mt-3 inline-flex items-center gap-2 text-sm text-gold">
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>
      <div className="min-w-0 lg:mr-[272px]">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-line bg-white/95 px-4 backdrop-blur lg:hidden">
          <button type="button" className="rounded-lg p-2 text-navy" onClick={() => setOpen(true)} aria-label="فتح القائمة">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>
        <main className="px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
    </NotificationsProvider>
  )
}
