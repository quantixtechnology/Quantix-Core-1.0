"use client"

// Quantix Core → Storefront Templates — Phase 2. Functional Commerce Template
// Library: master template CRUD, category-default mapping, business assignment,
// and template detail (metadata/pages/sections/usage/publish). Platform-only.
// The visual drag-and-drop builder is Phase 4; this manages the template domain.

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { LayoutTemplate, Loader2, Plus, Search, Copy, Archive, Power, Rocket, Layers, ChevronLeft, FileStack, PackageSearch, Star } from "lucide-react"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { COMMERCE_CATEGORY_VALUES } from "@/lib/commerce/commerce-categories"

// Single source of truth for the supported Commerce category vocabulary.
const COMMERCE_CATEGORIES = COMMERCE_CATEGORY_VALUES
const STATUS_STYLE: Record<string, string> = { ACTIVE: "bg-green-100 text-green-700", DRAFT: "bg-amber-100 text-amber-700", INACTIVE: "bg-slate-100 text-slate-500", ARCHIVED: "bg-slate-100 text-slate-400" }

interface TemplateRow {
  id: string; code: string; name: string; description: string | null
  businessCategory: string; compatibleCategories: string[]
  status: string; version: number; publishedVersion: number; publishedAt: string | null
  pages: number; assignments: number; defaultForCategories: string[]
}

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(path, { ...opts, headers: { ...(await getAuthHeaders()), "Content-Type": "application/json", ...(opts.headers || {}) } })
  const j = await res.json().catch(() => ({}))
  return { ok: res.ok && j.success !== false, status: res.status, json: j }
}

export function CommerceTemplateLibrary() {
  const [detailId, setDetailId] = useState<string | null>(null)
  if (detailId) return <TemplateDetail id={detailId} onBack={() => setDetailId(null)} />
  return <LibraryHome onOpen={setDetailId} />
}

