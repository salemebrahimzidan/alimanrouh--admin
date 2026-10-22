import { describe, expect, it } from 'vitest'
import { bundlesFromCopy, defaultCopy, normalizeCopy, validateCopy } from '../src/lib/site-copy'

describe('site copy', () => {
  it('turns saved fields into nested translation bundles and skips blanks', () => {
    const copy = defaultCopy('identity')
    copy.ar['shared.brand.name'] = '  اسم جديد  '
    copy.en['shared.brand.name'] = 'New name'
    copy.ar['shared.company.social.instagram'] = '   '
    copy.en['shared.company.social.instagram'] = ''
    const bundles = bundlesFromCopy([normalizeCopy('identity', copy)])
    expect(bundles.ar.shared).toMatchObject({ brand: { name: 'اسم جديد' } })
    expect(bundles.en.shared).toMatchObject({ brand: { name: 'New name' } })
    expect(JSON.stringify(bundles.ar.shared)).not.toContain('instagram')
  })

  it('rejects a social link that is not https', () => {
    const copy = defaultCopy('identity')
    copy.ar['shared.company.social.instagram'] = 'http://instagram.com/alimanrouh'
    expect(validateCopy('identity', copy)).toContain('https://')
  })

  it('keeps a shared phone on both languages', () => {
    const copy = defaultCopy('identity')
    copy.ar['shared.company.phone'] = '+966500000000'
    const clean = normalizeCopy('identity', copy)
    expect(clean.ar['shared.company.phone']).toBe('+966500000000')
    expect(clean.en['shared.company.phone']).toBe('+966500000000')
  })
})
