"use client"

// Source + Sales Team Owner — the two acquisition fields, wherever a customer
// is created or edited.
//
// One component so New Order and Customer Master cannot drift into asking the
// question two different ways.
//
// Both lists come from the server: sources from the configurable master,
// owners from CRM lead ownership — the people who already own leads, not the
// staff list.
//
// Whatever this customer already carries stays in its dropdown even when it is
// no longer offered: a retired source, or an owner whose leads have all moved
// on. Otherwise editing a phone number would silently blank how they were won.

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { getAuthHeaders } from "@/lib/admin-fetch"

export interface Source { id: string; name: string; active: boolean }
export interface Owner { id: string; name: string }

export function useAcquisitionOptions(businessId: string) {
  const [sources, setSources] = useState<Source[]>([])
  const [owners, setOwners] = useState<Owner[]>([])

  useEffect(() => {
    if (!businessId) return
    const q = `businessId=${encodeURIComponent(businessId)}`
    fetch(`/api/laundry/settings/customer-sources?${q}`, { headers: getAuthHeaders() })
      .then((r) => r.json()).then((j) => { if (j?.success) setSources(j.data) }).catch(() => {})
    fetch(`/api/laundry/settings/sales-owners?${q}`, { headers: getAuthHeaders() })
      .then((r) => r.json()).then((j) => { if (j?.success) setOwners(j.data) }).catch(() => {})
  }, [businessId])

  return { sources, owners }
}

/** The id a new customer starts on: Direct when it exists, else the first active. */
export function defaultSourceId(sources: Source[]): string {
  const direct = sources.find((s) => s.active && s.name.toLowerCase() === "direct")
  return direct?.id || sources.find((s) => s.active)?.id || ""
}

export function AcquisitionFields({
  sources, owners, sourceId, ownerId, ownerName, onSourceChange, onOwnerChange,
}: {
  sources: Source[]
  owners: Owner[]
  sourceId: string
  ownerId: string
  /** The owner already on this customer, so history survives the dropdown. */
  ownerName?: string
  onSourceChange: (id: string) => void
  onOwnerChange: (id: string, name: string) => void
}) {
  // Active options, plus whatever this customer already carries — a retired
  // source must not vanish from the record that has it.
  const options = sources.filter((s) => s.active || s.id === sourceId)

  // Same for the owner: if this customer's owner is no longer in the CRM list,
  // keep them, so opening the form does not quietly reassign the customer.
  const ownerOptions = ownerId && !owners.some((o) => o.id === ownerId)
    ? [{ id: ownerId, name: ownerName || ownerId }, ...owners]
    : owners

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Source</Label>
        <select
          value={sourceId}
          onChange={(e) => onSourceChange(e.target.value)}
          className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background"
        >
          {options.map((s) => (
            <option key={s.id} value={s.id}>{s.name}{s.active ? "" : " (inactive)"}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Sales Team Owner</Label>
        <select
          value={ownerId}
          onChange={(e) => {
            const id = e.target.value
            onOwnerChange(id, owners.find((o) => o.id === id)?.name || "")
          }}
          className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background"
        >
          {/* Optional by design: a Direct customer has nobody who won them. */}
          <option value="">Select Sales Team Owner</option>
          {ownerOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
    </div>
  )
}
