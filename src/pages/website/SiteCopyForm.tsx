import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'
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
  type SectionCopy,
  type SiteSection,
  type SiteSectionId,
} from '../../lib/site-copy'
import {
  homePartsForSection,
  identityPartsForSection,
  pagesForSection,
  visiblePageFields,
  type FieldGroupView,
} from '../../lib/site-pages'
import { Button, Card, ErrorBanner, TextAreaField, TextField, cx } from '../../components/ui'
import { SocialLinkField, socialBrandId } from './SocialLinkField'

export function SiteCopyForm({
  section,
  onDirtyChange,
}: {
  section: SiteSection
  onDirtyChange: (id: SiteSectionId, dirty: boolean) => void
}) {
  const [lang, setLang] = useState<CopyLang>('ar')
  const [partId, setPartId] = useState(initialPart(section.id))
  const [query, setQuery] = useState('')
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

  function renderField(field: CopyField) {
    const brand = socialBrandId(field.id)
    if (brand) {
      return (
        <SocialLinkField
          key={field.id}
          label={field.label}
          brand={brand}
          value={value(field)}
          onChange={(next) => update(field, next)}
        />
      )
    }
    const english = field.localized && lang === 'en'
    const dir = field.ltr || english ? 'ltr' : undefined
    const shared = field.multiline ? (
      <TextAreaField
        label={field.label}
        rows={4}
        maxLength={2000}
        dir={dir}
        value={value(field)}
        onChange={(event) => update(field, event.target.value)}
      />
    ) : (
      <TextField
        label={field.label}
        maxLength={300}
        dir={dir}
        placeholder={field.input === 'url' ? 'https://' : undefined}
        value={value(field)}
        onChange={(event) => update(field, event.target.value)}
      />
    )
    return (
      <div key={field.id} className={field.multiline ? 'sm:col-span-2' : undefined}>
        {shared}
      </div>
    )
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
  const copy = pickerCopy(section.id)

  return (
    <div className="space-y-4">
      {state.status === 'error' && state.error ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ErrorBanner message={state.error} />
            <Button variant="secondary" onClick={() => setAttempt((current) => current + 1)}>
              إعادة المحاولة
            </Button>
          </div>
        </Card>
      ) : null}
      {state.status === 'loading' ? <Card><p className="text-sm text-muted">جارٍ تحميل النصوص الحالية...</p></Card> : null}
      {ready ? (
        <FieldPicker
          views={viewsFor(section)}
          selectedId={partId}
          query={query}
          draft={state.draft}
          lang={lang}
          dirty={dirty}
          selectLabel={copy.selectLabel}
          pending={pending}
          notice={notice}
          formError={formError}
          onSelect={setPartId}
          onQueryChange={setQuery}
          onLang={setLang}
          onSave={() => void save()}
          renderField={renderField}
        />
      ) : null}
    </div>
  )
}

function initialPart(sectionId: SiteSectionId) {
  if (sectionId === 'identity') return 'brand'
  if (sectionId === 'home') return 'hero'
  return 'about'
}

function viewsFor(section: SiteSection) {
  if (section.id === 'identity') return identityPartsForSection(section)
  if (section.id === 'home') return homePartsForSection(section)
  return pagesForSection(section)
}

function pickerCopy(sectionId: SiteSectionId) {
  if (sectionId === 'pages') return { selectLabel: 'الصفحة' }
  return { selectLabel: 'القسم' }
}

function FieldPicker({
  views,
  selectedId,
  query,
  draft,
  lang,
  dirty,
  selectLabel,
  pending,
  notice,
  formError,
  onSelect,
  onQueryChange,
  onLang,
  onSave,
  renderField,
}: {
  views: FieldGroupView[]
  selectedId: string
  query: string
  draft: SectionCopy | null
  lang: CopyLang
  dirty: boolean
  selectLabel: string
  pending: boolean
  notice: string | null
  formError: string | null
  onSelect: (id: string) => void
  onQueryChange: (query: string) => void
  onLang: (lang: CopyLang) => void
  onSave: () => void
  renderField: (field: CopyField) => ReactNode
}) {
  const selected = views.find((view) => view.id === selectedId) ?? views[0]
  const matches = views.map((view) => ({ view, fields: visiblePageFields(view, query, draft) }))
  const selectedFields = matches.find((item) => item.view.id === selected.id)?.fields ?? []
  const searching = query.trim().length > 0

  return (
    <Card>
      <div className="grid gap-4 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)_auto] lg:items-end">
        <SectionMenu
          label={selectLabel}
          value={selected.id}
          options={matches.map(({ view, fields }) => ({
            id: view.id,
            title: view.title,
            description: view.description,
            count: searching ? fields.length : null,
          }))}
          onChange={onSelect}
        />
        <TextField
          label="بحث"
          value={query}
          placeholder="ابحث في النصوص"
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <div className="inline-flex h-11 items-center self-end rounded-xl border border-line bg-slate-50 p-1">
          {(['ar', 'en'] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={cx('h-9 rounded-lg px-3 text-sm font-medium', lang === item ? 'bg-navy text-white' : 'text-navy')}
              onClick={() => onLang(item)}
            >
              {item === 'ar' ? 'العربية' : 'English'}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 border-t border-line pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-navy">{selected.title}</h3>
            <p className="mt-1 text-sm leading-6 text-muted">{selected.description}</p>
          </div>
          {dirty ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">تغييرات غير محفوظة</span> : null}
        </div>
        {selectedFields.length > 0 ? (
          <div className={cx('mt-5 grid', selected.id === 'social' ? 'gap-x-8 gap-y-3 lg:grid-cols-2' : 'gap-4 sm:grid-cols-2')}>
            {selectedFields.map((field) => renderField(field))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-muted">لا توجد نتائج في {selected.title}. الرقم بجانب الاسم في القائمة يوضح أين توجد النتائج.</p>
        )}
      </div>
      {formError ? <div className="mt-4"><ErrorBanner message={formError} /></div> : null}
      {notice ? <p className="mt-4 text-sm text-emerald-800">{notice}</p> : null}
      <div className="mt-6 flex justify-end border-t border-line pt-4">
        <Button disabled={pending} onClick={onSave}>
          {pending ? 'جارٍ الحفظ...' : 'حفظ ونشر'}
        </Button>
      </div>
    </Card>
  )
}

function SectionMenu({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ id: string; title: string; description: string; count: number | null }>
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const current = options.find((option) => option.id === value) ?? options[0]

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

  return (
    <div ref={rootRef} className="relative">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className={cx(
          'flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 text-sm shadow-sm outline-none transition',
          open ? 'border-gold ring-2 ring-gold/25' : 'border-line hover:border-slate-300',
        )}
      >
        <span className="truncate font-medium text-navy">{current?.title}</span>
        <ChevronDown className={cx('h-4 w-4 shrink-0 text-muted transition', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="absolute start-0 z-30 mt-2 w-[min(100vw-3rem,320px)] overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-lg">
          <ul id={listId} role="listbox" aria-label={label} className="max-h-80 overflow-auto">
            {options.map((option) => {
              const selected = option.id === current?.id
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(option.id)
                      setOpen(false)
                    }}
                    className={cx(
                      'flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-start transition',
                      selected ? 'bg-slate-50' : 'hover:bg-slate-50',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className={cx('block text-sm', selected ? 'font-semibold text-navy' : 'font-medium text-ink')}>{option.title}</span>
                        {option.count !== null ? <span className="rounded-full bg-slate-100 px-1.5 text-xs text-muted">{option.count}</span> : null}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted">{option.description}</span>
                    </span>
                    {selected ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" /> : null}
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
