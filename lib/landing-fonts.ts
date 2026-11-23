import { Bricolage_Grotesque, DM_Sans } from 'next/font/google'

// Marketing/public pages share one declaration of each font so Next fetches
// them from Google once per build instead of once per page.
export const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-bricolage',
})

export const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-sans',
})
