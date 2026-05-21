// ============================================================================
// Shared image URL resolver — use this everywhere images are rendered.
//
// Problem: Next.js standalone mode does not apply afterFiles rewrites for
// requests with image file extensions (.jpg, .png, etc.) on subdomains,
// because the proxy middleware is excluded from those paths. Requests for
// /uploads/... land a 404 instead of being proxied to /api/core/files/...
//
// Solution: Convert /uploads/ paths to /api/core/files/ at call sites so
// the request goes directly to the file-serving API route, bypassing the
// rewrite entirely. This works identically in dev and production/standalone.
//
// Usage (client, SSR, Flutter-equivalent):
//   import { resolveImageUrl } from "@/lib/image-url"
//   <img src={resolveImageUrl(product.images[0])} />
// ============================================================================

/**
 * Convert a raw image path (as stored in DB / returned by API) to a stable
 * public URL that works in all rendering contexts.
 *
 * /uploads/products/<id>/file.jpg  →  /api/core/files/products/<id>/file.jpg
 * https://cdn.example.com/img.jpg  →  unchanged (already absolute)
 * ""  |  null  |  undefined        →  "" (caller should handle empty)
 */
export function resolveImageUrl(raw: string | null | undefined): string {
  if (!raw) return ""

  // Already an absolute URL (CDN, external host, data URI)
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:")) {
    return raw
  }

  // /uploads/... → /api/core/files/...
  // The files route reads the file directly from disk, no rewrite needed.
  if (raw.startsWith("/uploads/")) {
    return "/api/core/files/" + raw.slice("/uploads/".length)
  }

  // Already a /api/core/files/ path (idempotent)
  if (raw.startsWith("/api/core/files/")) {
    return raw
  }

  // Unknown format — return as-is and let the browser report the error
  return raw
}

/**
 * Resolve a list of image URLs. Filters out empty strings.
 */
export function resolveImageUrls(raws: string[] | null | undefined): string[] {
  if (!Array.isArray(raws)) return []
  return raws.map(resolveImageUrl).filter(Boolean)
}
