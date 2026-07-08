"use client"

// Client-side entitlement gate for CRM pages. Direct navigation to a CRM page
// on a tenant without CRM shows a notice instead of the page — and the CRM
// APIs independently reject the tenant server-side, so this is UX, not security.

import { Loader2, Lock } from "lucide-react"
import { useCrmEnabled } from "./crm-shared"

export function CrmGate({ children }: { children: React.ReactNode }) {
  const enabled = useCrmEnabled()
  if (enabled === null) {
    return <div className="flex items-center gap-2 py-16 justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
  }
  if (!enabled) {
    return (
      <div className="py-20 text-center">
        <Lock className="h-8 w-8 mx-auto text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-600">CRM is not enabled for this business</p>
        <p className="text-xs text-slate-400 mt-1">Contact Quantix to enable the CRM feature for your Laundry OS workspace.</p>
      </div>
    )
  }
  return <>{children}</>
}
