/**
 * lib/email.ts
 *
 * Высокоуровневые функции отправки email + HTML-шаблоны.
 * Транспорт (Resend / SMTP) определяется в lib/mailer.ts через env-переменные.
 */

import { sendMail, getFromAddress } from './mailer'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ─── Shared layout ────────────────────────────────────────────────────────────

function layout(businessName: string, body: string, locale = 'en'): string {
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${businessName}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
          <tr>
            <td style="background:#2563eb;padding:20px 32px;">
              <span style="color:#ffffff;font-size:20px;font-weight:700;">${businessName}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                ${locale === 'fr' ? 'Propulsé par' : 'Powered by'} <a href="${APP_URL}" style="color:#2563eb;text-decoration:none;">Pronto</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function btn(text: string, href: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#2563eb;color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">${text}</a>`
}

function h1(text: string) {
  return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">${text}</h1>`
}

function p(text: string) {
  return `<p style="margin:8px 0;font-size:15px;color:#374151;line-height:1.6;">${text}</p>`
}

function info(rows: [string, string][]) {
  const cells = rows
    .map(
      ([label, value]) => `
    <tr>
      <td style="padding:8px 12px;font-size:14px;color:#6b7280;width:140px;border-bottom:1px solid #f3f4f6;">${label}</td>
      <td style="padding:8px 12px;font-size:14px;color:#111827;font-weight:500;border-bottom:1px solid #f3f4f6;">${value}</td>
    </tr>`
    )
    .join('')
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">${cells}</table>`
}

// ─── Booking confirmation ─────────────────────────────────────────────────────

export async function sendBookingConfirmation(opts: {
  to: string
  clientName: string
  businessName: string
  serviceName: string
  date: string
  time: string
  employeeName?: string
  address?: string
  calendarUrl?: string
  locale?: string
}) {
  const fr = opts.locale === 'fr'
  const body = `
    ${h1(fr ? 'Réservation confirmée !' : 'Booking confirmed!')}
    ${p(fr ? `Bonjour ${firstName(opts.clientName)}, votre rendez-vous est confirmé.` : `Hi ${firstName(opts.clientName)}, your appointment is confirmed.`)}
    ${info([
      [fr ? 'Prestation' : 'Service', opts.serviceName],
      ['Date', opts.date],
      [fr ? 'Heure' : 'Time', opts.time],
      ...(opts.employeeName ? [[fr ? 'Intervenant' : 'Employee', opts.employeeName] as [string, string]] : []),
      ...(opts.address ? [[fr ? 'Adresse' : 'Address', opts.address] as [string, string]] : []),
    ])}
    ${p(fr ? 'À bientôt !' : 'See you soon!')}
    ${opts.calendarUrl ? p(`<a href="${opts.calendarUrl}" style="color:#2563eb;">Ajouter à Google Agenda</a>`) : ''}
  `
  return sendMail({
    from: getFromAddress(opts.businessName),
    to: opts.to,
    subject: fr ? `Réservation confirmée — ${opts.serviceName} à ${opts.time}` : `Booking confirmed — ${opts.serviceName} at ${opts.time}`,
    html: layout(opts.businessName, body, opts.locale),
  })
}

// ─── Reminder ─────────────────────────────────────────────────────────────────

export async function sendReminder(opts: {
  to: string
  clientName: string
  businessName: string
  serviceName: string
  date: string
  time: string
  employeeName?: string
  address?: string
  isOneHour?: boolean
  locale?: string
}) {
  const fr = opts.locale === 'fr'
  const when = fr ? (opts.isOneHour ? 'dans 1 heure' : 'demain') : (opts.isOneHour ? 'in 1 hour' : 'tomorrow')
  const body = `
    ${h1(fr ? `Rappel : votre rendez-vous est ${when}` : `Reminder: your appointment is ${when}`)}
    ${p(fr ? `Bonjour ${firstName(opts.clientName)}, nous vous rappelons votre prochain rendez-vous.` : `Hi ${firstName(opts.clientName)}, just a friendly reminder about your upcoming appointment.`)}
    ${info([
      [fr ? 'Prestation' : 'Service', opts.serviceName],
      ['Date', opts.date],
      [fr ? 'Heure' : 'Time', opts.time],
      ...(opts.employeeName ? [[fr ? 'Intervenant' : 'Employee', opts.employeeName] as [string, string]] : []),
      ...(opts.address ? [[fr ? 'Adresse' : 'Address', opts.address] as [string, string]] : []),
    ])}
    ${p(fr ? 'Nous avons hâte de vous accueillir !' : 'We look forward to seeing you!')}
  `
  return sendMail({
    from: getFromAddress(opts.businessName),
    to: opts.to,
    subject: fr ? `Rappel : ${opts.serviceName} ${when} à ${opts.time}` : `Reminder: ${opts.serviceName} ${when} at ${opts.time}`,
    html: layout(opts.businessName, body, opts.locale),
  })
}

// ─── Thank-you ────────────────────────────────────────────────────────────────

export async function sendThankYou(opts: {
  to: string
  clientName: string
  businessName: string
  serviceName: string
  bookingUrl?: string
  locale?: string
}) {
  const fr = opts.locale === 'fr'
  const body = `
    ${h1(fr ? 'Merci pour votre visite !' : 'Thank you for your visit!')}
    ${p(fr ? `Bonjour ${firstName(opts.clientName)}, merci d'avoir choisi ${opts.businessName}. Au plaisir de vous revoir !` : `Hi ${firstName(opts.clientName)}, thank you for choosing ${opts.businessName}. We hope to see you again!`)}
    ${p(fr ? `Votre prestation : <strong>${opts.serviceName}</strong>` : `You were in for: <strong>${opts.serviceName}</strong>`)}
    ${opts.bookingUrl ? btn(fr ? 'Réserver votre prochain rendez-vous' : 'Book your next appointment', opts.bookingUrl) : ''}
  `
  return sendMail({
    from: getFromAddress(opts.businessName),
    to: opts.to,
    subject: fr ? `Merci pour votre visite chez ${opts.businessName} !` : `Thanks for visiting ${opts.businessName}!`,
    html: layout(opts.businessName, body, opts.locale),
  })
}

// ─── Re-activation ────────────────────────────────────────────────────────────

export async function sendReactivation(opts: {
  to: string
  clientName: string
  businessName: string
  bookingUrl?: string
  locale?: string
}) {
  const fr = opts.locale === 'fr'
  const body = `
    ${h1(fr ? 'Vous nous manquez !' : 'We miss you!')}
    ${p(fr ? `Bonjour ${firstName(opts.clientName)}, cela fait quelque temps que vous n'êtes pas venu(e) chez ${opts.businessName}.` : `Hi ${firstName(opts.clientName)}, it's been a while since your last visit to ${opts.businessName}.`)}
    ${p(fr ? 'Nous serions ravis de vous revoir. Réservez votre prochain rendez-vous en quelques instants.' : "We'd love to see you again. Book your next appointment anytime — it only takes a minute.")}
    ${opts.bookingUrl ? btn(fr ? 'Réserver maintenant' : 'Book now', opts.bookingUrl) : ''}
  `
  return sendMail({
    from: getFromAddress(opts.businessName),
    to: opts.to,
    subject: fr ? `${opts.businessName} aimerait vous revoir` : `${opts.businessName} misses you — book your next visit`,
    html: layout(opts.businessName, body, opts.locale),
  })
}

// ─── Birthday ─────────────────────────────────────────────────────────────────

export async function sendBirthday(opts: {
  to: string
  clientName: string
  businessName: string
  bookingUrl?: string
  locale?: string
}) {
  const fr = opts.locale === 'fr'
  const body = `
    ${h1(fr ? '🎂 Joyeux anniversaire !' : '🎂 Happy Birthday!')}
    ${p(fr ? `Bonjour ${firstName(opts.clientName)}, toute l'équipe de ${opts.businessName} vous souhaite un merveilleux anniversaire !` : `Hi ${firstName(opts.clientName)}, wishing you a wonderful birthday from the whole team at ${opts.businessName}!`)}
    ${p(fr ? 'Pour célébrer cette journée, faites-vous plaisir avec une visite.' : 'To celebrate, come in and treat yourself.')}
    ${opts.bookingUrl ? btn(fr ? 'Réserver une visite' : 'Book a visit', opts.bookingUrl) : ''}
  `
  return sendMail({
    from: getFromAddress(opts.businessName),
    to: opts.to,
    subject: fr ? `Joyeux anniversaire de la part de ${opts.businessName} ! 🎂` : `Happy Birthday from ${opts.businessName}! 🎂`,
    html: layout(opts.businessName, body, opts.locale),
  })
}

// ─── Low-stock alert ──────────────────────────────────────────────────────────

export async function sendLowStockAlert(opts: {
  to: string
  businessName: string
  items: { name: string; quantity: number; unit: string; threshold: number }[]
  locale?: string
}) {
  const fr = opts.locale === 'fr'
  const rows = opts.items.map(
    (i) => [i.name, fr ? `${i.quantity} ${i.unit} (seuil : ${i.threshold})` : `${i.quantity} ${i.unit} (threshold: ${i.threshold})`] as [string, string]
  )
  const body = `
    ${h1(fr ? 'Alerte de stock faible' : 'Low-stock alert')}
    ${p(fr ? `Les articles suivants de ${opts.businessName} sont bientôt en rupture de stock :` : `The following items in ${opts.businessName} are running low:`)}
    ${info(rows)}
    ${btn(fr ? 'Accéder à l’inventaire' : 'Go to Inventory', `${APP_URL}/inventory`)}
  `
  return sendMail({
    from: getFromAddress(opts.businessName),
    to: opts.to,
    subject: fr ? `Alerte de stock faible — ${opts.items.length} article(s) à réapprovisionner` : `Low-stock alert — ${opts.items.length} item(s) running low`,
    html: layout(opts.businessName, body, opts.locale),
  })
}

// ─── Name helpers ─────────────────────────────────────────────────────────────

/** "KONSTANTIN UMNOV" → "Konstantin Umnov", "kostya" → "Kostya" */
function toTitleCase(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** "Konstantin Umnov" → "Konstantin", "kostya" → "Kostya" */
function firstName(name: string): string {
  return toTitleCase(name).split(/\s+/)[0]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatEmailDate(iso: string, timezone = 'UTC', locale = 'en-US') {
  return new Date(iso).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: timezone,
  })
}

export function formatEmailTime(iso: string, timezone = 'UTC', locale = 'en-US') {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  })
}
