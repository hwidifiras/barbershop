// Business "vertical" selection. Barbershop mode is chosen by businesses.type
// ('barbershop') unless the shop overrides it with businesses.barbershop_mode.
// Every other type keeps the standard SaaS experience. See docs/barbershop-mode/SPEC.md.

export interface VerticalInput {
  type?: string | null
  barbershop_mode?: boolean | null
}

export function isBarbershopMode(business: VerticalInput | null | undefined): boolean {
  if (!business) return false
  if (typeof business.barbershop_mode === 'boolean') return business.barbershop_mode
  return business.type === 'barbershop'
}
