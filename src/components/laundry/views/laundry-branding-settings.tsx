"use client"

// Workspace Settings → Business Branding.
//
// A white-label configuration studio rather than a settings form. The logo is
// the subject of the page, and every change is answered immediately by three
// previews showing the surfaces the brand actually lands on — sidebar, invoice
// and app header — so a business owner can see the result instead of saving
// and going to look for it.
//
// Presentation only. The upload path, the branding API, permissions and the
// save behaviour are the ones that already shipped.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Upload, Trash2, RefreshCw, Save, Check, Sparkles, ImageIcon, Info } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"
import {
  BrandLogo, LOGO_ACCEPT, LOGO_MAX_BYTES, readImageSize, logoAdvice,
} from "@/components/laundry/brand-logo"

interface Branding {
  businessName: string
  logo: string | null
  primaryColor: string
  secondaryColor: string
}

/** Where the brand is used. Listed so the owner knows one upload is enough. */
const APPLIES_TO = [
  "Admin Portal", "Customer Website", "Mobile Apps", "Invoices",
  "Receipts", "Printed Labels", "Executive App", "Email Notifications",
]

const FUTURE_ASSETS = [
  "Dark Logo", "Invoice Logo", "Website Banner", "Login Background",
  "Email Header", "Watermark", "Favicon",
]

