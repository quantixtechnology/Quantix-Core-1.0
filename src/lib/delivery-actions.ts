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
