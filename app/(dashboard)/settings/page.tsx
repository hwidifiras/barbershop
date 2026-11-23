import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { getTranslations } from 'next-intl/server'
import { SettingsTabs } from './settings-tabs'
import { getAuthUser } from '@/lib/auth-user'

export default async function SettingsPage() {
  const supabase = await createClient()
  const t = await getTranslations('settings')
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, slug, type, phone, email, address, timezone, currency, plan, plan_expires_at, telegram_bot_token, telegram_chat_id, viber_bot_token, viber_chat_id, owner_whatsapp, email_provider, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, resend_api_key, meta_whatsapp_phone_number_id, meta_whatsapp_access_token, wa_template_confirmation, wa_template_reminder, wa_template_thankyou, wa_template_reactivation, wa_template_birthday, wa_template_language, brand_color, notification_language, logo_url, enabled_modules, barbershop_mode, online_booking_enabled')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!business) redirect('/onboarding')

  const [
    { data: services },
    { data: employees },
    { data: businessHours },
    { data: offers },
  ] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, description, price, duration_min, category, is_active, capacity, kind, bookable_alone, bookable_online, includes, exclusive_group')
      .eq('business_id', business.id)
      .order('name'),
    supabase
      .from('employees')
      .select('id, name, role, email, phone, is_active, avatar_url')
      .eq('business_id', business.id)
      .order('name'),
    supabase
      .from('business_hours')
      .select('day_of_week, is_open, open_time, close_time, break_start, break_end')
      .eq('business_id', business.id)
      .order('day_of_week'),
    supabase
      .from('offers')
      .select('id, name, price, service_ids, barber_ids, valid_from, valid_to, is_active')
      .eq('business_id', business.id)
      .order('created_at'),
  ])

  return (
    <>
      <Header title={t('title')} />
      <SettingsTabs
        business={business}
        services={services ?? []}
        offers={(offers ?? []).map((o) => ({ ...o, price: Number(o.price) }))}
        employees={employees ?? []}
        workingHours={businessHours ?? []}
        userEmail={user.email ?? ''}
      />
    </>
  )
}
