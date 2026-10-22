import { siteSections, type CopyField, type SectionCopy, type SiteSection } from './site-copy'

export const cmsPageOrder = ['about', 'contact', 'umrah', 'hajj', 'visas', 'flights', 'hotels', 'offers'] as const

export type CmsPageId = (typeof cmsPageOrder)[number]

type PageDefinition = {
  id: CmsPageId
  title: string
  description: string
  namespace: string
}

export const cmsPages: PageDefinition[] = [
  { id: 'about', title: 'عن الشركة', description: 'عنوان الصفحة ونص التعريف.', namespace: 'about' },
  { id: 'contact', title: 'تواصل معنا', description: 'عنوان صفحة التواصل ونص الخريطة.', namespace: 'contact' },
  { id: 'umrah', title: 'العمرة', description: 'نصوص غلاف صفحة العمرة. البرامج والأسعار تبقى في صفحة برامج العمرة.', namespace: 'umrah' },
  { id: 'hajj', title: 'الحج', description: 'نصوص غلاف صفحة الحج. البرامج والأسعار تبقى في صفحة برامج الحج.', namespace: 'hajj' },
  { id: 'visas', title: 'التأشيرات', description: 'نصوص غلاف صفحة الزيارات والتأشيرات.', namespace: 'tourism' },
  { id: 'flights', title: 'الطيران', description: 'نصوص غلاف صفحة تذاكر الطيران والباخرة.', namespace: 'flights' },
  { id: 'hotels', title: 'الفنادق', description: 'عنوان صفحة الفنادق ووصفها.', namespace: 'hotels' },
  { id: 'offers', title: 'العروض', description: 'عناوين صفحة العروض. بطاقات العروض المنشورة تبقى في تبويب البنرات والعروض.', namespace: 'offers' },
]

export type CmsPageView = PageDefinition & {
  fields: CopyField[]
}

export function pagesSection() {
  const section = siteSections.find((item) => item.id === 'pages')
  if (!section) throw new Error('pages section is missing')
  return section
}

export function pagesForSection(section: SiteSection): CmsPageView[] {
  return cmsPages.map((page) => ({
    ...page,
    fields: section.groups.flatMap((group) => group.fields.filter((field) => field.id.startsWith(`${page.namespace}.`))),
  }))
}

export function unassignedPageFields(section: SiteSection) {
  const assigned = new Set(pagesForSection(section).flatMap((page) => page.fields.map((field) => field.id)))
  return section.groups.flatMap((group) => group.fields.filter((field) => !assigned.has(field.id)))
}

export function normalizePageSearch(query: string) {
  return query.trim().toLocaleLowerCase('en')
}

export function fieldMatchesSearch(field: CopyField, query: string, copy?: SectionCopy | null) {
  const needle = normalizePageSearch(query)
  if (!needle) return true
  const parts = [field.label, field.id, field.ar, field.en]
  if (copy) parts.push(copy.ar[field.id] ?? '', copy.en[field.id] ?? '')
  return parts.join('\n').toLocaleLowerCase('en').includes(needle)
}

export function visiblePageFields(page: { fields: CopyField[] }, query: string, copy?: SectionCopy | null) {
  return page.fields.filter((field) => fieldMatchesSearch(field, query, copy))
}

export const identityPartOrder = ['brand', 'contact', 'social', 'nav', 'footer'] as const

export type IdentityPartId = (typeof identityPartOrder)[number]

const identityPartDefinitions: Array<{ id: IdentityPartId; title: string; description: string; test: (id: string) => boolean }> = [
  { id: 'brand', title: 'اسم الوكالة', description: 'الاسم الكامل والمختصر والاسم اللاتيني.', test: (id) => id.startsWith('shared.brand.') },
  { id: 'contact', title: 'بيانات التواصل', description: 'الهاتف والبريد وساعات العمل والعناوين.', test: (id) => id.startsWith('shared.company.') && !id.startsWith('shared.company.social.') },
  { id: 'social', title: 'روابط التواصل', description: 'اترك الحقل فارغاً لإخفاء الأيقونة. الرابط يجب أن يبدأ بـ https://', test: (id) => id.startsWith('shared.company.social.') },
  { id: 'nav', title: 'القائمة', description: 'عناوين القائمة وزر احجز الآن.', test: (id) => id.startsWith('shared.nav.') || id.startsWith('shared.navbar.') },
  { id: 'footer', title: 'التذييل', description: 'عبارة التذييل وعناوين الأعمدة وحقوق النشر.', test: (id) => id.startsWith('shared.footer.') },
]

export function identitySection() {
  const section = siteSections.find((item) => item.id === 'identity')
  if (!section) throw new Error('identity section is missing')
  return section
}

export type FieldGroupView = {
  id: string
  title: string
  description: string
  fields: CopyField[]
}

export function identityPartsForSection(section: SiteSection): FieldGroupView[] {
  const fields = section.groups.flatMap((group) => group.fields)
  return identityPartDefinitions.map((part) => ({
    id: part.id,
    title: part.title,
    description: part.description,
    fields: fields.filter((field) => part.test(field.id)),
  }))
}

export function unassignedIdentityFields(section: SiteSection) {
  const assigned = new Set(identityPartsForSection(section).flatMap((part) => part.fields.map((field) => field.id)))
  return section.groups.flatMap((group) => group.fields.filter((field) => !assigned.has(field.id)))
}

export const homePartOrder = ['hero', 'benefits', 'stats', 'why', 'destinations', 'booking'] as const

export type HomePartId = (typeof homePartOrder)[number]

const homePartDefinitions: Array<{ id: HomePartId; title: string; description: string; groupTitle: string }> = [
  { id: 'hero', title: 'الغلاف', description: 'عنوان الغلاف والأزرار وزر واتساب.', groupTitle: 'الغلاف' },
  { id: 'benefits', title: 'المزايا', description: 'المزايا الأربع تحت الغلاف.', groupTitle: 'المزايا' },
  { id: 'stats', title: 'الأرقام', description: 'أرقام الخبرة والرضا والحجاج.', groupTitle: 'الأرقام' },
  { id: 'why', title: 'لماذا الإيمان روح', description: 'سبب الاختيار والبنود الأربعة.', groupTitle: 'لماذا الإيمان روح' },
  { id: 'destinations', title: 'الوجهات', description: 'عناوين الوجهات ووصف كل وجهة.', groupTitle: 'الوجهات' },
  { id: 'booking', title: 'الدعوة للحجز', description: 'دعوة التخطيط وفقرة الختام.', groupTitle: 'الدعوة للحجز' },
]

export function homeSection() {
  const section = siteSections.find((item) => item.id === 'home')
  if (!section) throw new Error('home section is missing')
  return section
}

export function homePartsForSection(section: SiteSection): FieldGroupView[] {
  return homePartDefinitions.map((part) => ({
    id: part.id,
    title: part.title,
    description: part.description,
    fields: section.groups.find((group) => group.title === part.groupTitle)?.fields ?? [],
  }))
}

export function unassignedHomeFields(section: SiteSection) {
  const assigned = new Set(homePartsForSection(section).flatMap((part) => part.fields.map((field) => field.id)))
  return section.groups.flatMap((group) => group.fields.filter((field) => !assigned.has(field.id)))
}
