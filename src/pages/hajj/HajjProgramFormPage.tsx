import { BedDouble, Bus, Calendar, FileText } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getHajjProgram, saveHajjProgram, uploadPublicImage } from '../../lib/api'
import { errorText } from '../../lib/format'
import { hajjProgramStatuses, type HajjProgramStatus } from '../../lib/labels'
import { mediaUrl } from '../../lib/supabase'
import { ProgramForm } from '../../components/ProgramForm'
import { LoadingState, TextAreaField, TextField } from '../../components/ui'

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
          internal_status: values.is_published ? 'published' : 'closed',
          is_published: values.is_published,
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

  return (
    <ProgramForm
      backTo="/hajj"
      backLabel="العودة إلى برامج الحج"
      title={id ? 'تعديل برنامج الحج' : 'برنامج حج جديد'}
      description="أدخل تفاصيل البرنامج، ثم انشره عندما يكون جاهزاً للظهور في الموقع."
      pending={pending}
      error={error}
      onSubmit={submit}
      imageUrl={mediaUrl(imagePath)}
      onImageClear={() => setImagePath(null)}
      published={values.is_published}
      onPublishedChange={(next) => setValues({
        ...values,
        is_published: next,
        internal_status: next ? 'published' : 'closed',
      })}
    >
      <TextField label="اسم البرنامج" name="title" icon={<FileText className="h-4 w-4" />} value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} placeholder="مثال: برنامج الحج المميز" required />
      <TextField label="الموسم" name="season_label" icon={<Calendar className="h-4 w-4" />} value={values.season_label} onChange={(event) => setValues({ ...values, season_label: event.target.value })} placeholder="مثال: موسم الوكالة القادم" />
      <TextField label="السعر بالريال السعودي" name="price_sar" type="number" min="0" step="0.01" badge="اختياري" value={values.price_sar} onChange={(event) => setValues({ ...values, price_sar: event.target.value })} placeholder="مثال: 4500" />
      <TextField label="المدة بالأيام" name="duration_days" icon={<Calendar className="h-4 w-4" />} type="number" min="1" step="1" value={values.duration_days} onChange={(event) => setValues({ ...values, duration_days: event.target.value })} placeholder="مثال: 10" />
      <TextField label="الفندق" name="hotel_info" icon={<BedDouble className="h-4 w-4" />} value={values.hotel_info} onChange={(event) => setValues({ ...values, hotel_info: event.target.value })} placeholder="مثال: فندق 5 نجوم" />
      <TextField label="التنقل" name="transportation" icon={<Bus className="h-4 w-4" />} value={values.transportation} onChange={(event) => setValues({ ...values, transportation: event.target.value })} placeholder="مثال: حافلات خاصة" />
      <div className="sm:col-span-2">
        <TextAreaField label="وصف البرنامج" name="description" icon={<FileText className="h-4 w-4" />} rows={5} maxLength={100} value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} placeholder="اكتب تفاصيل البرنامج، الخدمات المشمولة، والمميزات، والمعلومات المهمة..." />
      </div>
    </ProgramForm>
  )
}
