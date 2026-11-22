import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bricolage_Grotesque, DM_Sans } from 'next/font/google'
import styles from '../landing.module.css'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-bricolage',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-sans',
})

export const metadata: Metadata = {
  title: 'Pronto — Logiciel de gestion gratuit pour les entreprises de services',
  description:
    'Caisse, CRM, réservations, inventaire et notifications pour les salons, barbershops, ateliers et entreprises de services. Open source, auto-hébergé ou cloud. Zéro commission.',
  keywords: [
    'logiciel de caisse',
    'logiciel de gestion salon',
    'logiciel barber shop',
    'CRM pour petites entreprises',
    'logiciel de réservation en ligne',
    'gestion de stock',
    'logiciel open source',
    'prise de rendez-vous',
  ],
  alternates: {
    canonical: 'https://trypronto.app/fr/',
    languages: {
      en: 'https://trypronto.app/',
      es: 'https://trypronto.app/es/',
      fr: 'https://trypronto.app/fr/',
      'x-default': 'https://trypronto.app/',
    },
  },
  openGraph: {
    type: 'website',
    url: 'https://trypronto.app/fr/',
    title: 'Pronto — Gestion d’entreprise, réservations et caisse sans commission',
    description:
      'Gérez les ventes, les clients, les stocks et les rendez-vous depuis une seule application. Auto-hébergée ou dans le cloud.',
    images: [{ url: 'https://trypronto.app/og-image.png' }],
    locale: 'fr_FR',
    siteName: 'Pronto',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pronto — Logiciel de gestion pour les entreprises de services',
    description: 'Caisse, CRM, réservations et inventaire. Zéro commission.',
    images: ['https://trypronto.app/og-image.png'],
  },
}

const softwareAppJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Pronto',
  url: 'https://trypronto.app/fr/',
  description:
    'Logiciel open source de caisse, CRM, inventaire et réservation en ligne pour les entreprises de services.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, Linux, Windows, macOS',
  offers: [
    { '@type': 'Offer', name: 'Gratuit', price: '0', priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Starter', price: '19', priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Pro', price: '39', priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Agency', price: '79', priceCurrency: 'USD' },
  ],
  isAccessibleForFree: true,
  license: 'https://opensource.org/licenses/MIT',
  inLanguage: 'fr',
}

const faqs = [
  {
    question: 'Pronto est-il vraiment gratuit ?',
    answer:
      'Oui. La version auto-hébergée est gratuite sous licence MIT. L’offre cloud comprend également une formule gratuite avec un employé et jusqu’à 100 clients.',
  },
  {
    question: 'Pronto prélève-t-il une commission sur les réservations ?',
    answer:
      'Non. Vos clients réservent directement auprès de votre établissement et vous conservez 100 % du montant de vos ventes et prestations.',
  },
  {
    question: 'Mes clients doivent-ils créer un compte pour réserver ?',
    answer:
      'Non. La page de réservation publique permet de choisir une prestation et un créneau avec un nom et un numéro de téléphone. Aucun compte client n’est nécessaire.',
  },
  {
    question: 'Puis-je héberger Pronto sur mon propre serveur ?',
    answer:
      'Oui. Pronto peut être installé avec Docker Compose sur votre propre serveur. Vous gardez le contrôle de vos données et de votre infrastructure.',
  },
  {
    question: 'Quels canaux de notification sont disponibles ?',
    answer:
      'Pronto prend en charge les e-mails, Telegram, WhatsApp et Viber. Vous connectez vos propres identifiants auprès de chaque service.',
  },
]

