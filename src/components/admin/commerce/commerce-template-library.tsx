"use client"

// Quantix Core → Storefront Templates (Commerce Template Library) — Phase 1
// foundation. Read-only Library shell grouped by Commerce business category,
// with status/default badges and a resolver-diagnostic panel. Master template
// CRUD + category mapping + assignment arrive in Phase 2; the visual page
// builder in Phase 4. This view establishes the platform navigation home and
// proves the engine is wired (list API + resolve diagnostic).

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LayoutTemplate, Loader2, Info, Search, PackageSearch, Layers } from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"

interface TemplateRow {
  id: string; code: string; name: string; description: string | null
  status: string; isDefault: boolean; version: number; pages: number; assignments: number
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  DRAFT: "bg-amber-100 text-amber-700",
  INACTIVE: "bg-slate-100 text-slate-500",
  ARCHIVED: "bg-slate-100 text-slate-400",
}

// The Commerce business categories (Business.businessType values that render a
// Commerce storefront). Grocery is included but is NOT the generic fallback.
const COMMERCE_CATEGORIES = ["GROCERY", "ECOMMERCE", "MEAT_DELIVERY", "COSMETICS", "FURNITURE"]

export function CommerceTemplateLibrary() {
  const [byCategory, setByCategory] = useState<Record<string, TemplateRow[]>>({})
  const [loading, setLoading] = useState(true)
  const [diagId, setDiagId] = useState("")
  const [diag, setDiag] = useState<Record<string, unknown> | null>(null)
  const [diagLoading, setDiagLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/core/commerce/templates", { headers: await getAuthHeaders() })
      const j = await res.json()
      if (j.success) setByCategory(j.byCategory || {})
    } catch { /* noop */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const runDiagnostic = async () => {
    if (!diagId.trim()) return
    setDiagLoading(true); setDiag(null)
    try {
      const res = await fetch(`/api/core/commerce/resolve?businessId=${encodeURIComponent(diagId.trim())}`, { headers: await getAuthHeaders() })
      const j = await res.json()
      setDiag(j.success ? (j.diagnostic as Record<string, unknown>) : { error: j.error })
    } catch { setDiag({ error: "Request failed" }) } finally { setDiagLoading(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2"><LayoutTemplate className="h-5 w-5 text-indigo-600" /> Storefront Templates</h1>
          <p className="text-sm text-muted-foreground">Quantix Core Commerce template library. Category-driven storefronts — Commerce is never Grocery-coupled.</p>
        </div>
        <Badge variant="outline" className="text-[11px]">Phase 1 · Foundation</Badge>
      </div>

      {/* Phase notice — honest about scope */}
      <Card className="border-indigo-200 bg-indigo-50/40">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
          <div className="text-xs text-slate-600 space-y-1">
            <p><b>Template Engine foundation is live.</b> Commerce storefronts now resolve through the category-template resolver with a neutral Commerce fallback (never Grocery).</p>
            <p>Master template CRUD + category mapping + assignment (Phase 2), multi-page renderer (Phase 3), and the visual drag-and-drop page builder (Phase 4) build on this foundation. No master templates are seeded yet — Commerce renders the neutral baseline.</p>
          </div>
        </CardContent>
      </Card>

      {/* Category → templates tree */}
      <div className="grid gap-4 lg:grid-cols-2">
        {COMMERCE_CATEGORIES.map((cat) => {
          const rows = byCategory[cat] || []
          return (
            <Card key={cat}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4 text-slate-400" /> {cat.replace(/_/g, " ")}</CardTitle>
                <Badge variant="outline" className="text-[10px]">{rows.length} template{rows.length === 1 ? "" : "s"}</Badge>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                ) : rows.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3">No templates yet. {cat === "ECOMMERCE" ? "Uses the neutral Commerce baseline." : "Uses the neutral Commerce baseline until a template is created (Phase 2)."}</p>
                ) : (
                  <div className="space-y-2">
                    {rows.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{t.name}</span>
                            {t.isDefault && <Badge className="bg-blue-100 text-blue-700 text-[9px]">Default</Badge>}
                            <Badge className={`text-[9px] ${STATUS_STYLE[t.status] || ""}`}>{t.status}</Badge>
                          </div>
                          <p className="text-[10px] text-slate-400">{t.code} · v{t.version} · {t.pages} page{t.pages === 1 ? "" : "s"} · {t.assignments} assigned</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Production-safe resolver diagnostic */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><PackageSearch className="h-4 w-4 text-slate-400" /> Storefront Resolution Diagnostic</CardTitle>
          <p className="text-xs text-muted-foreground">Trace how a Commerce business resolves its storefront (category, config, template, live catalogue counts) — platform-only, no tenant bypass.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input value={diagId} onChange={(e) => setDiagId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runDiagnostic()} placeholder="Business ID…" className="pl-8 h-9" />
            </div>
            <Button onClick={runDiagnostic} disabled={diagLoading || !diagId.trim()} className="h-9 gap-1 bg-indigo-600 hover:bg-indigo-700 text-white">
              {diagLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageSearch className="h-4 w-4" />} Resolve
            </Button>
          </div>
          {diag && (
            <pre className="text-[11px] bg-slate-50 border rounded-lg p-3 overflow-x-auto max-h-[360px]">{JSON.stringify(diag, null, 2)}</pre>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
