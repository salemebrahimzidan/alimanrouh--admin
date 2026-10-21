import { FileText, ImagePlus, Plus, RefreshCw, Save, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BackLink, Button, ErrorBanner, cx } from './ui'

export function ProgramForm({
  backTo,
  backLabel,
  title,
  description,
  pending,
  error,
  onSubmit,
  children,
  imageUrl,
  onImageClear,
  published,
  onPublishedChange,
}: {
  backTo: string
  backLabel: string
  title: string
  description: string
  pending: boolean
  error: string | null
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  children: ReactNode
  imageUrl: string | null
  onImageClear: () => void
  published: boolean
  onPublishedChange: (next: boolean) => void
}) {
  return (
    <div>
      <BackLink to={backTo}>{backLabel}</BackLink>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-navy">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{description}</p>
      </div>
      <form onSubmit={onSubmit}>
        <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="p-5">
              <header className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-navy">تفاصيل البرنامج</h3>
                  <p className="mt-1 text-sm text-muted">المعلومات التي تظهر للعميل عند استعراض البرنامج.</p>
                </div>
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-navy">
                  <FileText className="h-5 w-5" aria-hidden="true" />
                </span>
              </header>
              <div className="grid gap-4 sm:grid-cols-2">{children}</div>
            </div>
            <div className="border-t border-line p-4 lg:border-s lg:border-t-0">
              <ImageField imageUrl={imageUrl} onClear={onImageClear} />
              <div className="mt-4">
                <PublishSwitch on={published} onToggle={() => onPublishedChange(!published)} />
              </div>
            </div>
          </div>
          {error ? <div className="border-t border-line px-5 py-4"><ErrorBanner message={error} /></div> : null}
          <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
            <Link to={backTo} className="inline-flex h-11 items-center justify-center rounded-xl border border-line bg-white px-5 text-sm font-medium text-ink hover:bg-slate-50">
              إلغاء
            </Link>
            <Button type="submit" className="h-11 rounded-xl px-5" disabled={pending}>
              <Save className="h-4 w-4" aria-hidden="true" />
              {pending ? 'جارٍ الحفظ...' : 'حفظ البرنامج'}
            </Button>
          </div>
        </section>
      </form>
    </div>
  )
}

const maxImageBytes = 5 * 1024 * 1024

function ImageField({ imageUrl, onClear }: { imageUrl: string | null; onClear: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localUrl, setLocalUrl] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const shown = localUrl || imageUrl

  useEffect(() => () => {
    if (localUrl) URL.revokeObjectURL(localUrl)
  }, [localUrl])

  function choose() {
    inputRef.current?.click()
  }

  function remove() {
    if (inputRef.current) inputRef.current.value = ''
    setFileError(null)
    setLocalUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
    onClear()
  }

  return (
    <div>
      <div className="rounded-2xl border border-dashed border-gold/60 bg-gold-soft/50 px-4 py-5 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-navy shadow-sm">
          <ImagePlus className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="mt-3 text-sm font-semibold text-navy">أضف صورة البرنامج</p>
        <p className="mt-1 text-xs text-muted">PNG أو JPG أو WEBP، بحد أقصى 5 ميجابايت</p>
        <button type="button" onClick={choose} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-navy text-sm font-medium text-white hover:bg-navy-soft">
          <Upload className="h-4 w-4" aria-hidden="true" />
          اختيار صورة
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        {shown ? (
          <span className="relative h-16 w-16 overflow-hidden rounded-xl border border-line">
            <img src={shown} alt="" className="h-full w-full object-cover" />
            <button type="button" aria-label="حذف الصورة" onClick={remove} className="absolute start-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-ink shadow-sm">
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ) : null}
        <button type="button" onClick={choose} className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line text-[10px] font-medium text-muted hover:bg-slate-50">
          <Plus className="h-4 w-4" aria-hidden="true" />
          إضافة صورة
        </button>
      </div>
      {fileError ? <p className="mt-2 text-xs text-rose-700">{fileError}</p> : null}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button type="button" onClick={choose} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gold-soft text-xs font-medium text-navy hover:bg-gold/20">
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          رفع
        </button>
        <button type="button" onClick={choose} disabled={!shown} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-50 text-xs font-medium text-navy hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          تغيير
        </button>
        <button type="button" onClick={remove} disabled={!shown} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-rose-50 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300">
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          حذف
        </button>
      </div>
      <input
        ref={inputRef}
        name="image"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file && file.size > maxImageBytes) {
            event.target.value = ''
            setFileError('حجم الصورة أكبر من 5 ميجابايت.')
            return
          }
          setFileError(null)
          setLocalUrl((current) => {
            if (current) URL.revokeObjectURL(current)
            return file ? URL.createObjectURL(file) : null
          })
        }}
      />
    </div>
  )
}

function PublishSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const label = on ? 'مفعل' : 'مغلق'
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-slate-50 px-3 py-3">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-navy">
          {label}
          {on ? <span className="h-2 w-2 rounded-full bg-emerald-500" /> : null}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted">إظهار البرنامج للعميل في الموقع</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onToggle}
        dir="ltr"
        className={cx('relative h-7 w-12 shrink-0 rounded-full p-0.5 transition-colors', on ? 'bg-navy' : 'bg-slate-300')}
      >
        <span className={cx('block h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200', on ? 'translate-x-5' : 'translate-x-0')} />
      </button>
    </div>
  )
}
