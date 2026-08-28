"use client"

// The bag checklist an operator works through — delivery hand-over (executive at
// a door, or the counter in Ready for Delivery), and the return of the bags a
// customer is holding at the next pickup.
//
// ONE component for all three because the shape is identical: a list of bags, a
// scan, and an N-of-M count. The DIFFERENCE is entirely the endpoint, and every
// rule lives behind it — this file validates nothing.
//
// Progress is never computed here (§I). Each action POSTs and the server's own
// view replaces local state, so a failed scan leaves the bag unaccounted and the
// count untouched. The same is true of an exception: the client asks for one to
// be RECORDED and is told what the server actually stored. It cannot mark a bag
// done, and it cannot skip the gate.
import { useCallback, useEffect, useState } from "react"
import { Loader2, Package, Check, AlertTriangle, ScanLine } from "lucide-react"
import { toast } from "sonner"
import { BagScanButton } from "@/components/laundry/bag-scanner"

export type ChecklistKind = "delivery" | "return"

/** Mirrors EXCEPTION_REASONS in laundry-delivery-bags.ts — the server re-validates. */
const REASONS: { code: string; label: string }[] = [
  { code: "QR_UNREADABLE", label: "QR damaged / unreadable" },
  { code: "BAG_UNAVAILABLE", label: "Bag not available" },
  { code: "OTHER", label: "Other" },
]
const NEEDS_NOTE = "OTHER"

interface ChecklistBag {
  bagId: string
  bagNumber: string
  index: number
  confirmed?: boolean
  returned?: boolean
  accounted?: boolean
  exception?: { code: string; label: string; note: string | null } | null
}

interface ChecklistView {
  bags: ChecklistBag[]
  total: number
  confirmed?: number
  returned?: number
  exceptions?: number
  /** Delivery only — every bag accounted for. Returns have no completion concept. */
  complete?: boolean
  /** Return only — informational. */
  allReturned?: boolean
  /** Delivery only — "2 of 3 bags scanned · 1 exception". */
  summary?: string
  message: string | null
}

const COPY = {
  delivery: { title: "Delivery Bags", verb: "scanned", scan: "Scan Bag", empty: "No bags recorded for this order." },
  return: { title: "Customer Bags", verb: "returned", scan: "Scan Returned Bag", empty: "This customer is not holding any bags." },
} as const

// DELIVERY blocks: every bag must be ACCOUNTED FOR — scanned, or explicitly
// recorded as a scan exception — before the hand-over completes.
// RETURN does NOT: a customer may hand back some bags, one, or none, and the
// pickup completes either way. Its progress is information, never a gate.
const isGated = (kind: ChecklistKind) => kind === "delivery"

const doneCount = (v: ChecklistView) => (v.confirmed ?? v.returned ?? 0)
const isDone = (b: ChecklistBag) => !!(b.confirmed || b.returned)
const isAccounted = (b: ChecklistBag) => isDone(b) || !!b.exception

/**
 * @param endpoint   the bag route for this context. GET lists, POST records.
 * @param onProgress lets the host screen enable/disable its own completion
 *                   action. The SERVER gate is still authoritative — this only
 *                   stops the operator being sent to a customer to be refused.
 */
