// Settings layout for barbershop mode (docs/barbershop-mode/SPEC.md 4.7). Pure helpers, so the
// rule "standard businesses see no change" can be tested.

const BARBERSHOP_TAB_ORDER = ['general', 'employees', 'services', 'notifications', 'modules', 'billing', 'account']

/** Barbershop: Salon, Barbiers, Prestations, Notifications, Modules, Facturation, Compte. */
export function orderSettingsTabs<T extends { key: string }>(tabs: T[], barbershop: boolean): T[] {
  if (!barbershop) return tabs
  return [...tabs].sort((a, b) => BARBERSHOP_TAB_ORDER.indexOf(a.key) - BARBERSHOP_TAB_ORDER.indexOf(b.key))
}

/** True when a rarely used field must be hidden: barbershop only, until "Avancé" is opened. */
export function hideAdvanced(barbershop: boolean, open: boolean): boolean {
  return barbershop && !open
}
