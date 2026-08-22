"use client"

import { useState, useEffect, useRef } from "react"
import { ArrowDownToLine } from "lucide-react"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

declare global {
  interface Window { __bip?: BeforeInstallPromptEvent | null }
}

export type InstallMode = "pwa" | "playstore" | "appstore"

interface InstallAppButtonProps {
  brandColor?:   string
  mode?:         InstallMode  // reserved for future Play Store / App Store switch
  playstoreUrl?: string
  appstoreUrl?:  string
  className?:    string
}

export function InstallAppButton({ brandColor = "#10B981", mode = "pwa", playstoreUrl, appstoreUrl, className = "" }: InstallAppButtonProps) {
  const promptRef  = useRef<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)
  const [showModal,  setShowModal]  = useState(false)
  const [hovered,    setHovered]    = useState(false)

  useEffect(() => {
    // Claim event captured by the early-capture script in layout.tsx (runs before React)
    if (window.__bip) { promptRef.current = window.__bip; window.__bip = null }
    const onBip = (e: Event) => { e.preventDefault(); promptRef.current = e as BeforeInstallPromptEvent }
    window.addEventListener("beforeinstallprompt", onBip)
    return () => window.removeEventListener("beforeinstallprompt", onBip)
  }, [])

  async function handleClick() {
    if (mode === "playstore" && playstoreUrl) { window.open(playstoreUrl, "_blank", "noopener"); return }
    if (mode === "appstore"  && appstoreUrl)  { window.open(appstoreUrl,  "_blank", "noopener"); return }

    if (promptRef.current) {
      setInstalling(true)
      try {
        await promptRef.current.prompt()
        await promptRef.current.userChoice
        promptRef.current = null
      } finally {
        setInstalling(false)
      }
      return
    }

    setShowModal(true)
  }

  const btnClass = [
    "relative flex items-center gap-1.5 px-3.5 h-10 rounded-xl border",
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
        {/* Animated accent line */}
        <span aria-hidden className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full transition-all duration-300" style={{ backgroundColor: brandColor, width: hovered ? "60%" : "0%", opacity: hovered ? 1 : 0 }} />
      </button>

      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Install App</h2>
            <p className="text-sm text-gray-600 mb-4">
              To install this app, use <strong>Add to Home Screen</strong> from your browser menu.
            </p>
            <ul className="text-sm text-gray-600 space-y-2 mb-5">
              <li className="flex items-start gap-2">
                <span className="font-semibold text-gray-800 shrink-0">iPhone / iPad:</span>
                Tap the Share button ⬆ then "Add to Home Screen"
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-gray-800 shrink-0">Android:</span>
                Tap the browser menu ⋮ then "Add to Home Screen"
              </li>
            </ul>
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