export function BagChecklist({
  endpoint, kind, token, body, onProgress,
}: {
  endpoint: string
  kind: ChecklistKind
  token?: string | null
  /** Extra fields every POST carries — the admin routes need businessId/actor. */
  body?: Record<string, unknown>
  onProgress?: (complete: boolean) => void
}) {
  const [view, setView] = useState<ChecklistView | null>(null)
  const [busy, setBusy] = useState(false)
  const [exceptFor, setExceptFor] = useState<string | null>(null)
  const [reason, setReason] = useState<string>(REASONS[0].code)
  const [note, setNote] = useState("")
  const copy = COPY[kind]
  const extra = JSON.stringify(body ?? {})

  const headers = useCallback(
    (json = false) => ({
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token],
  )

  const load = useCallback(async () => {
    try {
      const j = await fetch(endpoint, { headers: headers() }).then((r) => r.json())
      if (j?.success) { setView(j.data); onProgress?.(!!j.data.complete) }
    } catch { /* the host screen still works; the list just cannot load */ }
    // onProgress is a render-stable callback in practice; excluded so a parent
    // re-render cannot re-trigger the fetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, headers])

  useEffect(() => { void load() }, [load])

  const post = async (payload: Record<string, unknown>, ok: (d: ChecklistView & Record<string, unknown>) => string) => {
    setBusy(true)
    try {
      const res = await fetch(endpoint, {
        method: "POST", headers: headers(true),
        body: JSON.stringify({ ...JSON.parse(extra), ...payload }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) {
        // The server's reason, verbatim — never "something went wrong" (§J).
        toast.error(j.error || "Could not record that")
        return false
      }
      // Server view replaces local state — no optimistic progress.
      setView(j.data)
      onProgress?.(!!j.data.complete)
      toast.success(ok(j.data))
      return true
    } catch {
      toast.error("Could not reach the server. Try again.")
      return false
    } finally { setBusy(false) }
  }

  const scan = (code: string) =>
    post({ code }, (d) =>
      d.alreadyConfirmed || d.alreadyReturned
        ? `${d.scanned} is already ${copy.verb}`
        : `${d.scanned} ${copy.verb} — ${doneCount(d)} of ${d.total}`)

  const recordException = async (bagNumber: string) => {
    const ok = await post(
      { action: "exception", code: bagNumber, reason, note: note.trim() || undefined },
      (d) => `Scan exception recorded for ${d.scanned}`,
    )
    if (ok) { setExceptFor(null); setNote(""); setReason(REASONS[0].code) }
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
  const allAccounted = view.bags.every(isAccounted)
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <Package className="h-4 w-4 text-blue-600" /> {copy.title}
        </p>
        {/* "2 of 3 bags scanned · 1 exception" — the server's own words. */}
        <span className={`text-xs font-bold ${allAccounted ? "text-emerald-700" : isGated(kind) ? "text-amber-700" : "text-slate-500"}`}>
          {view.summary ?? `${done} / ${view.total} ${copy.verb}`}{allAccounted && isGated(kind) ? " ✓" : ""}
        </span>
      </div>

      <div className="space-y-1.5">
        {view.bags.map((b) => (
          <div key={b.bagId} className={`rounded-lg border px-2.5 py-2 ${isDone(b) ? "border-emerald-200 bg-emerald-50/60" : b.exception ? "border-amber-200 bg-amber-50/60" : "border-slate-100 bg-slate-50/60"}`}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">Bag {b.index} of {view.total}</p>
                <p className="font-mono text-sm font-semibold text-slate-800">{b.bagNumber}</p>
              </div>
              {isDone(b) ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" /> {copy.verb}</span>
              ) : b.exception ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 text-right"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Scan Exception</span>
              ) : (
                <span className="text-[11px] text-slate-400">{kind === "return" ? "Still with customer" : "Waiting for scan…"}</span>
              )}
            </div>

            {/* The recorded reason stays visible — the exception is a fact about
                this delivery, not a dismissed dialog. */}
            {b.exception && (
              <p className="mt-1 text-[11px] text-amber-800">
                {b.exception.label}{b.exception.note ? ` — ${b.exception.note}` : ""}
              </p>
            )}

            {/* Only a delivery bag that is neither scanned nor already excepted
                can be excepted. Return bags have nothing to except: an unreturned
                bag simply stays with the customer. */}
            {isGated(kind) && !isAccounted(b) && (
              exceptFor === b.bagNumber ? (
                <div className="mt-2 space-y-2 rounded-lg border border-amber-200 bg-white p-2">
                  <p className="text-[11px] font-semibold text-slate-700">Why can this bag not be scanned?</p>
                  {REASONS.map((r) => (
                    <label key={r.code} className="flex items-center gap-2 text-[11px] text-slate-700">
                      <input type="radio" name={`reason-${b.bagId}`} value={r.code} checked={reason === r.code} onChange={() => setReason(r.code)} />
                      {r.label}
                    </label>
                  ))}
                  {reason === NEEDS_NOTE && (
                    <input
                      value={note} onChange={(e) => setNote(e.target.value)} maxLength={300}
                      placeholder="Required — what happened?"
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                    />
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button" disabled={busy || (reason === NEEDS_NOTE && !note.trim())}
                      onClick={() => recordException(b.bagNumber)}
                      className="flex-1 h-8 rounded-lg bg-amber-600 text-white text-[11px] font-semibold disabled:opacity-50"
                    >Record Exception</button>
                    <button type="button" onClick={() => setExceptFor(null)} className="h-8 px-3 rounded-lg border border-slate-200 text-[11px] text-slate-600">Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  type="button" disabled={busy} onClick={() => { setExceptFor(b.bagNumber); setNote(""); setReason(REASONS[0].code) }}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 underline underline-offset-2 disabled:opacity-50"
                ><ScanLine className="h-3 w-3" /> Can&apos;t scan this bag?</button>
              )
            )}
          </div>
        ))}
      </div>

      {view.message && (
        isGated(kind) && !view.complete ? (
          // Delivery: an unaccounted bag genuinely stops the hand-over.
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
