// Client identity for barbershop mode (docs/barbershop-mode/SPEC.md 4.5): look a client up by phone
// number, whatever the spelling, using the computed `clients.phone_key` column (migration 042).

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhone } from '@/lib/phone'

export interface ClientByPhone {
  id: string
  name: string
  phone: string | null
}

/**
 * The client of this business whose phone number is the same as `rawPhone`, or null.
 * If a shop already holds duplicates, the oldest record wins so every path picks the same one.
 */
export async function findClientByPhone(
  supabase: SupabaseClient, businessId: string, rawPhone: string | null | undefined, excludeId?: string,
): Promise<ClientByPhone | null> {
  const key = normalizePhone(rawPhone)
  if (!key) return null
  let query = supabase.from('clients').select('id, name, phone')
    .eq('business_id', businessId).eq('phone_key', key)
    .order('created_at', { ascending: true }).limit(1)
  if (excludeId) query = query.neq('id', excludeId)
  const { data } = await query.maybeSingle()
  return (data as ClientByPhone | null) ?? null
}
