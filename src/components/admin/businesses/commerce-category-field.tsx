"use client"

// Controlled Business Category field for the Business Setup wizard.
//
//  • New business (no id): a plain controlled Select over the supported Commerce
//    category vocabulary — persisted as Business.businessType at creation.
//  • Existing COMMERCE business: current category is shown read-only with a
//    "Change" action that previews the template-resolution consequence and, on
//    confirmation, applies it via the platform-only category endpoint. An
//    explicit template assignment incompatible with the new category is never
//    left invalid — it is removed only after explicit confirmation.
//  • Existing non-COMMERCE business: category is shown read-only (preserved).
import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2, ArrowRight, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { COMMERCE_BUSINESS_CATEGORIES, commerceCategoryLabel } from "@/lib/commerce/commerce-categories"
import { getProductCategories } from "@/lib/products/product-categories"

interface Consequence {
  current: { category: string; label: string }
  proposed: {
    category: string; label: string
    newCategoryDefault: { code: string; name: string } | null
    explicitAssignment: { id: string; code: string; name: string } | null
    explicitCompatibleWithNew: boolean
    action: "KEEP_ASSIGNMENT" | "REMOVE_INCOMPATIBLE_ASSIGNMENT" | "USE_NEW_DEFAULT"
    requiresConfirmation: boolean
  }
}

export function CommerceCategoryField({
  businessId, productCode, value, onChange, onChanged,
}: {
  businessId: string | null
  productCode?: string | null
  value: string
  onChange: (v: string) => void       // new-business flow
  onChanged?: () => void              // existing-business reload
}) {
  const isCommerce = (productCode || "").toUpperCase() === "COMMERCE"
  const isExisting = !!businessId

  const [preview, setPreview] = useState<Consequence | null>(null)
  const [pendingCategory, setPendingCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Existing non-COMMERCE business: preserve — read-only category.
  if (isExisting && !isCommerce) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{commerceCategoryLabel(value)}</span>
          <Badge variant="outline" className="text-[10px]">{productCode || "—"}</Badge>
        </div>
        <p className="text-[11px] text-muted-foreground">Category is managed by the {productCode} workspace.</p>
      </div>
    )
  }

  // New business: category is unavailable until a Product is chosen, and the
  // vocabulary is scoped to that product (never a Commerce default).
  if (!isExisting) {
    if (!productCode) {
      return <p className="text-[11px] text-muted-foreground italic py-2">Select a Product first to view available business categories.</p>
    }
    const cats = getProductCategories(productCode)
    if (cats.length === 0) {
      return <p className="text-[11px] text-amber-600 py-2">No business categories are defined for {productCode} yet.</p>
    }
    return (
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue placeholder="Select a business category…" /></SelectTrigger>
        <SelectContent>
          {cats.map((c) => (
            <SelectItem key={c.value} value={c.value}>{c.label} <span className="text-muted-foreground text-xs">· {c.description}</span></SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  // Existing COMMERCE business: controlled change with consequence preview.
  const openPreview = async (newCategory: string) => {
    if (newCategory === value) return
    setPendingCategory(newCategory); setLoading(true); setPreview(null)
    try {
      const res = await fetch(`/api/core/commerce/business-category?businessId=${encodeURIComponent(businessId!)}&newCategory=${encodeURIComponent(newCategory)}`, { headers: await getAuthHeaders() })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Preview failed")
      setPreview(j.data)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Preview failed"); setPendingCategory(null) } finally { setLoading(false) }
  }

  const apply = async () => {
    if (!pendingCategory) return
    setSaving(true)
    try {
      const res = await fetch("/api/core/commerce/business-category", {
        method: "POST", headers: { ...(await getAuthHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, businessType: pendingCategory, removeIncompatibleAssignment: preview?.proposed.action === "REMOVE_INCOMPATIBLE_ASSIGNMENT" }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Change failed")
      toast.success(`Category changed to ${commerceCategoryLabel(pendingCategory)}${j.data?.removedIncompatibleAssignment ? " · incompatible assignment removed" : ""}`)
      setPreview(null); setPendingCategory(null)
      onChanged?.()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Change failed") } finally { setSaving(false) }
  }

  return (
    <div className="space-y-2">
      <Select value={value || undefined} onValueChange={openPreview} disabled={loading}>
        <SelectTrigger className="h-9"><SelectValue placeholder="Select a business category…" /></SelectTrigger>
        <SelectContent>
          {COMMERCE_BUSINESS_CATEGORIES.map((c) => (
            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[11px] text-muted-foreground">Authoritative Commerce category used by the storefront template resolver.</p>

      <Dialog open={!!pendingCategory} onOpenChange={(o) => { if (!o) { setPendingCategory(null); setPreview(null) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Change business category</DialogTitle></DialogHeader>
          {loading || !preview ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Calculating template consequence…</div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{preview.current.label}</Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge className="bg-indigo-600 text-white">{preview.proposed.label}</Badge>
              </div>
              <div className="rounded-lg border p-3 space-y-1.5">
                <p className="text-xs"><span className="text-muted-foreground">New category default:</span> <b>{preview.proposed.newCategoryDefault?.name || "Neutral Commerce (fallback)"}</b></p>
                {preview.proposed.explicitAssignment && (
                  <p className="text-xs"><span className="text-muted-foreground">Explicit assignment:</span> {preview.proposed.explicitAssignment.name}{" "}
                    {preview.proposed.explicitCompatibleWithNew
                      ? <Badge variant="outline" className="text-[9px] ml-1">kept (compatible)</Badge>
                      : <Badge className="bg-amber-100 text-amber-700 text-[9px] ml-1">will be removed</Badge>}
                  </p>
                )}
              </div>
              {preview.proposed.requiresConfirmation && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[12px] text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>The current template assignment is not compatible with {preview.proposed.label}. Confirming will remove it and fall back to the new category default.</span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setPendingCategory(null); setPreview(null) }} disabled={saving}>Cancel</Button>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1" onClick={apply} disabled={saving || loading || !preview}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {preview?.proposed.requiresConfirmation ? "Remove & change" : "Confirm change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
