"use client"

// ============================================================================
// Settings → Business Configuration
// Reuses the Laundry Setup Wizard for EDITING business information after the
// tenant exists. This is the relocated home of the wizard (it no longer blocks
// the operational dashboard). Onboarding/first-time setup happens during tenant
// creation in Platform Business Management; this screen is for later edits.
// ============================================================================

import { useAuthStore } from "@/stores/auth-store"
import LaundrySetupWizard from "./laundry-setup-wizard"

export function LaundryBusinessConfig() {
  const { currentBusinessId } = useAuthStore()

  if (!currentBusinessId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p className="text-sm">No business selected</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Business Configuration</h2>
        <p className="text-sm text-muted-foreground">Edit your laundry business information, stores, and operational setup.</p>
      </div>
      <LaundrySetupWizard
        laundryBusinessId={currentBusinessId}
        onComplete={() => { /* stays on the configuration screen after saving */ }}
      />
    </div>
  )
}
