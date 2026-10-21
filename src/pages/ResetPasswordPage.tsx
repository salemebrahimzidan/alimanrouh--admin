import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { ConfigurationScreen } from '../auth/RequireAdmin'
import { Button, Card, ErrorBanner, TextField } from '../components/ui'
import { errorText } from '../lib/format'
import { updatePassword } from '../lib/portal'

export function ResetPasswordPage() {
  const { configured, loading, session } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  if (!configured) return <ConfigurationScreen />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') ?? '')
    const confirm = String(form.get('confirm') ?? '')
    if (password.length < 8) {
      setError('كلمة المرور يجب ألا تقل عن 8 أحرف.')
      return
    }
    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await updatePassword(password)
      setDone(true)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-6">
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-semibold text-navy">تعيين كلمة مرور جديدة</h1>
        {loading ? <span role="status" aria-busy="true" className="mt-5 inline-block h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-navy" /> : null}
        {!loading && !session ? (
          <p className="mt-4 text-sm leading-7 text-muted">
            رابط الاستعادة غير صالح أو انتهت صلاحيته. اطلب رابطاً جديداً من صفحة الدخول.
          </p>
        ) : null}
        {done ? <p className="mt-4 text-sm leading-7 text-emerald-800">تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.</p> : null}
        {!done && session ? (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <TextField label="كلمة المرور الجديدة" name="password" type="password" autoComplete="new-password" required minLength={8} />
            <TextField label="تأكيد كلمة المرور" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
            {error ? <ErrorBanner message={error} /> : null}
            <Button type="submit" disabled={pending}>
              {pending ? 'جارٍ الحفظ...' : 'حفظ كلمة المرور'}
            </Button>
          </form>
        ) : null}
        <Link to="/login" className="mt-6 inline-block text-sm text-navy">
          العودة لتسجيل الدخول
        </Link>
      </Card>
    </div>
  )
}
