// ============================================================================
// QUANTIX CORE — Delivery agent device actions
//
// Shared by the Delivery PWA (order detail, dashboard quick actions).
// All actions deep-link out to native apps — no SDK, no API key:
//   - tel:    opens the phone dialer (Android + iOS)
//   - wa.me:  opens WhatsApp if installed, web WhatsApp otherwise
//   - Google Maps universal URLs: open the Maps app if installed,
//     fall back to browser maps on any platform
// ============================================================================

/** Open the device dialer for a phone number. No-op when phone is empty. */
export function callPhone(phone: string | null | undefined): boolean {
  if (!phone?.trim()) return false
  window.location.href = `tel:${phone.replace(/[^\d+]/g, "")}`
  return true
}

/**
 * Open a WhatsApp chat. 10-digit numbers are assumed Indian (+91).
 * Optional prefilled message via wa.me ?text= param.
 */
export function openWhatsApp(phone: string | null | undefined, message?: string): boolean {
  if (!phone?.trim()) return false
  const digits = phone.replace(/\D/g, "")
  if (!digits) return false
  const intl = digits.length === 10 ? `91${digits}` : digits
  const text = message ? `?text=${encodeURIComponent(message)}` : ""
  window.open(`https://wa.me/${intl}${text}`, "_blank", "noopener")
  return true
}

/**
 * Launch turn-by-turn navigation in Google Maps.
 * Prefers exact coordinates; falls back to an address text search.
 * Universal URLs open the native Maps app on Android/iOS when installed.
 */
export function navigateToLocation(
  lat: number | null | undefined,
  lng: number | null | undefined,
  address?: string | null,
): boolean {
  if (typeof lat === "number" && typeof lng === "number" && (lat !== 0 || lng !== 0)) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank", "noopener")
    return true
  }
  if (address?.trim()) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, "_blank", "noopener")
    return true
  }
  return false
}

/**
 * Canonical "open this place" Maps URL for a saved location.
 *
 * Sibling of navigateToLocation() above, which builds a /maps/dir/ DIRECTIONS
 * link for a driver mid-round. A Location QR on a visiting card wants the
 * place itself, not a route from wherever the scanner happens to be standing,
 * so it uses /maps/search/ with the same api=1 universal form — which opens
 * the native Maps app on Android and iOS when installed and the web map
 * otherwise.
 *
 * Coordinates only, never the typed address: the address text is what someone
 * keyed in, while the coordinates are what was actually pinned on the map.
 * Returns null when there is nothing trustworthy to point at, so callers can
 * refuse to render a QR rather than publish a wrong one.
 */
export function locationMapsUrl(lat: number | null | undefined, lng: number | null | undefined): string | null {
  if (typeof lat !== "number" || typeof lng !== "number") return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  // 0,0 is Null Island — in practice an unset pair, not a real shop.
  if (lat === 0 && lng === 0) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}
