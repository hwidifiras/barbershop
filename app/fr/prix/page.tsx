import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { bricolage, dmSans } from '@/lib/landing-fonts'
import { Check, Minus } from 'lucide-react'
import styles from '../../landing.module.css'

export const metadata: Metadata = {
  title: 'Tarifs Pronto — Logiciel de gestion à partir de 0 $',
  description:
    'Comparez les offres Pronto : Gratuit, Starter, Pro et Agency. Caisse, CRM, réservations, inventaire et notifications, sans commission sur vos ventes.',
  keywords: [
    'tarifs logiciel de caisse',
    'prix logiciel de réservation',
    'CRM prix',
    'logiciel gestion salon tarifs',
    'logiciel barbershop prix',
    'logiciel de gestion gratuit',
  ],
  alternates: {
    canonical: 'https://trypronto.app/fr/prix',
    languages: {
      en: 'https://trypronto.app/',
      es: 'https://trypronto.app/es/precios',
      fr: 'https://trypronto.app/fr/prix',
      'x-default': 'https://trypronto.app/',
    },
  },
  openGraph: {
    type: 'website',
    url: 'https://trypronto.app/fr/prix',
    title: 'Tarifs Pronto — À partir de 0 $, sans commission',
    description: 'Une formule gratuite et des offres payantes simples. Aucun frais sur vos réservations ni sur vos ventes.',
    images: [{ url: 'https://trypronto.app/og-image.png' }],
    locale: 'fr_FR',
    siteName: 'Pronto',
  },
}

const plans = [
  {
    name: 'Gratuit',
    price: '$0',
    cadence: 'pour toujours',
    limit: '1 employé · 100 clients',
    features: ['Caisse et inventaire', 'Notifications par e-mail', 'Gestion de base de votre activité'],
    highlight: false,
  },
  {
    name: 'Starter',
    price: '$19',
    cadence: 'par mois',
    limit: '3 employés · 1 000 clients',
    features: ['Réservations en ligne', 'CRM et historique client', 'Notifications et rappels'],
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$39',
    cadence: 'par mois',
    limit: '15 employés · clients illimités',
    features: ['Analyses avancées', 'Programme de fidélité', 'Domaine personnalisé'],
    highlight: true,
  },
  {
    name: 'Agency',
    price: '$79',
    cadence: 'par mois',
    limit: 'Plusieurs établissements',
    features: ['Gestion multi-sites', 'Marque blanche', 'Accès à l’API'],
    highlight: false,
  },
]

const features = [
  ['Employés', '1', '3', '15', 'Illimités'],
  ['Clients', '100', '1 000', 'Illimités', 'Illimités'],
  ['Réservations en ligne', '—', '✓', '✓', '✓'],
  ['CRM et historique client', '—', '✓', '✓', '✓'],
  ['Caisse et encaissement', '✓', '✓', '✓', '✓'],
  ['Gestion des stocks', '✓', '✓', '✓', '✓'],
  ['Analyses avancées', '—', '—', '✓', '✓'],
  ['Programme de fidélité', '—', '—', '✓', '✓'],
  ['Domaine personnalisé', '—', '—', '✓', '✓'],
  ['Plusieurs établissements', '—', '—', '—', '✓'],
  ['Marque blanche et API', '—', '—', '—', '✓'],
  ['Notifications', 'E-mail', 'E-mail et messageries', 'E-mail et messageries', 'E-mail et messageries'],
]

const faqs = [
  {
    q: 'Y a-t-il une offre gratuite ?',
    a: 'Oui. L’offre gratuite n’a pas de date d’expiration. Elle comprend une caisse, l’inventaire, les notifications par e-mail, un employé et jusqu’à 100 clients. La version auto-hébergée est également gratuite sous licence MIT.',
  },
  {
    q: 'Pronto prélève-t-il une commission ?',
    a: 'Non. Pronto ne prélève aucune commission sur vos ventes ni sur les réservations effectuées par vos clients.',
  },
  {
    q: 'Puis-je changer d’offre plus tard ?',
    a: 'Oui. Vous pouvez faire évoluer votre abonnement depuis les paramètres de votre compte.',
  },
  {
    q: 'La version auto-hébergée est-elle payante ?',
    a: 'Non. Vous pouvez installer la version open source sur votre propre serveur avec Docker Compose. Vous gérez alors votre infrastructure et vos données.',
  },
]

