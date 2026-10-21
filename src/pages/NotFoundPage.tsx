import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="rounded-2xl border border-line bg-white px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold text-navy">الصفحة غير موجودة</h1>
      <p className="mt-2 text-sm text-muted">تحقق من الرابط أو ارجع إلى الرئيسية.</p>
      <Link to="/" className="mt-6 inline-flex text-sm font-medium text-navy">
        الرئيسية
      </Link>
    </div>
  )
}
