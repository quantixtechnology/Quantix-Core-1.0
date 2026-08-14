"use client"

// Install this web application as an app.
//
// There is no file to download and nothing to package. A PWA install is the
// browser wrapping the site it is already on in its own window — the code stays
// on the server, and installing grants nothing that opening the URL did not.
// So the button never promises a binary, and never promises access.
//
// THE AUTHORITATIVE SIGNAL IS `beforeinstallprompt`, not the user agent. Only
// the browser knows whether this page is installable right now: it weighs the
// manifest, the service worker, HTTPS, whether the app is already installed and
// its own engagement rules. A user-agent string knows none of that, so it is
// used for one thing only — naming the device in the label once the browser has
// already said yes.
//
// The event also only fires on a page inside the app's own scope. That is why
// this belongs on the Laundry OS host, where the workspace and the app it
// installs are the same origin. Elsewhere the browser stays silent and the
// operator gets the manual instructions and the QR code instead of a button
// that would do nothing.

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Download, Info } from "lucide-react"

/** The Chromium-only event. Typed here because lib.dom does not carry it. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

type Platform = "windows" | "android" | "other"

/** A LABEL, never a decision — the browser decides whether install is offered. */
function describeDevice(ua: string): Platform {
  const s = ua.toLowerCase()
  if (s.includes("android")) return "android"
  if (s.includes("windows")) return "windows"
  return "other"
}

function installLabel(p: Platform): string {
  if (p === "windows") return "Install on Windows PC"
  if (p === "android") return "Install on Android Tablet"
  return "Install Laundry OS"
}

/**
 * Is this page running inside the installed window?
 *
 * Read through useSyncExternalStore so the browser stays the source of truth
 * and the server render agrees with the first client render — the standalone
 * answer is simply false until the browser can be asked.
 */
function subscribeDisplayMode(onChange: () => void): () => void {
  const mq = window.matchMedia("(display-mode: standalone)")
  mq.addEventListener("change", onChange)
  window.addEventListener("appinstalled", onChange)
  return () => {
    mq.removeEventListener("change", onChange)
    window.removeEventListener("appinstalled", onChange)
  }
}

function readStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

const NO_SUBSCRIBE = () => () => {}

/** What to do by hand when the browser offers no prompt. */
function manualSteps(p: Platform): string {
  if (p === "android") return "Open the browser menu (⋮) and choose Install app / Add to Home screen."
  return "Open the browser menu (⋮) and choose Install Laundry OS. Chrome and Edge also show an install icon at the right-hand end of the address bar."
}

export function PwaInstallButton({ appName = "Laundry OS", url }: { appName?: string; url: string }) {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Running inside the installed window is the one certain proof it is
  // installed; the browser is asked directly rather than mirrored into state.
  const standalone = useSyncExternalStore(subscribeDisplayMode, readStandalone, () => false)
  const platform = useSyncExternalStore(NO_SUBSCRIBE, () => describeDevice(navigator.userAgent || ""), () => "other" as Platform)
  const installed = standalone || accepted

  useEffect(() => {
    const onPrompt = (e: Event) => {
      // Keep the event so the install can happen on a real click — browsers
      // require a user gesture, and the event is single-use.
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => { setAccepted(true); setPrompt(null) }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!prompt) return
    setBusy(true)
    try {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      // The event cannot be reused either way; the browser fires a fresh one if
      // the app is still installable.
      setPrompt(null)
      if (outcome === "accepted") setAccepted(true)
      else setDismissed(true)
    } catch {
      setPrompt(null)
    } finally {
      setBusy(false)
    }
  }, [prompt])

  if (installed) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 h-8 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> Installed
        </span>
        <Button asChild size="sm" variant="outline" className="gap-1">
          <a href={url} target="_blank" rel="noreferrer">Open {appName}</a>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {prompt ? (
          <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={install} disabled={busy}>
            <Download className="h-3.5 w-3.5" /> {installLabel(platform)}
          </Button>
        ) : (
          // No button that does nothing: the browser has not offered an install
          // here, so say how to do it by hand instead of pretending.
          <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 h-8 text-xs font-medium text-slate-500">
            <Info className="h-3.5 w-3.5" /> Install manually
          </span>
        )}
        <Button asChild size="sm" variant="outline" className="gap-1">
          <a href={url} target="_blank" rel="noreferrer">Open</a>
        </Button>
      </div>
      {!prompt && <p className="text-[11px] leading-snug text-slate-400">{manualSteps(platform)}</p>}
      {dismissed && <p className="text-[11px] leading-snug text-slate-400">Installation cancelled — you can install any time from the browser menu.</p>}
    </div>
  )
}
