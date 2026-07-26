"use client"

// Shared PWA install control for the field-ops / admin apps. Uses the platform
// usePwaInstall hook: on Android/Chrome it fires the native install prompt; on
// iOS (no beforeinstallprompt) it shows the manual Add-to-Home-Screen steps.
// Hidden once the app is already running installed (standalone).
import { useState } from "react"
import { Download, X } from "lucide-react"
import { usePwaInstall } from "@/hooks/use-pwa-install"

export function PwaInstallButton({ className = "", label = "Install App" }: { className?: string; label?: string }) {
  const { canInstall, isInstalled, isIos, install } = usePwaInstall({ ignoreDismiss: true })
  const [help, setHelp] = useState(false)

  if (isInstalled) return null

  const onClick = async () => {
    if (isIos) { setHelp(true); return }
    const ok = await install()
    if (!ok && !canInstall) setHelp(true)
  }

  return (
    <>
      <button
        onClick={onClick}
        className={className || "w-full h-11 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium flex items-center justify-center gap-2 hover:bg-slate-50"}
      >
        <Download className="h-4 w-4" /> {label}
      </button>

      {help && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => setHelp(false)}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-800 flex items-center gap-2"><Download className="h-4 w-4" /> Install this app</p>
              <button onClick={() => setHelp(false)} className="text-slate-400"><X className="h-5 w-5" /></button>
            </div>
            {isIos ? (
              <p className="text-sm text-slate-600">In Safari, tap the <b>Share</b> button, then <b>Add to Home Screen</b>. Open the app from your home screen for the full-screen experience.</p>
            ) : (
              <p className="text-sm text-slate-600">Open your browser menu (⋮ top-right) and tap <b>Install app</b> / <b>Add to Home screen</b>, then launch it from your home screen.</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
