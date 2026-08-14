// What this terminal IS, and what a hardware test is allowed to conclude.
//
// Two jobs, both about telling the truth:
//
//   1. Terminal identity — is this the installed Laundry OS, in its own window,
//      over HTTPS, with a service worker? An operator about to run a shift
//      should be able to see they are on the right application, and a demo
//      should be able to show it. Facts the browser reports about itself, and
//      nothing else: no token, no session, no tenant, no server call.
//
//   2. A vocabulary for hardware results. "Failed" and "cannot be seen from
//      here" are completely different answers, and collapsing them is how a
//      working scanner ends up reported as broken. A browser cannot enumerate
//      arbitrary USB devices — that is a deliberate security boundary, not a
//      fault — and a keyboard-emulation scanner is a keyboard to it, provable
//      only by scanning. So a result is one of five things, and NOT_DETECTABLE
//      and PERMISSION_REQUIRED are never dressed up as FAIL.

export type HardwareResult =
  | "PASS"
  | "FAIL"
  | "NOT_AVAILABLE"        // the browser does not implement this API at all
  | "PERMISSION_REQUIRED"  // it does, but the operator has granted nothing yet
  | "NOT_DETECTABLE"       // real and possibly working, but unobservable here

export const RESULT_LABEL: Record<HardwareResult, string> = {
  PASS: "Pass",
  FAIL: "Fail",
  NOT_AVAILABLE: "Not available",
  PERMISSION_REQUIRED: "Permission required",
  NOT_DETECTABLE: "Not detectable",
}

/** Only a genuine failure is red. The rest are states, not faults. */
export const RESULT_TONE: Record<HardwareResult, "ok" | "bad" | "info"> = {
  PASS: "ok",
  FAIL: "bad",
  NOT_AVAILABLE: "info",
  PERMISSION_REQUIRED: "info",
  NOT_DETECTABLE: "info",
}

export interface TerminalFacts {
  /** Running inside the installed window rather than a browser tab. */
  standalone: boolean
  displayMode: string
  browser: string
  secure: boolean
  serviceWorker: boolean
}

/** Best-effort browser name for the operator to recognise. Never a decision. */
export function browserName(ua: string): string {
  const s = ua.toLowerCase()
  if (s.includes("edg/")) return "Microsoft Edge"
  if (s.includes("opr/") || s.includes("opera")) return "Opera"
  if (s.includes("firefox")) return "Firefox"
  // Chrome's UA contains Safari, so Chrome must be ruled out first.
  if (s.includes("chrome") || s.includes("chromium")) return "Chrome"
  if (s.includes("safari")) return "Safari"
  return "Browser"
}

export function readTerminalFacts(): TerminalFacts {
  if (typeof window === "undefined") {
    return { standalone: false, displayMode: "browser", browser: "Browser", secure: false, serviceWorker: false }
  }
  const modes = ["standalone", "window-controls-overlay", "fullscreen", "minimal-ui"]
  const displayMode = modes.find((m) => window.matchMedia(`(display-mode: ${m})`).matches) ?? "browser"
  const standalone =
    displayMode === "standalone" ||
    displayMode === "window-controls-overlay" ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return {
    standalone,
    displayMode,
    browser: browserName(navigator.userAgent || ""),
    secure: window.isSecureContext === true,
    // Registered, not merely supported: a controller means one is running this page.
    serviceWorker: !!navigator.serviceWorker?.controller,
  }
}

/**
 * What a device-API test may conclude, from capability and grant count alone.
 *
 * `supported` is whether the browser implements the API; `grantedCount` is how
 * many devices the operator has already allowed through the chooser. Zero
 * grants is PERMISSION_REQUIRED — the operator has simply not paired anything
 * yet — and never FAIL, because nothing has been tried.
 */
export function deviceApiResult(supported: boolean, grantedCount: number): HardwareResult {
  if (!supported) return "NOT_AVAILABLE"
  return grantedCount > 0 ? "PASS" : "PERMISSION_REQUIRED"
}

/**
 * The scanner is the exception, and the reason this vocabulary exists.
 *
 * A keyboard-emulation scanner cannot be enumerated by WebUSB, WebHID or Web
 * Serial — the operating system claims it as a keyboard — so its absence from
 * those lists means nothing at all. The one honest proof is that a barcode has
 * arrived through the engine.
 */
export function scannerResult(everScanned: boolean): HardwareResult {
  return everScanned ? "PASS" : "NOT_DETECTABLE"
}
