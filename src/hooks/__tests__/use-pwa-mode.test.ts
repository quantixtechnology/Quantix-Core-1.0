import { describe, it, expect } from "vitest"
import { isPwaShell } from "@/hooks/use-pwa-mode"

// ============================================================================
// Installed-app shell detection: an installed PWA (standalone display-mode or
// iOS navigator.standalone) OR the Quantix Android WebView shell (marked in
// its user agent) wears the app shell. Everything else gets the web shell.
//
// The marker is a PRESENTATION switch only — nothing auth/business-related
// keys off it.
// ============================================================================

const CHROME_MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
const ANDROID_WEBVIEW_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 " +
  "wv QuantixApp/1"
const IPSA_FULLSCREEN_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

describe("isPwaShell — which surface wears the app shell", () => {
  it("a normal browser tab: false", () => {
    expect(isPwaShell(false, false, CHROME_MOBILE_UA)).toBe(false)
  })

  it("an installed Android PWA (display-mode: standalone): true", () => {
    expect(isPwaShell(true, false, CHROME_MOBILE_UA)).toBe(true)
  })

  it("an iOS Home-screen web app (navigator.standalone): true", () => {
    expect(isPwaShell(false, true, IPSA_FULLSCREEN_UA)).toBe(true)
  })

  it("the Quantix Android shell (marked WebView): true", () => {
    expect(isPwaShell(false, false, ANDROID_WEBVIEW_UA)).toBe(true)
  })

  it("the installed-PWA flags still win over any UA", () => {
    expect(isPwaShell(true, true, "irrelevant")).toBe(true)
  })

  describe("the QuantixApp/<version> marker", () => {
    it("is case-insensitive and any wrapper version matches", () => {
      expect(isPwaShell(false, false, "quantixapp/9")).toBe(true)
      expect(isPwaShell(false, false, "QuantixApp/1")).toBe(true)
    })

    it("requires the slash-and-version: a bare substring does not match", () => {
      expect(isPwaShell(false, false, "QuantixAppStore")).toBe(false)
      expect(isPwaShell(false, false, "quantixappx")).toBe(false)
    })

    it("matches wherever the token appears in the UA", () => {
      expect(isPwaShell(false, false, "Mozilla/5.0 Thing QuantixApp/2 Tail")).toBe(true)
    })
  })
})