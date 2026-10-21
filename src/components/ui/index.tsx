import { Component, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, type InputHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, Inbox } from 'lucide-react'
import type { Tone } from '../../lib/labels'
import { Skeleton } from './skeleton'

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  info: 'bg-sky-50 text-sky-800',
  success: 'bg-emerald-50 text-emerald-800',
  warning: 'bg-amber-50 text-amber-900',
  danger: 'bg-rose-50 text-rose-800',
  gold: 'bg-gold-soft text-[#6d5420]',
}

const statusDots: Record<Tone, string> = {
  neutral: 'bg-slate-400',
  info: 'bg-sky-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-400',
  danger: 'bg-rose-500',
  gold: 'bg-gold',
}

const buttonStyles = {
  primary: 'bg-navy text-white hover:bg-navy-soft',
  secondary: 'border border-line bg-white text-ink hover:bg-slate-50',
  danger: 'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50',
  ghost: 'text-navy hover:bg-slate-100',
}

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonStyles }) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60',
        buttonStyles[variant],
        className,
      )}
      {...props}
    />
  )
}

export const fieldClass =
  'h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-gold focus:ring-2 focus:ring-gold/25 disabled:bg-slate-50'

export function TextField({ label, hint, badge, icon, ...props }: { label: string; hint?: string; badge?: string; icon?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const id = props.id ?? props.name
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 flex items-center justify-between gap-2 text-sm font-semibold text-navy">
        <span>{label}{props.required ? <span className="text-rose-500"> *</span> : null}</span>
        {badge ? <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-medium text-[#6d5420]">{badge}</span> : null}
      </span>
      <span className="relative block">
        <input id={id} className={cx(fieldClass, 'rounded-xl bg-slate-50/70', icon ? 'pe-10' : false)} {...props} />
        {icon ? <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted">{icon}</span> : null}
      </span>
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  )
}

export function SelectField({ label, children, ...props }: { label: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = props.id ?? props.name
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <select id={id} className={fieldClass} {...props}>
        {children}
      </select>
    </label>
  )
}

export function TextAreaField({ label, icon, ...props }: { label: string; icon?: ReactNode } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = props.id ?? props.name
  const length = typeof props.value === 'string' ? props.value.length : 0
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-sm font-semibold text-navy">
        {label}{props.required ? <span className="text-rose-500"> *</span> : null}
      </span>
      <span className="relative block">
        <textarea id={id} className={cx(fieldClass, 'h-auto rounded-xl bg-slate-50/70 py-3', icon ? 'pe-10' : false)} {...props} />
        {icon ? <span className="pointer-events-none absolute end-3 top-3 text-muted">{icon}</span> : null}
      </span>
      {props.maxLength ? <span className="mt-1 flex justify-end text-xs text-muted"><span dir="ltr">{length}/{props.maxLength}</span></span> : null}
    </label>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', tones[tone])}>{children}</span>
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-semibold text-navy">{title}</h2>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-2xl border border-line bg-white p-5 shadow-sm', className)}>{children}</section>
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800">
      {message}
    </div>
  )
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-gold/40 bg-gold-soft px-4 py-3 text-sm leading-6 text-[#6d5420]">{children}</p>
}

const skeletonRows = [72, 64, 58, 76, 48]

export function LoadingState({ plain = false }: { plain?: boolean }) {
  const body = (
    <div role="status" aria-busy="true">
      <div className="flex items-center gap-8 border-b border-line bg-slate-50 px-5 py-3">
        <Skeleton className="h-2 w-20 rounded-full" />
        <Skeleton className="hidden h-2 w-16 rounded-full sm:block" />
        <Skeleton className="hidden h-2 w-14 rounded-full md:block" />
        <Skeleton className="ms-auto h-2 w-12 rounded-full" />
      </div>
      {skeletonRows.map((width) => (
        <div key={width} className="flex items-center gap-4 border-b border-line px-5 py-3.5 last:border-b-0">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <span className="min-w-0 flex-1">
            <Skeleton className="h-2.5 rounded-full" style={{ width: `${width}%` }} />
            <Skeleton className="mt-2 h-2 w-24 max-w-full rounded-full" />
          </span>
          <Skeleton className="hidden h-2.5 w-16 rounded-full sm:block" />
          <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  )
  if (plain) return body
  return <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-line bg-white shadow-sm">{body}</div>
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-soft text-gold">
        <Inbox className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-navy">{title}</h3>
      {body ? <p className="mt-1 max-w-md text-sm leading-6 text-muted">{body}</p> : null}
    </div>
  )
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}) {
  if (total === 0) return null
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="text-sm text-muted">
        عرض <span dir="ltr">{from.toLocaleString('en-GB')}–{to.toLocaleString('en-GB')}</span> من {total.toLocaleString('en-GB')}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          السابق
        </Button>
        <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          التالي
        </Button>
      </div>
    </div>
  )
}

export function FilterSelect({
  label = 'الحالة',
  allLabel = 'كل الحالات',
  value,
  options,
  onChange,
  className,
}: {
  label?: string
  allLabel?: string
  value: string
  options: Array<{ value: string; label: string; tone?: Tone }>
  onChange: (value: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const current = options.find((item) => item.value === value)
  const currentLabel = current?.label ?? allLabel
  const currentTone = current?.tone ?? 'neutral'

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function choose(next: string) {
    onChange(next)
    setOpen(false)
  }

  const items = [{ value: '', label: allLabel, tone: 'neutral' as Tone }, ...options]

  return (
    <div ref={rootRef} className={cx('relative w-full max-w-60 shrink-0', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${currentLabel}`}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className={cx(
          'flex h-11 w-full items-center justify-between gap-2 rounded-lg border px-3 text-sm text-ink shadow-sm outline-none transition',
          open ? 'border-gold bg-white ring-2 ring-gold/25' : value ? 'border-gold/50 bg-gold-soft/60 hover:border-gold' : 'border-line bg-white hover:border-slate-300',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white', value ? statusDots[currentTone] : 'bg-slate-300')} />
          <span className="truncate font-medium">{currentLabel}</span>
        </span>
        <ChevronDown className={cx('h-4 w-4 shrink-0 text-muted transition', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="absolute left-0 z-20 mt-2 w-max min-w-full overflow-hidden rounded-xl border border-line bg-white p-1.5 shadow-lg">
          <p className="px-2.5 pb-1 pt-1 text-xs font-medium text-muted">{label}</p>
          <ul id={listId} role="listbox" aria-label={label}>
          {items.map((item) => {
            const selected = value === item.value
            const tone = item.tone ?? 'neutral'
            return (
              <li key={item.value || 'all'}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => choose(item.value)}
                  className={cx(
                    'flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm transition',
                    selected ? 'bg-slate-50 font-medium text-navy' : 'text-ink hover:bg-slate-50',
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', item.value ? statusDots[tone] : 'bg-slate-300')} />
                    {item.label}
                  </span>
                  {selected ? <Check className="h-4 w-4 shrink-0 text-gold" /> : <span className="h-4 w-4 shrink-0" />}
                </button>
              </li>
            )
          })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export function SearchForm({
  initial,
  placeholder,
  onSearch,
}: {
  initial: string
  placeholder: string
  onSearch: (value: string) => void
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onSearch(String(data.get('q') ?? ''))
  }
  return (
    <form onSubmit={submit} className="flex min-w-[240px] flex-1 gap-2">
      <input key={initial} name="q" defaultValue={initial} placeholder={placeholder} className={fieldClass} />
      <Button type="submit" variant="secondary">
        بحث
      </Button>
    </form>
  )
}

export function EnglishWhen({ value, inline = false }: { value: string; inline?: boolean }) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const day = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
  if (inline) return <span>{`${day}, ${time}`}</span>
  return (
    <span className="inline-flex flex-col items-start leading-tight">
      <span>{day}</span>
      <span className="text-xs text-muted">{time}</span>
    </span>
  )
}

export function DataShell({ children }: { children: ReactNode }) {
  return <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-line bg-white shadow-sm">{children}</div>
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="mb-4 inline-flex text-sm font-medium text-navy hover:text-gold">
      {children}
    </Link>
  )
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center bg-canvas px-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-navy">تعذر عرض الصفحة</h1>
          <p className="mt-2 text-sm leading-6 text-muted">حدّث الصفحة. إذا استمرت المشكلة، راجع سجل المتصفح.</p>
        </div>
      </div>
    )
  }
}
