import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ArrowRight, Bell, ChevronLeft, X } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { listNotifications, type AuditRow } from '../lib/api'
import { errorText } from '../lib/format'
import { label } from '../lib/labels'
import { EnglishWhen, cx } from './ui'

const entityTypeLabels: Record<string, string> = {
  booking: 'حجز',
  visa_application: 'تأشيرة',
  profile: 'عميل',
  hajj_inquiry: 'استفسار حج',
  support_conversation: 'استفسارات',
  payment: 'دفعة',
  umrah_packages: 'برنامج عمرة',
  hajj_programs: 'برنامج حج',
  website_content: 'محتوى الموقع',
}

function entityTypeLabel(value: string) {
  return entityTypeLabels[value] ?? value
}

type NotificationsState = {
  logs: AuditRow[]
  loading: boolean
  error: string | null
  unread: number
  isRead: (id: string) => boolean
  markRead: (id: string) => void
  markAllRead: () => void
  reload: () => void
}

const NotificationsContext = createContext<NotificationsState | null>(null)

function storageKey(userId: string) {
  return `alimanrouh-audit-read:${userId}`
}

function loadRead(userId: string) {
  if (!userId) return new Set<string>()
  try {
    const raw = localStorage.getItem(storageKey(userId))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return new Set<string>()
    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set<string>()
  }
}

function saveRead(userId: string, ids: Set<string>) {
  if (!userId) return
  localStorage.setItem(storageKey(userId), JSON.stringify([...ids]))
}

