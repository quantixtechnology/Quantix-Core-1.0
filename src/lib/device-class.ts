// Is this the INSTALLED Laundry OS app, on a phone?
//
// A narrow window is not a phone, and a phone is not a problem. The first
// version of the Laundry device guard asked only "is the viewport under 768?"
// and so blocked anyone who opened the workspace in Chrome on their phone —
// which is an ordinary responsive website visit and must always work.
//
// Two different products live at the same URL:
//
//   the WEBSITE   — opened in a browser. Always allowed, at any size. A small
//                   screen is the visitor's business, not ours.
//   the INSTALLED APP — a controlled operational terminal for a counter or a
//                   processing floor. That one may say it wants a desk.
//
// So the restriction needs all three, and nothing less:
//   the Laundry OS host  ·  installed/standalone  ·  a phone-sized device
//
// Anything else — narrow browser, Android UA, iPhone UA, standalone Commerce,
// an installed app on a tablet or a desktop — renders normally.

/** Below this, the smallest side of the SCREEN belongs to a phone. */
const PHONE_MAX_SHORT_SIDE = 600

export interface DeviceRestrictionInput {
  /** The app is running in its own window, not a browser tab. */
  installed: boolean
  /**
   * The shorter side of the screen, in CSS pixels.
   *
   * The SHORT side, deliberately: it is the same in portrait and landscape, so
   * a phone turned sideways is still a phone and a tablet held upright is
   * still a tablet. Width alone gets both of those wrong.
   *
   *   iPhone 15      390 × 844   → 390   phone
   *   iPad Air       820 × 1180  → 820   tablet
   *   Android tablet 800 × 1280  → 800   tablet
   */
  shortestScreenSide: number
  /** The host really is the Laundry OS application. */
  isLaundryOsHost: boolean
}

/** True only for the installed Laundry OS app on a phone. */
export function shouldRestrictToDesktopTablet(i: DeviceRestrictionInput): boolean {
  if (!i.isLaundryOsHost) return false
  // A browser tab is the website. Never blocked, whatever its size.
  if (!i.installed) return false
  if (!Number.isFinite(i.shortestScreenSide) || i.shortestScreenSide <= 0) return false
  return i.shortestScreenSide < PHONE_MAX_SHORT_SIDE
}

/** Phone class from the screen, falling back to the viewport. */
export function shortestScreenSide(): number {
  if (typeof window === "undefined") return 0
  const w = window.screen?.width || window.innerWidth || 0
  const h = window.screen?.height || window.innerHeight || 0
  return Math.min(w, h) || 0
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
