// Phone identity for barbershop mode (docs/barbershop-mode/SPEC.md 4.5): the phone number is what
// identifies a client, so every way of typing the same number must give the same key.
//   "50 300 200", "503 00 200", "50300200", "+216 50 300 200", "21650300200", "0021650300200"
//   all become "50300200" (Tunisian numbers are kept as their 8 local digits).
// Numbers from other countries keep their country code ("+33 6 12 34 56 78" -> "33612345678").
// KEEP IN SYNC with public.normalize_phone() in supabase/migrations/042_client_phone_key.sql.

const TN_CODE = '216'
const TN_LOCAL_LENGTH = 8

/** Canonical digits for a phone number, or null when it is empty or cannot be a phone number. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = String(raw).trim()
  const hasPlus = trimmed.startsWith('+')
  let digits = trimmed.replace(/\D/g, '')
  if (!hasPlus && digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith(TN_CODE) && digits.length === TN_CODE.length + TN_LOCAL_LENGTH) digits = digits.slice(TN_CODE.length)
  if (digits.length < 6 || digits.length > 15) return null
  return digits
}

/** True when two typed numbers are the same phone number. */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a)
  return na !== null && na === normalizePhone(b)
}

/** Display form: "50 300 200" for a Tunisian number, digits as-is otherwise. */
export function formatPhone(raw: string | null | undefined): string {
  const n = normalizePhone(raw)
  if (!n) return raw?.trim() ?? ''
  if (n.length === TN_LOCAL_LENGTH) return `${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`
  return n
}

/**
 * Key to look an existing booking up with, only once the number looks complete: the 8 local digits of a
 * Tunisian number, or a full international number (10+ digits). Fewer digits = still typing = null.
 */
export function lookupKey(raw: string | null | undefined): string | null {
  const key = normalizePhone(raw)
  if (!key) return null
  return key.length === TN_LOCAL_LENGTH || key.length >= 10 ? key : null
}

/** Number for a WhatsApp link (wa.me): country code included, digits only. Null if unusable. */
export function whatsappNumber(raw: string | null | undefined): string | null {
  const n = normalizePhone(raw)
  if (!n) return null
  return n.length === TN_LOCAL_LENGTH ? `${TN_CODE}${n}` : n
}
