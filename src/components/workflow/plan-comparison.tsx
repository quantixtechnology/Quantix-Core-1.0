"use client"

import { Badge } from "@/components/ui/badge"
import { Check, X, ShoppingCart, Truck, Calendar, CreditCard, Receipt, Store, Package, ShoppingBag, Users, UserCheck, Info } from "lucide-react"
import { PLAN_CONFIGS, WORKFLOW_CONFIGS, type PlanTier } from "@/stores/admin-store"

const workflowIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingCart, Truck, Calendar, CreditCard, Receipt,
}

const TIER_STYLE: Record<PlanTier, { badge: string; border: string; accent: string }> = {
  STANDARD: { badge: "bg-slate-100 text-slate-700 border-slate-200", border: "border-gray-200",                       accent: "text-slate-600" },
  PRO:      { badge: "bg-blue-600 text-white border-blue-700",        border: "border-blue-200 ring-1 ring-blue-100", accent: "text-blue-600" },
}

function LimitPill({ value, label, icon: Icon }: { value: number | string; label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-md px-2 py-1">
      <Icon className="h-3 w-3 text-gray-400 shrink-0" />
      <span className="text-xs font-semibold text-gray-700">{typeof value === "number" ? value.toLocaleString() : value}</span>
      <span className="text-[10px] text-gray-400">{label}</span>
    </div>
  )
}

export function PlanComparison() {
  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Feature Access Configuration</h2>
          <p className="text-xs text-gray-500 mt-0.5">Workflow unlock and resource limits per plan tier — billing is configured per business</p>
        </div>
        <Badge variant="outline" className="text-[10px] text-gray-400 border-dashed">Read-only</Badge>
      </div>

      {/* Plan Cards */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {PLAN_CONFIGS.map((plan) => {
          const style = TIER_STYLE[plan.tier]
          return (
            <div key={plan.tier} className={`bg-white rounded-xl border ${style.border} overflow-hidden`}>

              {/* Card header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] font-bold px-2 py-0.5 ${style.badge}`}>{plan.tier}</Badge>
                  <span className="text-sm font-semibold text-gray-800">{plan.name} Plan</span>
                </div>
                <span className="text-[11px] text-gray-400 hidden sm:block">{plan.description}</span>
              </div>

              <div className="p-4 space-y-4">

                {/* Limits */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Limits</p>
                  <div className="flex flex-wrap gap-1.5">
                    <LimitPill value={plan.limits.stores}   label="stores"    icon={Store} />
                    <LimitPill value={plan.limits.products.toLocaleString()} label="products" icon={Package} />
                    <LimitPill value={`${(plan.limits.orders / 1000).toFixed(0)}K`} label="orders/mo" icon={ShoppingBag} />
                    <LimitPill value={plan.limits.staff}    label="staff"     icon={Users} />
                    <LimitPill value={plan.limits.partners} label="partners"  icon={UserCheck} />
                  </div>
                </div>

                {/* Workflow access */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Workflow Access</p>
                  <div className="space-y-0.5">
                    {WORKFLOW_CONFIGS.map((wf) => {
                      const allowed = plan.allowedWorkflows.includes(wf.type)
                      const Icon = workflowIconMap[wf.icon] || ShoppingCart
                      return (
                        <div
                          key={wf.type}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs ${
                            allowed ? "bg-emerald-50/70 text-gray-700" : "text-gray-300"
                          }`}
                        >
                          {allowed
                            ? <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                            : <X className="h-3 w-3 text-gray-200 shrink-0" />}
                          <Icon className={`h-3 w-3 shrink-0 ${allowed ? wf.color : "text-gray-200"}`} />
                          <span className={allowed ? "font-medium" : ""}>{wf.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Feature list */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Included</p>
                  <div className="flex flex-wrap gap-1">
                    {plan.features.map((f) => (
                      <span key={f} className="text-[10px] bg-gray-50 border border-gray-200 text-gray-600 rounded px-2 py-0.5">{f}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Workflow matrix — quick reference */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700">Workflow Access Matrix</span>
          <Badge variant="outline" className="text-[10px] text-gray-400">Quick Reference</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 w-1/2">Workflow</th>
                {PLAN_CONFIGS.map((p) => (
                  <th key={p.tier} className="px-4 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WORKFLOW_CONFIGS.map((wf, i) => {
                const Icon = workflowIconMap[wf.icon] || ShoppingCart
                return (
                  <tr key={wf.type} className={i % 2 === 0 ? "bg-gray-50/40" : ""}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-3.5 w-3.5 shrink-0 ${wf.color}`} />
                        <span className="font-medium text-gray-700">{wf.label}</span>
                      </div>
                    </td>
                    {PLAN_CONFIGS.map((plan) => {
                      const allowed = plan.allowedWorkflows.includes(wf.type)
                      return (
                        <td key={plan.tier} className="px-4 py-2 text-center">
                          {allowed
                            ? <Check className="h-3.5 w-3.5 text-emerald-500 mx-auto" />
                            : <X className="h-3.5 w-3.5 text-gray-200 mx-auto" />}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Billing note */}
      <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-gray-200 px-4 py-3">
        <Info className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="font-medium text-gray-700">Pricing is not tied to plan tier.</span>{" "}
          Subscription amounts, discounts, billing cycles, implementation charges, iOS billing, and add-ons are negotiated and configured per business during onboarding.
        </p>
      </div>

    </div>
  )
}
