import { describe, it, expect } from 'vitest'
import { hideAdvanced, orderSettingsTabs } from '@/lib/barbershop-settings'

const tabs = ['general', 'services', 'employees', 'notifications', 'billing', 'modules', 'account'].map((key) => ({ key }))

describe('orderSettingsTabs', () => {
  it('leaves standard businesses exactly as they were', () => {
    expect(orderSettingsTabs(tabs, false)).toBe(tabs)
  })
  it('orders a barbershop as in the spec', () => {
    expect(orderSettingsTabs(tabs, true).map((t) => t.key)).toEqual(
      ['general', 'employees', 'services', 'notifications', 'modules', 'billing', 'account'],
    )
  })
})

describe('hideAdvanced', () => {
  it('never hides anything from a standard business', () => {
    expect(hideAdvanced(false, false)).toBe(false)
  })
  it('hides until opened in a barbershop', () => {
    expect(hideAdvanced(true, false)).toBe(true)
    expect(hideAdvanced(true, true)).toBe(false)
  })
})
