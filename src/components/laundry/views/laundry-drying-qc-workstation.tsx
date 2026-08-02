"use client"

import { Wind, ShieldCheck } from "lucide-react"
import { LaundryWorkstation } from "@/components/laundry/views/laundry-workstation"

// Combined "Drying & Quality Control" workstation.
//
// Drying and QC are a SINGLE business stage in the post-refactor processing
// model: the operator verifies each garment is dry (Drying), then inspects it
// and passes / fails / reworks it (Quality Check), all from one screen. The
// Order-Based Finishing Bag is assigned here too — the moment the LAST garment
// of an order passes QC, one scan binds the whole order and retires every
// garment barcode (see the bag prompt on the Quality Check panel).
//
// Both subworkstations still scan garment barcodes — that is the last permitted
// garment-barcode stage. Ironing / Folding / Packing use the container-only
// finishing workstation (no garment-code scanning after this screen).
export function LaundryDryingQcWorkstation() {
  return (
    <div className="px-4 lg:px-6 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <Wind className="h-5 w-5 text-blue-600" /> Drying &amp; Quality Control
        </h1>
        <p className="text-sm text-slate-500">
          Combined workstation · verify garments are dry, then inspect quality. When the last
          garment of an order passes Quality Check, scan the finishing container once to bind the whole order.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-0 xl:gap-4 items-start">
        <div className="rounded-t-2xl xl:rounded-2xl border border-blue-200 bg-blue-50/40 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 flex items-center gap-2 border-b border-blue-100 bg-blue-50">
            <Wind className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-slate-700">1 · Drying</span>
          </div>
          <LaundryWorkstation stage="DRY" />
        </div>

        <div className="rounded-t2xl xl:rounded-2xl border border-emerald-200 bg-emerald-50/40 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 flex items-center gap-2 border-b border-emerald-100 bg-white">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-semibold text-slate-700">2 · Quality Control</span>
          </div>
          <LaundryWorkstation stage="QC" />
        </div>
      </div>
    </div>
  )
}