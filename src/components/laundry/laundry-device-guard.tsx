"use client"

// Laundry OS is an operations console, not a phone app.
//
// The counter, the audit table and every workstation queue are built for the
// information density of a desk or a tablet stand. Squeezed to phone width the
// same screens do not become a phone app — they become the desktop app with
// everything overlapping, which is worse than saying so plainly.
//
// This guard covers ONLY the Laundry OS workspace. The Delivery Executive PWA,
// the Store Admin PWA and the Customer app are phone applications by design and
// are untouched.
//
// It is presentation, never authorization: nothing here decides what anyone may
// see. A narrow window hides the console and offers the way back; permissions
// are settled long before this renders.

import { useEffect, useState, type ReactNode } from "react"
import { Monitor } from "lucide-react"

/** Below this the operational layout stops being usable. Tablet portrait is 768. */
const MIN_OPERATIONAL_WIDTH = 768

export function LaundryDeviceGuard({ children }: { children: ReactNode }) {
  // Undefined until measured, so the server render and the first client render
  // agree and nothing flashes.
  const [tooNarrow, setTooNarrow] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MIN_OPERATIONAL_WIDTH - 1}px)`)
    const sync = () => setTooNarrow(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  if (tooNarrow !== true) return <>{children}</>

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
          <Monitor className="h-7 w-7 text-blue-600" />
        </div>
        <h1 className="text-lg font-bold text-slate-800">Laundry OS is designed for Desktop &amp; Tablet</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Please open Laundry OS on a desktop, laptop or tablet for the best operational experience.
        </p>
        <p className="mt-4 text-xs text-slate-400">
          Pickup and delivery executives have their own phone app and should continue using that.
        </p>
      </div>
    </div>
  )
}
