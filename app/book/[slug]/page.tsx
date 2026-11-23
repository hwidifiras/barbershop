export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import { PublicBookingForm } from './booking-form'
import { getTelegramBotInfo } from '@/lib/telegram'
import { getViberBotInfo } from '@/lib/viber'
import { LangSwitcher } from '@/components/layout/lang-switcher'
import { getTranslations } from 'next-intl/server'
import { isBarbershopMode } from '@/lib/vertical'
import { accentFor } from '@/lib/barbershop-theme'
import { fr } from '@/lib/barbershop-fr'
import { BarberBooking } from './barber-booking'
import { bricolage, dmSans } from '@/lib/landing-fonts'
import barberStyles from './barber-booking.module.css'

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const t = await getTranslations('publicBooking')
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('businesses')
    .select('name, type, barbershop_mode')
    .eq('slug', params.slug)
    .maybeSingle()

  if (data && isBarbershopMode(data)) {
    return { title: `${fr.booking.headerTagline} — ${data.name}` }
  }

  return {
    title: data ? `${t('bookAnAppointment')} — ${data.name}` : t('bookAnAppointment'),
  }
}

export default async function PublicBookingPage(props: {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ b?: string; s?: string }>
}) {
  const params = await props.params;
  const query = (await props.searchParams) ?? {}
  const t = await getTranslations('publicBooking')
  const supabase = createServiceClient()

  // Public data — brand_color included for warm/premium design
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, type, phone, logo_url, currency, slug, timezone, address, brand_color, barbershop_mode, online_booking_enabled')
    .eq('slug', params.slug)
    .maybeSingle()

  if (!business) notFound()

  // Barbershop mode (docs/barbershop-mode/SPEC.md 4.9): phone-first flow, French only.
  // Every other business type falls through to the unchanged standard page below.
  if (isBarbershopMode(business)) {
    const accent = accentFor(business.brand_color)

    if (business.online_booking_enabled === false) {
      return (
        <div
          className={`${barberStyles.root} ${bricolage.variable} ${dmSans.variable}`}
          style={{ '--accent': accent } as React.CSSProperties}
        >
          <main className={barberStyles.main} style={{ textAlign: 'center', paddingTop: 72 }}>
            <h1 className={`${barberStyles.h2} ${barberStyles.display}`}>{fr.booking.onlineOffTitle}</h1>
            <p className={barberStyles.muted}>{business.name}</p>
            <p className={barberStyles.muted}>{fr.booking.onlineOffBody}</p>
            {business.phone && (
              <div className={barberStyles.actions}>
                <a className={barberStyles.btn} href={`tel:${business.phone.replace(/[^\d+]/g, '')}`}>{fr.booking.callShop}</a>
              </div>
            )}
          </main>
        </div>
      )
    }

    const [{ data: bServices }, { data: bBarbers }, { data: bHours }] = await Promise.all([
      supabase
        .from('services')
        .select('id, name, description, price, duration_min, category')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .order('category', { nullsFirst: false })
        .order('name'),
      supabase
        .from('employees')
        .select('id, name, avatar_url')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('business_hours')
        .select('day_of_week, is_open, open_time, close_time, break_start, break_end')
        .eq('business_id', business.id)
        .order('day_of_week'),
    ])

    return (
      <BarberBooking
        business={{
          id: business.id, name: business.name, currency: business.currency, slug: business.slug,
          timezone: business.timezone, address: business.address ?? null, phone: business.phone ?? null,
          logo_url: business.logo_url ?? null,
        }}
        services={bServices ?? []}
        barbers={bBarbers ?? []}
        workingHours={bHours ?? []}
        accent={accent}
        initialBarberId={query.b ?? null}
        initialServiceId={query.s ?? null}
      />
    )
  }

  // Tokens fetched server-side only — never serialised to the client
  const { data: bizTokens } = await supabase
    .from('businesses')
    .select('telegram_bot_token, viber_bot_token')
    .eq('id', business.id)
    .maybeSingle()

  const [
    { data: services },
    { data: employees },
    { data: businessHours },
    telegramInfo,
    viberInfo,
  ] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, description, price, duration_min, category, capacity')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('employees')
      .select('id, name')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('business_hours')
      .select('day_of_week, is_open, open_time, close_time, break_start, break_end')
      .eq('business_id', business.id)
      .order('day_of_week'),
    bizTokens?.telegram_bot_token
      ? getTelegramBotInfo(bizTokens.telegram_bot_token)
      : Promise.resolve({ ok: false as const }),
    bizTokens?.viber_bot_token
      ? getViberBotInfo(bizTokens.viber_bot_token)
      : Promise.resolve({ ok: false as const }),
  ])

  const telegramBotUsername = telegramInfo.ok ? (telegramInfo as { ok: true; result: { username: string } }).result?.username ?? null : null
  const viberBotUri = viberInfo.ok ? (viberInfo as { ok: true; uri?: string }).uri ?? null : null

  const brandColor = business.brand_color || '#2D2926'

  return (
    <div
      style={{
        '--brand': brandColor,
        '--brand-light': `${brandColor}18`,
      } as React.CSSProperties}
    >
      {/* Header */}
      <header style={{ background: 'white', borderBottom: '0.5px solid #E8E0D8', padding: '14px 16px' }}>
        <div style={{ maxWidth: 448, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {business.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logo_url} alt={business.name} style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 500, fontSize: 16 }}>
              {business.name[0]}
            </div>
          )}
          <div style={{ minWidth: 0, flex: '1 1 auto' }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#2D2926', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{business.name}</div>
            <div style={{ fontSize: 12, color: '#9A8E85' }}>{t('bookAnAppointment')}</div>
          </div>
          <div style={{ flexShrink: 0 }}><LangSwitcher variant="light" /></div>
        </div>
      </header>

      {/* Content */}
      <div style={{ background: '#FBF8F5', minHeight: 'calc(100vh - 67px)', padding: '20px 16px' }}>
        <div style={{ maxWidth: 448, margin: '0 auto' }}>
          <PublicBookingForm
            business={business}
            services={services ?? []}
            employees={employees ?? []}
            workingHours={businessHours ?? []}
            telegramBotUsername={telegramBotUsername}
            viberBotUri={viberBotUri}
          />
        </div>
      </div>
    </div>
  )
}
