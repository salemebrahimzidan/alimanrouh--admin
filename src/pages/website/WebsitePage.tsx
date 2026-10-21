import { useEffect, useState, type FormEvent } from 'react'
import { deleteContent, listContent, saveContent, uploadPublicImage, type ContentInput, type ContentRow } from '../../lib/api'
import { errorText } from '../../lib/format'
import { contentKinds, label, type ContentKind } from '../../lib/labels'
import { mediaUrl } from '../../lib/supabase'
import { Badge, Button, Card, DataShell, EmptyState, ErrorBanner, LoadingState, PageHeader, TextAreaField, TextField } from '../../components/ui'

const empty: ContentInput = {
  kind: 'banner',
  title: '',
  body: '',
  image_path: null,
  link_url: null,
  sort_order: 0,
  is_published: false,
}

export function WebsitePage() {
  const [rows, setRows] = useState<ContentRow[]>([])
  const [editing, setEditing] = useState<ContentRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

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
      <PageHeader
        title="إدارة الموقع"
        description="البنرات والعروض والإعلانات المنشورة هي المحتوى الذي سيقرأه الموقع الرسمي بعد الربط. برامج العمرة والحج وأسعارها تُدار من صفحاتها."
      />
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
            onError={setError}
          />
        </div>
        <div className="xl:col-span-3">
          <DataShell>
            {loading ? <LoadingState plain /> : null}
            {!loading && rows.length === 0 ? <EmptyState title="لا يوجد محتوى منشور أو مسودة" /> : null}
            {rows.length > 0 ? (
              <ul className="divide-y divide-line">
                {rows.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="font-medium text-navy">{item.title}</p>
                      <p className="mt-1 text-xs text-muted">{label.content(item.kind)} · الترتيب {item.sort_order.toLocaleString('ar-SA')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone={item.is_published ? 'success' : 'neutral'}>{item.is_published ? 'منشور' : 'مسودة'}</Badge>
                      <button type="button" className="text-sm text-navy" onClick={() => setEditing(item)}>تعديل</button>
                      <DeleteContent id={item.id} onDone={() => setVersion((current) => current + 1)} onError={setError} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </DataShell>
        </div>
      </div>
    </div>
  )
}

function ContentForm({
  initial,
  onSaved,
  onError,
}: {
  initial: ContentRow | null
  onSaved: () => void
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
      <h3 className="font-semibold text-navy">{initial ? 'تعديل المحتوى' : 'محتوى جديد'}</h3>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <label className="block text-sm font-medium">
          النوع
          <select className="mt-1.5 h-11 w-full rounded-lg border border-line px-3" value={kind} onChange={(event) => setKind(event.target.value as ContentKind)}>
            {contentKinds.map((item) => <option key={item} value={item}>{label.content(item)}</option>)}
          </select>
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
        <Button type="submit" disabled={pending}>{pending ? 'جارٍ الحفظ...' : 'حفظ'}</Button>
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
