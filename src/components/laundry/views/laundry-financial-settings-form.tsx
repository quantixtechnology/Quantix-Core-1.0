"use client"

// Business Financial / Invoice settings — the simple controls the invoice engine
// reads. Reuses GET/PUT /api/laundry/financial-settings (no new API). Kept
// deliberately minimal: GST ON/OFF + GST Number, Invoice Prefix, Terms.
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"

interface Settings {
  gstEnabled: boolean
  gstNumber: string | null
  invoicePrefix: string
  invoiceTerms: string | null
}

export function LaundryFinancialSettingsForm({ businessId }: { businessId: string }) {
  const [s, setS] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    if (!businessId) return
    setLoading(true)
    fetch(`/api/laundry/financial-settings?businessId=${encodeURIComponent(businessId)}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setS({ gstEnabled: !!j.data.gstEnabled, gstNumber: j.data.gstNumber ?? "", invoicePrefix: j.data.invoicePrefix ?? "INV", invoiceTerms: j.data.invoiceTerms ?? "" }) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [businessId])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!s) return
    setSaving(true)
    try {
      const res = await fetch("/api/laundry/financial-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, gstEnabled: s.gstEnabled, gstNumber: s.gstNumber || null, invoicePrefix: s.invoicePrefix || "INV", invoiceTerms: s.invoiceTerms || null }),
      })
      const j = await res.json()
      if (!res.ok || j.success === false) throw new Error(j.error || "Could not save")
      toast.success("Invoice settings saved")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  if (loading || !s) return <div className="rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-400">Loading invoice settings…</div>

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5">
      <p className="text-sm font-semibold text-slate-900">Invoice &amp; GST</p>
      <p className="mt-0.5 text-xs text-slate-500">Controls the invoice number prefix and whether GST is shown on invoices.</p>

      <div className="mt-4 space-y-4">
        {/* GST enable */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Enable GST</p>
          <div className="mt-1.5 flex gap-2">
            {[{ v: true, l: "ON" }, { v: false, l: "OFF" }].map((o) => (
              <button
                key={o.l}
                onClick={() => setS({ ...s, gstEnabled: o.v })}
                className={`rounded-lg border px-4 py-1.5 text-xs font-semibold ${s.gstEnabled === o.v ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              >{o.l}</button>
            ))}
          </div>
        </div>

        {/* GST number — only when enabled */}
        {s.gstEnabled && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">GST Number</label>
            <input
              value={s.gstNumber ?? ""}
              onChange={(e) => setS({ ...s, gstNumber: e.target.value })}
              placeholder="e.g. 29ABCDE1234F1Z5"
              className="mt-1 w-full max-w-sm rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
        )}

        {/* Invoice prefix */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Invoice Prefix</label>
          <input
            value={s.invoicePrefix}
            onChange={(e) => setS({ ...s, invoicePrefix: e.target.value })}
            placeholder="INV"
            className="mt-1 w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <p className="mt-1 text-[11px] text-slate-400">Numbers are sequential, e.g. {s.invoicePrefix || "INV"}-000001.</p>
        </div>

        {/* Terms */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Terms &amp; Conditions</label>
          <textarea
            value={s.invoiceTerms ?? ""}
            onChange={(e) => setS({ ...s, invoiceTerms: e.target.value })}
            rows={3}
            placeholder="Shown at the bottom of the invoice (optional)."
            className="mt-1 w-full max-w-lg rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>

        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Invoice Settings
        </button>
      </div>
    </div>
  )
}
