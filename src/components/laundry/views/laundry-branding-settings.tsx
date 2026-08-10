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
import { getAuthHeaders } from "@/lib/admin-fetch"
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

  /**
   * Read a response as JSON, but never blindly.
   *
   * `.json()` on an HTML body throws "Unexpected token '<'", which tells a
   * business owner nothing and tells a developer nothing either. When the body
   * is not JSON we capture what it actually was — endpoint, status,
   * content-type, first bytes — log that for diagnosis and surface a plain
   * sentence to the user.
   */
  const readJson = async (res: Response, endpoint: string) => {
    const ct = res.headers.get("content-type") || ""
    if (!ct.includes("application/json")) {
      const preview = (await res.text().catch(() => "")).slice(0, 200)
      console.error("[branding upload] non-JSON response", { endpoint, status: res.status, contentType: ct, preview })
      throw new Error(
        res.status === 401 || res.status === 403
          ? "Your session has expired. Sign in again and retry the upload."
          : `Logo upload failed (${res.status || "network"}). Please try again.`,
      )
    }
    return res.json()
  }

  const load = useCallback(async () => {
    if (!bizId) return
    setLoading(true)
    try {
      const url = `/api/laundry/branding?businessId=${encodeURIComponent(bizId)}`
      const res = await fetch(url, { headers: getAuthHeaders() })
      const j = await readJson(res, url)
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
    if (file.size > LOGO_MAX_BYTES) { toast.error("Logo must be smaller than 2 MB"); return }
    setAdvice(logoAdvice(await readImageSize(file)))

    // Optimistic: show the chosen file at once from a local object URL, so the
    // three previews respond to the click rather than to the round trip. The
    // previous logo is held so a failure restores it instead of dropping to the
    // initials placeholder, which reads as "your logo was deleted".
    const previous = data.logo
    const localUrl = URL.createObjectURL(file)
    set("logo", localUrl)
    setUploading(true)

    const endpoint = "/api/core/upload"
    try {
      const fd = new FormData()
      fd.append("file", file); fd.append("businessId", bizId)
      fd.append("type", "image"); fd.append("category", "branding")

      // Same auth as the branding API — one mechanism, not two. Content-Type
      // is deliberately dropped: multipart needs the boundary the browser
      // generates, and setting it by hand corrupts the body.
      const headers = getAuthHeaders()
      delete (headers as Record<string, string>)["Content-Type"]

      const res = await fetch(endpoint, { method: "POST", body: fd, headers })
      const j = await readJson(res, endpoint)
      const url = j.url || j.data?.url || j.path
      if (!res.ok || !url) throw new Error(j.error || "Upload failed")

      set("logo", url)
    } catch (e) {
      set("logo", previous)   // never silently fall back to the placeholder
      setAdvice(null)
      toast.error(e instanceof Error ? e.message : "Logo upload failed. Please try again.")
    } finally {
      URL.revokeObjectURL(localUrl)
      setUploading(false)
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/laundry/branding", {
        method: "PUT", headers: getAuthHeaders(),
        body: JSON.stringify({ businessId: bizId, ...data }),
      })
      const j = await readJson(res, "/api/laundry/branding")
      if (!res.ok || !j.success) throw new Error(j.error || "Could not save")
      setData(j.data); setBaseline(JSON.stringify(j.data))
      toast.success("Branding updated")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save")
    } finally { setSaving(false) }
  }

  const name = data.businessName || "Your Business"

  // A replaced logo often keeps its filename, so the browser and CDN happily
  // serve the old bytes. The version is derived from the URL itself, so it
  // changes exactly when the logo does and is stable across renders — a random
  // parameter each render would defeat caching entirely. Blob URLs (the
  // optimistic preview) are left alone; they are already unique.
  const logoSrc = useMemo(() => {
    if (!data.logo) return null
    if (data.logo.startsWith("blob:")) return data.logo
    let h = 0
    for (let i = 0; i < data.logo.length; i++) h = (h * 31 + data.logo.charCodeAt(i)) | 0
    return `${data.logo}${data.logo.includes("?") ? "&" : "?"}v=${Math.abs(h)}`
  }, [data.logo])

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
        {/* ── Brand identity: logo, name, product — one vertical axis ───── */}
        <Panel title="Brand Identity">
          {/* Fixed 220px stage so the card never changes height as logos come
              and go, and nothing can spill past its edge. The checkerboard
              lets a transparent PNG read as transparent instead of as a white
              block. */}
          <div
            className="rounded-2xl border border-slate-200 bg-[linear-gradient(45deg,#f8fafc_25%,transparent_25%),linear-gradient(-45deg,#f8fafc_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f8fafc_75%),linear-gradient(-45deg,transparent_75%,#f8fafc_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] flex items-center justify-center overflow-hidden"
            style={{ height: 220, padding: 32 }}>
            {data.logo ? (
              // contain + both maxima: a landscape logo takes the width, a
              // square one stays square, and neither is stretched or cropped.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc!} alt={name} className="object-contain" style={{ maxWidth: "100%", maxHeight: 160 }} />
            ) : (
              <BrandLogo src={null} name={name} size="xl" color={data.primaryColor} className="!h-[100px]" />
            )}
          </div>

          {/* Logo first, business second, product third — the hierarchy a
              white-label tenant should see, all on the same axis. */}
          <div className="mt-4 text-center">
            <p className="text-[18px] font-bold leading-tight text-slate-900 truncate">{name}</p>
            <p className="text-[13px] font-medium text-slate-400 mt-0.5">Laundry OS</p>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <input ref={fileRef} type="file" accept={LOGO_ACCEPT} className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pickLogo(f); e.target.value = "" }} />
            <Button size="sm" variant={data.logo ? "outline" : "default"} className="gap-1.5" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : data.logo ? <RefreshCw className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
              {data.logo ? "Replace Logo" : "Upload Logo"}
            </Button>
            {data.logo && (
              <Button size="sm" variant="outline" className="gap-1.5 text-slate-500" onClick={() => { set("logo", null); setAdvice(null) }}>
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Button>
            )}
          </div>

          {advice && <p className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 text-center">{advice}</p>}

          {/* Compact and centred on the same axis, not spread into columns. */}
          <div className="mt-4 border-t border-slate-100 pt-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Recommended</p>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              600 × 180 px · Landscape<br />
              Transparent PNG · 2 MB max
            </p>
            <p className="mt-2 text-[10px] text-slate-400 leading-relaxed">
              Never stretched or cropped. A square logo stays centred with equal space either side.
            </p>
          </div>
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
                  {/* Mirrors the real sidebar header: stacked, centred, with
                      the logo given the same generous share of the column. A
                      preview that flatters the result is worse than none. */}
                  <div className="flex flex-col items-center justify-center gap-1 pb-2 border-b border-slate-100 text-center">
                    {logoSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoSrc} alt={name} className="object-contain" style={{ maxHeight: 44, maxWidth: 128 }} />
                    ) : (
                      <BrandLogo src={null} name={name} size="sm" color={data.primaryColor} />
                    )}
                    <div className="min-w-0 w-full">
                      <p className="text-xs font-semibold text-slate-800 truncate">{name}</p>
                      <p className="text-[10px] font-medium text-slate-400">Laundry OS</p>
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
                    <BrandLogo src={logoSrc} name={name} size="sm" color={data.primaryColor} />
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
