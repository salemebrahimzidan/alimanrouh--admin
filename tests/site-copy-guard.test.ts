import { describe, expect, it } from 'vitest'
import { defaultCopy } from '../src/lib/site-copy'
import {
  SECTION_LOAD_ERROR,
  SECTION_TABLE_ERROR,
  canPublishSection,
  hasUnsavedChanges,
  isSectionDirty,
  publishSection,
  sectionLoadFailed,
  sectionLoaded,
  shouldWarnOnSectionChange,
  startSectionLoad,
  withDraftChange,
} from '../src/lib/site-copy-guard'

describe('site copy save safety', () => {
  it('does not publish defaults when loading fails', () => {
    const failed = sectionLoadFailed(new Error('Could not find the table site_settings in the schema cache'))
    const offline = sectionLoadFailed(new Error('Failed to fetch'))
    expect(failed.status).toBe('error')
    expect(failed.draft).toBeNull()
    expect(failed.baseline).toBeNull()
    expect(failed.error).toBe(SECTION_TABLE_ERROR)
    expect(offline.error).toBe(SECTION_LOAD_ERROR)
    expect(canPublishSection(failed)).toBe(false)
    expect(canPublishSection(startSectionLoad())).toBe(false)
    expect(publishSection('identity', failed)).toBeNull()
    expect(publishSection('home', startSectionLoad())).toBeNull()
    expect(isSectionDirty(failed)).toBe(false)
  })

  it('publishes only the loaded section and keeps both languages', () => {
    const identity = sectionLoaded(defaultCopy('identity'))
    const edited = withDraftChange(identity, 'en', 'shared.brand.name', 'New name', true)
    const result = publishSection('identity', edited)
    expect(result?.ok).toBe(true)
    if (!result?.ok) return
    expect(result.row.section).toBe('identity')
    expect(result.row.content.en['shared.brand.name']).toBe('New name')
    expect(result.row.content.ar['shared.brand.name']).toBe(identity.baseline?.ar['shared.brand.name'])
    expect(result.row.content.ar['home.hero.titleLead']).toBeUndefined()
    expect(result.row.content.en['about.title']).toBeUndefined()

    const home = publishSection('home', sectionLoaded(defaultCopy('home')))
    expect(home?.ok).toBe(true)
    if (!home?.ok) return
    expect(home.row.section).toBe('home')
    expect(home.row.content.ar['shared.brand.name']).toBeUndefined()
    expect(home.row.section).not.toBe(result.row.section)
  })

  it('tracks unsaved changes separately and warns only for the edited section', () => {
    const identity = withDraftChange(sectionLoaded(defaultCopy('identity')), 'ar', 'shared.brand.nameShort', 'اسم التجربة', true)
    const home = sectionLoaded(defaultCopy('home'))
    expect(isSectionDirty(identity)).toBe(true)
    expect(isSectionDirty(home)).toBe(false)
    expect(identity.draft?.en['shared.brand.name']).toBe(identity.baseline?.en['shared.brand.name'])
    const dirty = { identity: true, home: false, pages: false }
    expect(shouldWarnOnSectionChange(dirty, 'identity')).toBe(true)
    expect(shouldWarnOnSectionChange(dirty, 'home')).toBe(false)
    expect(shouldWarnOnSectionChange(dirty, 'pages')).toBe(false)
    expect(shouldWarnOnSectionChange(dirty, 'media')).toBe(false)
    expect(hasUnsavedChanges(dirty)).toBe(true)
    expect(hasUnsavedChanges({ identity: false, home: false, pages: false })).toBe(false)
  })

  it('keeps a shared phone on both languages while editing', () => {
    const next = withDraftChange(sectionLoaded(defaultCopy('identity')), 'ar', 'shared.company.phone', '+966500000000', false)
    expect(next.draft?.ar['shared.company.phone']).toBe('+966500000000')
    expect(next.draft?.en['shared.company.phone']).toBe('+966500000000')
    expect(isSectionDirty(next)).toBe(true)
  })
})
