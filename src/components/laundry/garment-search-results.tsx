"use client"

// Workstation search results — where the garment actually is.
//
// A global search means a hit may belong to another department. The card says so
// plainly and offers no action there: the operator learns where the cloth is and
// goes to that station. Only a garment at THIS stage, in progress, offers Return
// to Queue, and the server re-checks the permission regardless.

import { Loader2, Search, MapPin, Undo2 } from "lucide-react"
import type { GarmentHit } from "@/hooks/use-garment-search"

const STATUS_STYLE: Record<string, string> = {
  WAITING:     "border-amber-300 text-amber-700 bg-amber-50",
  IN_PROGRESS: "border-blue-300 text-blue-700 bg-blue-50",
  PAUSED:      "border-orange-300 text-orange-700 bg-orange-50",
  DONE:        "border-emerald-300 text-emerald-700 bg-emerald-50",
}

export function GarmentSearchResults({
  query, results, loading, error, truncated, stages, canReturn, busy, onReturn, onLocate,
}: {
  query: string
  results: GarmentHit[]
  loading: boolean
  error: string | null
  truncated: boolean
  /** The stages THIS workstation owns — Dry & Quality Check owns two. A hit
   *  outside them is read-only here and says where it actually is. */
  stages: string[]
  canReturn: boolean
  busy: boolean
  onReturn: (hit: GarmentHit) => void
  /**
   * Optional: take the operator TO the garment on this screen. Only offered for
   * a hit that belongs to a stage this workstation owns — a garment elsewhere
   * has nothing here to jump to.
   */
  onLocate?: (hit: GarmentHit) => void
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
        <Search className="h-4 w-4 text-slate-400" />
        <p className="text-[13px] font-semibold text-slate-700">
          Search results for <span className="font-mono">{query}</span>
        </p>
        {/* Inline only — the queue below stays on screen while this runs. */}
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
        {!loading && <span className="text-[11px] text-slate-400">{results.length} found{truncated ? "+" : ""}</span>}
      </div>

      {error ? (
        <p className="px-4 py-6 text-sm text-rose-600">{error}</p>
      ) : results.length === 0 && !loading ? (
        <p className="px-4 py-6 text-sm text-slate-400">
          No garment matches <span className="font-mono">{query}</span> anywhere in this business.
        </p>
      ) : (
        <div className="divide-y divide-slate-100 max-h-[55vh] overflow-y-auto">
          {results.map((r) => {
            const here = !!r.processingStage && stages.includes(r.processingStage)
            const returnable = here && r.processingStatus === "IN_PROGRESS" && canReturn
            return (
              <div key={r.id} className="px-4 py-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-slate-800">{r.garmentName}</p>
                  <p className="font-mono text-[11px] text-slate-500">{r.garmentScanCode || r.itemNumber || r.barcode || "—"}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {r.serviceName || "—"} · <span className="font-mono">{r.orderNumber}</span>
                  </p>
                </div>
                <div className="shrink-0 text-right space-y-1">
                  {/* WHERE IT IS — always shown, whatever station is asking. */}
                  <p className="text-[11px] text-slate-600 flex items-center justify-end gap-1">
                    <MapPin className="h-3 w-3 text-slate-400" />
                    {here ? "This station" : `Currently in ${r.department || r.stageLabel}`}
                  </p>
                  <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${STATUS_STYLE[r.processingStatus || ""] || "border-slate-200 text-slate-500 bg-slate-50"}`}>
                    {(r.processingStatus || "—").replace(/_/g, " ")}
                  </span>
                  {here && onLocate && (
                    <div>
                      <button
                        type="button"
                        onClick={() => onLocate(r)}
                        className="mt-1 inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-indigo-200 text-indigo-700 text-[12px] font-medium"
                      >
                        <MapPin className="h-3.5 w-3.5" /> Locate
                      </button>
                    </div>
                  )}
                  {returnable && (
                    <div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onReturn(r)}
                        className="mt-1 inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-amber-200 text-amber-700 text-[12px] font-medium disabled:opacity-60"
                      >
                        <Undo2 className="h-3.5 w-3.5" /> Return to Queue
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {truncated && <p className="px-4 py-2 text-[11px] text-slate-400 border-t border-slate-100">Showing the first 25 matches — refine the code for an exact hit.</p>}
    </div>
  )
}