export function LaundryBrandingSettings({ businessId }: { businessId: string }) {
  const { currentBusinessId } = useAuthStore()
  const bizId = businessId || currentBusinessId || ""

  const [data, setData] = useState<Branding>({ businessName: "", logo: null, primaryColor: "#2563eb", secondaryColor: "#0f172a" })
  const [baseline, setBaseline] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [advice, setAdvice] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!bizId) return
    setLoading(true)
    try {
      const j = await fetch(`/api/laundry/branding?businessId=${encodeURIComponent(bizId)}`).then((r) => r.json())
      if (j.success) { setData(j.data); setBaseline(JSON.stringify(j.data)) }
    } catch { /* keep defaults; the form still works */ } finally { setLoading(false) }
  }, [bizId])

  useEffect(() => { load() }, [load])

  const dirty = JSON.stringify(data) !== baseline
  const set = <K extends keyof Branding>(k: K, v: Branding[K]) => setData((d) => ({ ...d, [k]: v }))

  const completeness = useMemo(() => {
    const checks = [
      { label: "Logo", done: !!data.logo },
      { label: "Business name", done: !!data.businessName.trim() },
      { label: "Primary colour", done: !!data.primaryColor },
      { label: "Secondary colour", done: !!data.secondaryColor },
      { label: "Invoice branding", done: !!data.logo && !!data.businessName.trim() },
      { label: "Website branding", done: !!data.logo && !!data.primaryColor },
    ]
    const pct = Math.round((checks.filter((c) => c.done).length / checks.length) * 100)
    return { checks, pct }
  }, [data])

  const pickLogo = async (file: File) => {
    if (file.size > LOGO_MAX_BYTES) { toast.error("Logo must be 2 MB or smaller"); return }
    setAdvice(logoAdvice(await readImageSize(file)))
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file); fd.append("businessId", bizId)
      fd.append("type", "image"); fd.append("category", "branding")
      const j = await fetch("/api/core/upload", { method: "POST", body: fd }).then((r) => r.json())
      const url = j.url || j.data?.url || j.path
      if (!url) throw new Error(j.error || "Upload failed")
      set("logo", url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
    } finally { setUploading(false) }
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/laundry/branding", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: bizId, ...data }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Could not save")
      setData(j.data); setBaseline(JSON.stringify(j.data))
      toast.success("Branding updated")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save")
    } finally { setSaving(false) }
  }

  const name = data.businessName || "Your Business"

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin inline" />
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-600" /> Business Branding
        </h2>
        <p className="text-sm text-slate-500">
          Your business identity across Admin · Website · Invoices · Labels · Apps. Separate from any individual store.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,35fr)_minmax(0,65fr)] items-start">
        {/* ── Logo: the subject of the page ─────────────────────────────── */}
        <Panel title="Logo">
          <div className="rounded-2xl bg-[linear-gradient(45deg,#f8fafc_25%,transparent_25%),linear-gradient(-45deg,#f8fafc_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f8fafc_75%),linear-gradient(-45deg,transparent_75%,#f8fafc_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] border border-slate-200 p-5 grid place-items-center min-h-[180px]">
            {/* Checkerboard behind, so a transparent PNG reads as transparent
                rather than as a white block. */}
            <BrandLogo src={data.logo} name={name} size="xl" color={data.primaryColor} className="!h-[120px]" />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept={LOGO_ACCEPT} className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pickLogo(f); e.target.value = "" }} />
            <Button size="sm" variant={data.logo ? "outline" : "default"} className="gap-1.5" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : data.logo ? <RefreshCw className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
              {data.logo ? "Replace Logo" : "Upload Logo"}
            </Button>
            {data.logo && (
              <Button size="sm" variant="ghost" className="gap-1.5 text-slate-500" onClick={() => { set("logo", null); setAdvice(null) }}>
                <Trash2 className="h-3.5 w-3.5" /> Remove Logo
              </Button>
            )}
          </div>

          {advice && <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">{advice}</p>}

          <dl className="mt-4 space-y-1.5 text-[11px]">
            <Spec k="Recommended" v="600 × 180 px (landscape)" />
            <Spec k="Format" v="PNG preferred · SVG, JPG, WEBP" />
            <Spec k="Maximum" v="2 MB" />
            <Spec k="Background" v="Transparent recommended" />
          </dl>
          <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">
            Logos are never stretched or cropped. A square logo is centred with equal space either side.
          </p>
        </Panel>

        {/* ── Identity + colours + previews ─────────────────────────────── */}
        <div className="space-y-5">
          <Panel title="Business Identity">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Business Name</span>
              <span className="block text-[11px] text-slate-400 mb-1.5">The official customer-facing name. Store names appear beneath it, never instead of it.</span>
              <Input value={data.businessName} onChange={(e) => set("businessName", e.target.value)} placeholder="Laundry &amp; Drycleaners" className="max-w-md" />
            </label>
          </Panel>

          <Panel title="Brand Colours">
            <div className="grid gap-3 sm:grid-cols-2 max-w-md">
              <Swatch label="Primary" hint="Headings, buttons, invoice accent" value={data.primaryColor} onChange={(v) => set("primaryColor", v)} />
              <Swatch label="Secondary" hint="Supporting accents" value={data.secondaryColor} onChange={(v) => set("secondaryColor", v)} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" className="h-8 px-3 rounded-lg text-white text-xs font-medium" style={{ backgroundColor: data.primaryColor }}>Primary button</button>
              <button type="button" className="h-8 px-3 rounded-lg text-white text-xs font-medium" style={{ backgroundColor: data.secondaryColor }}>Secondary</button>
              <span className="text-xs font-semibold" style={{ color: data.primaryColor }}>Heading colour</span>
            </div>
          </Panel>

          {/* Answering the change immediately is the point — the owner sees the
              result instead of saving and going to look for it. */}
          <Panel title="Live Preview">
            <div className="grid gap-3 md:grid-cols-2">
              <Preview label="Sidebar">
                <div className="rounded-xl border border-slate-200 bg-white p-3 w-full">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <BrandLogo src={data.logo} name={name} size="sm" color={data.primaryColor} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{name}</p>
                      <p className="text-[9px] font-semibold tracking-[0.15em] uppercase" style={{ color: data.primaryColor }}>Laundry OS</p>
                    </div>
                  </div>
                  <div className="pt-2 space-y-1">
                    {["Dashboard", "Orders", "Customers"].map((r, i) => (
                      <div key={r} className="flex items-center gap-2 rounded-md px-2 py-1 text-[11px]"
                        style={i === 0 ? { backgroundColor: `${data.primaryColor}14`, color: data.primaryColor } : { color: "#64748b" }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: i === 0 ? data.primaryColor : "#cbd5e1" }} />{r}
                      </div>
                    ))}
                  </div>
                </div>
              </Preview>

              <Preview label="Invoice">
                <div className="rounded-xl border border-slate-200 bg-white p-3 w-full">
                  <div className="flex items-start gap-2 border-b-2 pb-2" style={{ borderColor: data.primaryColor }}>
                    <BrandLogo src={data.logo} name={name} size="sm" color={data.primaryColor} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate" style={{ color: data.primaryColor }}>{name}</p>
                      <p className="text-[9px] text-slate-500">GSTIN · Phone · Email</p>
                      <p className="text-[9px] text-slate-600 mt-1 pt-1 border-t border-slate-100">
                        <span className="font-semibold">Thanisandra Branch</span> · Bangalore
                      </p>
                    </div>
                    <span className="text-[9px] font-bold shrink-0" style={{ color: data.primaryColor }}>INVOICE</span>
                  </div>
                  <div className="pt-2 space-y-1">
                    {[1, 2].map((i) => <div key={i} className="h-1.5 rounded bg-slate-100" style={{ width: `${90 - i * 20}%` }} />)}
                  </div>
                </div>
              </Preview>
            </div>
          </Panel>

          <div className="grid gap-5 md:grid-cols-2 items-start">
            <Panel title="Brand Completeness">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${completeness.pct}%`, backgroundColor: data.primaryColor }} />
                </div>
                <span className="text-sm font-bold tabular-nums" style={{ color: data.primaryColor }}>{completeness.pct}%</span>
              </div>
              <ul className="space-y-1">
                {completeness.checks.map((c) => (
                  <li key={c.label} className="flex items-center gap-2 text-xs">
                    <span className={`h-4 w-4 rounded-full grid place-items-center shrink-0 ${c.done ? "bg-emerald-100" : "bg-slate-100"}`}>
                      {c.done ? <Check className="h-2.5 w-2.5 text-emerald-600" /> : <span className="h-1 w-1 rounded-full bg-slate-300" />}
                    </span>
                    <span className={c.done ? "text-slate-600" : "text-slate-400"}>{c.label}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Where this is used">
              <p className="text-[11px] text-slate-500 mb-2 flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-px shrink-0 text-slate-400" /> Upload once — every surface picks it up.
              </p>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
                {APPLIES_TO.map((s) => (
                  <li key={s} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <Check className="h-3 w-3 text-emerald-500 shrink-0" />{s}
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          {/* Named, not rendered as a wall of dead controls. */}
          <Panel title="Future Branding Assets" subtitle="Coming soon">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <ImageIcon className="h-3.5 w-3.5 inline mr-1 -mt-px text-slate-400" />
              {FUTURE_ASSETS.join(" · ")}
            </p>
          </Panel>
        </div>
      </div>

      {dirty && (
        <div className="sticky bottom-0 z-10 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur shadow-lg px-4 py-3 flex items-center gap-3">
          <span className="text-xs font-medium text-amber-700 flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" /> Unsaved changes
          </span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" disabled={saving} onClick={() => { setData(JSON.parse(baseline)); setAdvice(null) }}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : <><Save className="h-3.5 w-3.5" /> Save Changes</>}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && <span className="text-[10px] uppercase tracking-wide text-slate-400">{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-400">{k}</dt>
      <dd className="text-slate-600 text-right">{v}</dd>
    </div>
  )
}

function Swatch({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <span className="block text-[10px] text-slate-400 mb-1">{hint}</span>
      <span className="flex items-center gap-2 rounded-xl border border-slate-200 p-1.5">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} colour`}
          className="h-8 w-9 rounded-lg border-0 bg-transparent p-0 cursor-pointer" />
        <input value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} colour hex`}
          className="w-full bg-transparent font-mono text-xs uppercase text-slate-600 outline-none" />
      </span>
    </label>
  )
}

function Preview({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1.5">{label}</p>
      <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 flex">{children}</div>
    </div>
  )
}