export default function FrenchPricingPage() {
  if (process.env.NEXT_PUBLIC_DEPLOYMENT_MODE !== 'saas') {
    redirect('/login')
  }

  return (
    <div className={`${styles.page} ${bricolage.variable} ${dmSans.variable}`}>
      <nav className={styles.nav}>
        <Link href="/fr/" className={styles.navBrand}>Pronto<span>.</span></Link>
        <div className={styles.navRight}>
          <Link href="/fr/prix" className={`${styles.navLink} ${styles.hideMob}`}>Tarifs</Link>
          <Link href="/login" className={styles.navLink}>Se connecter</Link>
          <Link href="/" className={`${styles.navLink} lang-switcher`}>EN</Link>
          <Link href="/es/precios" className={`${styles.navLink} lang-switcher`}>ES</Link>
          <Link href="/register" className={styles.btnNav}>Commencer gratuitement</Link>
        </div>
      </nav>

      <main>
        <section className={styles.hero}>
          <h1>Des tarifs simples.
            <br />
            <em>Zéro commission.</em>
          </h1>
          <p className={styles.heroDesc}>
            Commencez gratuitement, puis choisissez les fonctionnalités adaptées à votre équipe.
            Aucun frais sur vos ventes ni sur vos réservations.
          </p>
        </section>

        <section className={`${styles.sec} ${styles.secWhite}`}>
          <div className={styles.plans}>
            {plans.map((plan) => (
              <div key={plan.name} className={`${styles.plan} ${plan.highlight ? styles.featured : ''}`}>
                {plan.highlight && <div className={styles.planPopular}>Le plus populaire</div>}
                <h2 className={styles.planName}>{plan.name}</h2>
                <div className={styles.planPrice}>{plan.price}</div>
                <p className={styles.planTrial}>{plan.cadence}</p>
                <p className={styles.planLimit}>{plan.limit}</p>
                <ul className={styles.planFeats}>
                  {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
                <Link href="/register" className={styles.btnPrimary}>Commencer</Link>
              </div>
            ))}
          </div>
          <p className={styles.pricingNote}>Tarifs en dollars américains, facturés mensuellement pour les offres payantes. La disponibilité des fonctionnalités dépend de la formule choisie.</p>
        </section>

        <section className={`${styles.sec} ${styles.secMint}`}>
          <div className={styles.secHead}>
            <h2>Comparer les fonctionnalités</h2>
            <p>Retrouvez les principales limites et fonctionnalités de chaque formule.</p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Fonctionnalité</th>
                  {plans.map((plan) => <th key={plan.name} className="px-3 py-3 text-center font-semibold text-gray-700">{plan.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {features.map((row) => (
                  <tr key={row[0]} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 text-gray-700">{row[0]}</td>
                    {row.slice(1).map((value, index) => (
                      <td key={index} className="px-3 py-3 text-center text-gray-600">
                        {value === '✓'
                          ? <Check className="w-4 h-4 text-green-600 mx-auto" />
                          : value === '—'
                            ? <Minus className="w-4 h-4 text-gray-300 mx-auto" />
                            : value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.faq}>
          <div className={styles.faqInner}>
            <h2>Questions sur les tarifs</h2>
            {faqs.map((item) => (
              <div className={styles.faqItem} key={item.q}>
                <h3 className={styles.faqQ}>{item.q}</h3>
                <p className={styles.faqA}>{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={`${styles.sec} ${styles.secBlue}`}>
          <div className={styles.secHead}>
            <h2>Prêt à commencer ?</h2>
            <p>Créez votre compte gratuit et configurez votre activité avec Pronto.</p>
          </div>
          <div className="flex justify-center">
            <Link href="/register" className={styles.btnPrimary}>Créer un compte gratuit</Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>Pronto<span>.</span></div>
        <div className={styles.footerCopy}>© 2026 Pronto · Licence MIT</div>
        <div className={styles.footerLinks}>
          <Link href="/fr/">Accueil</Link>
          <Link href="/fr/prix">Tarifs</Link>
          <Link href="/terms">Conditions</Link>
          <Link href="/privacy">Confidentialité</Link>
          <a href="https://github.com/SGrappelli/pronto" target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
      </footer>
    </div>
  )
}
