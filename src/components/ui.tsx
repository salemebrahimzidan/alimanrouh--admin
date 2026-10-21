import { Component, type ButtonHTMLAttributes, type FormEvent, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, type InputHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import { Inbox, Loader2 } from 'lucide-react'
import type { Tone } from '../lib/labels'

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

export function TextField({ label, hint, ...props }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = props.id ?? props.name
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input id={id} className={fieldClass} {...props} />
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

export function TextAreaField({ label, ...props }: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = props.id ?? props.name
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <textarea id={id} className={cx(fieldClass, 'h-auto py-3')} {...props} />
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

export function LoadingState({ label = 'جارٍ تحميل البيانات' }: { label?: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted">
      <Loader2 className="h-5 w-5 animate-spin text-gold" />
      <span>{label}</span>
    </div>
  )
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
        عرض {from.toLocaleString('ar-SA')}–{to.toLocaleString('ar-SA')} من {total.toLocaleString('ar-SA')}
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

export function DataShell({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">{children}</div>
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
