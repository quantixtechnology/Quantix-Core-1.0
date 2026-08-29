"use client"

// Install App — the storefront header action.
//
// It used to carry its OWN beforeinstallprompt capture, duplicating
// usePwaInstall, and when no prompt was available it told the customer to use
// "Add to Home Screen" from the browser menu. On Android that is Chrome's
// CREATE SHORTCUT flow — a bookmark with an icon, not an installed app — so our
// own modal was instructing customers to do the wrong thing. It also never
// checked whether the app was already installed, and it cleared the captured
// prompt on a DISMISS, which left the button permanently falling through to
// that modal.
//
// Now it reuses the shared hook (one install system, not two) and every branch
// is honest about what the browser can actually do:
//
//   native prompt available  → the real install dialog
//   iOS Safari               → the Add to Home Screen steps, which IS how you
//                              install on iOS — not a shortcut substitute
//   already installed        → says so, no prompt
//   anything else            → explains why, and never suggests a shortcut

import { useState } from "react"
import { ArrowDownToLine, Check, Share, Plus, MoreVertical } from "lucide-react"
import { usePwaInstall } from "@/hooks/use-pwa-install"

export type InstallMode = "pwa" | "playstore" | "appstore"

interface InstallAppButtonProps {
  brandColor?:   string
  mode?:         InstallMode  // reserved for future Play Store / App Store switch
  playstoreUrl?: string
  appstoreUrl?:  string
  className?:    string
}

export function InstallAppButton({ brandColor = "#10B981", mode = "pwa", playstoreUrl, appstoreUrl, className = "" }: InstallAppButtonProps) {
  // ignoreDismiss: the header CTA is an explicit request to install, so a
  // dismissed home-page banner must not suppress it.
  const { canInstall, isInstalled, isIos, browserSupported, install } = usePwaInstall({ ignoreDismiss: true })
  const [installing, setInstalling] = useState(false)
  const [showModal,  setShowModal]  = useState(false)
  const [hovered,    setHovered]    = useState(false)

  // Already running as an installed app — there is nothing to install.
  if (mode === "pwa" && isInstalled) {
    return (
      <span className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 h-10 rounded-xl border border-emerald-200 bg-emerald-50 select-none ${className}`}>
        <Check className="w-[15px] h-[15px] text-emerald-600" strokeWidth={2.4} />
        <span className="hidden sm:block text-sm font-medium leading-none text-emerald-700 whitespace-nowrap">App Installed</span>
      </span>
    )
  }

  // Desktop Firefox/Safari and anything else that cannot install: hide rather
  // than offer an action that leads nowhere.
  if (mode === "pwa" && !browserSupported && !canInstall) return null

  async function handleClick() {
    if (mode === "playstore" && playstoreUrl) { window.open(playstoreUrl, "_blank", "noopener"); return }
    if (mode === "appstore"  && appstoreUrl)  { window.open(appstoreUrl,  "_blank", "noopener"); return }

    // iOS never fires beforeinstallprompt — the Share sheet IS the install path.
    if (isIos) { setShowModal(true); return }

    setInstalling(true)
    try {
      // Returns false when the customer dismissed the dialog, or when no prompt
      // was available. Either way the button stays usable: Chrome re-fires
      // beforeinstallprompt on a later visit, and until then we explain instead
      // of offering a shortcut.
      const accepted = await install()
      if (!accepted) setShowModal(true)
    } finally {
      setInstalling(false)
    }
  }

  const btnClass = [
    "relative flex items-center gap-1.5 px-2.5 sm:px-3.5 h-10 rounded-xl border",
    "transition-all duration-200 overflow-hidden select-none cursor-pointer",
    "focus-visible:outline-none disabled:opacity-60",
    className,
  ].filter(Boolean).join(" ")

  return (
    <>
      <button
        type="button"
        disabled={installing}
        onClick={handleClick}
        aria-label="Install app"
        className={btnClass}
        style={{
          borderColor:     hovered ? `${brandColor}50` : "#e5e7eb",
          backgroundColor: hovered ? `${brandColor}08` : "#ffffff",
          boxShadow:       hovered ? `0 0 0 3px ${brandColor}18` : "none",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        <span className="flex-shrink-0 transition-transform duration-200" style={{ color: brandColor, transform: hovered ? "scale(1.12)" : "scale(1)" }}>
          <ArrowDownToLine className="w-[15px] h-[15px]" strokeWidth={2.2} />
        </span>
        <span className="hidden sm:block text-sm font-medium leading-none whitespace-nowrap" style={{ color: hovered ? "#111827" : "#374151" }}>
          {installing ? "Installing…" : "Install App"}
        </span>
        <span aria-hidden className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full transition-all duration-300" style={{ backgroundColor: brandColor, width: hovered ? "60%" : "0%", opacity: hovered ? 1 : 0 }} />
      </button>

      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Install the App</h2>

            {isIos ? (
              <>
                <p className="text-sm text-gray-600 mb-4">Add it to your Home Screen from Safari.</p>
                <ol className="text-sm text-gray-700 space-y-3 mb-5">
                  <li className="flex items-center gap-3">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center">1</span>
                    <span className="flex items-center gap-1.5">Tap the <Share className="w-4 h-4 inline" style={{ color: brandColor }} /> <strong>Share</strong> button in Safari</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center">2</span>
                    <span className="flex items-center gap-1.5">Select <Plus className="w-4 h-4 inline" style={{ color: brandColor }} /> <strong>Add to Home Screen</strong></span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center">3</span>
                    <span>Tap <strong>Add</strong></span>
                  </li>
                </ol>
              </>
            ) : (
              <>
                {/* Deliberately NOT "use Add to Home Screen from the menu" — on
                    Android that is the Create Shortcut flow, which is a bookmark
                    and not an install. */}
                <p className="text-sm text-gray-600 mb-4">
                  Installation isn&apos;t available right now.
                </p>
                <ul className="text-sm text-gray-600 space-y-2 mb-5">
                  <li className="flex items-start gap-2">
                    <MoreVertical className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                    <span>If you just closed the install dialog, reload the page and tap <strong>Install App</strong> again.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowDownToLine className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                    <span>Already installed it? Open the app from your home screen — Chrome won&apos;t offer to install it twice.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowDownToLine className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                    <span>On Android, open this site in <strong>Chrome</strong> to install it as an app.</span>
                  </li>
                </ul>
              </>
            )}

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="w-full h-11 rounded-xl font-semibold text-white text-sm"
              style={{ backgroundColor: brandColor }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