// ─── Library home (tabs: Library / Category Mapping / Assignment) ───────────
function LibraryHome({ onOpen }: { onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [catFilter, setCatFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [creating, setCreating] = useState(false)
  const [productScope, setProductScope] = useState<"COMMERCE" | "LAUNDRY">("COMMERCE")

  const load = useCallback(async () => {
    setLoading(true)
    const { json } = await api("/api/core/commerce/templates")
    setRows(json.success ? json.data : []); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const filtered = rows.filter((t) => {
    if (catFilter !== "ALL" && !t.compatibleCategories.includes(catFilter)) return false
    if (statusFilter !== "ALL" && t.status !== statusFilter) return false
    if (q.trim() && !`${t.name} ${t.code}`.toLowerCase().includes(q.trim().toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2"><LayoutTemplate className="h-5 w-5 text-indigo-600" /> Website Templates</h1>
          <p className="text-sm text-muted-foreground">Quantix Core master website templates, category defaults and assignments — organised by Product then Business Category.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setCreating(true)} className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"><Plus className="h-4 w-4" /> New Template</Button>
        </div>
      </div>

      {/* Product scope — honest renderer status per product. The library manages
          COMMERCE templates today; LAUNDRY templates + renderer are Phase 4. */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setProductScope("COMMERCE")} className={`rounded-lg border px-3 h-9 text-xs font-medium flex items-center gap-1.5 ${productScope === "COMMERCE" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
          Commerce <Badge className="bg-emerald-100 text-emerald-700 text-[9px]">Renderer Active</Badge>
        </button>
        <button onClick={() => setProductScope("LAUNDRY")} className={`rounded-lg border px-3 h-9 text-xs font-medium flex items-center gap-1.5 ${productScope === "LAUNDRY" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
          Laundry <Badge className="bg-slate-100 text-slate-500 text-[9px]">Renderer Planned</Badge>
        </button>
      </div>

      {productScope === "LAUNDRY" ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Laundry website templates and renderer are <b>planned</b> (Phase 4). No Laundry templates exist yet — none are fabricated here.
        </div>
      ) : (

      <Tabs defaultValue="library">
        <TabsList>
          <TabsTrigger value="library" className="gap-1.5"><Layers className="h-3.5 w-3.5" /> Library</TabsTrigger>
          <TabsTrigger value="mapping" className="gap-1.5"><Star className="h-3.5 w-3.5" /> Category Defaults</TabsTrigger>
          <TabsTrigger value="assign" className="gap-1.5"><PackageSearch className="h-3.5 w-3.5" /> Assignment</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / code…" className="pl-8 h-9 w-[240px]" /></div>
            <Select value={catFilter} onValueChange={setCatFilter}><SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All categories</SelectItem>{COMMERCE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger><SelectContent>{["ALL", "ACTIVE", "DRAFT", "INACTIVE", "ARCHIVED"].map((s) => <SelectItem key={s} value={s}>{s === "ALL" ? "All statuses" : s}</SelectItem>)}</SelectContent></Select>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-16 justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-16 text-center text-sm text-slate-400">No templates match. Create one to get started.</CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((t) => (
                <button key={t.id} onClick={() => onOpen(t.id)} className="text-left rounded-xl border bg-white p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{t.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{t.code}</p>
                    </div>
                    <Badge className={`text-[10px] shrink-0 ${STATUS_STYLE[t.status] || ""}`}>{t.status}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {t.compatibleCategories.map((c) => <Badge key={c} variant="outline" className="text-[9px]">{c.replace(/_/g, " ")}</Badge>)}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1"><FileStack className="h-3 w-3" /> {t.pages} page{t.pages === 1 ? "" : "s"}</span>
                    <span>v{t.version} · pub v{t.publishedVersion}</span>
                    {t.assignments > 0 && <span>{t.assignments} assigned</span>}
                    {t.defaultForCategories.length > 0 && <Badge className="bg-blue-100 text-blue-700 text-[9px]">Default</Badge>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mapping"><CategoryMapping templates={rows} onChanged={load} /></TabsContent>
        <TabsContent value="assign"><AssignmentPanel /></TabsContent>
      </Tabs>
      )}

      {creating && <CreateTemplateDialog onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); load(); onOpen(id) }} />}
    </div>
  )
}

// ─── Create template ─────────────────────────────────────────────────────────
function CreateTemplateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("")
  const [primary, setPrimary] = useState("ECOMMERCE")
  const [extra, setExtra] = useState<string[]>([])
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const toggle = (c: string) => setExtra((x) => x.includes(c) ? x.filter((v) => v !== c) : [...x, c])

  const save = async () => {
    if (!name.trim()) return toast.error("Name is required")
    setSaving(true)
    const { ok, json } = await api("/api/core/commerce/templates", { method: "POST", body: JSON.stringify({ name: name.trim(), businessCategory: primary, compatibleCategories: [primary, ...extra], description }) })
    setSaving(false)
    if (!ok) return toast.error(json.error || "Create failed")
    toast.success("Template created")
    onCreated(json.data.id)
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Template</DialogTitle><DialogDescription className="text-xs">Master Commerce template. Code is generated from the name.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label className="text-xs">Template Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" placeholder="e.g. Grocery Modern" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Primary Business Category</Label>
            <Select value={primary} onValueChange={setPrimary}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{COMMERCE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Also compatible with</Label>
            <div className="flex flex-wrap gap-1.5">{COMMERCE_CATEGORIES.filter((c) => c !== primary).map((c) => <button key={c} type="button" onClick={() => toggle(c)} className={`rounded-lg border px-2.5 h-8 text-xs ${extra.includes(c) ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>{c.replace(/_/g, " ")}</button>)}</div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="text-sm" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving} className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Template detail ─────────────────────────────────────────────────────────
interface TemplateDetail { id: string; code: string; name: string; description: string | null; businessCategory: string; compatibleCategories: string[]; status: string; version: number; publishedVersion: number; publishedAt: string | null; pages: { id: string; name: string; slug: string; pageType: string; isHomePage: boolean; sections: { id: string; sectionType: string }[] }[]; usage: { counts: Record<string, number>; inUse: boolean } }

function TemplateDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [t, setT] = useState<TemplateDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<{ action: string; label: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { json } = await api(`/api/core/commerce/templates/${id}`)
    setT(json.success ? json.data : null); setLoading(false)
  }, [id])
  useEffect(() => { load() }, [load])

  const setStatus = async (status: string) => {
    setBusy(true)
    const { ok, json } = await api(`/api/core/commerce/templates/${id}/status`, { method: "POST", body: JSON.stringify({ status }) })
    setBusy(false); setConfirm(null)
    if (!ok) return toast.error(json.error || "Failed")
    toast.success(`Template ${status.toLowerCase()}`); load()
  }
  const publish = async () => {
    setBusy(true)
    const { ok, json } = await api(`/api/core/commerce/templates/${id}/publish`, { method: "POST" })
    setBusy(false)
    if (!ok) return toast.error(json.error || "Publish failed")
    toast.success(`Published v${json.data.publishedVersion} (${json.data.sectionCount} sections)`); load()
  }
  const duplicate = async () => {
    setBusy(true)
    const { ok, json } = await api(`/api/core/commerce/templates/${id}/duplicate`, { method: "POST" })
    setBusy(false)
    if (!ok) return toast.error(json.error || "Duplicate failed")
    toast.success(`Duplicated → ${json.data.code}`)
  }

  if (loading) return <div className="flex items-center gap-2 py-16 justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
  if (!t) return <div className="py-16 text-center"><p className="text-sm text-slate-500">Template not found.</p><Button variant="outline" size="sm" className="mt-3" onClick={onBack}><ChevronLeft className="h-4 w-4" /> Back</Button></div>

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={onBack}><ChevronLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap"><h2 className="text-lg font-semibold tracking-tight">{t.name}</h2><Badge className={STATUS_STYLE[t.status] || ""}>{t.status}</Badge></div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">{t.code} · v{t.version} · published v{t.publishedVersion}{t.publishedAt ? ` · ${new Date(t.publishedAt).toLocaleDateString("en-IN")}` : " (never published)"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1" onClick={duplicate} disabled={busy}><Copy className="h-3.5 w-3.5" /> Duplicate</Button>
          {t.status !== "ACTIVE" && <Button variant="outline" size="sm" className="gap-1" onClick={() => setStatus("ACTIVE")} disabled={busy}><Power className="h-3.5 w-3.5" /> Activate</Button>}
          {t.status === "ACTIVE" && <Button variant="outline" size="sm" className="gap-1" onClick={() => setConfirm({ action: "INACTIVE", label: "Deactivate" })} disabled={busy}><Power className="h-3.5 w-3.5" /> Deactivate</Button>}
          {t.status !== "ARCHIVED" && <Button variant="outline" size="sm" className="gap-1 text-rose-600 border-rose-200" onClick={() => setConfirm({ action: "ARCHIVED", label: "Archive" })} disabled={busy}><Archive className="h-3.5 w-3.5" /> Archive</Button>}
          <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={publish} disabled={busy}><Rocket className="h-3.5 w-3.5" /> Publish</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileStack className="h-4 w-4 text-slate-400" /> Pages &amp; Sections</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {t.pages.length === 0 ? <p className="text-xs text-slate-400">No pages yet.</p> : t.pages.map((p) => (
              <div key={p.id} className="rounded-lg border p-2.5">
                <div className="flex items-center gap-2"><span className="text-sm font-medium">{p.name}</span>{p.isHomePage && <Badge className="bg-blue-100 text-blue-700 text-[9px]">Home</Badge>}<span className="text-[10px] text-slate-400 font-mono">/{p.slug}</span></div>
                <div className="mt-1.5 flex flex-wrap gap-1">{p.sections.map((s) => <Badge key={s.id} variant="outline" className="text-[9px]">{s.sectionType}</Badge>)}</div>
              </div>
            ))}
            <p className="text-[10px] text-slate-400 pt-1">Visual drag-and-drop editing arrives in Phase 4. Catalogue sections carry data-source config only — never copied catalogue data.</p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Metadata</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><p className="text-[10px] uppercase text-slate-400">Primary Category</p><p className="font-medium">{t.businessCategory.replace(/_/g, " ")}</p></div>
              <div><p className="text-[10px] uppercase text-slate-400">Compatible Categories</p><div className="flex flex-wrap gap-1 mt-0.5">{t.compatibleCategories.map((c) => <Badge key={c} variant="outline" className="text-[9px]">{c.replace(/_/g, " ")}</Badge>)}</div></div>
              {t.description && <div><p className="text-[10px] uppercase text-slate-400">Description</p><p className="text-slate-600">{t.description}</p></div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Usage</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              {["categoryDefaults", "businessAssignments", "storeAssignments", "tenantInstances"].map((k) => (
                <div key={k} className="flex items-center justify-between"><span className="text-slate-500 capitalize">{k.replace(/([A-Z])/g, " $1")}</span><span className="font-medium">{t.usage.counts[k] || 0}</span></div>
              ))}
              {!t.usage.inUse && <p className="text-[11px] text-slate-400 pt-1">Not in use — safe to archive.</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      {confirm && (
        <AlertDialog open onOpenChange={(o) => !o && setConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>{confirm.label} template?</AlertDialogTitle><AlertDialogDescription>{confirm.action === "ARCHIVED" ? "Archived templates cannot be assigned. Blocked if it is a category default or has active assignments." : "Deactivated templates cannot be newly assigned."}</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => setStatus(confirm.action)}>{confirm.label}</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

// ─── Category default mapping ────────────────────────────────────────────────
function CategoryMapping({ templates, onChanged }: { templates: TemplateRow[]; onChanged: () => void }) {
  const [rows, setRows] = useState<{ businessCategory: string; defaultTemplate: { id: string; name: string; status: string } | null; configured: boolean }[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    const { json } = await api("/api/core/commerce/category-defaults")
    setRows(json.success ? json.data : []); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const setDefault = async (businessCategory: string, templateId: string | null) => {
    const { ok, json } = await api("/api/core/commerce/category-defaults", { method: "POST", body: JSON.stringify({ businessCategory, templateId }) })
    if (!ok) return toast.error(json.error || "Failed")
    toast.success("Category default updated"); load(); onChanged()
  }

  if (loading) return <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Category Default Templates</CardTitle><p className="text-xs text-muted-foreground">One default per Commerce category. Only ACTIVE compatible templates qualify. Changing a default never overrides explicit business assignments.</p></CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => {
          const compatible = templates.filter((t) => t.status === "ACTIVE" && t.compatibleCategories.includes(r.businessCategory))
          return (
            <div key={r.businessCategory} className="flex items-center gap-3 rounded-lg border p-2.5">
              <span className="text-sm font-medium w-40 shrink-0">{r.businessCategory.replace(/_/g, " ")}</span>
              <Select value={r.defaultTemplate?.id || "NONE"} onValueChange={(v) => setDefault(r.businessCategory, v === "NONE" ? null : v)}>
                <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="No default configured" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">— No default (neutral fallback) —</SelectItem>
                  {compatible.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {!r.configured && <Badge variant="outline" className="text-[10px] text-amber-600">unset</Badge>}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ─── Assignment panel ────────────────────────────────────────────────────────
function AssignmentPanel() {
  const [businessId, setBusinessId] = useState("")
  const [data, setData] = useState<{ business: { name: string; businessType: string; workspaceType: string; isCommerce: boolean }; resolved: { code: string; source: string }; rendererMode: string; explicitAssignments: { storeId: string | null; template: { id: string; name: string } | null }[]; compatibleTemplates: { id: string; name: string }[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [pick, setPick] = useState("")

  const inspect = async () => {
    if (!businessId.trim()) return
    setLoading(true); setData(null)
    const { json } = await api(`/api/core/commerce/assignments?businessId=${encodeURIComponent(businessId.trim())}`)
    setData(json.success ? json.data : null); setLoading(false)
    if (!json.success) toast.error(json.error || "Not found")
  }
  const assign = async () => {
    if (!pick) return
    const { ok, json } = await api("/api/core/commerce/assignments", { method: "POST", body: JSON.stringify({ businessId: businessId.trim(), templateId: pick }) })
    if (!ok) return toast.error(json.error || "Assign failed")
    toast.success("Template assigned"); inspect()
  }
  const removeAssignment = async () => {
    const { ok, json } = await api(`/api/core/commerce/assignments?businessId=${encodeURIComponent(businessId.trim())}`, { method: "DELETE" })
    if (!ok) return toast.error(json.error || "Failed")
    toast.success("Assignment removed — back to category default"); inspect()
  }
  const setMode = async (mode: string) => {
    const { ok, json } = await api("/api/core/commerce/renderer-mode", { method: "POST", body: JSON.stringify({ businessId: businessId.trim(), mode }) })
    if (!ok) return toast.error(json.error || "Failed")
    toast.success(`Renderer mode → ${mode}`); inspect()
  }

  return (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Business Template Assignment</CardTitle><p className="text-xs text-muted-foreground">Inspect a Commerce business's resolved template + assign a compatible one. Server enforces category compatibility and COMMERCE-only.</p></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2"><div className="relative flex-1 max-w-md"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={businessId} onChange={(e) => setBusinessId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && inspect()} placeholder="Business ID…" className="pl-8 h-9" /></div><Button onClick={inspect} disabled={loading || !businessId.trim()} className="h-9 gap-1 bg-indigo-600 hover:bg-indigo-700 text-white">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageSearch className="h-4 w-4" />} Inspect</Button></div>

        {data && (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="font-medium">{data.business.name}</span>
              <Badge variant="outline" className="text-[10px]">{data.business.workspaceType}</Badge>
              <Badge variant="outline" className="text-[10px]">{data.business.businessType.replace(/_/g, " ")}</Badge>
              {!data.business.isCommerce && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Not a Commerce business</Badge>}
            </div>
            <div className="text-xs text-slate-600">Resolved template: <b>{data.resolved.code}</b> <Badge variant="outline" className="text-[9px] ml-1">{data.resolved.source}</Badge></div>
            {data.business.isCommerce && (
              <div className="flex items-center gap-2 pb-1 border-b">
                <span className="text-xs text-slate-500">Live renderer:</span>
                <Select value={data.rendererMode} onValueChange={setMode}>
                  <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{["LEGACY", "TEMPLATE", "AUTO"].map((m) => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}</SelectContent>
                </Select>
                <span className="text-[10px] text-slate-400">LEGACY = existing homepage · TEMPLATE/AUTO = template renderer</span>
              </div>
            )}
            {data.business.isCommerce && (
              <div className="flex items-center gap-2">
                <Select value={pick} onValueChange={setPick}><SelectTrigger className="h-9 flex-1 max-w-sm"><SelectValue placeholder="Assign a compatible template…" /></SelectTrigger><SelectContent>{data.compatibleTemplates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
                <Button onClick={assign} disabled={!pick} size="sm" className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white">Assign</Button>
                {data.explicitAssignments.some((a) => a.storeId === null) && <Button onClick={removeAssignment} variant="outline" size="sm" className="h-9">Remove</Button>}
              </div>
            )}
            {data.compatibleTemplates.length === 0 && data.business.isCommerce && <p className="text-[11px] text-amber-600">No ACTIVE compatible templates for {data.business.businessType.replace(/_/g, " ")}.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
