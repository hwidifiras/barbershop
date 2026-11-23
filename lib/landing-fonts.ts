import localFont from 'next/font/local'

// Self-hosted (latin subset, variable, SIL OFL) instead of next/font/google:
// the Google loader fetched font files at build time and intermittently
// crashed the Vercel build ("Cannot read properties of null (reading '1')").
export const bricolage = localFont({
  src: './fonts/BricolageGrotesque-latin.woff2',
  weight: '400 800',
  variable: '--font-bricolage',
  display: 'swap',
})

export const dmSans = localFont({
  src: './fonts/DMSans-latin.woff2',
  weight: '400 500',
  variable: '--font-dm-sans',
  display: 'swap',
})
