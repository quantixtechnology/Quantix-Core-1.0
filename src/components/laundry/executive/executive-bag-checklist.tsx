"use client"

// The bag checklist an executive works through — delivery hand-over, and the
// return of the bags a customer is holding at the next pickup.
//
// One component for both because the shape is identical: a list of bags, a
// scan, and an N-of-M gate. The DIFFERENCE is entirely in the endpoint, and
// every rule lives behind it — this file validates nothing.
//
// Progress is never computed here (§I). Each scan POSTs and the server's own
// view replaces local state, so a failed scan leaves the bag unconfirmed and the
// count untouched.
import { useCallback, useEffect, useState } from "react"
import { Loader2, Package, Check, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { BagScanButton } from "@/components/laundry/bag-scanner"

export type ChecklistKind = "delivery" | "return"

interface ChecklistBag {
  bagId: string
  bagNumber: string
  index: number
  confirmed?: boolean
  returned?: boolean
}

interface ChecklistView {
  bags: ChecklistBag[]
  total: number
  confirmed?: number
  returned?: number
  /** Delivery only — every bag confirmed. Returns have no completion concept. */
  complete?: boolean
  /** Return only — informational. */
  allReturned?: boolean
  message: string | null
}

const COPY = {
  delivery: { title: "Delivery Bags", verb: "confirmed", scan: "Scan Bag", empty: "No bags recorded for this order." },
  return: { title: "Customer Bags", verb: "returned", scan: "Scan Returned Bag", empty: "This customer is not holding any bags." },
} as const

// DELIVERY blocks: every bag must be confirmed before the hand-over completes.
// RETURN does NOT: a customer may hand back some bags, one, or none, and the
// pickup completes either way. Its progress is information, never a gate.
const isGated = (kind: ChecklistKind) => kind === "delivery"

const doneCount = (v: ChecklistView) => (v.confirmed ?? v.returned ?? 0)
const isDone = (b: ChecklistBag) => !!(b.confirmed || b.returned)

/**
 * @param onProgress lets the job screen enable/disable its own completion action.
 *                   The SERVER gate is still authoritative — this only stops the
 *                   executive being sent to a customer's door to be refused.
 */
export function ExecutiveBagChecklist({
  jobId, kind, token, onProgress,
}: {
  jobId: string
  kind: ChecklistKind
  token: string | null
  onProgress?: (complete: boolean) => void
}) {
  const [view, setView] = useState<ChecklistView | null>(null)
  const [busy, setBusy] = useState(false)
  const copy = COPY[kind]
  const path = kind === "delivery" ? "delivery-bags" : "return-bags"

  const headers = useCallback(
    (json = false) => ({
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token],
  )

  const load = useCallback(async () => {
    try {
      const j = await fetch(`/api/laundry/executive/jobs/${jobId}/${path}`, { headers: headers() }).then((r) => r.json())
      if (j?.success) { setView(j.data); onProgress?.(!!j.data.complete) }
    } catch { /* the job screen still works; the list just cannot load */ }
    // onProgress is a render-stable callback in practice; excluded so a parent
    // re-render cannot re-trigger the fetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, path, headers])

  useEffect(() => { void load() }, [load])

  const scan = async (code: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/laundry/executive/jobs/${jobId}/${path}`, {
        method: "POST", headers: headers(true), body: JSON.stringify({ code }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) {
        // The server's reason, verbatim — never "something went wrong" (§J).
        toast.error(j.error || `Could not record ${code}`)
        return
      }
      // Server view replaces local state — no optimistic progress.
      setView(j.data)
      onProgress?.(!!j.data.complete)
      toast.success(
        j.data.alreadyConfirmed || j.data.alreadyReturned
          ? `${j.data.scanned} is already ${copy.verb}`
          : `${j.data.scanned} ${copy.verb} — ${doneCount(j.data)} of ${j.data.total}`,
      )
    } catch {
      toast.error("Could not reach the server. Try the scan again.")
    } finally { setBusy(false) }
  }

  if (!view || view.total === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <Package className="h-4 w-4 text-blue-600" /> {copy.title}
        </p>
        <p className="text-xs text-slate-400 mt-1">{view ? copy.empty : "Loading…"}</p>
      </div>
    )
  }

  const done = doneCount(view)
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <Package className="h-4 w-4 text-blue-600" /> {copy.title}
        </p>
        <span className={`text-xs font-bold ${done === view.total ? "text-emerald-700" : isGated(kind) ? "text-amber-700" : "text-slate-500"}`}>
          {done} / {view.total} {copy.verb}{done === view.total ? " ✓" : ""}
        </span>
      </div>

      <div className="space-y-1.5">
        {view.bags.map((b) => (
          <div key={b.bagId} className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 ${isDone(b) ? "border-emerald-200 bg-emerald-50/60" : "border-slate-100 bg-slate-50/60"}`}>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Bag {b.index} of {view.total}</p>
              <p className="font-mono text-sm font-semibold text-slate-800">{b.bagNumber}</p>
            </div>
            {isDone(b)
              ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" /> {copy.verb}</span>
              : <span className="text-[11px] text-slate-400">{kind === "return" ? "Still with customer" : "Waiting for scan…"}</span>}
          </div>
        ))}
      </div>

      {view.message && (
        isGated(kind) && !view.complete ? (
          // Delivery: an outstanding bag genuinely stops the hand-over.
          <p className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" /> {view.message}
          </p>
        ) : (
          // Return: states the position. It never says "cannot continue".
          <p className="text-[11px] text-slate-500">{view.message}</p>
        )
      )}

      <BagScanButton
        label={busy ? "Recording…" : copy.scan}
        onScan={scan}
        disabled={busy || done === view.total}
        closeOnScan
        className="w-full h-11 justify-center"
      />
      {busy && <p className="text-[11px] text-slate-400 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Recording…</p>}
    </div>
  )
}
