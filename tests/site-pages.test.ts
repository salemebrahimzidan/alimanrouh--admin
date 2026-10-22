import { describe, expect, it } from 'vitest'
import { defaultCopy, sectionFields } from '../src/lib/site-copy'
import { publishSection, sectionLoaded, withDraftChange } from '../src/lib/site-copy-guard'
import {
  cmsPageOrder,
  fieldMatchesSearch,
  homePartOrder,
  homePartsForSection,
  homeSection,
  identityPartOrder,
  identityPartsForSection,
  identitySection,
  pagesForSection,
  pagesSection,
  unassignedHomeFields,
  unassignedIdentityFields,
  unassignedPageFields,
  visiblePageFields,
} from '../src/lib/site-pages'

describe('cms pages', () => {
  const section = pagesSection()
  const pages = pagesForSection(section)

  it('lists the existing pages in the editor order and keeps every current key', () => {
    expect(pages.map((page) => page.id)).toEqual([...cmsPageOrder])
    expect(unassignedPageFields(section)).toEqual([])
    const visible = pages.flatMap((page) => page.fields.map((field) => field.id))
    expect(visible.slice().sort()).toEqual(sectionFields('pages').map((field) => field.id).slice().sort())
    expect(new Set(visible).size).toBe(visible.length)
    expect(pages.find((page) => page.id === 'visas')?.fields.every((field) => field.id.startsWith('tourism.'))).toBe(true)
  })

  it('filters one page without dropping the other saved keys', () => {
    const umrah = pages.find((page) => page.id === 'umrah')
    expect(umrah).toBeTruthy()
    const matches = visiblePageFields(umrah!, 'عمرة')
    expect(matches.map((field) => field.id)).toContain('umrah.hero.eyebrow')
    expect(matches.every((field) => field.id.startsWith('umrah.'))).toBe(true)
    const state = withDraftChange(sectionLoaded(defaultCopy('pages')), 'ar', 'about.title', 'عنوان جديد', true)
    const result = publishSection('pages', state)
    expect(result?.ok).toBe(true)
    if (!result?.ok) return
    expect(result.row.section).toBe('pages')
    expect(result.row.content.ar['about.title']).toBe('عنوان جديد')
    expect(result.row.content.en['about.title']).toBe(defaultCopy('pages').en['about.title'])
    expect(result.row.content.ar['contact.title']).toBe(defaultCopy('pages').ar['contact.title'])
    expect(result.row.content.ar['umrah.hero.title']).toBeTruthy()
    expect(result.row.content.en['offers.empty']).toBeTruthy()
  })

  it('finds a field by its Arabic text, English text, or key', () => {
    const fields = sectionFields('pages')
    const eyebrow = fields.find((field) => field.id === 'hajj.hero.eyebrow')
    expect(eyebrow && fieldMatchesSearch(eyebrow, 'برامج الحج')).toBe(true)
    expect(eyebrow && fieldMatchesSearch(eyebrow, 'Hajj programs')).toBe(true)
    expect(eyebrow && fieldMatchesSearch(eyebrow, 'hajj.hero.eyebrow')).toBe(true)
    expect(eyebrow && fieldMatchesSearch(eyebrow, 'فندق')).toBe(false)
    const hotels = pages.find((page) => page.id === 'hotels')
    expect(visiblePageFields(hotels!, 'Browse stays').map((field) => field.id)).toEqual(['hotels.subtitle'])
  })
})

describe('cms identity', () => {
  const section = identitySection()
  const parts = identityPartsForSection(section)

  it('splits identity into the existing groups and keeps every key', () => {
    expect(parts.map((part) => part.id)).toEqual([...identityPartOrder])
    expect(unassignedIdentityFields(section)).toEqual([])
    const visible = parts.flatMap((part) => part.fields.map((field) => field.id))
    expect(visible.slice().sort()).toEqual(sectionFields('identity').map((field) => field.id).slice().sort())
    expect(new Set(visible).size).toBe(visible.length)
    expect(parts.find((part) => part.id === 'nav')?.fields.map((field) => field.id)).toContain('shared.navbar.bookNow')
    expect(parts.find((part) => part.id === 'social')?.fields.every((field) => field.id.includes('.social.'))).toBe(true)
  })

  it('filters one identity group without dropping the rest of the saved section', () => {
    const social = parts.find((part) => part.id === 'social')
    expect(visiblePageFields(social!, 'instagram').map((field) => field.id)).toEqual(['shared.company.social.instagram'])
    const state = withDraftChange(sectionLoaded(defaultCopy('identity')), 'ar', 'shared.brand.nameShort', 'اسم التجربة', true)
    const result = publishSection('identity', state)
    expect(result?.ok).toBe(true)
    if (!result?.ok) return
    expect(result.row.section).toBe('identity')
    expect(result.row.content.ar['shared.brand.nameShort']).toBe('اسم التجربة')
    expect(result.row.content.en['shared.brand.nameShort']).toBe('Al Iman Rouh')
    expect(result.row.content.ar['shared.company.phone']).toBe(defaultCopy('identity').ar['shared.company.phone'])
    expect(result.row.content.ar['shared.footer.headline']).toBeTruthy()
    expect(result.row.content.ar['home.hero.titleLead']).toBeUndefined()
  })
})

describe('cms home', () => {
  const section = homeSection()
  const parts = homePartsForSection(section)

  it('splits the homepage into the existing groups and keeps every key', () => {
    expect(parts.map((part) => part.id)).toEqual([...homePartOrder])
    expect(unassignedHomeFields(section)).toEqual([])
    const visible = parts.flatMap((part) => part.fields.map((field) => field.id))
    expect(visible.slice().sort()).toEqual(sectionFields('home').map((field) => field.id).slice().sort())
    expect(new Set(visible).size).toBe(visible.length)
    expect(parts.find((part) => part.id === 'hero')?.fields.map((field) => field.id)).toContain('home.whatsapp.label')
    expect(parts.find((part) => part.id === 'booking')?.fields.map((field) => field.id)).toContain('home.contactCta.action')
  })

  it('filters one homepage group without dropping the rest of the saved section', () => {
    const destinations = parts.find((part) => part.id === 'destinations')
    expect(visiblePageFields(destinations!, 'مكة').map((field) => field.id)).toContain('home.destinations.items.0.name')
    const state = withDraftChange(sectionLoaded(defaultCopy('home')), 'en', 'home.hero.titleLead', 'A new journey', true)
    const result = publishSection('home', state)
    expect(result?.ok).toBe(true)
    if (!result?.ok) return
    expect(result.row.section).toBe('home')
    expect(result.row.content.en['home.hero.titleLead']).toBe('A new journey')
    expect(result.row.content.ar['home.hero.titleLead']).toBe(defaultCopy('home').ar['home.hero.titleLead'])
    expect(result.row.content.ar['home.stats.eyebrow']).toBeTruthy()
    expect(result.row.content.ar['shared.brand.name']).toBeUndefined()
  })
})