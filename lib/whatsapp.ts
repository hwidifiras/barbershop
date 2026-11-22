/**
 * lib/whatsapp.ts
 * Meta WhatsApp Cloud API — отправка сообщений клиентам.
 *
 * Requires env vars:
 *   META_WHATSAPP_PHONE_NUMBER_ID  — ID номера отправителя в Meta Dashboard
 *   META_WHATSAPP_ACCESS_TOKEN     — постоянный или временный токен доступа
 */

const BASE = 'https://graph.facebook.com/v20.0'

// ─── Нормализация номера ──────────────────────────────────────────────────────
// WhatsApp требует E.164 без '+': "79001234567", "12025551234" и т.д.

function normalizePhone(phone: string): string {
  return phone.replace(/^\+/, '').replace(/[\s\-().]/g, '')
}

// ─── Отправить текстовое сообщение ────────────────────────────────────────────

export async function sendWhatsAppMessage(
  to: string,
  message: string,
  credentials?: { phoneNumberId: string; accessToken: string }
): Promise<boolean> {
  const phoneNumberId = credentials?.phoneNumberId ?? process.env.META_WHATSAPP_PHONE_NUMBER_ID
  const accessToken = credentials?.accessToken ?? process.env.META_WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) return false

  const normalizedTo = normalizePhone(to)
  if (!normalizedTo) return false

  try {
    const res = await fetch(`${BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizedTo,
        type: 'text',
        text: { body: message },
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      console.error('[whatsapp] sendMessage error:', json?.error?.message ?? json)
      return false
    }
    return true
  } catch (err) {
    console.error('[whatsapp] sendMessage exception:', err)
    return false
  }
}

// ─── Шаблоны сообщений (plain text, без HTML) ────────────────────────────────

export function tplBookingConfirmation(opts: {
  clientName: string
  serviceName: string
  date: string
  time: string
  businessName: string
  employeeName?: string
  address?: string
  locale?: string
}): string {
  const fr = opts.locale === 'fr'
  const lines = [
    fr ? '✅ Réservation confirmée !' : '✅ Booking confirmed!',
    '',
    fr ? `Bonjour ${opts.clientName},` : `Hi ${opts.clientName},`,
    fr ? 'Votre rendez-vous a bien été enregistré :' : 'Your appointment has been booked:',
    '',
    `${fr ? 'Prestation' : 'Service'} : ${opts.serviceName}`,
    `${fr ? 'Date' : 'Date'} : ${opts.date} à ${opts.time}`,
  ]
  if (opts.employeeName) lines.push(`${fr ? 'Intervenant' : 'Specialist'} : ${opts.employeeName}`)
  if (opts.address) lines.push(`${fr ? 'Adresse' : 'Address'} : ${opts.address}`)
  lines.push('', fr ? `À bientôt — ${opts.businessName}` : `See you soon — ${opts.businessName}`)
  return lines.join('\n')
}

export function tplReminder(opts: {
  clientName: string
  serviceName: string
  date: string
  time: string
  businessName: string
  isOneHour?: boolean
  locale?: string
}): string {
  const fr = opts.locale === 'fr'
  const when = fr ? (opts.isOneHour ? 'dans 1 heure ⏰' : 'demain 📅') : (opts.isOneHour ? 'in 1 hour ⏰' : 'tomorrow 📅')
  return [
    fr ? '🔔 Rappel de rendez-vous' : '🔔 Appointment reminder',
    '',
    fr ? `Bonjour ${opts.clientName},` : `Hi ${opts.clientName},`,
    fr ? `Votre rendez-vous est prévu ${when} :` : `Your appointment is ${when}:`,
    '',
    `${fr ? 'Prestation' : 'Service'} : ${opts.serviceName}`,
    `${fr ? 'Date' : 'Date'} : ${opts.date} à ${opts.time}`,
    '',
    fr ? `À bientôt — ${opts.businessName}` : `See you soon — ${opts.businessName}`,
  ].join('\n')
}

export function tplThankYou(opts: {
  clientName: string
  serviceName: string
  businessName: string
  bookingUrl?: string
  locale?: string
}): string {
  const fr = opts.locale === 'fr'
  const lines = [
    fr ? '✅ Merci pour votre visite !' : '✅ Thank you for your visit!',
    '',
    fr ? `Bonjour ${opts.clientName},` : `Hi ${opts.clientName},`,
    fr ? `Nous avons été ravis de vous accueillir pour ${opts.serviceName}.` : `It was a pleasure seeing you for ${opts.serviceName}.`,
    '',
    fr ? 'Au plaisir de vous revoir !' : 'We look forward to your next visit!',
  ]
  if (opts.bookingUrl) lines.push('', fr ? 'Réservez votre prochain rendez-vous :' : 'Book your next appointment:', opts.bookingUrl)
  lines.push('', `— ${opts.businessName}`)
  return lines.join('\n')
}

export function tplReactivation(opts: {
  clientName: string
  businessName: string
  bookingUrl?: string
  locale?: string
}): string {
  const fr = opts.locale === 'fr'
  const lines = [
    fr ? `👋 Vous nous manquez, ${opts.clientName} !` : `👋 We miss you, ${opts.clientName}!`,
    '',
    fr ? `Cela fait quelque temps que vous n'êtes pas venu(e) chez ${opts.businessName}.` : `It's been a while since your last visit at ${opts.businessName}.`,
    fr ? 'Nous serions ravis de vous revoir !' : "We'd love to see you again!",
  ]
  if (opts.bookingUrl) lines.push('', fr ? 'Réservez votre rendez-vous :' : 'Book your appointment:', opts.bookingUrl)
  return lines.join('\n')
}

export function tplBirthday(opts: {
  clientName: string
  businessName: string
  bookingUrl?: string
  locale?: string
}): string {
  const fr = opts.locale === 'fr'
  const lines = [
    fr ? `🎂 Joyeux anniversaire, ${opts.clientName} !` : `🎂 Happy Birthday, ${opts.clientName}!`,
    '',
    fr ? `Toute l'équipe de ${opts.businessName} vous souhaite une excellente journée. 🎉` : `Wishing you a wonderful day from all of us at ${opts.businessName}.`,
    fr ? 'Faites-vous plaisir, vous le méritez !' : 'Treat yourself — you deserve it!',
  ]
  if (opts.bookingUrl) lines.push('', fr ? 'Réservez un moment rien que pour vous :' : 'Book a special treat:', opts.bookingUrl)
  return lines.join('\n')
}

export function tplLowStock(opts: {
  itemName: string
  quantity: number
  unit: string
  threshold: number
}): string {
  return [
    `⚠️ Low stock alert`,
    ``,
    `📦 ${opts.itemName}`,
    `Current: ${opts.quantity} ${opts.unit} (threshold: ${opts.threshold})`,
    ``,
    `Please restock soon.`,
  ].join('\n')
}
