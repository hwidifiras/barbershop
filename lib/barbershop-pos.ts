// Helpers for the barbershop Caisse (docs/barbershop-mode/SPEC.md 4.4).

/** Services sold most come first; equal counts keep their original (alphabetical) order. */
export function sortByUse<T extends { name: string }>(services: T[], sales: { items: unknown }[]): T[] {
  const used = new Map<string, number>()
  for (const sale of sales) {
    if (!Array.isArray(sale.items)) continue
    for (const item of sale.items as { name?: unknown; qty?: unknown }[]) {
      if (typeof item?.name !== 'string') continue
      used.set(item.name, (used.get(item.name) ?? 0) + (Number(item.qty) || 1))
    }
  }
  return [...services].sort((a, b) => (used.get(b.name) ?? 0) - (used.get(a.name) ?? 0))
}

/** Digits of a typed number without the Tunisian prefix, so "+216 50 300" matches "50300200". */
function searchDigits(text: string): string {
  return text.replace(/\D/g, '').replace(/^(00216|216(?=\d{3}))/, '')
}

/** Find a client by part of the name, or 3+ digits of the number in any spelling. */
export function matchesClient(client: { name: string; phone: string | null }, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (client.name.toLowerCase().includes(q)) return true
  const digits = searchDigits(q)
  return digits.length >= 3 && (client.phone ?? '').replace(/\D/g, '').includes(digits)
}
