"use client"

// Thin page wrappers so the Services master and the three pricing sub-tools
// (Subscription Plans, Charges & Rules, Pricing Simulator) each get their OWN
// sidebar page. These used to live only as tabs inside the (now retired)
// Services & Pricing engine; restoring them keeps master data separated from
// pricing without redesigning any of the underlying screens.
import { useCallback, useEffect, useState } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { LaundryServicesPricing } from "./laundry-services-pricing"
import { LaundrySubscriptionPlans } from "./laundry-subscription-plans"
import { LaundryChargesRules } from "./laundry-charges-rules"
import { PricingSimulator } from "./pricing-simulator"
import type { Ref } from "./pricing-shared"

export function ServicesMasterPage() {
  const { currentBusinessId } = useAuthStore()
  if (!currentBusinessId) return null
  return (
    <div className="space-y-4">
      <div><h2 className="text-lg font-semibold tracking-tight">Services</h2></div>
      <LaundryServicesPricing businessId={currentBusinessId} />
    </div>
  )
}

export function SubscriptionPlansPage() {
  const { currentBusinessId } = useAuthStore()
  if (!currentBusinessId) return null
  return (
    <div className="space-y-4">
      <div><h2 className="text-lg font-semibold tracking-tight">Subscription Plans</h2><p className="text-sm text-muted-foreground">Recurring plans and allowances. Prices resolve through the same billing engine.</p></div>
      <LaundrySubscriptionPlans businessId={currentBusinessId} />
    </div>
  )
}

export function ChargesRulesPage() {
  const { currentBusinessId } = useAuthStore()
  if (!currentBusinessId) return null
  return (
    <div className="space-y-4">
      <div><h2 className="text-lg font-semibold tracking-tight">Charges &amp; Rules</h2><p className="text-sm text-muted-foreground">Surcharges and rules layered on top of base garment pricing.</p></div>
      <LaundryChargesRules businessId={currentBusinessId} />
    </div>
  )
}

export function PricingSimulatorPage() {
  const { currentBusinessId } = useAuthStore()
  const [masters, setMasters] = useState<{ services: Ref[]; garments: Ref[]; cats: Ref[]; stores: Ref[] }>({ services: [], garments: [], cats: [], stores: [] })

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    const qs = `businessId=${encodeURIComponent(currentBusinessId)}`
    const [s, g, c, st] = await Promise.all([
      fetch(`/api/laundry/services?${qs}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/laundry/garments?${qs}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/laundry/categories?${qs}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/laundry/businesses/${currentBusinessId}/stores`).then((r) => r.json()).catch(() => []),
    ])
    setMasters({
      services: s.success ? s.data : [],
      garments: g.success ? g.data : [],
      cats: c.success ? c.data : [],
      stores: Array.isArray(st) ? st.map((x: { id: string; storeName: string }) => ({ id: x.id, storeName: x.storeName, name: x.storeName })) : [],
    })
  }, [currentBusinessId])
  useEffect(() => { load() }, [load])

  if (!currentBusinessId) return null
  return (
    <div className="space-y-4">
      <div><h2 className="text-lg font-semibold tracking-tight">Pricing Simulator</h2><p className="text-sm text-muted-foreground">Preview the exact price the billing engine will resolve for any combination.</p></div>
      <PricingSimulator businessId={currentBusinessId} masters={masters} />
    </div>
  )
}
