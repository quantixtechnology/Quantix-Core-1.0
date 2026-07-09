"use client"

// Commerce storefront template selection during business creation. Renders ONLY
// for COMMERCE-product businesses. Resolves the category default from the
// persisted businessType and lets the Super Admin pick another compatible active
// template. Assignment persists via the platform assignment API (server-enforced
// compatibility). Non-Commerce businesses render nothing (no effect on Laundry).

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Store } from "lucide-react"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/admin-fetch"

interface Data {
  business: { name: string; businessType: string; workspaceType: string; isCommerce: boolean }
  resolved: { templateId: string | null; code: string; name: string; source: string }
  compatibleTemplates: { id: string; name: string }[]
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

  return (
    <Card className="p-6 space-y-3">
      <CardHeader className="p-0 pb-1"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><Store className="h-4 w-4" /> Storefront Template</CardTitle></CardHeader>
      <CardContent className="p-0 space-y-3">
        <p className="text-xs text-muted-foreground">Commerce storefront for <b>{data.business.businessType.replace(/_/g, " ")}</b>. The category default is selected automatically; choose another compatible active template to override.</p>
        <div className="flex items-center gap-2">
          <Select value={currentId || undefined} onValueChange={assign} disabled={saving}>
            <SelectTrigger className="h-9 max-w-sm"><SelectValue placeholder={`${data.resolved.name} (${SOURCE_LABEL[data.resolved.source] || data.resolved.source})`} /></SelectTrigger>
            <SelectContent>{data.compatibleTemplates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
          {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Badge variant="outline" className="text-[10px]">{SOURCE_LABEL[data.resolved.source] || data.resolved.source}</Badge>
        </div>
        {data.compatibleTemplates.length === 0 && <p className="text-[11px] text-amber-600">No active compatible templates yet — the storefront uses the neutral Commerce fallback.</p>}
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
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Storefront Template</p>
      <p className="text-sm font-medium">{data.resolved.name} <span className="text-xs font-normal text-muted-foreground">· {SOURCE_LABEL[data.resolved.source] || data.resolved.source}</span></p>
    </div>
  )
}
