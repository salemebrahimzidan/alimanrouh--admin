import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { ConfigurationScreen } from '../auth/RequireAdmin'
import { Button, Card, ErrorBanner, TextField } from '../components/ui'
import { agencyName } from '../lib/config'
import { errorText, isEmail, isMobile } from '../lib/format'
import { db } from '../lib/supabase'
import { registerCustomer, sendPasswordReset } from '../lib/portal'

export function CustomerLoginPage() {
  const { configured, loading, session } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  if (!configured) return <ConfigurationScreen />
  if (!loading && session) return <Navigate to="/portal" replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')
    if (!isEmail(email) || password.length < 8) {
      setError('أدخل بريداً صحيحاً وكلمة مرور لا تقل عن 8 أحرف.')
      return
    }
    setPending(true)
    const { error: signError } = await db().auth.signInWithPassword({ email: email.trim(), password })
    setPending(false)
    if (signError) setError(errorText(signError))
  }

  return (
    <AuthShell title="دخول العملاء" footer={<Link to="/portal/register">إنشاء حساب</Link>}>
      <form onSubmit={submit} className="space-y-4">
        <TextField label="البريد الإلكتروني" name="email" type="email" autoComplete="username" required />
        <TextField label="كلمة المرور" name="password" type="password" autoComplete="current-password" required minLength={8} />
        {error ? <ErrorBanner message={error} /> : null}
        <Button type="submit" className="w-full" disabled={pending}>{pending ? 'جارٍ الدخول...' : 'دخول'}</Button>
      </form>
      <Link to="/portal/forgot-password" className="mt-4 inline-block text-sm text-navy">نسيت كلمة المرور؟</Link>
    </AuthShell>
  )
}

export function RegisterPage() {
  const { configured, session, loading } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)
  if (!configured) return <ConfigurationScreen />
  if (!loading && session) return <Navigate to="/portal" replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const fullName = String(form.get('full_name') ?? '').trim()
    const mobile = String(form.get('mobile') ?? '').trim()
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    const confirm = String(form.get('confirm') ?? '')
    if (fullName.length < 2 || !isMobile(mobile) || !isEmail(email)) {
      setError('أدخل الاسم ورقم الجوال والبريد بشكل صحيح.')
      return
    }
    if (password.length < 8 || password !== confirm) {
      setError('كلمة المرور يجب ألا تقل عن 8 أحرف وأن تتطابق مع التأكيد.')
      return
    }
    setPending(true)
    setError(null)
    try {
      const result = await registerCustomer({ fullName, mobile, email, password })
      if (result.session) return
      setDone(true)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell title="تسجيل عميل جديد" footer={<Link to="/portal/login">لدي حساب</Link>}>
      {done ? (
        <p className="text-sm leading-7 text-ink">أُرسلت رسالة التحقق إلى بريدك. بعد التأكيد سيظهر حسابك في قائمة عملاء الإدارة حتى قبل إنشاء أي حجز.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <TextField label="الاسم الكامل" name="full_name" required />
          <TextField label="رقم الجوال" name="mobile" required placeholder="05xxxxxxxx" />
          <TextField label="البريد الإلكتروني" name="email" type="email" required />
          <TextField label="كلمة المرور" name="password" type="password" required minLength={8} />
          <TextField label="تأكيد كلمة المرور" name="confirm" type="password" required minLength={8} />
          {error ? <ErrorBanner message={error} /> : null}
          <Button type="submit" className="w-full" disabled={pending}>{pending ? 'جارٍ إنشاء الحساب...' : 'إنشاء الحساب'}</Button>
        </form>
      )}
    </AuthShell>
  )
}

export function ForgotPasswordPage() {
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email') ?? '')
    if (!isEmail(email)) {
      setError('أدخل بريداً إلكترونياً صحيحاً.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await sendPasswordReset(email)
      setNotice('إذا كان البريد مسجلاً فستصلك رسالة إعادة التعيين.')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell title="استعادة كلمة المرور" footer={<Link to="/portal/login">العودة للدخول</Link>}>
      <form onSubmit={submit} className="space-y-4">
        <TextField label="البريد الإلكتروني" name="email" type="email" required />
        {error ? <ErrorBanner message={error} /> : null}
        {notice ? <p className="text-sm text-emerald-800">{notice}</p> : null}
        <Button type="submit" disabled={pending}>{pending ? 'جارٍ الإرسال...' : 'إرسال الرابط'}</Button>
      </form>
    </AuthShell>
  )
}

function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <Card className="w-full max-w-md">
        <p className="text-sm text-gold">{agencyName}</p>
        <h1 className="mt-2 text-2xl font-semibold text-navy">{title}</h1>
        <div className="mt-6">{children}</div>
        {footer ? <div className="mt-6 text-sm text-navy">{footer}</div> : null}
      </Card>
    </div>
  )
}
