import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { deleteContent, listContent, saveContent, uploadPublicImage, type ContentInput, type ContentRow } from '../../lib/api'
import { errorText } from '../../lib/format'
import { contentKinds, label, type ContentKind } from '../../lib/labels'
import { hasUnsavedChanges, shouldWarnOnSectionChange, UNSAVED_CHANGES_MESSAGE } from '../../lib/site-copy-guard'
import { siteSections, type SiteSectionId } from '../../lib/site-copy'
import { mediaUrl } from '../../lib/supabase'
import { Badge, Button, Card, DataShell, EmptyState, ErrorBanner, LoadingState, PageHeader, TextAreaField, TextField, cx } from '../../components/ui'
import { SiteCopyForm } from './SiteCopyForm'

const empty: ContentInput = {
  kind: 'banner',
  title: '',
  body: '',
  image_path: null,
  link_url: null,
  sort_order: 0,
  is_published: false,
}

const kindHints: Record<ContentKind, string> = {
  banner: 'بطاقة بصورة في الصفحة الرئيسية.',
  offer: 'بطاقة في صفحة العروض.',
  announcement: 'شريط إعلان في الصفحة الرئيسية.',
}

const tabs: Array<{ id: SiteSectionId | 'media'; label: string }> = [
  { id: 'identity', label: 'الهوية والتواصل' },
  { id: 'home', label: 'الرئيسية' },
  { id: 'pages', label: 'الصفحات' },
  { id: 'media', label: 'البنرات والعروض' },
]

function isSectionTab(tab: (typeof tabs)[number]['id']): tab is SiteSectionId {
  return tab !== 'media'
}

export function WebsitePage() {
  const [tab, setTab] = useState<(typeof tabs)[number]['id']>('identity')
  const [dirty, setDirty] = useState<Record<SiteSectionId, boolean>>({
    identity: false,
    home: false,
    pages: false,
  })
  const onDirtyChange = useCallback((id: SiteSectionId, value: boolean) => {
    setDirty((current) => (current[id] === value ? current : { ...current, [id]: value }))
  }, [])

  function selectTab(next: (typeof tabs)[number]['id']) {
    if (next === tab) return
    if (isSectionTab(tab) && shouldWarnOnSectionChange(dirty, tab) && !window.confirm(UNSAVED_CHANGES_MESSAGE)) return
    setTab(next)
  }

  useEffect(() => {
    if (!hasUnsavedChanges(dirty)) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null
      const anchor = element?.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return
      let url: URL
      try {
        url = new URL(anchor.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return
      if (window.confirm(UNSAVED_CHANGES_MESSAGE)) return
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty])

  return (
    <div>
      <PageHeader
        title="إدارة الموقع"
        description="عدّل من هنا بيانات الوكالة ونصوص الصفحات والبنرات والعروض. الحفظ ينشر التغيير في الموقع الرسمي. برامج العمرة والحج وأسعارها تبقى في صفحاتها."
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cx(
              'h-10 rounded-full px-4 text-sm font-medium transition',
              tab === item.id ? 'bg-navy text-white' : 'border border-line bg-white text-navy hover:bg-slate-50',
            )}
            onClick={() => selectTab(item.id)}
          >
            {item.label}
            {isSectionTab(item.id) && dirty[item.id] ? <span className="ms-2 inline-block h-2 w-2 rounded-full bg-amber-400" aria-label="تغييرات غير محفوظة" /> : null}
          </button>
        ))}
      </div>
      {siteSections.map((item) => (
        <div key={item.id} className={tab === item.id ? undefined : 'hidden'} hidden={tab !== item.id}>
          <SiteCopyForm section={item} onDirtyChange={onDirtyChange} />
        </div>
      ))}
      {tab === 'media' ? <MediaManager /> : null}
    </div>
  )
}

