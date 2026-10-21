import { useState, type FormEvent, type MouseEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { MoonStar } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { ConfigurationScreen, NotAdminScreen } from '../auth/RequireAdmin'
import { Button, ErrorBanner, LoadingState, TextField } from '../components/ui'
import { agencyName, customerPortalEnabled } from '../lib/config'
import { errorText, isEmail } from '../lib/format'
import { db } from '../lib/supabase'
import { sendPasswordReset } from '../lib/portal'

export function LoginPage() {
  const { configured, loading, session, isAdmin, authError } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [resetting, setResetting] = useState(false)

  if (!configured) return <ConfigurationScreen />
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas">
        <LoadingState label="جارٍ التحقق من الجلسة" />
      </div>
    )
  }
  if (authError) return <ConfigurationScreen detail={authError} />
  if (session && isAdmin) return <Navigate to="/" replace />
  if (session && !isAdmin) return <NotAdminScreen />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')
    if (!isEmail(email) || password.length < 8) {
      setError('أدخل بريداً إلكترونياً صحيحاً وكلمة مرور لا تقل عن 8 أحرف.')
      return
    }
    setPending(true)
    setError(null)
    setNotice(null)
    const { error: signError } = await db().auth.signInWithPassword({ email: email.trim(), password })
    setPending(false)
    if (signError) setError(errorText(signError))
  }

  async function reset(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form
    if (!form) return
    const email = String(new FormData(form).get('email') ?? '')
    if (!isEmail(email)) {
      setError('أدخل البريد الإلكتروني لإرسال رابط الاستعادة.')
      return
    }
    setResetting(true)
    setError(null)
    try {
      await sendPasswordReset(email)
      setNotice('إذا كان البريد مرتبطاً بحساب الإدارة فستصلك رسالة إعادة التعيين.')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-navy text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-y-0 left-0 w-px bg-gold/70" />
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold text-gold">
            <MoonStar className="h-6 w-6" />
          </span>
          <p className="text-sm text-gold">لوحة الإدارة</p>
        </div>
        <div>
          <h1 className="max-w-md text-4xl font-semibold leading-snug">{agencyName}</h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-white/75">
            متابعة العملاء والحجوزات وبرامج العمرة والحج وطلبات التأشيرات والمدفوعات من مكان واحد.
          </p>
        </div>
        <p className="text-xs text-white/50">الدخول مخصص لحساب الإدارة المعتمد فقط.</p>
      </section>
      <section className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold text-gold">
              <MoonStar className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-gold">لوحة الإدارة</p>
              <p className="text-sm font-semibold text-navy">{agencyName}</p>
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-navy">تسجيل الدخول</h2>
          <p className="mt-2 text-sm leading-6 text-muted">لا يتوفر تسجيل عام لحسابات الإدارة.</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <TextField label="البريد الإلكتروني" name="email" type="email" autoComplete="username" required />
            <TextField label="كلمة المرور" name="password" type="password" autoComplete="current-password" required minLength={8} />
            {error ? <ErrorBanner message={error} /> : null}
            {notice ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p> : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'جارٍ الدخول...' : 'دخول'}
            </Button>
            <button type="button" onClick={reset} className="text-sm text-navy hover:text-gold" disabled={resetting}>
              {resetting ? 'جارٍ الإرسال...' : 'نسيت كلمة المرور؟'}
            </button>
          </form>
          {customerPortalEnabled ? (
            <p className="mt-8 text-xs leading-6 text-muted">
              أثناء التطوير يمكن تجربة تسجيل العملاء من{' '}
              <Link className="text-navy underline" to="/portal/register">
                بوابة العميل
              </Link>
              . هذه البوابة لا تُعرض في نسخة الإدارة الإنتاجية.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
