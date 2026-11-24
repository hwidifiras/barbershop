import { describe, it, expect } from 'vitest'
import { balanceOf, splitPayment } from '@/lib/kridi'

describe('splitPayment', () => {
  it('empty input = everything paid', () => expect(splitPayment(25, '')).toEqual({ received: 25, kridi: 0 }))
  it('partial', () => expect(splitPayment(25, '10')).toEqual({ received: 10, kridi: 15 }))
  it('zero = all kridi', () => expect(splitPayment(25, '0')).toEqual({ received: 0, kridi: 25 }))
  it('over total is capped', () => expect(splitPayment(25, '40')).toEqual({ received: 25, kridi: 0 }))
  it('negative or junk', () => {
    expect(splitPayment(25, '-5')).toEqual({ received: 0, kridi: 25 })
    expect(splitPayment(25, 'abc')).toEqual({ received: 25, kridi: 0 })
  })
  it('comma decimals and rounding', () => expect(splitPayment(12.5, '7,3')).toEqual({ received: 7.3, kridi: 5.2 }))
})

describe('balanceOf', () => {
  it('credits minus payments and write-offs', () => {
    expect(balanceOf([{ kind: 'credit', amount: '25' }, { kind: 'credit', amount: 10 }, { kind: 'payment', amount: 20 }])).toBe(15)
    expect(balanceOf([{ kind: 'credit', amount: 15 }, { kind: 'writeoff', amount: 15 }])).toBe(0)
  })
  it('never negative', () => expect(balanceOf([{ kind: 'payment', amount: 5 }])).toBe(0))
  it('empty', () => expect(balanceOf([])).toBe(0))
})
