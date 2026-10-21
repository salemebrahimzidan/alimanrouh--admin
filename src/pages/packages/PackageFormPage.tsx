import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPackage, savePackage, uploadPublicImage } from '../../lib/api'
import { errorText } from '../../lib/format'
import { mediaUrl } from '../../lib/supabase'
import { BackLink, Button, Card, ErrorBanner, LoadingState, TextAreaField, TextField } from '../../components/ui'

export function PackageFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(Boolean(id))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [values, setValues] = useState({
    title: '',
    description: '',
    price_sar: '',
    duration_days: '',
    hotel_info: '',
    transportation: '',
    is_published: false,
  })

  useEffect(() => {
    if (!id) return
    let active = true
    getPackage(id)
      .then((row) => {
        if (!active) return
        if (!row) {
          setError('البرنامج غير موجود.')
          return
        }
        setImagePath(row.image_path)
        setValues({
          title: row.title,
          description: row.description,
          price_sar: String(row.price_sar),
          duration_days: String(row.duration_days),
          hotel_info: row.hotel_info,
          transportation: row.transportation,
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
    const price = Number(values.price_sar)
    const duration = Number(values.duration_days)
    if (values.title.trim().length < 2 || !Number.isFinite(price) || price < 0 || !Number.isInteger(duration) || duration < 1) {
      setError('أدخل عنواناً وسعراً صحيحاً بالريال ومدة لا تقل عن يوم.')
      return
    }
    setPending(true)
    setError(null)
    try {
      const file = (event.currentTarget.elements.namedItem('image') as HTMLInputElement).files?.[0]
      let nextImage = imagePath
      if (file) nextImage = await uploadPublicImage('umrah', file)
      await savePackage(
        {
          title: values.title.trim(),
          description: values.description.trim(),
          price_sar: price,
          duration_days: duration,
          hotel_info: values.hotel_info.trim(),
          transportation: values.transportation.trim(),
          image_path: nextImage,
          is_published: values.is_published,
        },
        id,
      )
      navigate('/umrah')
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
      <BackLink to="/umrah">العودة إلى البرامج</BackLink>
      <h2 className="mb-6 text-2xl font-semibold text-navy">{id ? 'تعديل برنامج العمرة' : 'برنامج عمرة جديد'}</h2>
      <Card>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <TextField label="اسم البرنامج" name="title" value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} required />
          <TextField label="السعر بالريال السعودي" name="price_sar" type="number" min="0" step="0.01" value={values.price_sar} onChange={(event) => setValues({ ...values, price_sar: event.target.value })} required />
          <TextField label="المدة بالأيام" name="duration_days" type="number" min="1" step="1" value={values.duration_days} onChange={(event) => setValues({ ...values, duration_days: event.target.value })} required />
          <TextField label="الفندق" name="hotel_info" value={values.hotel_info} onChange={(event) => setValues({ ...values, hotel_info: event.target.value })} />
          <div className="md:col-span-2">
            <TextField label="التنقل" name="transportation" value={values.transportation} onChange={(event) => setValues({ ...values, transportation: event.target.value })} />
          </div>
          <div className="md:col-span-2">
            <TextAreaField label="وصف البرنامج" name="description" rows={5} value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-ink">
              صورة البرنامج
              <input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="mt-1.5 block w-full text-sm" />
            </label>
            {preview ? <img src={preview} alt="" className="mt-3 h-32 w-48 rounded-lg object-cover" /> : null}
          </div>
          <label className="flex items-center gap-2 text-sm text-ink md:col-span-2">
            <input type="checkbox" checked={values.is_published} onChange={(event) => setValues({ ...values, is_published: event.target.checked })} />
            نشر البرنامج للموقع
          </label>
          {error ? <div className="md:col-span-2"><ErrorBanner message={error} /></div> : null}
          <div>
            <Button type="submit" disabled={pending}>{pending ? 'جارٍ الحفظ...' : 'حفظ البرنامج'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
