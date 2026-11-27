import { describe, it, expect } from 'vitest'
import { matchesClient, sortByUse } from '@/lib/barbershop-pos'

describe('sortByUse', () => {
  const services = [{ name: 'Barbe' }, { name: 'Coupe' }, { name: 'Rasage' }]
  it('puts the most sold first and keeps the rest in order', () => {
    const sales = [{ items: [{ name: 'Coupe', qty: 2 }] }, { items: [{ name: 'Rasage' }] }, { items: null }]
    expect(sortByUse(services, sales).map((s) => s.name)).toEqual(['Coupe', 'Rasage', 'Barbe'])
  })
  it('changes nothing without sales', () => {
    expect(sortByUse(services, []).map((s) => s.name)).toEqual(['Barbe', 'Coupe', 'Rasage'])
  })
})

describe('matchesClient', () => {
  const client = { name: 'Sami Ben Ali', phone: '50300200' }
  it('matches part of the name', () => expect(matchesClient(client, 'ben')).toBe(true))
  it('matches any spelling of the number', () => {
    for (const q of ['503 00', '+216 50 300 200', '0021650300', '300200']) expect(matchesClient(client, q)).toBe(true)
  })
  it('ignores too few digits and other numbers', () => {
    expect(matchesClient(client, '50')).toBe(false)
    expect(matchesClient(client, '999')).toBe(false)
  })
  it('keeps everyone when nothing is typed', () => expect(matchesClient(client, ' ')).toBe(true))
})
