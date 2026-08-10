"use client"

// Workspace Settings → Business Branding.
//
// The business identity, owned by the business and independent of any store.
// A tenant uploads once here and every surface that draws the brand reads the
// same record — sidebar, invoices, receipts, labels, the PWAs and the customer
// site — so there is no second place to keep in step.
//
// The page is built as a list of branding assets rather than a fixed form, so
// the ones that are not implemented yet appear as Coming Soon instead of
// needing the screen redesigned when they land.

import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Upload, Trash2, Palette, Save, ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"
import {
  BrandLogo, LOGO_ACCEPT, LOGO_GUIDANCE, LOGO_MAX_BYTES, readImageSize, logoAdvice,
} from "@/components/laundry/brand-logo"

/** Assets the branding page will hold. Unimplemented ones render as Coming Soon. */
const FUTURE_ASSETS = [
  "Favicon", "Dark Logo", "Light Logo", "Invoice Logo", "Secondary Colour",
  "Website Banner", "Login Background", "Email Header", "Invoice Footer", "Watermark",
] as const

interface Branding { businessName: string; logo: string | null; primaryColor: string }

export function LaundryBrandingSettings({ businessId }: { businessId: string }) {
  const { currentBusinessId } = useAuthStore()
  const bizId = businessId || currentBusinessId || ""
  const [data, setData] = useState<Branding>({ businessName: "", logo: null, primaryColor: "#2563eb" })
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
      if (j.success) {
        setData(j.data)
        setBaseline(JSON.stringify(j.data))
      }
    } catch { /* leave the defaults; the form still works */ } finally { setLoading(false) }
  }, [bizId])

  useEffect(() => { load() }, [load])

  const dirty = JSON.stringify(data) !== baseline

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
      setData((d) => ({ ...d, logo: url }))
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

  return (
    <Card className="rounded-xl border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2">
          <Palette className="h-[18px] w-[18px] text-blue-600" /> Business Branding
        </CardTitle>
        <p className="text-[11px] text-slate-500">
          Your business identity, separate from any individual store. Used on the sidebar, invoices, receipts, labels,
          the mobile apps and your customer site.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="py-8 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Business Name</Label>
                <Input value={data.businessName} onChange={(e) => setData((d) => ({ ...d, businessName: e.target.value }))} placeholder="Laundry &amp; Drycleaners" />
                <p className="text-[10px] text-slate-400">The master display name. Store names appear beneath it, never instead of it.</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Primary Colour</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={data.primaryColor} onChange={(e) => setData((d) => ({ ...d, primaryColor: e.target.value }))} className="h-9 w-12 rounded border border-slate-200 bg-white" />
                  <Input value={data.primaryColor} onChange={(e) => setData((d) => ({ ...d, primaryColor: e.target.value }))} className="font-mono text-xs" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-slate-600">Business Logo</Label>
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4 flex flex-col sm:flex-row items-center gap-4">
                {/* Preview in the exact container every surface uses, so what
                    is seen here is what invoices and the sidebar will show. */}
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 grid place-items-center">
                  <BrandLogo src={data.logo} name={data.businessName || "Business"} size="xl" color={data.primaryColor} />
                </div>
                <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left">
                  <p className="text-[11px] text-slate-500">{LOGO_GUIDANCE}</p>
                  <p className="text-[10px] text-slate-400">PNG, SVG, JPG or WEBP · up to 2 MB · minimum 400 × 120 · 1200 × 360 for print</p>
                  {advice && <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">{advice}</p>}
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <input ref={fileRef} type="file" accept={LOGO_ACCEPT} className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) pickLogo(f); e.target.value = "" }} />
                    <Button size="sm" variant="outline" className="gap-1.5" disabled={uploading} onClick={() => fileRef.current?.click()}>
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {data.logo ? "Replace logo" : "Upload logo"}
                    </Button>
                    {data.logo && (
                      <Button size="sm" variant="ghost" className="gap-1.5 text-slate-500" onClick={() => { setData((d) => ({ ...d, logo: null })); setAdvice(null) }}>
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-400">
                Logos are never stretched. A square logo is centred in the landscape space with clear room either side — that is
                correct, not a crop.
              </p>
            </div>

            {/* Named now so the page does not need redesigning when they land. */}
            <div>
              <p className="text-[11px] font-medium text-slate-500 mb-1.5">More branding assets</p>
              <div className="flex flex-wrap gap-1.5">
                {FUTURE_ASSETS.map((f) => (
                  <span key={f} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-400">
                    <ImageIcon className="h-3 w-3" /> {f} · Coming soon
                  </span>
                ))}
              </div>
            </div>

            {dirty && (
              <div className="sticky bottom-0 -mx-6 -mb-6 border-t border-slate-200 bg-white/95 backdrop-blur px-6 py-3 flex items-center gap-3">
                <span className="text-xs font-medium text-amber-700">Unsaved changes</span>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" disabled={saving} onClick={() => setData(JSON.parse(baseline))}>Cancel</Button>
                  <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
                    {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : <><Save className="h-3.5 w-3.5" /> Save Changes</>}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
