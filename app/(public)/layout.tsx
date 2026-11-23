import Link from 'next/link'
import { bricolage, dmSans } from '@/lib/landing-fonts'
import styles from './public-layout.module.css'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${styles.page} ${bricolage.variable} ${dmSans.variable}`}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.navBrand}>
          Pronto<span>.</span>
        </Link>
        <div className={styles.navRight}>
          <Link href="/login" className={styles.navLink}>
            Sign in
          </Link>
          <Link href="/es/precios" className={`${styles.navLink} lang-switcher`}>
            ES
          </Link>
          <Link href="/register" className={styles.btnNav}>
            Start free
          </Link>
        </div>
      </nav>

      <main className={styles.main}>
        {children}
      </main>

      {/* FOOTER — keep in sync with all other pages
          ES standard: /es/ · /es/precios · /es/para · legal · GitHub
          EN standard: / · legal · GitHub */}
      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          Pronto<span>.</span>
        </div>
        <div className={styles.footerCopy}>© 2026 Pronto. All rights reserved.</div>
        <div className={styles.footerLinks}>
          <Link href="/">Home</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/refund">Refund policy</Link>
          <a href="https://github.com/SGrappelli/pronto" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}
