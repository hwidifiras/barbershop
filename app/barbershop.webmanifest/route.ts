// Barbershop mode (docs/barbershop-mode/SPEC.md 4.14): the home-screen app carries the shop's name
// and opens on Today. Linked from the dashboard layout's metadata for barbershops only; the shop name
// arrives in ?n= because the browser fetches the manifest without the login cookie.

import { NextRequest, NextResponse } from 'next/server'

export function GET(req: NextRequest) {
  const name = (req.nextUrl.searchParams.get('n') ?? '').replace(/[<>"\\]/g, '').trim().slice(0, 40) || 'Barbershop'
  return NextResponse.json({
    name,
    short_name: name.slice(0, 15),
    description: 'Agenda, caisse et clients du salon',
    id: '/dashboard',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'fr',
    theme_color: '#0e0e0f',
    background_color: '#0e0e0f',
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  }, { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' } })
}
