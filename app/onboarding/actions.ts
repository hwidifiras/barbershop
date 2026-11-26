'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DOMPurify from 'isomorphic-dompurify'
import { BARBERSHOP_LOCALE, barbershopHourRows, barbershopModules, starterServiceRows, type StarterChoice } from '@/lib/barbershop-onboarding'

function sanitize(s: string): string {
  return DOMPurify.sanitize(s, { ALLOWED_TAGS: [] }).trim()
}

export async function completeOnboarding(data: {
  bizType: string
  bizName?: string
  serviceName: string
  servicePrice: number
  serviceDuration: number
  slug?: string
  /** Barbershop only: ticked starter services and the "do you sell products?" answer. */
  starterServices?: StarterChoice[]
  sellsProducts?: boolean
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // .order(created_at ASC).limit(1): resolve to the SAME row everything else
  // does (app/(dashboard)/layout.tsx, lib/business.ts) so onboarding_completed
  // lands on the row the dashboard will read. Without .limit(1), an install
  // that still has a duplicate row (pre-migration-036) makes .maybeSingle()
  // throw here and the whole last onboarding step fails with "Something went
  // wrong" — refreshing sometimes clears it, sometimes not.
  const { data: business } = await supabase
    .from('businesses')
    .select('id, slug, onboarding_completed')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!business) redirect('/login')

  // Sanitize and validate text fields
  const bizName = data.bizName ? sanitize(data.bizName).slice(0, 100) : undefined
  // serviceName can be empty — the user may have clicked "Skip" on the
  // first-service step. See the `if (serviceName && data.servicePrice)`
  // guard below: an empty name (or a name without a price) simply means
  // no service gets created, which is the intended Skip behaviour.
  const serviceName = sanitize(data.serviceName).slice(0, 100)

  // Server-side slug validation (defence against bypassed client checks)
  if (data.slug) {
    if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(data.slug)) {
      throw new Error('Invalid slug format')
    }
  }

  // Barbershop presets (docs/barbershop-mode/SPEC.md 4.8): first onboarding only, so a shop that
  // is already set up is never overwritten. Hours and services are written before the shop is
  // marked as onboarded, so a failure can simply be retried.
  const barbershopPreset = data.bizType === 'barbershop' && !business.onboarding_completed

  if (barbershopPreset) {
    const { error: hoursError } = await supabase
      .from('business_hours')
      .upsert(barbershopHourRows(business.id), { onConflict: 'business_id,day_of_week' })
    if (hoursError) throw new Error(hoursError.message)

    const wanted = starterServiceRows(business.id, data.starterServices ?? [])
    if (wanted.length) {
      const { data: existing, error: readError } = await supabase
        .from('services').select('name').eq('business_id', business.id)
      if (readError) throw new Error(readError.message)
      const taken = new Set((existing ?? []).map((s) => s.name))
      const rows = wanted.filter((row) => !taken.has(row.name))
      if (rows.length) {
        const { error: servicesError } = await supabase.from('services').insert(rows)
        if (servicesError) throw new Error(servicesError.message)
      }
    }
  }

  const basePatch = {
    ...(data.bizType ? { type: data.bizType } : {}),
    ...(bizName ? { name: bizName } : {}),
    ...(barbershopPreset
      ? {
          enabled_modules: barbershopModules(data.sellsProducts === true),
          notification_language: 'fr',
          ...BARBERSHOP_LOCALE,
        }
      : {}),
    onboarding_completed: true,
  }

  // Resolve the slug. Only touch it if the wizard actually changed it — the
  // pre-filled value already belongs to this row. If the chosen slug collides
  // with another business (a legitimately same-named business, or an orphaned
  // row from a manually-deleted account), transparently fall back to a
  // suffixed variant instead of failing the whole last onboarding step with a
  // generic error — same treatment getOrCreateBusiness() gives a slug
  // collision at registration.
  let finalSlug = business.slug
  const chosenSlug = data.slug ?? ''

  if (!chosenSlug || chosenSlug === business.slug) {
    const { error } = await supabase.from('businesses').update(basePatch).eq('id', business.id)
    if (error) throw new Error(error.message)
  } else {
    let applied = false
    for (let attempt = 0; attempt < 5; attempt++) {
      const trySlug = attempt === 0 ? chosenSlug : `${chosenSlug}-${Math.random().toString(36).slice(2, 6)}`
      const { error } = await supabase
        .from('businesses')
        .update({ ...basePatch, slug: trySlug })
        .eq('id', business.id)
      if (!error) {
        finalSlug = trySlug
        applied = true
        break
      }
      // Anything other than a unique violation is a real failure.
      if (error.code !== '23505') throw new Error(error.message)
    }
    if (!applied) {
      throw new Error('Could not assign a unique web address for your business — please pick a different name.')
    }
  }

  if (data.bizType !== 'barbershop' && serviceName && data.servicePrice) {
    await supabase.from('services').insert({
      business_id: business.id,
      name: serviceName,
      price: data.servicePrice,
      duration_min: data.serviceDuration || 60,
    })
  }

  // If NEXT_PUBLIC_ROOT_DOMAIN is set we're running in SaaS mode → go to subdomain
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN
  if (rootDomain && finalSlug) {
    redirect(`https://${finalSlug}.${rootDomain}/dashboard`)
  }

  redirect('/dashboard')
}
