import { useEffect, useState } from 'react'
import { loadSiteSection, saveSiteSection } from '../../lib/api'
import { errorText } from '../../lib/format'
import {
  canPublishSection,
  isSectionDirty,
  publishSection,
  sectionLoadFailed,
  sectionLoaded,
  startSectionLoad,
  withDraftChange,
  type SectionEditorState,
} from '../../lib/site-copy-guard'
import {
  type CopyField,
  type CopyLang,
  type SiteSection,
  type SiteSectionId,
} from '../../lib/site-copy'
import { Button, Card, ErrorBanner, TextAreaField, TextField, cx } from '../../components/ui'

export function SiteCopyForm({
  section,
  onDirtyChange,
}: {
  section: SiteSection
  onDirtyChange: (id: SiteSectionId, dirty: boolean) => void
}) {
  const [lang, setLang] = useState<CopyLang>('ar')
  const [open, setOpen] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [state, setState] = useState<SectionEditorState>(() => startSectionLoad())
  const dirty = isSectionDirty(state)

  useEffect(() => {
    let active = true
    setState(startSectionLoad())
    setNotice(null)
    setFormError(null)
    loadSiteSection(section.id)
      .then((copy) => {
        if (!active) return
        setState(sectionLoaded(copy))
      })
      .catch((err: unknown) => {
        if (!active) return
        setState(sectionLoadFailed(err))
      })
    return () => {
      active = false
    }
  }, [section.id, attempt])

  useEffect(() => {
    onDirtyChange(section.id, dirty)
    return () => onDirtyChange(section.id, false)
  }, [dirty, onDirtyChange, section.id])

  function value(field: CopyField) {
    if (!state.draft) return ''
    return (field.localized && lang === 'en' ? state.draft.en[field.id] : state.draft.ar[field.id]) ?? ''
  }

  function update(field: CopyField, next: string) {
    setNotice(null)
    setState((current) => withDraftChange(current, lang, field.id, next, field.localized))
  }

  async function save() {
    const result = publishSection(section.id, state)
    if (!result) return
    if (!result.ok) {
      setFormError(result.error)
      setNotice(null)
      return
    }
    setPending(true)
    setFormError(null)
    try {
      await saveSiteSection(result.row.section, result.row.content)
      setState(sectionLoaded(result.row.content))
      setNotice('تم الحفظ. يظهر النص في الموقع الرسمي مباشرة.')
    } catch (err) {
      const message = errorText(err)
      const raw = err instanceof Error ? err.message : ''
      setFormError(message && message !== raw ? message : 'تعذر حفظ هذا القسم. المحتوى المنشور لم يتغير.')
    } finally {
      setPending(false)
    }
  }

  const ready = canPublishSection(state)

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-navy">
              {section.title}
              {dirty ? <span className="ms-2 text-sm font-medium text-amber-800">تغييرات غير محفوظة</span> : null}
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">{section.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-line bg-slate-50 p-1">
              {(['ar', 'en'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={cx('h-9 rounded-lg px-3 text-sm font-medium', lang === item ? 'bg-navy text-white' : 'text-navy')}
                  onClick={() => setLang(item)}
                >
                  {item === 'ar' ? 'العربية' : 'English'}
                </button>
              ))}
            </div>
            <Button disabled={!ready || pending} onClick={() => void save()}>
              {pending ? 'جارٍ الحفظ...' : 'حفظ ونشر'}
            </Button>
          </div>
        </div>
        {formError ? <div className="mt-4"><ErrorBanner message={formError} /></div> : null}
        {state.status === 'error' && state.error ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ErrorBanner message={state.error} />
            <Button variant="secondary" onClick={() => setAttempt((current) => current + 1)}>
              إعادة المحاولة
            </Button>
          </div>
        ) : null}
        {notice ? <p className="mt-4 text-sm text-emerald-800">{notice}</p> : null}
      </Card>
      {state.status === 'loading' ? <Card><p className="text-sm text-muted">جارٍ تحميل النصوص الحالية...</p></Card> : null}
      {ready ? section.groups.map((group, index) => {
        const expanded = open === index
        return (
          <Card key={group.title}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 text-start"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? -1 : index)}
            >
              <span>
                <span className="block font-semibold text-navy">{group.title}</span>
                {group.hint ? <span className="mt-1 block text-xs leading-5 text-muted">{group.hint}</span> : null}
              </span>
              <span className="text-sm text-muted">{expanded ? 'إخفاء' : 'تعديل'}</span>
            </button>
            {expanded ? (
              <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                {group.fields.map((item) => {
                  const english = item.localized && lang === 'en'
                  const dir = item.ltr || english ? 'ltr' : undefined
                  const shared = (
                    item.multiline ? (
                      <TextAreaField
                        label={item.label}
                        rows={4}
                        maxLength={2000}
                        dir={dir}
                        value={value(item)}
                        onChange={(event) => update(item, event.target.value)}
                      />
                    ) : (
                      <TextField
                        label={item.label}
                        maxLength={300}
                        dir={dir}
                        placeholder={item.input === 'url' ? 'https://' : undefined}
                        value={value(item)}
                        onChange={(event) => update(item, event.target.value)}
                      />
                    )
                  )
                  return (
                    <div key={item.id} className={item.multiline ? 'sm:col-span-2' : undefined}>
                      {shared}
                    </div>
                  )
                })}
              </div>
            ) : null}
          </Card>
        )
      }) : null}
    </div>
  )
}
