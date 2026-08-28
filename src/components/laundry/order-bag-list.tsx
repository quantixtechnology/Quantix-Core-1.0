"use client"

// The bags of one order — shown wherever a stage must account for all of them.
//
// ONE ORDER → ONE OR MORE BAGS. The list is the order's own bag assignments
// (GET /api/laundry/orders/[id]/bags), which is the same relation Sorting wrote
// and Processing, Delivery and the next Pickup read. No stage keeps its own
// count, so they cannot drift.
//
// "+ Add Another Bag" scans a bag onto the SAME order through the existing
// assignment path — it never generates a bag number here, never creates a second
// bag record, and never replaces the bags already on the order.
import type { ServiceBagAccounting } from "@/lib/laundry-service-bags"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Package, Check, Printer } from "lucide-react"
import { toast } from "sonner"
import { BagScanButton } from "@/components/laundry/bag-scanner"
import { printBagLabels } from "@/lib/laundry-label"
import { getAuthHeaders } from "@/lib/admin-fetch"

export interface OrderBagRow {
  assignmentId: string
  bagId: string
  bagNumber: string
  qrValue: string
  status: string
  custodian: string
  open: boolean
  index: number
}

export function useOrderBags(orderId: string | null, businessId: string | null) {
  const [bags, setBags] = useState<OrderBagRow[]>([])
  // Service-level accounting comes from the SAME response as the bag list, so a
  // stage can never show a total that disagrees with the per-service breakdown.
  const [accounting, setAccounting] = useState<ServiceBagAccounting | null>(null)
  const loadBags = useCallback(async () => {
    if (!orderId || !businessId) { setBags([]); return }
    try {
      const j = await fetch(
        `/api/laundry/orders/${orderId}/bags?businessId=${encodeURIComponent(businessId)}`,
        { headers: getAuthHeaders() },
      ).then((r) => r.json())
      if (j?.success) { setBags(j.data.bags as OrderBagRow[]); setAccounting((j.data.accounting as ServiceBagAccounting) ?? null) }
    } catch { /* the stage still works — it just cannot list the bags */ }
  }, [orderId, businessId])
  useEffect(() => { void loadBags() }, [loadBags])
  return { bags, accounting, loadBags }
}

export function OrderBagList({
  orderId, businessId, bags, onChanged, disabled,
}: {
  orderId: string
  businessId: string
  bags: OrderBagRow[]
  onChanged: () => void
  disabled?: boolean
}) {
  const [adding, setAdding] = useState(false)

  const addBag = async (code: string) => {
    setAdding(true)
    try {
      const res = await fetch(`/api/laundry/orders/${orderId}/bags`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ businessId, code }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) { toast.error(j.error || "Could not add that bag"); return }
      toast.success(
        j.data.alreadyOnOrder
          ? `${j.data.bag.bagNumber} is already on this order`
          : `${j.data.bag.bagNumber} added — this order now has ${j.data.total} bag(s)`,
      )
      onChanged()
    } catch {
      toast.error("Could not add that bag")
    } finally { setAdding(false) }
  }

  // One label per bag, numbered "Bag N of M" so the operator can tell them apart.
  const printAll = async () => {
    if (!bags.length) return
    await printBagLabels(bags.map((b) => ({ bagNumber: b.bagNumber, qrValue: b.qrValue })))
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <Package className="h-4 w-4 text-blue-600" /> Bags
          <span className="text-slate-400 font-normal">{bags.length}</span>
        </p>
        {bags.length > 0 && (
          <Button size="sm" variant="ghost" onClick={printAll} className="h-7 gap-1 text-[11px] text-slate-500">
            <Printer className="h-3.5 w-3.5" /> Generate All Bag Labels
          </Button>
        )}
      </div>

      {bags.length === 0 ? (
        <p className="text-xs text-slate-400">No bag assigned yet — scan one below.</p>
      ) : (
        <div className="space-y-1.5">
          {bags.map((b) => (
            <div key={b.assignmentId} className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50/60 px-2.5 py-1.5">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">Bag {b.index} of {bags.length}</p>
                <p className="font-mono text-sm font-semibold text-slate-800">{b.bagNumber}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                <Check className="h-3.5 w-3.5" /> {b.open ? "On this order" : "Closed"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Packing may need more bags than Sorting planned — adding one keeps
          every existing bag exactly as it is. */}
      <BagScanButton
        label={adding ? "Adding…" : "+ Add Another Bag"}
        size="sm"
        onScan={addBag}
        disabled={disabled || adding}
        closeOnScan
        className="w-full h-9 justify-center"
      />
      {adding && <p className="text-[11px] text-slate-400 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Adding bag…</p>}
      <p className="text-[10px] text-slate-400">
        Every bag listed here follows this order through Processing, Delivery and back.
      </p>
    </div>
  )
}