export function notificationPath(item: AuditRow) {
  const id = item.entity_id
  switch (item.entity_type) {
    case 'booking':
      return id ? `/bookings/${id}` : '/bookings'
    case 'visa_application':
      return id ? `/visas/${id}` : '/visas'
    case 'profile':
      return id ? `/customers/${id}` : '/customers'
    case 'hajj_inquiry':
      return id ? `/hajj/inquiries/${id}` : '/hajj/inquiries'
    case 'support_conversation':
      return id ? `/inquiries?conversation=${encodeURIComponent(id)}` : '/inquiries'
    case 'payment':
      return '/payments'
    case 'umrah_packages':
      return id ? `/umrah/${id}/edit` : '/umrah'
    case 'hajj_programs':
      return id ? `/hajj/${id}/edit` : '/hajj'
    case 'website_content':
      return '/website'
    default:
      return null
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const [logs, setLogs] = useState<AuditRow[]>([])
  const [read, setRead] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    setRead(loadRead(userId))
  }, [userId])

  useEffect(() => {
    let active = true
    listNotifications()
      .then((rows) => {
        if (!active) return
        setLogs(rows)
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
  }, [version])

  const unread = useMemo(() => logs.filter((item) => !read.has(item.id)).length, [logs, read])

  function markRead(id: string) {
    setRead((current) => {
      if (current.has(id)) return current
      const next = new Set(current)
      next.add(id)
      saveRead(userId, next)
      return next
    })
  }

  function markAllRead() {
    setRead((current) => {
      const next = new Set(current)
      for (const item of logs) next.add(item.id)
      saveRead(userId, next)
      return next
    })
  }

  function reload() {
    setLoading(true)
    setVersion((current) => current + 1)
  }

  const value = useMemo<NotificationsState>(
    () => ({
      logs,
      loading,
      error,
      unread,
      isRead: (id) => read.has(id),
      markRead,
      markAllRead,
      reload,
    }),
    [logs, loading, error, unread, read, userId],
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications() {
  const value = useContext(NotificationsContext)
  if (!value) throw new Error('Notifications are only available inside the admin layout.')
  return value
}

export function NotificationInbox({ onOpen, onClose }: { onOpen?: () => void; onClose?: () => void }) {
  const { logs, loading, error, unread, isRead, markRead, markAllRead } = useNotifications()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const rows = logs
  const selected = selectedId ? rows.find((item) => item.id === selectedId) ?? null : null

  if (selected) {
    return (
      <NotificationDetail
        item={selected}
        read={isRead(selected.id)}
        onBack={() => setSelectedId(null)}
        onClose={onClose}
        onNavigate={() => {
          markRead(selected.id)
          onOpen?.()
        }}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-soft text-navy">
            <Bell className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-5 text-navy">الإشعارات</h3>
            <p className="text-[11px] leading-4 text-muted">
              <span dir="ltr">{unread.toLocaleString('en-GB')}</span> غير مقروء
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {unread > 0 ? (
            <button type="button" className="rounded-md px-2 py-1 text-[11px] font-medium text-navy hover:bg-slate-50 hover:text-gold" onClick={markAllRead}>
              تعليم الكل كمقروء
            </button>
          ) : null}
          {onClose ? (
            <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-slate-100 hover:text-navy" aria-label="إغلاق الإشعارات" onClick={onClose}>
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
      {loading ? <p className="mt-3 text-sm text-muted">جارٍ التحميل...</p> : null}
      {!loading && !error && rows.length === 0 ? <p className="mt-3 text-sm text-muted">لا توجد إشعارات.</p> : null}
      {rows.length > 0 ? (
        <ul className="mt-1 min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain">
          {rows.map((item) => (
            <NotificationItem
              key={item.id}
              item={item}
              read={isRead(item.id)}
              onSelect={() => {
                markRead(item.id)
                setSelectedId(item.id)
              }}
            />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function NotificationDetail({
  item,
  read,
  onBack,
  onClose,
  onNavigate,
}: {
  item: AuditRow
  read: boolean
  onBack: () => void
  onClose?: () => void
  onNavigate: () => void
}) {
  const path = notificationPath(item)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onBack()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onBack])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-2.5">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-medium text-navy hover:bg-slate-50"
          onClick={onBack}
        >
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          رجوع
        </button>
        {onClose ? (
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-slate-100 hover:text-navy" aria-label="إغلاق الإشعارات" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-6 text-navy">{label.audit(item.action)}</h3>
          <span className={cx('shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium', read ? 'bg-slate-100 text-slate-500' : 'bg-navy text-white')}>
            {read ? 'مقروء' : 'جديد'}
          </span>
        </div>

        <dl className="mt-3 space-y-2.5 text-[12px]">
          <div>
            <dt className="text-[11px] text-muted">النوع</dt>
            <dd className="mt-0.5 text-ink">{entityTypeLabel(item.entity_type)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted">التاريخ</dt>
            <dd className="mt-0.5 text-ink">
              <EnglishWhen value={item.created_at} inline />
            </dd>
          </div>
          {item.detail ? (
            <div>
              <dt className="text-[11px] text-muted">التفاصيل</dt>
              <dd className="mt-0.5 whitespace-pre-wrap break-words leading-5 text-ink">{item.detail}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {path ? (
        <div className="mt-3 border-t border-line pt-3">
          <Link
            to={path}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-[13px] font-medium text-white transition hover:bg-navy/90"
            onClick={onNavigate}
          >
            فتح السجل
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </div>
  )
}

function NotificationItem({ item, read, onSelect }: { item: AuditRow; read: boolean; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        className={cx(
          'flex w-full items-start gap-2 rounded-lg px-1.5 py-2 text-right text-[13px] leading-5 transition hover:bg-slate-50',
          read ? 'text-muted' : 'bg-gold-soft/40 text-navy',
        )}
        onClick={onSelect}
      >
        <span className={cx('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', read ? 'bg-slate-300' : 'bg-gold')} />
        <span className="min-w-0 flex-1">
          <span className={cx('block', read ? 'font-normal' : 'font-semibold')}>{label.audit(item.action)}</span>
          {item.detail ? <span className="mt-0.5 block truncate text-[11px] leading-4 text-muted">{item.detail}</span> : null}
          <span className="mt-0.5 block text-[11px] leading-4 text-muted">
            <EnglishWhen value={item.created_at} inline />
          </span>
        </span>
        <span className={cx('mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium', read ? 'bg-slate-100 text-slate-500' : 'bg-navy text-white')}>
          {read ? 'مقروء' : 'جديد'}
        </span>
      </button>
    </li>
  )
}

export function NotificationBell() {
  const { unread, reload } = useNotifications()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [place, setPlace] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    function onResize() {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return
      setPlace({
        top: Math.max(12, rect.bottom + 6),
        left: Math.max(12, Math.min(rect.left - 308, window.innerWidth - 332)),
      })
    }
    onResize()
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      document.body.style.overflow = previous
    }
  }, [open])

  function toggle() {
    setOpen((current) => {
      if (!current) reload()
      return !current
    })
  }

  return (
    <div>
      <button
        ref={buttonRef}
        type="button"
        className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-current hover:bg-slate-100 lg:hover:bg-white/10"
        aria-expanded={open}
        aria-label="الإشعارات"
        onClick={toggle}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -top-1 -end-1 inline-flex min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-semibold leading-4 text-navy" dir="ltr">
            {unread.toLocaleString('en-GB')}
          </span>
        ) : null}
      </button>
      {open
        ? createPortal(
            <>
              <button className="fixed inset-0 z-50 bg-navy/30 lg:bg-transparent" aria-label="إغلاق الإشعارات" onClick={() => setOpen(false)} />
              <div
                role="dialog"
                aria-modal="true"
                aria-label="الإشعارات"
                className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[min(70dvh,26rem)] flex-col overflow-hidden rounded-t-2xl border border-line bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1.5 text-ink shadow-xl lg:inset-auto lg:max-h-[min(24rem,calc(100vh-5rem))] lg:w-[320px] lg:rounded-xl lg:p-3 lg:shadow-lg lg:[left:var(--panel-left)] lg:[top:var(--panel-top)]"
                style={{ ['--panel-top' as string]: `${place.top}px`, ['--panel-left' as string]: `${place.left}px` }}
              >
                <div className="mb-1.5 flex justify-center lg:hidden" aria-hidden="true">
                  <span className="h-1 w-10 rounded-full bg-slate-200" />
                </div>
                <NotificationInbox onOpen={() => setOpen(false)} onClose={() => setOpen(false)} />
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  )
}
