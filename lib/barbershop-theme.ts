// Accent colour for the barbershop theme (dark surfaces). The shop's brand_color is used when it
// is readable on a dark background; the platform default (#2D2926) and other very dark colours
// fall back to brass. See docs/barbershop-mode/SPEC.md section 6.

export const BRASS = '#C9A24B'

function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
}

export function accentFor(brandColor: string | null | undefined): string {
  if (!brandColor) return BRASS
  const l = luminance(brandColor)
  if (l === null || l < 0.18) return BRASS
  return brandColor.startsWith('#') ? brandColor : `#${brandColor}`
}
