import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { agencyName, publicSiteUrl } from '../lib/config'
import { Button, LoadingState } from '../components/ui'

export function ConfigurationScreen({ detail }: { detail?: string | null }) {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-6 py-12">
      <div className="w-full max-w-xl rounded-2xl border border-line bg-white p-8 shadow-sm">
        <p className="text-sm text-gold">إعداد مطلوب</p>
        <h1 className="mt-2 text-2xl font-semibold text-navy">{agencyName}</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          لوحة الإدارة تقرأ البيانات من Supabase. ضع مفتاح anon العام في ملف .env.local ثم أعد تشغيل الخادم المحلي.
        </p>
        <ol className="mt-5 list-decimal space-y-2 pr-5 text-sm leading-6 text-ink">
          <li>من Supabase افتح Project Settings ثم API.</li>
          <li>انسخ المفتاح anon public إلى VITE_SUPABASE_ANON_KEY.</li>
          <li>لا تضع مفتاح service role في هذا المشروع.</li>
        </ol>
        {detail ? <pre className="mt-5 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{detail}</pre> : null}
      </div>
    </div>
  )
}

export function NotAdminScreen() {
  const { session, signOut } = useAuth()
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-navy">هذا الحساب غير مخوّل</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          الدخول إلى لوحة الإدارة مقصور على حساب الإدارة المعتمد. تسجيل العملاء يتم عبر الموقع الرسمي ولا يمنح صلاحية الإدارة.
        </p>
        <p className="mt-3 text-sm text-ink">{session?.user.email}</p>
        <a className="mt-4 block text-sm text-navy underline" href={publicSiteUrl}>
          الانتقال إلى الموقع الرسمي
        </a>
        <Button className="mt-6" variant="secondary" onClick={() => signOut()}>
          تسجيل الخروج
        </Button>
      </div>
    </div>
  )
}

export function RequireAdmin() {
  const { configured, loading, session, isAdmin, authError } = useAuth()
  if (!configured) return <ConfigurationScreen />
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas">
        <LoadingState label="جارٍ التحقق من الصلاحية" />
      </div>
    )
  }
  if (authError) return <ConfigurationScreen detail={authError} />
  if (!session) return <Navigate to="/login" replace />
  if (!isAdmin) return <NotAdminScreen />
  return <Outlet />
}
