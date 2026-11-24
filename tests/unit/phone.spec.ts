import { describe, it, expect } from 'vitest'
import { normalizePhone, samePhone, formatPhone, lookupKey } from '@/lib/phone'

describe('normalizePhone', () => {
  it('gives the same key for every way of typing a Tunisian number', () => {
    const variants = [
      '50300200', '50 300 200', '503 00 200', '50-300-200', '50.300.200', ' 50300200 ',
      '+21650300200', '+216 50 300 200', '216 50 300 200', '21650300200', '0021650300200', '00216 50 300 200',
      '(+216) 50-300-200',
    ]
    for (const v of variants) expect(normalizePhone(v), v).toBe('50300200')
  })

  it('keeps numbers from other countries with their country code', () => {
    expect(normalizePhone('+33 6 12 34 56 78')).toBe('33612345678')
    expect(normalizePhone('0033612345678')).toBe('33612345678')
    expect(normalizePhone('0612345678')).toBe('0612345678')
  })

  it('does not strip 216 from numbers that are not 216 + 8 digits', () => {
    expect(normalizePhone('216123')).toBe('216123')
    expect(normalizePhone('2161234567890')).toBe('2161234567890')
  })

  it('returns null for empty or impossible numbers', () => {
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
    expect(normalizePhone(undefined)).toBeNull()
    expect(normalizePhone('abc')).toBeNull()
    expect(normalizePhone('123')).toBeNull()
    expect(normalizePhone('1234567890123456')).toBeNull()
  })
})

describe('samePhone / formatPhone', () => {
  it('compares by identity, not by spelling', () => {
    expect(samePhone('50 300 200', '+21650300200')).toBe(true)
    expect(samePhone('50 300 200', '50 300 201')).toBe(false)
    expect(samePhone('', '')).toBe(false)
    expect(samePhone(null, '50300200')).toBe(false)
  })

  it('formats Tunisian numbers in groups', () => {
    expect(formatPhone('+216 50300200')).toBe('50 300 200')
    expect(formatPhone('+33612345678')).toBe('33612345678')
    expect(formatPhone('')).toBe('')
  })
})

describe('lookupKey', () => {
  it('waits for the 8th digit of a Tunisian number, whatever the spelling', () => {
    expect(lookupKey('5030020')).toBeNull()
    expect(lookupKey('50 300 20')).toBeNull()
    expect(lookupKey('50 300 200')).toBe('50300200')
    expect(lookupKey('+216 50 300 200')).toBe('50300200')
    expect(lookupKey('216 50 300 2')).toBeNull()
  })

  it('accepts complete international numbers and ignores junk', () => {
    expect(lookupKey('+33 6 12 34 56 78')).toBe('33612345678')
    expect(lookupKey('123456789')).toBeNull()
    expect(lookupKey('')).toBeNull()
  })
})
