"use client"

// The INSTALLED Laundry OS app is an operations console, not a phone app.
//
// The first version of this guard asked only whether the viewport was under
// 768px, and so blocked anyone who opened the workspace in Chrome on their
// phone. That is an ordinary responsive website visit and must always work: a
// small screen is the visitor's business, not ours.
//
// The restriction belongs to the INSTALLED app — the controlled terminal a
// counter or a processing floor runs — and only when it has been installed on
// a phone, where the audit table and the workstation queues genuinely cannot
// lay out. Three conditions, all required:
//
//   the Laundry OS host  ·  installed / standalone  ·  a phone-sized device
//
// A narrow browser, an Android or iPhone user agent, a standalone Commerce
// window, or the installed app on a tablet or desktop all render normally.
//
// This guard covers ONLY the Laundry OS workspace — it is imported by
// laundry-layout.tsx and nowhere else. The Delivery Executive, Store Admin and
// Customer apps are phone applications by design and never see it.
//
// It is presentation, never authorization: nothing here decides what anyone may
// see. Permissions are settled long before this renders.

import { useEffect, useState, type ReactNode } from "react"
import { Monitor } from "lucide-react"
import { shouldRestrictToDesktopTablet, shortestScreenSide, isStandaloneDisplay } from "@/lib/device-class"
import { isPlatformAppHost } from "@/lib/product-hosts"

const SF_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "quantixtechnology.in"

export function LaundryDeviceGuard({ children }: { children: ReactNode }) {
  // Undefined until measured, so the server render and the first client render
  // agree and nothing flashes. Defaults to ALLOWED: if the check never runs,
  // the workspace opens.
  const [restricted, setRestricted] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const sync = () => {
      const host = window.location.hostname
      setRestricted(shouldRestrictToDesktopTablet({
        installed: isStandaloneDisplay(),
        shortestScreenSide: shortestScreenSide(),
        // The app's own host, never the platform or a product it is not.
        // isPlatformAppHost is reused rather than re-deriving host rules.
        isLaundryOsHost: !isPlatformAppHost(host, SF_BASE) && host.startsWith("laundry."),
      }))
    }
    sync()
    const mq = window.matchMedia("(display-mode: standalone)")
    mq.addEventListener("change", sync)
    window.addEventListener("resize", sync)
    return () => { mq.removeEventListener("change", sync); window.removeEventListener("resize", sync) }
  }, [])

  if (restricted !== true) return <>{children}</>

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
        <p className="mt-3 text-xs text-slate-400">
          You can also open <span className="font-medium text-slate-500">laundry.{SF_BASE}</span> in your phone&rsquo;s browser —
          the website works at any size.
        </p>
        <p className="mt-4 text-xs text-slate-400">
          Pickup and delivery executives have their own phone app and should continue using that.
        </p>
      </div>
    </div>
  )
}
