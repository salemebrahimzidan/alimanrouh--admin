import { useEffect, useState } from 'react'
import { loadSiteSection, saveSiteSection } from '../../lib/api'
import { errorText } from '../../lib/format'
import {
  defaultCopy,
  normalizeCopy,
  validateCopy,
  type CopyField,
  type CopyLang,
  type SiteSection,
} from '../../lib/site-copy'
import { Button, Card, ErrorBanner, TextAreaField, TextField, cx } from '../../components/ui'

function settingsError(error: unknown) {
  const message = errorText(error)
  if (/site_settings|schema cache|does not exist|relation/i.test(message)) {
    return 'جدول إعدادات الموقع غير جاهز بعد. طبّق ترحيل قاعدة البيانات ثم أعد المحاولة.'
  }
  return message
}

export function SiteCopyForm({ section }: { section: SiteSection }) {
  const [lang, setLang] = useState<CopyLang>('ar')
  const [open, setOpen] = useState(0)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [ar, setAr] = useState<Record<string, string>>({})
  const [en, setEn] = useState<Record<string, string>>({})

  useEffect(() => {
    let active = true
    const fallback = defaultCopy(section.id)
    setAr(fallback.ar)
    setEn(fallback.en)
    setLang('ar')
    setOpen(0)
    setNotice(null)
    setLoading(true)
    loadSiteSection(section.id)
      .then((copy) => {
        if (!active) return
        setAr(copy.ar)
        setEn(copy.en)
        setError(null)
      })
      .catch((err: unknown) => {
        if (active) setError(settingsError(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [section.id])

  function value(field: CopyField) {
    return (field.localized && lang === 'en' ? en[field.id] : ar[field.id]) ?? ''
  }

  function update(field: CopyField, next: string) {
    setNotice(null)
    if (!field.localized || lang === 'ar') {
      setAr((current) => ({ ...current, [field.id]: next }))
      if (!field.localized) setEn((current) => ({ ...current, [field.id]: next }))
      return
    }
    setEn((current) => ({ ...current, [field.id]: next }))
  }

  async function save() {
    const copy = { ar, en }
    const problem = validateCopy(section.id, copy)
    if (problem) {
      setError(problem)
      setNotice(null)
      return
    }
    setPending(true)
    setError(null)
    try {
      const clean = normalizeCopy(section.id, copy)
      await saveSiteSection(section.id, clean)
      setAr(clean.ar)
      setEn(clean.en)
      setNotice('تم الحفظ. يظهر النص في الموقع الرسمي مباشرة.')
    } catch (err) {
      setError(settingsError(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-navy">{section.title}</h3>
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
            <Button disabled={loading || pending} onClick={() => void save()}>
              {pending ? 'جارٍ الحفظ...' : 'حفظ ونشر'}
            </Button>
          </div>
        </div>
        {error ? <div className="mt-4"><ErrorBanner message={error} /></div> : null}
        {notice ? <p className="mt-4 text-sm text-emerald-800">{notice}</p> : null}
      </Card>
      {loading ? <Card><p className="text-sm text-muted">جارٍ تحميل النصوص الحالية...</p></Card> : null}
      {!loading ? section.groups.map((group, index) => {
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
