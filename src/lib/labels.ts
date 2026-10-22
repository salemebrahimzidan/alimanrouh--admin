export const accountStatuses = ['pending_verification', 'active', 'suspended'] as const
export const bookingStatuses = ['pending', 'under_review', 'confirmed', 'completed', 'cancelled'] as const
export const visaStatuses = [
  'submitted',
  'under_review',
  'documents_requested',
  'processing',
  'ready_for_collection',
  'closed',
  'cancelled',
] as const
export const hajjInquiryStatuses = ['new', 'contacted', 'in_progress', 'closed'] as const
export const hajjProgramStatuses = ['draft', 'published', 'closed'] as const
export const paymentMethods = ['cash', 'bank_transfer', 'pos', 'other'] as const
export const paymentStatuses = ['recorded', 'void'] as const
export const contentKinds = ['banner', 'offer', 'announcement'] as const

export type AccountStatus = (typeof accountStatuses)[number]
export type BookingStatus = (typeof bookingStatuses)[number]
export type VisaStatus = (typeof visaStatuses)[number]
export type HajjInquiryStatus = (typeof hajjInquiryStatuses)[number]
export type HajjProgramStatus = (typeof hajjProgramStatuses)[number]
export type PaymentMethod = (typeof paymentMethods)[number]
export type PaymentStatus = (typeof paymentStatuses)[number]
export type ContentKind = (typeof contentKinds)[number]
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'gold'

const accountStatusLabels: Record<AccountStatus, string> = {
  pending_verification: 'بانتظار التحقق',
  active: 'نشط',
  suspended: 'موقوف',
}

const bookingStatusLabels: Record<BookingStatus, string> = {
  pending: 'قيد الانتظار',
  under_review: 'قيد المراجعة',
  confirmed: 'مؤكد',
  completed: 'مكتمل',
  cancelled: 'ملغى',
}

const visaStatusLabels: Record<VisaStatus, string> = {
  submitted: 'تم الاستلام',
  under_review: 'قيد المراجعة',
  documents_requested: 'مطلوب استكمال مستندات',
  processing: 'قيد المراجعة',
  ready_for_collection: 'جاهز للمتابعة',
  closed: 'مكتمل',
  cancelled: 'ملغى',
}

const hajjInquiryStatusLabels: Record<HajjInquiryStatus, string> = {
  new: 'جديد',
  contacted: 'تم التواصل',
  in_progress: 'قيد المتابعة',
  closed: 'مغلق',
}

const hajjProgramStatusLabels: Record<HajjProgramStatus, string> = {
  draft: 'مسودة',
  published: 'منشور',
  closed: 'مغلق',
}

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'نقداً',
  bank_transfer: 'تحويل بنكي',
  pos: 'شبكة',
  other: 'أخرى',
}

const paymentStatusLabels: Record<PaymentStatus, string> = {
  recorded: 'مسجّل',
  void: 'ملغى',
}

const contentKindLabels: Record<ContentKind, string> = {
  banner: 'بنر',
  offer: 'عرض',
  announcement: 'إعلان',
}

const auditActionLabels: Record<string, string> = {
  'profile.account_status': 'تغيير حالة الحساب',
  'client.created': 'عميل جديد',
  'booking.created': 'حجز جديد',
  'booking.status_change': 'تغيير حالة حجز',
  'booking.client_note': 'ملاحظة للعميل',
  'visa.created': 'إنشاء طلب تأشيرة',
  'visa.status_change': 'تغيير حالة تأشيرة',
  'visa.client_note': 'ملاحظة للعميل على طلب تأشيرة',
  'hajj_inquiry.created': 'استفسار حج جديد',
  'hajj_inquiry.status_change': 'تغيير حالة استفسار',
  'payment.recorded': 'تسجيل دفعة',
  'payment.voided': 'إلغاء قيد دفعة',
  'umrah_packages.publication': 'نشر برنامج عمرة',
  'hajj_programs.publication': 'نشر برنامج حج',
  'website_content.publication': 'نشر محتوى الموقع',
}

export function textLabel(labels: Record<string, string>, value: string | null | undefined) {
  if (!value) return '—'
  return labels[value] ?? value
}

export const label = {
  account: (value: string) => textLabel(accountStatusLabels, value),
  booking: (value: string) => textLabel(bookingStatusLabels, value),
  visa: (value: string) => textLabel(visaStatusLabels, value),
  inquiry: (value: string) => textLabel(hajjInquiryStatusLabels, value),
  program: (value: string) => textLabel(hajjProgramStatusLabels, value),
  paymentMethod: (value: string) => textLabel(paymentMethodLabels, value),
  payment: (value: string) => textLabel(paymentStatusLabels, value),
  content: (value: string) => textLabel(contentKindLabels, value),
  audit: (value: string) => textLabel(auditActionLabels, value),
}

export function accountTone(status: string): Tone {
  if (status === 'active') return 'success'
  if (status === 'suspended') return 'danger'
  if (status === 'pending_verification') return 'warning'
  return 'neutral'
}

const bookingFlow = ['pending', 'under_review', 'confirmed', 'completed'] as const satisfies readonly BookingStatus[]

export function nextBookingStatuses(current: string): BookingStatus[] {
  const index = bookingFlow.indexOf(current as (typeof bookingFlow)[number])
  if (index < 0 || index >= bookingFlow.length - 1) return []
  const next = bookingFlow[index + 1]
  return next ? [next, 'cancelled'] : []
}

export function bookingTone(status: string): Tone {
  if (status === 'pending') return 'warning'
  if (status === 'under_review') return 'info'
  if (status === 'confirmed') return 'success'
  if (status === 'completed') return 'gold'
  if (status === 'cancelled') return 'danger'
  return 'neutral'
}

export function visaTone(status: string): Tone {
  if (status === 'submitted' || status === 'documents_requested') return 'warning'
  if (status === 'under_review' || status === 'processing') return 'info'
  if (status === 'ready_for_collection') return 'success'
  if (status === 'closed') return 'gold'
  if (status === 'cancelled') return 'danger'
  return 'neutral'
}

export function inquiryTone(status: string): Tone {
  if (status === 'new') return 'warning'
  if (status === 'contacted' || status === 'in_progress') return 'info'
  return 'neutral'
}
