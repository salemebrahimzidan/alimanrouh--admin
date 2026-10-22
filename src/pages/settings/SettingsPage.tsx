import { useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { agencyName } from '../../lib/config'
import { errorText } from '../../lib/format'
import { updatePassword } from '../../lib/portal'
import { Button, Card, ErrorBanner, PageHeader, TextField } from '../../components/ui'

export function SettingsPage() {
  const { session } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const password = String(data.get('password') ?? '')
    const confirm = String(data.get('confirm') ?? '')
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
    setNotice(null)
    try {
      await updatePassword(password)
      form.reset()
      setNotice('تم تحديث كلمة المرور.')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      <PageHeader title="الإعدادات" description="حساب الإدارة الحالي. لا توجد إدارة موظفين أو أدوار." />
      {error ? <div className="mb-4"><ErrorBanner message={error} /></div> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="font-semibold text-navy">الحساب</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-muted">الوكالة</dt>
              <dd className="mt-1">{agencyName}</dd>
            </div>
            <div>
              <dt className="text-muted">البريد</dt>
              <dd className="mt-1">{session?.user.email}</dd>
            </div>
            <div>
              <dt className="text-muted">مشروع Supabase</dt>
              <dd className="mt-1 break-all">{import.meta.env.VITE_SUPABASE_URL}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-6 text-muted">
            مفتاح service role غير مستخدم في هذه الواجهة، ولا يجب وضعه في ملفات البيئة الخاصة بها.
          </p>
        </Card>
        <Card>
          <h3 className="font-semibold text-navy">تغيير كلمة المرور</h3>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <TextField label="كلمة المرور الجديدة" name="password" type="password" autoComplete="new-password" required minLength={8} />
            <TextField label="التأكيد" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
            {notice ? <p className="text-sm text-emerald-800">{notice}</p> : null}
            <Button type="submit" disabled={pending}>{pending ? 'جارٍ الحفظ...' : 'تحديث كلمة المرور'}</Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
