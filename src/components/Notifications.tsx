import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { listNotifications, type AuditRow } from '../lib/api'
import { errorText } from '../lib/format'
import { label } from '../lib/labels'
import { EnglishWhen, cx } from './ui'

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
      return '/hajj'
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

export function NotificationInbox({ onOpen }: { onOpen?: () => void }) {
  const { logs, loading, error, unread, isRead, markRead, markAllRead } = useNotifications()
  const rows = logs

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gold-soft text-navy">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-semibold text-navy">الإشعارات</h3>
            <p className="mt-0.5 text-xs text-muted">
              <span dir="ltr">{unread.toLocaleString('en-GB')}</span> غير مقروء
            </p>
          </div>
        </div>
        {unread > 0 ? (
          <button type="button" className="text-sm font-medium text-navy hover:text-gold" onClick={markAllRead}>
            تعليم الكل كمقروء
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      {loading ? <p className="mt-4 text-sm text-muted">جارٍ التحميل...</p> : null}
      {!loading && !error && rows.length === 0 ? <p className="mt-4 text-sm text-muted">لا توجد إشعارات.</p> : null}
      {rows.length > 0 ? (
        <ul className="mt-4 max-h-[calc(100vh-11rem)] divide-y divide-line overflow-y-auto">
          {rows.map((item) => (
            <NotificationItem
              key={item.id}
              item={item}
              read={isRead(item.id)}
              onOpen={() => {
                markRead(item.id)
                onOpen?.()
              }}
            />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function NotificationItem({ item, read, onOpen }: { item: AuditRow; read: boolean; onOpen: () => void }) {
  const path = notificationPath(item)
  const className = cx(
    'flex w-full items-start gap-3 px-2 py-3 text-right text-sm transition hover:bg-slate-50',
    read ? 'text-muted' : 'bg-gold-soft/50 text-navy',
  )
  const body = (
    <>
      <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', read ? 'bg-slate-300' : 'bg-gold')} />
      <span className="min-w-0 flex-1">
        <span className={cx('block', read ? 'font-normal' : 'font-semibold')}>{label.audit(item.action)}</span>
        {item.detail ? <span className="mt-0.5 block truncate text-xs">{item.detail}</span> : null}
        <span className="mt-1 block text-xs text-muted">
          <EnglishWhen value={item.created_at} inline />
        </span>
      </span>
      <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', read ? 'bg-slate-100 text-slate-500' : 'bg-navy text-white')}>
        {read ? 'مقروء' : 'جديد'}
      </span>
    </>
  )
  if (!path) {
    return (
      <li>
        <button type="button" className={className} onClick={onOpen}>
          {body}
        </button>
      </li>
    )
  }
  return (
    <li>
      <Link to={path} className={className} onClick={onOpen}>
        {body}
      </Link>
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
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function toggle() {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) {
      const width = 380
      setPlace({
        top: 16,
        left: Math.max(16, rect.left - width - 12),
      })
    }
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
        className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gold hover:bg-white/10"
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
              <button className="fixed inset-0 z-50 cursor-default" aria-label="إغلاق الإشعارات" onClick={() => setOpen(false)} />
              <div
                className="fixed z-[60] max-h-[calc(100vh-2rem)] w-[380px] overflow-hidden rounded-2xl border border-line bg-white p-4 text-ink shadow-lg"
                style={{ top: place.top, left: place.left }}
              >
                <NotificationInbox onOpen={() => setOpen(false)} />
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  )
}
