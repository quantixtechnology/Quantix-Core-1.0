// ============================================================================
// MediaService — single authority for resolving, normalising, and validating
// all media URLs in Quantix Core.
//
// Storage architecture:
//   Upload routes write files to UPLOAD_ROOT (/var/www/uploads in production).
//   DB stores relative paths like /uploads/<folder>/<id>/<file>.ext
//   API clients (web, Flutter) receive /api/core/files/<folder>/<id>/<file>.ext
//   which hits the files route that reads directly from UPLOAD_ROOT.
//
// This avoids any dependency on nginx rewrites for image extensions, which
// Next.js standalone mode does not proxy correctly on subdomains.
// ============================================================================

import { resolveImageUrl, resolveImageUrls } from './image-url'

export type MediaType = 'product' | 'category' | 'logo' | 'favicon' | 'generic'

const FALLBACKS: Record<MediaType, string> = {
  product:  '/placeholder-product.svg',
  category: '/placeholder-category.svg',
  logo:     '/placeholder-logo.svg',
  favicon:  '/placeholder-logo.svg',
  generic:  '/placeholder-product.svg',
}

// Infer media type from the path so callers don't need to pass it explicitly.
function inferType(path: string): MediaType {
  if (path.includes('/products/') || path.includes('products/'))  return 'product'
  if (path.includes('/categories/') || path.includes('categories/')) return 'category'
  if (path.includes('/logos/') || path.includes('logos/'))        return 'logo'
  if (path.includes('/favicons/') || path.includes('favicons/'))  return 'favicon'
  if (path.includes('/business/'))                                return 'logo'
  return 'generic'
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve a raw DB path (or any image reference) to a stable URL.
 * Returns fallback placeholder if the input is null/undefined/empty.
 */
export function getMediaUrl(
  raw: string | null | undefined,
  type?: MediaType,
): string {
  if (!raw) return FALLBACKS[type ?? 'generic']
  const resolved = resolveImageUrl(raw)
  if (!resolved) return FALLBACKS[type ?? inferType(raw)]
  return resolved
}

/**
 * Resolve an array of raw paths. Empty array if input is null/undefined.
 * Filters out any empty strings after resolution.
 */
export function getMediaUrls(
  raws: string[] | null | undefined,
): string[] {
  return resolveImageUrls(raws)
}

/**
 * Return the placeholder URL for a given media type.
 */
export function getFallback(type: MediaType = 'generic'): string {
  return FALLBACKS[type]
}

/**
 * Normalise a raw path to a canonical /uploads/... form.
 * Strips /api/core/files/ prefix back to /uploads/ so paths stored in DB are
 * always in the /uploads/ form regardless of how they arrived.
 */
export function normalizePath(raw: string | null | undefined): string | null {
  if (!raw) return null

  // /api/core/files/products/... → /uploads/products/...
  if (raw.startsWith('/api/core/files/')) {
    return '/uploads/' + raw.slice('/api/core/files/'.length)
  }

  // Already /uploads/... — return as-is
  if (raw.startsWith('/uploads/')) return raw

  // Absolute URL or data URI — not a managed path, return null
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) {
    return null
  }

  return raw
}

/**
 * Return true if the string looks like a valid managed media path.
 * Does NOT verify the file exists on disk.
 */
export function isValidMediaPath(raw: string | null | undefined): boolean {
  if (!raw) return false
  if (raw.startsWith('/uploads/')) return true
  if (raw.startsWith('/api/core/files/')) return true
  return false
}