export default function FrenchHomePage() {
  if (process.env.NEXT_PUBLIC_DEPLOYMENT_MODE !== 'saas') {
    redirect('/login')
  }

  return (
    <div className={`${styles.page} ${bricolage.variable} ${dmSans.variable}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }}
      />
      <nav className={styles.nav}>
        <Link href="/fr/" className={styles.navBrand}>Pronto<span>.</span></Link>
        <div className={styles.navRight}>
          <Link href="/fr/prix" className={`${styles.navLink} ${styles.hideMob}`}>Tarifs</Link>
          <Link href="/login" className={styles.navLink}>Se connecter</Link>
          <Link href="/" className={`${styles.navLink} lang-switcher`}>EN</Link>
          <Link href="/es/" className={`${styles.navLink} lang-switcher`}>ES</Link>
          <Link href="/register" className={styles.btnNav}>Commencer gratuitement</Link>
        </div>
      </nav>

      <main>
        <section className={styles.hero}>
          <h1>
            Gérez votre activité
            <br />
            <em>sans commission</em>
          </h1>
          <p className={styles.heroDesc}>
            La caisse, le CRM, les réservations, l’inventaire et les notifications réunis dans un seul outil.
            Pour les entreprises de services, en auto-hébergement ou dans le cloud.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-7">
            <Link href="/register" className={styles.btnPrimary}>Essayer gratuitement</Link>
            <Link href="/fr/prix" className={styles.btnOutline}>Voir les tarifs</Link>
          </div>
        </section>

        <section className={`${styles.sec} ${styles.secWhite}`}>
          <div className={styles.secHead}>
            <h2>Tout ce qu’il vous faut pour gérer votre activité</h2>
            <p>Moins d’outils dispersés, moins de tâches manuelles. Une seule application pour votre équipe et vos clients.</p>
          </div>
          <div className={styles.featGrid}>
            <div className={styles.featCard}>
              <h3>Caisse et encaissement</h3>
              <p>Enregistrez les ventes de prestations et de produits, appliquez des remises et suivez les paiements.</p>
            </div>
            <div className={styles.featCard}>
              <h3>CRM et fiches clients</h3>
              <p>Retrouvez les coordonnées, les visites, les notes et l’historique de chaque client.</p>
            </div>
            <div className={styles.featCard}>
              <h3>Réservations en ligne</h3>
              <p>Publiez une page de réservation et laissez vos clients choisir un service et un créneau.</p>
            </div>
            <div className={styles.featCard}>
              <h3>Gestion des stocks</h3>
              <p>Suivez les produits, les quantités, les codes-barres et les alertes de stock faible.</p>
            </div>
            <div className={styles.featCard}>
              <h3>Notifications automatiques</h3>
              <p>Envoyez des confirmations, des rappels et des messages de suivi par e-mail ou messagerie.</p>
            </div>
            <div className={styles.featCard}>
              <h3>Indicateurs et rapports</h3>
              <p>Consultez le chiffre d’affaires, les ventes, les prestations populaires et l’activité client.</p>
            </div>
          </div>
        </section>

        <section className={`${styles.sec} ${styles.secMint}`}>
          <div className={styles.secHead}>
            <h2>Conçu pour les entreprises de services</h2>
            <p>Pronto s’adapte à votre façon de travailler : activez les modules utiles et gardez une interface simple.</p>
          </div>
          <div className={styles.bizTags}>
            {['Salons de beauté', 'Barbershops', 'Spas et instituts', 'Cliniques dentaires', 'Salles de sport', 'Ateliers automobiles', 'Cafés', 'Boutiques'].map((item) => (
              <span key={item} className={styles.bizTag}>{item}</span>
            ))}
          </div>
        </section>

        <section className={`${styles.sec} ${styles.secWhite}`}>
          <div className={styles.secHead}>
            <h2>Choisissez où vos données sont hébergées</h2>
            <p>La même base fonctionnelle, deux façons de l’utiliser.</p>
          </div>
          <div className={styles.twoPaths}>
            <div className={`${styles.pathCard} ${styles.self}`}>
              <div className={styles.pathLabel}>Auto-hébergé</div>
              <h3>Votre serveur, vos données</h3>
              <p className={styles.pathDesc}>Installez Pronto avec Docker Compose. Gardez la maîtrise de votre infrastructure et de vos données.</p>
              <Link href="https://github.com/SGrappelli/pronto" className={styles.btnOutline} target="_blank">Voir le projet sur GitHub</Link>
            </div>
            <div className={`${styles.pathCard} ${styles.cloud}`}>
              <div className={styles.pathLabel}>Cloud</div>
              <h3>Démarrez sans gérer de serveur</h3>
              <p className={styles.pathDesc}>Créez votre compte et configurez votre activité en quelques minutes. Les mises à jour et l’hébergement sont pris en charge.</p>
              <Link href="/register" className={styles.btnPrimary}>Créer un compte gratuit</Link>
            </div>
          </div>
        </section>

        <section className={`${styles.sec} ${styles.secWarm}`}>
          <div className={styles.secHead}>
            <h2>Des tarifs simples. Zéro commission.</h2>
            <p>Commencez gratuitement et choisissez une formule payante lorsque votre activité en a besoin.</p>
          </div>
          <div className={styles.plans}>
            {[
              {name:'Gratuit',price:'$0',limit:'1 employé · 100 clients',features:['Caisse','Inventaire','Notifications par e-mail']},
              {name:'Starter',price:'$19/mois',limit:'3 employés · 1 000 clients',features:['Réservations en ligne','CRM','Notifications']},
              {name:'Pro',price:'$39/mois',limit:'15 employés · clients illimités',features:['Analyses','Programme de fidélité','Domaine personnalisé']},
              {name:'Agency',price:'$79/mois',limit:'Plusieurs établissements',features:['Marque blanche','Accès API','Gestion multi-sites']}
            ].map((plan) => (
              <div key={plan.name} className={styles.plan}>
                <h3 className={styles.planName}>{plan.name}</h3>
                <div className={styles.planPrice}>{plan.price}</div>
                <p className={styles.planLimit}>{plan.limit}</p>
                <ul className={styles.planFeats}>
                  {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
                <Link href="/register" className={styles.btnOutline}>Commencer</Link>
              </div>
            ))}
          </div>
          <p className={styles.pricingNote}>Tarifs affichés en dollars américains. Consultez la page des <Link href="/fr/prix">tarifs et fonctionnalités</Link>.</p>
        </section>

        <section className={styles.faq}>
          <div className={styles.faqInner}>
            <h2>Questions fréquentes</h2>
            {faqs.map((faq) => (
              <div className={styles.faqItem} key={faq.question}>
                <h3 className={styles.faqQ}>{faq.question}</h3>
                <p className={styles.faqA}>{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={`${styles.sec} ${styles.secBlue}`}>
          <div className={styles.secHead}>
            <h2>Prêt à simplifier votre gestion ?</h2>
            <p>Créez votre compte gratuitement ou installez Pronto sur votre propre serveur.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/register" className={styles.btnPrimary}>Commencer gratuitement</Link>
            <Link href="https://github.com/SGrappelli/pronto" target="_blank" className={styles.btnOutline}>Voir le code source</Link>
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
