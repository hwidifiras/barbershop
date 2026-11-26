// What a new barbershop gets at the end of onboarding (docs/barbershop-mode/SPEC.md 4.8 and 7).
// Pure functions, shared by the wizard and the server action. Applies to new signups only.

export const STARTER_SERVICES = [
  { key: 'cut', name: 'Coupe', price: 15, duration: 30, preselected: true },
  { key: 'beard', name: 'Barbe', price: 10, duration: 20, preselected: true },
  { key: 'combo', name: 'Coupe + Barbe', price: 22, duration: 45, preselected: false },
  { key: 'kids', name: 'Coupe enfant', price: 10, duration: 20, preselected: false },
  { key: 'shave', name: 'Rasage', price: 10, duration: 30, preselected: false },
] as const

export type StarterKey = (typeof STARTER_SERVICES)[number]['key']

export interface StarterChoice {
  key: string
  price: number
  duration: number
}

export const MIN_DURATION = 5
export const MAX_DURATION = 480
export const MAX_PRICE = 100000

export function isValidChoice(c: { price: number; duration: number }): boolean {
  return (
    Number.isFinite(c.price) && c.price > 0 && c.price <= MAX_PRICE &&
    Number.isInteger(c.duration) && c.duration >= MIN_DURATION && c.duration <= MAX_DURATION
  )
}

/**
 * Rows to insert for the ticked starter services. The browser only sends a key, a price and a
 * duration: names come from the list above, unknown keys and invalid values are dropped.
 */
export function starterServiceRows(businessId: string, choices: StarterChoice[]) {
  return STARTER_SERVICES.flatMap((starter) => {
    const choice = choices.find((c) => c.key === starter.key)
    if (!choice || !isValidChoice(choice)) return []
    return [{
      business_id: businessId,
      name: starter.name,
      price: choice.price,
      duration_min: choice.duration,
      kind: 'main',
    }]
  })
}

/** A new barbershop starts in Tunisian dinars on Tunis time (changeable in Settings). */
export const BARBERSHOP_LOCALE = { currency: 'TND', timezone: 'Africa/Tunis' } as const

/** Products are opt-in for a barbershop. */
export function barbershopModules(sellsProducts: boolean): string[] {
  const modules = ['bookings', 'crm', 'pos', 'notifications']
  return sellsProducts ? [...modules, 'inventory'] : modules
}

/** Default week: Tuesday to Saturday, 09:00 to 19:00 (0 = Sunday). Editable in Settings. */
export function barbershopHourRows(businessId: string) {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    business_id: businessId,
    day_of_week: day,
    is_open: day >= 2,
    open_time: '09:00',
    close_time: '19:00',
    break_start: null,
    break_end: null,
  }))
}
