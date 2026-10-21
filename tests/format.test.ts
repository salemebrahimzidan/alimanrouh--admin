import { describe, expect, it } from 'vitest'
import { errorText, formatDate, formatMoney, ilikeOr, pageRange, sanitizeSearch } from '../src/lib/format'

describe('formatters', () => {
  it('formats SAR amounts without losing the currency label', () => {
    expect(formatMoney(1500)).toContain('ر.س')
    expect(formatMoney(0)).toContain('ر.س')
  })

  it('formats date-only values and rejects empty input', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate('not-a-date')).toBe('—')
    expect(formatDate('2026-10-20')).not.toBe('—')
  })

  it('removes filter characters before building a search clause', () => {
    expect(sanitizeSearch(' a%b_c,d ')).toBe('abcd')
    expect(ilikeOr(['full_name', 'email'], ' ali ')).toBe('full_name.ilike."%ali%",email.ilike."%ali%"')
    expect(ilikeOr(['full_name'], ' % ')).toBeNull()
  })

  it('builds inclusive page ranges', () => {
    expect(pageRange(1, 15)).toEqual({ from: 0, to: 14 })
    expect(pageRange(3, 15)).toEqual({ from: 30, to: 44 })
    expect(pageRange(0, 15)).toEqual({ from: 0, to: 14 })
  })

  it('does not treat an ambiguous payment relationship as a missing database', () => {
    const embed = new Error("Could not embed because more than one relationship was found for 'payments' and 'bookings'")
    const text = errorText(embed)
    expect(text).not.toContain('غير جاهزة')
    expect(text).toContain('حدّث الصفحة')
    expect(errorText({ message: embed.message })).toBe(text)
  })
})
