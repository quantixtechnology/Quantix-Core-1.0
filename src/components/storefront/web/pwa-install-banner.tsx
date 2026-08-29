"use client"

// PwaInstallBanner — shown at the top of the home page when the app can be installed.
//
// Android: shows a one-tap "Install App" button that triggers the native prompt.
//          (It is deliberately NOT labelled "Add to Home Screen" — on Android
//          that is Chrome's Create Shortcut flow, which is a bookmark, not an
//          install. The button here really does install.)
// iOS:     shows a small tip explaining how to use Safari's Share → Add to Home Screen.
//
// Dismissed for 30 days on close. Does not render at all when already installed
// or when the browser has not fired `beforeinstallprompt` (e.g. Firefox desktop).

import { useState } from "react"
import { X, Download, Share } from "lucide-react"
import { usePwaInstall } from "@/hooks/use-pwa-install"
import { useAdminStore } from "@/stores/admin-store"

interface PwaInstallBannerProps {
  brandColor: string
}

export function PwaInstallBanner({ brandColor }: PwaInstallBannerProps) {
  const { canInstall, isIos, install, dismiss } = usePwaInstall()
  const { currentBusinessName } = useAdminStore()
  const [installing, setInstalling] = useState(false)

  if (!canInstall) return null

  const appName = currentBusinessName || "this store"

  async function handleInstall() {
    if (isIos) return // iOS shows static instructions; no prompt to trigger
    setInstalling(true)
    try {
      await install()
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div
      className="mx-4 mb-4 rounded-2xl border flex items-start gap-3 px-4 py-3 shadow-sm"
      style={{ borderColor: `${brandColor}30`, backgroundColor: `${brandColor}0d` }}
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: brandColor }}
      >
        {isIos ? (
          <Share className="w-4 h-4 text-white" />
        ) : (
          <Download className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        {isIos ? (
          <>
            <p className="text-sm font-semibold text-gray-900 leading-tight">
              Add to Home Screen
            </p>
            <p className="text-xs text-gray-500 mt-0.5 leading-snug">
              Tap the <strong>Share</strong> button below, then{" "}
              <strong>Add to Home Screen</strong> to install {appName}.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-gray-900 leading-tight">
              Install {appName}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Add to home screen for the best experience.
            </p>
          </>
        )}

        {/* Android install button */}
        {!isIos && (
          <button
            onClick={handleInstall}
            disabled={installing}
            className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: brandColor }}
          >
            {installing ? "Installing…" : "Install App"}
          </button>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={dismiss}
        className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-0.5 -mr-1 -mt-0.5"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
