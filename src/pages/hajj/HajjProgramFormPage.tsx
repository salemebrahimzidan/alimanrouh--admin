import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getHajjProgram, saveHajjProgram, uploadPublicImage } from '../../lib/api'
import { hajjDisclaimer } from '../../lib/config'
import { errorText } from '../../lib/format'
import { hajjProgramStatuses, label, type HajjProgramStatus } from '../../lib/labels'
import { mediaUrl } from '../../lib/supabase'
import { BackLink, Button, Card, ErrorBanner, LoadingState, Notice, TextAreaField, TextField } from '../../components/ui'

export function HajjProgramFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(Boolean(id))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [values, setValues] = useState({
    title: '',
    season_label: '',
    description: '',
    price_sar: '',
    duration_days: '',
    hotel_info: '',
    transportation: '',
    internal_status: 'draft' as HajjProgramStatus,
    is_published: false,
  })

  useEffect(() => {
    if (!id) return
    let active = true
    getHajjProgram(id)
      .then((row) => {
        if (!active) return
        if (!row) {
          setError('البرنامج غير موجود.')
          return
        }
        setImagePath(row.image_path)
        setValues({
          title: row.title,
          season_label: row.season_label,
          description: row.description,
          price_sar: row.price_sar == null ? '' : String(row.price_sar),
          duration_days: row.duration_days == null ? '' : String(row.duration_days),
          hotel_info: row.hotel_info,
          transportation: row.transportation,
          internal_status: (hajjProgramStatuses as readonly string[]).includes(row.internal_status)
            ? (row.internal_status as HajjProgramStatus)
            : 'draft',
          is_published: row.is_published,
        })
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
  }, [id])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const price = values.price_sar.trim() === '' ? null : Number(values.price_sar)
    const duration = values.duration_days.trim() === '' ? null : Number(values.duration_days)
    if (values.title.trim().length < 2) {
      setError('أدخل اسم البرنامج.')
      return
    }
    if (price != null && (!Number.isFinite(price) || price < 0)) {
      setError('السعر غير صحيح.')
      return
    }
    if (duration != null && (!Number.isInteger(duration) || duration < 1)) {
      setError('المدة غير صحيحة.')
      return
    }
    setPending(true)
    setError(null)
    try {
      const file = (event.currentTarget.elements.namedItem('image') as HTMLInputElement).files?.[0]
      let nextImage = imagePath
      if (file) nextImage = await uploadPublicImage('hajj', file)
      const published = values.internal_status === 'published'
      await saveHajjProgram(
        {
          title: values.title.trim(),
          description: values.description.trim(),
          season_label: values.season_label.trim(),
          price_sar: price,
          duration_days: duration,
          hotel_info: values.hotel_info.trim(),
          transportation: values.transportation.trim(),
          image_path: nextImage,
          internal_status: values.internal_status,
          is_published: published || values.is_published,
        },
        id,
      )
      navigate('/hajj')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  if (loading) return <LoadingState />
  const preview = mediaUrl(imagePath)

  return (
    <div>
      <BackLink to="/hajj">العودة إلى برامج الحج</BackLink>
      <h2 className="mb-4 text-2xl font-semibold text-navy">{id ? 'تعديل برنامج الحج' : 'برنامج حج جديد'}</h2>
      <div className="mb-4"><Notice>{hajjDisclaimer}</Notice></div>
      <Card>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <TextField label="اسم البرنامج" value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} required />
          <TextField label="الموسم" value={values.season_label} onChange={(event) => setValues({ ...values, season_label: event.target.value })} placeholder="مثال: موسم الوكالة القادم" />
          <TextField label="السعر بالريال، إن وُجد" type="number" min="0" step="0.01" value={values.price_sar} onChange={(event) => setValues({ ...values, price_sar: event.target.value })} />
          <TextField label="المدة بالأيام" type="number" min="1" step="1" value={values.duration_days} onChange={(event) => setValues({ ...values, duration_days: event.target.value })} />
          <TextField label="الفندق" value={values.hotel_info} onChange={(event) => setValues({ ...values, hotel_info: event.target.value })} />
          <TextField label="التنقل" value={values.transportation} onChange={(event) => setValues({ ...values, transportation: event.target.value })} />
          <div className="md:col-span-2">
            <TextAreaField label="الوصف" rows={5} value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} />
          </div>
          <label className="block text-sm font-medium">
            الحالة الداخلية
            <select
              className="mt-1.5 h-11 w-full rounded-lg border border-line px-3"
              value={values.internal_status}
              onChange={(event) => {
                const internal_status = event.target.value as HajjProgramStatus
                setValues({ ...values, internal_status, is_published: internal_status === 'published' })
              }}
            >
              {hajjProgramStatuses.map((status) => (
                <option key={status} value={status}>{label.program(status)}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.is_published}
              onChange={(event) => setValues({
                ...values,
                is_published: event.target.checked,
                internal_status: event.target.checked ? 'published' : values.internal_status === 'published' ? 'draft' : values.internal_status,
              })}
            />
            إظهار البرنامج في الموقع
          </label>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium">
              صورة البرنامج
              <input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="mt-1.5 block text-sm" />
            </label>
            {preview ? <img src={preview} alt="" className="mt-3 h-32 w-48 rounded-lg object-cover" /> : null}
          </div>
          {error ? <div className="md:col-span-2"><ErrorBanner message={error} /></div> : null}
          <Button type="submit" disabled={pending}>{pending ? 'جارٍ الحفظ...' : 'حفظ البرنامج'}</Button>
        </form>
      </Card>
    </div>
  )
}