function MediaManager() {
  const [rows, setRows] = useState<ContentRow[]>([])
  const [editing, setEditing] = useState<ContentRow | null>(null)
  const [kind, setKind] = useState<ContentKind | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const visible = kind === 'all' ? rows : rows.filter((item) => item.kind === kind)

  useEffect(() => {
    let active = true
    setLoading(true)
    listContent()
      .then((result) => {
        if (!active) return
        setRows(result)
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

  return (
    <div>
      {error ? <div className="mb-4"><ErrorBanner message={error} /></div> : null}
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <ContentForm
            key={editing?.id ?? 'new'}
            initial={editing}
            onSaved={() => {
              setEditing(null)
              setVersion((current) => current + 1)
            }}
            onCancel={editing ? () => setEditing(null) : undefined}
            onError={setError}
          />
        </div>
        <div className="xl:col-span-3">
          <div className="mb-3 flex flex-wrap gap-2">
            <FilterChip active={kind === 'all'} onClick={() => setKind('all')}>الكل</FilterChip>
            {contentKinds.map((item) => (
              <FilterChip key={item} active={kind === item} onClick={() => setKind(item)}>{label.content(item)}</FilterChip>
            ))}
          </div>
          <DataShell>
            {loading ? <LoadingState plain /> : null}
            {!loading && visible.length === 0 ? (
              <EmptyState title="لا يوجد محتوى" body="أضف بنراً أو عرضاً أو إعلاناً، ثم فعّل النشر ليظهر في الموقع." />
            ) : null}
            {visible.length > 0 ? (
              <ul className="divide-y divide-line">
                {visible.map((item) => {
                  const image = mediaUrl(item.image_path)
                  return (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {image ? <img src={image} alt="" className="h-14 w-20 rounded-lg object-cover" /> : <span className="h-14 w-20 rounded-lg bg-slate-100" />}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-navy">{item.title}</p>
                          <p className="mt-1 text-xs text-muted">{label.content(item.kind)} · الترتيب {item.sort_order.toLocaleString('en-GB')}</p>
                          {item.body ? <p className="mt-1 line-clamp-1 text-xs text-muted">{item.body}</p> : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge tone={item.is_published ? 'success' : 'neutral'}>{item.is_published ? 'منشور' : 'مسودة'}</Badge>
                        <button type="button" className="text-sm text-navy" onClick={() => setEditing(item)}>تعديل</button>
                        <DeleteContent id={item.id} onDone={() => setVersion((current) => current + 1)} onError={setError} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </DataShell>
        </div>
      </div>
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      className={cx('h-9 rounded-full px-3 text-sm', active ? 'bg-navy text-white' : 'border border-line bg-white text-navy')}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function ContentForm({
  initial,
  onSaved,
  onCancel,
  onError,
}: {
  initial: ContentRow | null
  onSaved: () => void
  onCancel?: () => void
  onError: (message: string) => void
}) {
  const [pending, setPending] = useState(false)
  const [kind, setKind] = useState<ContentKind>((initial?.kind as ContentKind) || 'banner')
  const [published, setPublished] = useState(initial?.is_published ?? false)
  const preview = mediaUrl(initial?.image_path)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title') ?? '').trim()
    const link = String(form.get('link_url') ?? '').trim()
    if (title.length < 2) {
      onError('أدخل عنواناً للمحتوى.')
      return
    }
    if (link && !link.startsWith('https://')) {
      onError('الرابط يجب أن يبدأ بـ https://')
      return
    }
    setPending(true)
    try {
      const file = (event.currentTarget.elements.namedItem('image') as HTMLInputElement).files?.[0]
      let imagePath = initial?.image_path ?? null
      if (file) imagePath = await uploadPublicImage('website', file)
      await saveContent(
        {
          kind,
          title,
          body: String(form.get('body') ?? '').trim(),
          image_path: imagePath,
          link_url: link || null,
          sort_order: Number(form.get('sort_order') ?? 0),
          is_published: published,
        },
        initial?.id,
      )
      onSaved()
    } catch (err) {
      onError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <h3 className="font-semibold text-navy">{initial ? 'تعديل المحتوى' : 'إضافة بنر أو عرض أو إعلان'}</h3>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <label className="block text-sm font-medium">
          النوع
          <select className="mt-1.5 h-11 w-full rounded-lg border border-line px-3" value={kind} onChange={(event) => setKind(event.target.value as ContentKind)}>
            {contentKinds.map((item) => <option key={item} value={item}>{label.content(item)}</option>)}
          </select>
          <span className="mt-1 block text-xs font-normal text-muted">{kindHints[kind]}</span>
        </label>
        <TextField label="العنوان" name="title" defaultValue={initial?.title ?? empty.title} required />
        <TextAreaField label="النص" name="body" rows={4} defaultValue={initial?.body ?? ''} />
        <TextField label="رابط" name="link_url" defaultValue={initial?.link_url ?? ''} placeholder="https://" />
        <TextField label="الترتيب" name="sort_order" type="number" min="0" max="9999" defaultValue={initial?.sort_order ?? 0} />
        <label className="block text-sm font-medium">
          صورة
          <input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="mt-1.5 block text-sm" />
        </label>
        {preview ? <img src={preview} alt="" className="h-24 w-40 rounded-lg object-cover" /> : null}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
          نشر في الموقع
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>{pending ? 'جارٍ الحفظ...' : 'حفظ'}</Button>
          {onCancel ? <Button variant="secondary" onClick={onCancel}>إلغاء التعديل</Button> : null}
        </div>
      </form>
    </Card>
  )
}

function DeleteContent({ id, onDone, onError }: { id: string; onDone: () => void; onError: (message: string) => void }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  if (!open) return <button type="button" className="text-sm text-rose-700" onClick={() => setOpen(true)}>حذف</button>
  return (
    <span className="flex gap-2">
      <Button
        variant="danger"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          try {
            await deleteContent(id)
            onDone()
          } catch (err) {
            onError(errorText(err))
          } finally {
            setPending(false)
          }
        }}
      >
        تأكيد
      </Button>
      <Button variant="secondary" onClick={() => setOpen(false)}>تراجع</Button>
    </span>
  )
}
