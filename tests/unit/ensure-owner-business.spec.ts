import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureOwnerBusiness } from '@/lib/create-business'

/** Just enough of the Supabase client for ensureOwnerBusiness. */
function fakeAdmin() {
  const tables: Record<string, Record<string, unknown>[]> = { businesses: [], employees: [] }
  const from = (table: string) => {
    const filters: [string, unknown][] = []
    const rows = () => tables[table].filter((r) => filters.every(([k, v]) => r[k] === v))
    const query = {
      select: (_cols?: string, opts?: { head?: boolean }) =>
        opts?.head
          ? { eq: async (k: string, v: unknown) => ({ count: tables[table].filter((r) => r[k] === v).length }) }
          : query,
      eq: (k: string, v: unknown) => { filters.push([k, v]); return query },
      order: () => query,
      limit: () => query,
      maybeSingle: async () => ({ data: rows()[0] ?? null }),
      insert: (row: Record<string, unknown>) => {
        const saved: Record<string, unknown> = { id: `${table}-${tables[table].length + 1}`, ...row }
        tables[table].push(saved)
        return Object.assign(Promise.resolve({ error: null }), {
          select: () => ({ single: async () => ({ data: saved, error: null }) }),
        })
      },
    }
    return query
  }
  return { admin: { from } as unknown as SupabaseClient, tables }
}

describe('ensureOwnerBusiness', () => {
  const user = { id: '12345678-aaaa', email: 'sam.cuts@example.com' }

  it('creates the business and the owner as first employee', async () => {
    const { admin, tables } = fakeAdmin()
    const business = await ensureOwnerBusiness(admin, user)
    expect(business?.slug).toBe('samcuts')
    expect(tables.businesses).toHaveLength(1)
    expect(tables.employees).toHaveLength(1)
  })

  it('does nothing more when called again', async () => {
    const { admin, tables } = fakeAdmin()
    await ensureOwnerBusiness(admin, user)
    await ensureOwnerBusiness(admin, user)
    expect(tables.businesses).toHaveLength(1)
    expect(tables.employees).toHaveLength(1)
  })

  it('still gets a web address when the name has no latin letters', async () => {
    const { admin } = fakeAdmin()
    const business = await ensureOwnerBusiness(admin, { id: '12345678-aaaa', user_metadata: { full_name: 'حلاق' } })
    expect(business?.slug).toBe('shop-12345678')
  })
})
