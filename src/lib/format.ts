export function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

export function formatMoney(value: number) {
  const amount = new Intl.NumberFormat('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
  return `${amount} ر.س`
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium' }).format(date)
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function englishAmount(value: number) {
  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

export function sanitizeSearch(value: string) {
  return value.trim().replace(/[%_\\",]/g, '')
}

export function ilikeOr(columns: string[], term: string) {
  const clean = sanitizeSearch(term)
  if (!clean) return null
  const pattern = `"%${clean}%"`
  return columns.map((column) => `${column}.ilike.${pattern}`).join(',')
}

export function pageRange(page: number, pageSize: number) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const from = (safePage - 1) * pageSize
  return { from, to: from + pageSize - 1 }
}

export function displayName(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : 'بدون اسم'
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function isMobile(value: string) {
  return /^[0-9+\s-]{8,20}$/.test(value.trim())
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return 'حدث خطأ غير متوقع'
}

export function errorText(error: unknown) {
  const message = errorMessage(error)
  if (/invalid login credentials/i.test(message)) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
  if (/email not confirmed/i.test(message)) return 'يلزم تأكيد البريد الإلكتروني قبل تسجيل الدخول.'
  if (/user already registered/i.test(message)) return 'هذا البريد مسجّل مسبقاً.'
  if (/account cannot/i.test(message)) return 'الحساب غير مفعّل أو موقوف، ولا يمكنه إرسال هذا الطلب.'
  if (/package is not available/i.test(message)) return 'البرنامج غير متاح للحجز.'
  if (/status must follow the previous step/i.test(message)) return 'لا يمكن تجاوز حالة. انتقل إلى الخطوة التالية فقط.'
  if (/not authorized|permission denied|42501/i.test(message)) return 'ليست لديك صلاحية لتنفيذ هذا الإجراء.'
  if (/more than one relationship was found|could not find a relationship/i.test(message)) {
    return 'تعذر ربط السجلات المرتبطة. حدّث الصفحة.'
  }
  if (/could not find the (table|relation|function)|does not exist/i.test(message) && !/relationship/i.test(message)) {
    return 'قاعدة البيانات غير جاهزة. طبّق ملف SQL بعد مراجعته ثم أعد المحاولة.'
  }
  return message
}
