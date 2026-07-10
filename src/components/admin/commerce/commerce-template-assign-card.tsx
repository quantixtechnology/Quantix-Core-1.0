"use client"

// Commerce storefront template selection during business creation. Renders ONLY
// for COMMERCE-product businesses. Resolves the category default from the
// persisted businessType and lets the Super Admin pick another compatible active
// template. Assignment persists via the platform assignment API (server-enforced
// compatibility). Non-Commerce businesses render nothing (no effect on Laundry).

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Store } from "lucide-react"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/admin-fetch"

interface CompatibleTemplate {
  id: string; code: string; name: string; description: string | null; thumbnailUrl: string | null
  publishedVersion: number | null; pageCount: number; compatibleCategories: string[]; isCategoryDefault: boolean
}
interface Data {
  business: { name: string; businessType: string; workspaceType: string; isCommerce: boolean }
  resolved: { templateId: string | null; code: string; name: string; source: string }
  compatibleTemplates: CompatibleTemplate[]
  explicitAssignments: { storeId: string | null; template: { id: string } | null }[]
}

const SOURCE_LABEL: Record<string, string> = {
  STORE_OVERRIDE: "Store Override", BUSINESS_ASSIGNMENT: "Manually Selected",
  CATEGORY_DEFAULT: "Category Default", NEUTRAL_FALLBACK: "Neutral Fallback",
}

export function CommerceTemplateAssignCard({ businessId, productCode }: { businessId: string; productCode?: string | null }) {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/core/commerce/assignments?businessId=${encodeURIComponent(businessId)}`, { headers: await getAuthHeaders() })
      const j = await res.json()
      setData(j.success ? j.data : null)
    } catch { setData(null) } finally { setLoading(false) }
  }, [businessId])
  useEffect(() => { load() }, [load])

  // Only for COMMERCE businesses.
  if ((productCode || "").toUpperCase() !== "COMMERCE") return null
  if (loading) return <Card className="p-6"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Resolving storefront template…</div></Card>
  if (!data || !data.business.isCommerce) return null

  const currentId = data.explicitAssignments.find((a) => a.storeId === null)?.template?.id || (data.resolved.source === "BUSINESS_ASSIGNMENT" ? data.resolved.templateId : "")

  const assign = async (templateId: string) => {
    setSaving(true)
    try {
      const res = await fetch("/api/core/commerce/assignments", { method: "POST", headers: { ...(await getAuthHeaders()), "Content-Type": "application/json" }, body: JSON.stringify({ businessId, templateId }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Assignment failed")
      toast.success("Storefront template assigned")
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Assignment failed") } finally { setSaving(false) }
  }

  // Selected = explicit business assignment if present, else the resolved template.
  const selectedId = currentId || data.resolved.templateId

  return (
    <Card className="p-6 space-y-3">
      <CardHeader className="p-0 pb-1"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><Store className="h-4 w-4" /> Storefront Template</CardTitle></CardHeader>
      <CardContent className="p-0 space-y-3">
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          <span>Commerce storefront for <b>{data.business.businessType.replace(/_/g, " ")}</b>.</span>
          <span>Resolved:</span> <b className="text-foreground">{data.resolved.name}</b>
          <Badge variant="outline" className="text-[10px]">{SOURCE_LABEL[data.resolved.source] || data.resolved.source}</Badge>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        </div>

        {data.compatibleTemplates.length === 0 ? (
          <p className="text-[11px] text-amber-600">No ACTIVE compatible templates yet — the storefront uses the neutral Commerce fallback.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {data.compatibleTemplates.map((t) => {
              const selected = t.id === selectedId
              return (
                <button
                  key={t.id} type="button" onClick={() => !selected && assign(t.id)} disabled={saving}
                  className={`text-left rounded-xl border p-3 transition-colors ${selected ? "border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
                >
                  <div className="aspect-[16/9] w-full rounded-lg overflow-hidden mb-2 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                    {t.thumbnailUrl
                      ? <img src={t.thumbnailUrl} alt={t.name} className="w-full h-full object-cover" />
                      : <Store className="h-6 w-6 text-slate-300" />}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold">{t.name}</span>
                    {t.isCategoryDefault && <Badge className="bg-emerald-100 text-emerald-700 text-[9px]">Category Default</Badge>}
                    {selected && <Badge className="bg-indigo-600 text-white text-[9px]">Selected</Badge>}
                  </div>
                  {t.description && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>}
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                    <span>{t.pageCount} page{t.pageCount === 1 ? "" : "s"}</span>
                    <span>·</span><span>v{t.publishedVersion ?? 0}</span>
                    <span>·</span><span>{t.compatibleCategories.map((c) => c.replace(/_/g, " ")).join(", ")}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Read-only resolved template + source for the Review Configuration step.
// Renders nothing for non-Commerce businesses (matches wizard Field styling).
export function CommerceTemplateReviewField({ businessId, productCode }: { businessId: string; productCode?: string | null }) {
  const [data, setData] = useState<Data | null>(null)
  useEffect(() => {
    if ((productCode || "").toUpperCase() !== "COMMERCE") return
    let live = true
    ;(async () => {
      try {
        const res = await fetch(`/api/core/commerce/assignments?businessId=${encodeURIComponent(businessId)}`, { headers: await getAuthHeaders() })
        const j = await res.json()
        if (live) setData(j.success ? j.data : null)
      } catch { if (live) setData(null) }
    })()
    return () => { live = false }
  }, [businessId, productCode])
  if ((productCode || "").toUpperCase() !== "COMMERCE" || !data?.business.isCommerce) return null
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Website Template</p>
      <p className="text-sm font-medium">{data.resolved.name} <span className="text-xs font-normal text-muted-foreground">· {SOURCE_LABEL[data.resolved.source] || data.resolved.source}</span></p>
    </div>
  )
}
