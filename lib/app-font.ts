import localFont from 'next/font/local'

// Self-hosted Inter (latin, variable, SIL OFL); see landing-fonts.ts.
export const inter = localFont({
  src: './fonts/Inter-latin.woff2',
  weight: '100 900',
  display: 'swap',
})
