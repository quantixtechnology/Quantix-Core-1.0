"use client"

// Business Invoice Template (Branding & Invoice). The single tenant-configured
// identity every invoice inherits — Admin Preview / Print / PDF and the customer
// download all render from these values. Reuses GET/PUT
// /api/laundry/financial-settings (no new API / table / renderer).
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"
import { LaundryImageUpload } from "./pricing/laundry-image-upload"

interface Settings {
  businessLogo: string
  businessName: string
  businessAddress: string
  businessPhone: string
  businessEmail: string
  businessWebsite: string
  primaryColor: string
  gstEnabled: boolean
  gstNumber: string
  invoicePrefix: string
  currency: string
  invoiceTerms: string
  declaration: string
  authorizedSignatory: string
  signatureUrl: string
  invoiceFooter: string
  bankDetails: string
  upiQr: string
}

const EMPTY: Settings = {
  businessLogo: "", businessName: "", businessAddress: "", businessPhone: "", businessEmail: "",
  businessWebsite: "", primaryColor: "#2563eb", gstEnabled: false, gstNumber: "", invoicePrefix: "INV",
  currency: "INR", invoiceTerms: "", declaration: "", authorizedSignatory: "", signatureUrl: "",
  invoiceFooter: "", bankDetails: "", upiQr: "",
}

// Module-level inputs (never define components inside render — that remounts and
// drops input focus on every keystroke).
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{children}</label>
}

