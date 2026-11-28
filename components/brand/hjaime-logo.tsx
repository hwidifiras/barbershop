// H J'aime brand mark (chosen 2026-11-28): a bold H whose crossbar is a brass heart.
// Same drawing as public/icons/icon.svg; the PNG icons in public/ are rendered from it.

export function HJaimeMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label="H J'aime">
      <rect width="100" height="100" rx="22" fill="#0e0e0f" />
      <rect x="25" y="23" width="13" height="54" rx="3" fill="#f3efe6" />
      <rect x="62" y="23" width="13" height="54" rx="3" fill="#f3efe6" />
      <path d="M50 61 C41.5 55.5 38.6 50.8 41.2 46.6 C43.4 43.4 47.6 43.6 50 47 C52.4 43.6 56.6 43.4 58.8 46.6 C61.4 50.8 58.5 55.5 50 61 Z" fill="#c9a24b" />
    </svg>
  )
}

export const BRAND_NAME = "H J'aime"
