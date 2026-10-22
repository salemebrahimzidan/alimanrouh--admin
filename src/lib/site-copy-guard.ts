import { normalizeCopy, validateCopy, type CopyLang, type SectionCopy, type SiteSectionId } from './site-copy'

export const SECTION_LOAD_ERROR =
  'تعذر تحميل هذا القسم. لم يُستبدل المحتوى المنشور، ولن يُحفظ شيء حتى ينجح التحميل.'

export const SECTION_TABLE_ERROR =
  'جدول إعدادات الموقع غير جاهز بعد. لم يُستبدل المحتوى المنشور. أعد المحاولة بعد تجهيز قاعدة البيانات.'

export const UNSAVED_CHANGES_MESSAGE =
  'لديك تغييرات لم تُحفظ. لن تُنشر على الموقع إلا بعد الضغط على حفظ ونشر. هل تريد المتابعة دون نشر؟'

export type SectionEditorStatus = 'loading' | 'ready' | 'error'

export type SectionEditorState = {
  status: SectionEditorStatus
  baseline: SectionCopy | null
  draft: SectionCopy | null
  error: string | null
}

export type SectionPublishRow = {
  section: SiteSectionId
  content: SectionCopy
}

const emptyDirty: Record<SiteSectionId, boolean> = {
  identity: false,
  home: false,
  pages: false,
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return ''
}

function copySignature(copy: SectionCopy) {
  const keys = [...new Set([...Object.keys(copy.ar), ...Object.keys(copy.en)])].sort()
  return JSON.stringify(keys.map((key) => [key, copy.ar[key] ?? '', copy.en[key] ?? '']))
}

export function loadErrorMessage(error: unknown) {
  const message = errorMessage(error)
  if (/site_settings|schema cache|does not exist|relation|could not find the table/i.test(message)) {
    return SECTION_TABLE_ERROR
  }
  return SECTION_LOAD_ERROR
}

export function startSectionLoad(): SectionEditorState {
  return { status: 'loading', baseline: null, draft: null, error: null }
}

export function sectionLoaded(copy: SectionCopy): SectionEditorState {
  return { status: 'ready', baseline: copy, draft: copy, error: null }
}

export function sectionLoadFailed(error: unknown): SectionEditorState {
  return { status: 'error', baseline: null, draft: null, error: loadErrorMessage(error) }
}

export function canPublishSection(state: SectionEditorState) {
  return state.status === 'ready' && state.baseline !== null && state.draft !== null
}

export function withDraftChange(
  state: SectionEditorState,
  lang: CopyLang,
  fieldId: string,
  value: string,
  localized: boolean,
): SectionEditorState {
  if (!canPublishSection(state) || !state.draft) return state
  const draft: SectionCopy = {
    ar: { ...state.draft.ar },
    en: { ...state.draft.en },
  }
  if (!localized || lang === 'ar') {
    draft.ar[fieldId] = value
    if (!localized) draft.en[fieldId] = value
  } else {
    draft.en[fieldId] = value
  }
  return { ...state, draft }
}

export function isSectionDirty(state: SectionEditorState) {
  if (!canPublishSection(state) || !state.baseline || !state.draft) return false
  return copySignature(state.baseline) !== copySignature(state.draft)
}

export function publishSection(section: SiteSectionId, state: SectionEditorState) {
  if (!canPublishSection(state) || !state.draft) return null
  const problem = validateCopy(section, state.draft)
  if (problem) return { ok: false as const, error: problem }
  return {
    ok: true as const,
    row: { section, content: normalizeCopy(section, state.draft) } satisfies SectionPublishRow,
  }
}

export function shouldWarnOnSectionChange(dirty: Readonly<Record<SiteSectionId, boolean>>, leaving: SiteSectionId | 'media') {
  if (leaving === 'media') return false
  return dirty[leaving] === true
}

export function hasUnsavedChanges(dirty: Readonly<Partial<Record<SiteSectionId, boolean>>>) {
  return (Object.keys(emptyDirty) as SiteSectionId[]).some((id) => dirty[id] === true)
}