/** Compact card. One heading, one hairline, dense body — no oversized chrome. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <h3 className="border-b border-slate-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="p-4">{children}</div>
    </section>
  )
}

function TField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
    </div>
  )
}
function TArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
    </div>
  )
}

export function LaundryFinancialSettingsForm({ businessId }: { businessId: string }) {
  const [s, setS] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => (p ? { ...p, [k]: v } : p))

  const load = useCallback(() => {
    if (!businessId) return
    setLoading(true)
    fetch(`/api/laundry/financial-settings?businessId=${encodeURIComponent(businessId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          const d = j.data
          setS({
            businessLogo: d.businessLogo ?? "", businessName: d.businessName ?? "", businessAddress: d.businessAddress ?? "",
            businessPhone: d.businessPhone ?? "", businessEmail: d.businessEmail ?? "", businessWebsite: d.businessWebsite ?? "",
            primaryColor: d.primaryColor ?? "#2563eb", gstEnabled: !!d.gstEnabled, gstNumber: d.gstNumber ?? "",
            invoicePrefix: d.invoicePrefix ?? "INV", currency: d.currency ?? "INR", invoiceTerms: d.invoiceTerms ?? "",
            declaration: d.declaration ?? "", authorizedSignatory: d.authorizedSignatory ?? "", signatureUrl: d.signatureUrl ?? "",
            invoiceFooter: d.invoiceFooter ?? "", bankDetails: d.bankDetails ?? "", upiQr: d.upiQr ?? "",
          })
        } else setS({ ...EMPTY })
      })
      .catch(() => setS({ ...EMPTY }))
      .finally(() => setLoading(false))
  }, [businessId])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!s) return
    setSaving(true)
    try {
      const payload = {
        businessId,
        businessLogo: s.businessLogo || null, businessName: s.businessName || null, businessAddress: s.businessAddress || null,
        businessPhone: s.businessPhone || null, businessEmail: s.businessEmail || null, businessWebsite: s.businessWebsite || null,
        primaryColor: s.primaryColor || null, gstEnabled: s.gstEnabled, gstNumber: s.gstNumber || null,
        invoicePrefix: s.invoicePrefix || "INV", currency: s.currency || "INR", invoiceTerms: s.invoiceTerms || null,
        declaration: s.declaration || null, authorizedSignatory: s.authorizedSignatory || null, signatureUrl: s.signatureUrl || null,
        invoiceFooter: s.invoiceFooter || null, bankDetails: s.bankDetails || null, upiQr: s.upiQr || null,
      }
      const res = await fetch("/api/laundry/financial-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const j = await res.json()
      if (!res.ok || j.success === false) throw new Error(j.error || "Could not save")
      toast.success("Invoice template saved")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  if (loading || !s) return <div className="rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-400">Loading invoice template…</div>

  return (
    // Two columns on desktop: configuration on the left, the assets that appear
    // at the FOOT of an invoice (signature, bank, UPI) on the right. Collapses
    // to one column on tablet and below. No fixed widths, so no horizontal
    // scrollbar at any viewport.
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">Branding &amp; Invoice</p>
        <p className="mt-0.5 text-xs text-slate-500">Configure once — every invoice (Admin Preview, Print, PDF and customer download) uses these tenant details.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        {/* ── Main column ─────────────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-2">
          <Section title="Business Identity">
            {/* The logo box is capped in px and uses object-contain, so a wide
                logo, a square one and a tall one all sit inside the same tidy
                frame without stretching or driving the page height. */}
            <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-start">
              <div>
                <FieldLabel>Business Logo</FieldLabel>
                <LaundryImageUpload value={s.businessLogo || null} businessId={businessId} folder="laundry-invoice"
                  onChange={(url) => set("businessLogo", url || "")}
                  objectFit="contain" compact frameClass="w-[240px] max-w-full" previewClass="w-full h-[110px]" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TField label="Business Name" value={s.businessName} onChange={(v) => set("businessName", v)} placeholder="Sparkle Laundry" />
                <TField label="Phone" value={s.businessPhone} onChange={(v) => set("businessPhone", v)} placeholder="+91 98xxxxxxx" />
                <TField label="Email" value={s.businessEmail} onChange={(v) => set("businessEmail", v)} placeholder="hello@business.in" />
                <TField label="Website" value={s.businessWebsite} onChange={(v) => set("businessWebsite", v)} placeholder="www.business.in" />
                <div className="sm:col-span-2"><TArea label="Address" value={s.businessAddress} onChange={(v) => set("businessAddress", v)} placeholder="Shop no, street, city, PIN" /></div>
              </div>
            </div>
          </Section>

          <Section title="Invoice Settings">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <FieldLabel>Primary Colour</FieldLabel>
                <div className="flex items-center gap-2">
                  <input type="color" value={s.primaryColor || "#2563eb"} onChange={(e) => set("primaryColor", e.target.value)} className="h-9 w-10 shrink-0 rounded border border-slate-200" />
                  <input value={s.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} className="w-full min-w-0 rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
              </div>
              <TField label="Currency" value={s.currency} onChange={(v) => set("currency", v)} placeholder="INR" />
              <TField label="Invoice Prefix" value={s.invoicePrefix} onChange={(v) => set("invoicePrefix", v)} placeholder="INV" />
              <div className="space-y-1">
                <FieldLabel>Enable GST</FieldLabel>
                <div className="flex gap-2">
                  {[{ v: true, l: "ON" }, { v: false, l: "OFF" }].map((o) => (
                    <button key={o.l} onClick={() => set("gstEnabled", o.v)} className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold ${s.gstEnabled === o.v ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{o.l}</button>
                  ))}
                </div>
              </div>
              {s.gstEnabled && <div className="sm:col-span-2"><TField label="GST Number" value={s.gstNumber} onChange={(v) => set("gstNumber", v)} placeholder="29ABCDE1234F1Z5" /></div>}
            </div>
          </Section>

          <Section title="Invoice Content">
            <div className="grid gap-3 sm:grid-cols-2">
              <TArea label="Terms & Conditions" value={s.invoiceTerms} onChange={(v) => set("invoiceTerms", v)} placeholder="Goods once serviced are non-returnable…" />
              <TArea label="Declaration" value={s.declaration} onChange={(v) => set("declaration", v)} placeholder="We declare that this invoice shows the actual price…" />
              <div className="sm:col-span-2"><TArea label="Footer Notes" value={s.invoiceFooter} onChange={(v) => set("invoiceFooter", v)} placeholder="Thank you for your business!" /></div>
              <div className="sm:col-span-2"><TField label="Authorized Signatory (name)" value={s.authorizedSignatory} onChange={(v) => set("authorizedSignatory", v)} placeholder="For Sparkle Laundry" /></div>
            </div>
          </Section>
        </div>

        {/* ── Side column: what prints at the foot of the invoice ──────── */}
        <div className="space-y-4">
          <Section title="Signature">
            <LaundryImageUpload value={s.signatureUrl || null} businessId={businessId} folder="laundry-invoice"
              onChange={(url) => set("signatureUrl", url || "")}
              objectFit="contain" compact frameClass="w-[200px] max-w-full" previewClass="w-full h-[70px]" />
            <p className="mt-1.5 text-[11px] text-slate-400">Optional. Prints above the signatory name.</p>
          </Section>

          <Section title="Payment Details">
            <TArea label="Bank Details" value={s.bankDetails} onChange={(v) => set("bankDetails", v)} placeholder="A/c Name · A/c No · IFSC · Bank" />
            <div className="mt-3">
              <FieldLabel>UPI QR</FieldLabel>
              <LaundryImageUpload value={s.upiQr || null} businessId={businessId} folder="laundry-invoice"
                onChange={(url) => set("upiQr", url || "")}
                objectFit="contain" compact frameClass="w-[150px] max-w-full" previewClass="w-full h-[150px]" />
            </div>
          </Section>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Invoice Template
        </button>
      </div>
    </div>
  )
}
