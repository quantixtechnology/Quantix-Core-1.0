"use client"

// Mobile Apps hub (Business Management) — one place for the owner to find, share
// and install every white-label app: the Customer App, the Executive Pickup &
// Delivery App and delivery tracking links. Reuses the shared AppShareCard
// (copy / QR / WhatsApp). All apps are the business's own branded PWAs.
import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { AppShareCard } from "@/components/laundry/apps/app-share-card"
import { Smartphone, Bike, MapPin } from "lucide-react"

export function LaundryMobileApps() {
  const [origin, setOrigin] = useState("")
  useEffect(() => { setOrigin(window.location.origin) }, [])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2"><Smartphone className="h-5 w-5 text-blue-600" /> Mobile Apps</h2>
        <p className="text-sm text-muted-foreground">Your business&apos;s own branded apps — share the links or QR codes to install. Fully white-label.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <AppShareCard
          title="Customer App"
          description="Customers book pickups, track orders and pay."
          icon={<Smartphone className="h-5 w-5" />}
          url={`${origin}/laundry/app`}
          note="Installs as your branded customer app (logo, colours, name)."
        />
        <AppShareCard
          title="Executive Pickup & Delivery App"
          description="Field executives run assigned pickups and deliveries."
          icon={<Bike className="h-5 w-5" />}
          url={`${origin}/laundry/executive`}
          note="Only active Delivery Executives can sign in (mobile + password)."
        />
        <Card className="rounded-xl border-slate-200">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 grid place-items-center shrink-0"><MapPin className="h-5 w-5" /></div>
              <div>
                <p className="font-semibold text-slate-800">Delivery Tracking Links</p>
                <p className="text-xs text-slate-500">Live per-order tracking for customers.</p>
              </div>
            </div>
            <p className="text-sm text-slate-500">A tracking link is generated per order and shared from the order&apos;s detail screen (and automatically in customer notifications). Customers open it in the Customer App to follow pickup → processing → delivery in real time.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
