"use client"

// Printer Configuration for the laundry workspace — the Commerce store printer
// tab, in Laundry. Same fields, same names, same idea: pick the paper, pick the
// printer, set a few switches, save.
//
// Deliberately small. No discovery, no device registry, no queues, no drivers —
// that is the Hardware Manager's territory and is not what a small laundry
// needs in order to print a receipt.
//
// Reuses GET/PUT /api/laundry/printer-settings (LaundryOperationalConfig), the
// same persistence the COD and slot settings use. The preview renders the REAL
// receipt component, so what is configured here is what the printer produces.

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Save, Printer } from "lucide-react"
import {
  DEFAULT_PRINTER_SETTINGS, PAPER_SIZES, PRINTER_TYPES, COPY_OPTIONS,
  MIN_WIDTH_MM, MAX_WIDTH_MM, normalizePrinterSettings, isRoll, paperWidthMm,
  type PrinterSettings, type PaperSize, type PrinterType,
} from "@/lib/laundry-printer"
import { LaundryThermalReceipt } from "../invoice/laundry-thermal-receipt"
import { LaundryInvoiceDocument, type InvoiceView } from "../invoice/laundry-invoice-document"

// A representative order, used ONLY to draw the preview. Nothing here is saved,
// sent anywhere, or derived from a real customer.
const SAMPLE: InvoiceView = {
  invoice: { number: "INV-LND-000017", status: "PAID", issuedAt: new Date().toISOString(), notes: null },
  order: { orderNumber: "ORD-000017", pickupAddress: null, createdAt: new Date().toISOString(), pickupDate: null },
  totals: {
    subtotal: 42, gstTotal: 0, pickupCharge: 0, deliveryCharge: 0, expressCharge: 0,
    discount: 0, grandTotal: 42, amountPaid: 42, balanceDue: 0, paymentStatus: "PAID",
  },
  gst: { enabled: false, amount: 0, gstNumber: null },
  items: [
    { id: "1", serviceName: "Wash & Fold", garmentName: "Shirt", pricingType: "PER_KG", quantity: 1, weightKg: 0.6, unitPrice: 35, total: 21 },
    { id: "2", serviceName: "Wash & Fold", garmentName: "Pant", pricingType: "PER_KG", quantity: 1, weightKg: 0.6, unitPrice: 35, total: 21 },
  ],
  payments: [{ id: "p1", method: "CASH", amount: 42, at: new Date().toISOString() }],
  customer: { name: "Mukhtar Khan", phone: "+917350551170", email: null },
  store: null,
  settings: {
    currency: "INR", businessLogo: null, businessName: null, businessAddress: null,
    businessPhone: null, businessEmail: null, businessWebsite: null, primaryColor: null,
    invoiceFooter: null, invoiceTerms: null, declaration: null, authorizedSignatory: null,
    signatureUrl: null, bankDetails: null, upiQr: null, gstNumber: null,
  },
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{children}</label>
}

const selectCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"

function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-700">{label}</p>
        <p className="text-[11px] text-slate-400">{desc}</p>
      </div>
      <button
        type="button" role="switch" aria-checked={checked} aria-label={label}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-slate-200"}`}>
        <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </button>
    </div>
  )
}

export function LaundryPrinterSettingsForm({ businessId }: { businessId: string }) {
  const [s, setS] = useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof PrinterSettings>(k: K, v: PrinterSettings[K]) => setS((p) => ({ ...p, [k]: v }))

  const load = useCallback(() => {
    if (!businessId) return
    setLoading(true)
    fetch(`/api/laundry/printer-settings?businessId=${encodeURIComponent(businessId)}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setS(normalizePrinterSettings(j.data)) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [businessId])
  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/laundry/printer-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, ...s }),
      })
      const j = await res.json()
      if (!res.ok || j.success === false) throw new Error(j.error || "Could not save")
      setS(normalizePrinterSettings(j.data))
      toast.success("Printer settings saved")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">Loading printer settings…</div>

  const roll = isRoll(s)
  const widthMm = paperWidthMm(s)

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        <Printer className="h-4 w-4 text-blue-600" />
        <div className="min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Printer Configuration</h3>
          <p className="text-[11px] text-slate-400">Set up your receipt printer. Used by Order → Print / Save PDF.</p>
        </div>
      </div>

      {/* Config left, live preview right; one column on tablet and below. */}
      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="min-w-0 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Default Paper Size</FieldLabel>
              <select value={s.paperSize} onChange={(e) => set("paperSize", e.target.value as PaperSize)} className={selectCls}>
                {PAPER_SIZES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Printer Type</FieldLabel>
              <select value={s.printerType} onChange={(e) => set("printerType", e.target.value as PrinterType)} className={selectCls}>
                {PRINTER_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            {/* Only when it applies — an always-visible width field would be one
                more thing to misread. */}
            {s.paperSize === "custom" && (
              <div>
                <FieldLabel>Custom Width (mm)</FieldLabel>
                <input
                  type="number" min={MIN_WIDTH_MM} max={MAX_WIDTH_MM} value={s.customWidthMm}
                  onChange={(e) => set("customWidthMm", Number(e.target.value))}
                  className={selectCls} />
                <p className="mt-1 text-[11px] text-slate-400">{MIN_WIDTH_MM}–{MAX_WIDTH_MM} mm. For a roll whose width is not 58 or 80.</p>
              </div>
            )}
            <div>
              <FieldLabel>Number of Copies</FieldLabel>
              <select value={s.copies} onChange={(e) => set("copies", Number(e.target.value))} className={selectCls}>
                {COPY_OPTIONS.map((c) => <option key={c} value={c}>{c} {c === 1 ? "Copy" : "Copies"}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Toggle label="Auto-print on New Order" desc="Print a receipt as soon as an order is created" checked={s.autoPrintOrder} onChange={(v) => set("autoPrintOrder", v)} />
            <Toggle label="Print Receipt on Payment" desc="Print a receipt when payment is confirmed" checked={s.printOnPayment} onChange={(v) => set("printOnPayment", v)} />
            <Toggle label="Include QR Code" desc="Add the payment QR to printed receipts" checked={s.includeQr} onChange={(v) => set("includeQr", v)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Receipt Header Text</FieldLabel>
              <textarea rows={2} value={s.headerText} onChange={(e) => set("headerText", e.target.value)}
                placeholder="Printed above the business name" className={selectCls} />
            </div>
            <div>
              <FieldLabel>Receipt Footer Text</FieldLabel>
              <textarea rows={2} value={s.footerText} onChange={(e) => set("footerText", e.target.value)}
                placeholder="Thank you for your business!" className={selectCls} />
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Printer Settings
            </button>
          </div>
        </div>

        {/* Preview — the real receipt component, at its true physical width, so
            58mm is visibly narrower than 80mm because it actually is. */}
        <div className="min-w-0">
          <FieldLabel>Print Preview {widthMm ? `· ${widthMm}mm` : "· Full page"}</FieldLabel>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-3">
            {roll ? (
              <div className="mx-auto w-fit bg-white p-2 shadow-sm">
                <LaundryThermalReceipt data={SAMPLE} settings={s} />
              </div>
            ) : (
              // Standard/A4 shows the existing invoice template, scaled down to
              // fit the panel — not a second design.
              <div className="mx-auto w-[300px] overflow-hidden bg-white shadow-sm">
                <div className="origin-top-left scale-[0.4]" style={{ width: 750, height: 640 }}>
                  <LaundryInvoiceDocument data={SAMPLE} />
                </div>
              </div>
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Sample data — your real order details are used when printing.</p>
        </div>
      </div>
    </section>
  )
}
