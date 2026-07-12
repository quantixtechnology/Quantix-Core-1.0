"use client"

// Customers — live, database-backed listing with per-customer KPIs and actions
// (View / Edit / New Order). Reads GET /api/laundry/customers; edits via
// PUT /api/laundry/customers/[id]. No placeholders.

import { useEffect, useState, useCallback } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Users, Search, Loader2, Eye, Pencil, Plus, ChevronLeft, ChevronRight, UserCheck, Repeat, Wallet, Phone, Mail, MapPin, Save, Trash2, AlertTriangle } from "lucide-react"
import { SearchableSelect } from "./pricing/searchable-select"
import { INDIAN_STATES, isValidPincode, formatAddressLines } from "@/lib/india"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { useLaundryPermissions } from "@/hooks/use-laundry-permissions"

interface Row {
  id: string; name: string; phone: string | null; email: string | null; customerCode: string | null
  loyaltyTier: string; walletBalance: number; totalOrders: number; totalSpent: number
  status: string; isActive: boolean; lastOrderAt: string | null
}
interface Addr { id: string; addressType?: string; label?: string | null; addressLine1: string; addressLine2: string | null; area: string | null; landmark: string | null; city: string; state: string; pincode: string; country: string; isDefault?: boolean; isPickupDefault?: boolean; isDeliveryDefault?: boolean }
interface CustStats { totalOrders: number; completed: number; cancelled: number; grossValue: number; collected: number; outstanding: number; avgOrderValue: number; lastOrderAt: string | null }
interface Detail extends Row {
  addresses: Addr[]; fullAddress?: string; tags?: string[]; comm?: Record<string, boolean>
  alternateMobile?: string | null; company?: string | null; reference?: string | null; anniversary?: string | null
  gender?: string | null; dateOfBirth?: string | null; gstNumber?: string | null; notes?: string; stats?: CustStats
}
interface TL { at: string; type: string; title: string; detail?: string | null; amount?: number | null }
interface Note { id: string; type: string; title: string; body: string | null; actorName: string | null; createdAt: string }

const PAGE = 10
const inr = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`
const tierStyle = (t: string) => ({ GOLD: "border-amber-300 text-amber-700 bg-amber-50", PLATINUM: "border-violet-300 text-violet-700 bg-violet-50", SILVER: "border-slate-300 text-slate-600 bg-slate-50" }[(t || "").toUpperCase()] || "border-orange-300 text-orange-700 bg-orange-50")
const initials = (n: string) => n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()

export function LaundryCustomersView() {
  const { currentBusinessId, user } = useAuthStore()
  const isSuperAdmin = user?.role === "QUANTIX_SUPER_ADMIN"
  const { can } = useLaundryPermissions()
  const canArchive = can("laundry.customers.delete") || isSuperAdmin
  const { setLaundryPage } = useAdminStore()
  const { toast } = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState({ totalCustomers: 0, activeCustomers: 0, activeMemberships: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)

  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [custSub, setCustSub] = useState<{ planName: string; status: string; remainingKg: number; remainingPieces: number; allowanceKg: number | null; allowancePieces: number | null; expiry: string; renewalDate: string; autoRenew: boolean } | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [timeline, setTimeline] = useState<TL[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [newNote, setNewNote] = useState("")
  const [tab, setTab] = useState<"overview" | "addresses" | "timeline" | "notes">("overview")
  // Merge duplicate
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeQuery, setMergeQuery] = useState("")
  const [mergeResults, setMergeResults] = useState<Row[]>([])
  const [merging, setMerging] = useState(false)

  // Archive (soft delete). Orders, invoices, payments, subscription ledger and
  // audit are NEVER deleted — the customer is marked archived and hidden from
  // search / New Order / Customer App; history stays intact.
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState(false)

  const doDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/laundry/customers/${deleteTarget.id}?businessId=${currentBusinessId}`, { method: "DELETE", headers: getAuthHeaders() })
      const json = await res.json()
      if (!res.ok || !json.success) { toast({ title: "Archive failed", description: json.error, variant: "destructive" }); return }
      toast({ title: "Customer archived", description: `${deleteTarget.name} is archived. Their orders and history are kept.` })
      setDeleteTarget(null); load()
    } catch { toast({ title: "Archive failed", variant: "destructive" }) } finally { setDeleting(false) }
  }

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ businessId: currentBusinessId, limit: String(PAGE), offset: String(page * PAGE) })
      if (search.trim()) params.set("q", search.trim())
      const json = await fetch(`/api/laundry/customers?${params}`).then((r) => r.json())
      setRows(json.success ? json.data : []); setTotal(json.total || 0)
      if (json.summary) setSummary(json.summary)
    } catch { setRows([]) } finally { setLoading(false) }
  }, [currentBusinessId, page, search])
  useEffect(() => { load() }, [load])

  const openCustomer = async (id: string, edit: boolean) => {
    setOpenId(id); setEditing(edit); setDetail(null); setCustSub(null); setTimeline([]); setNotes([]); setTab("overview"); setLoadingDetail(true)
    // Active/GRACE subscription (Part 8) — detected, never assumed.
    fetch(`/api/laundry/subscriptions/active?businessId=${currentBusinessId}&customerId=${id}`).then((r) => r.json())
      .then((j) => setCustSub(j.success && j.data.length ? j.data[0] : null)).catch(() => setCustSub(null))
    fetch(`/api/laundry/customers/${id}/timeline?businessId=${currentBusinessId}`).then((r) => r.json()).then((j) => setTimeline(j.success ? j.data : [])).catch(() => {})
    fetch(`/api/laundry/customers/${id}/notes?businessId=${currentBusinessId}`).then((r) => r.json()).then((j) => setNotes(j.success ? j.data : [])).catch(() => {})
    try {
      const json = await fetch(`/api/laundry/customers/${id}?businessId=${currentBusinessId}`).then((r) => r.json())
      if (json.success) {
        const d = json.data as Detail; setDetail(d)
        const a = d.addresses?.[0]
        setForm({ name: d.name, mobile: d.phone || "", email: d.email || "", alternateMobile: d.alternateMobile || "", company: d.company || "", gstNumber: d.gstNumber || "", gender: d.gender || "", reference: d.reference || "", tags: (d.tags || []).join(", "), status: d.status || "ACTIVE", addressLine1: a?.addressLine1 || "", addressLine2: a?.addressLine2 || "", area: a?.area || "", landmark: a?.landmark || "", city: a?.city || "", state: a?.state || "", pincode: a?.pincode || "" })
      }
    } catch { /* noop */ } finally { setLoadingDetail(false) }
  }
  const closeDialog = () => { setOpenId(null); setDetail(null); setEditing(false) }

  const addNote = async () => {
    if (!newNote.trim() || !detail) return
    try {
      const res = await fetch(`/api/laundry/customers/${detail.id}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, content: newNote.trim(), type: "NOTE", actorName: user?.name || "staff" }) })
      const j = await res.json()
      if (j.success) { setNotes((n) => [j.data, ...n]); setTimeline((t) => [{ at: j.data.createdAt, type: "NOTE", title: j.data.title, detail: j.data.body }, ...t]); setNewNote("") }
    } catch { toast({ title: "Failed to add note", variant: "destructive" }) }
  }
  const searchMerge = async (q: string) => {
    setMergeQuery(q)
    if (q.trim().length < 2) { setMergeResults([]); return }
    try { const j = await fetch(`/api/laundry/customers?businessId=${currentBusinessId}&q=${encodeURIComponent(q)}`).then((r) => r.json()); setMergeResults((j.data || []).filter((c: Row) => c.id !== detail?.id)) } catch { setMergeResults([]) }
  }
  const sendInvite = async () => {
    if (!detail?.email) { toast({ title: "Email required", description: "Add an email address before sending an app invitation.", variant: "destructive" }); return }
    try {
      const res = await fetch(`/api/laundry/app/invite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, email: detail.email, name: detail.name, customerId: detail.id, source: "WALK_IN", actorName: user?.name || "staff" }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Failed to send")
      toast({ title: "Invitation sent", description: j.data?.sent ? `App invite emailed to ${detail.email}` : `Invite prepared for ${detail.email} (email delivery pending SMTP config)` })
    } catch (e) { toast({ title: "Invite failed", description: e instanceof Error ? e.message : "", variant: "destructive" }) }
  }
  const doMerge = async (duplicateId: string) => {
    if (!detail) return
    setMerging(true)
    try {
      const res = await fetch(`/api/laundry/customers/merge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, primaryId: detail.id, duplicateId, actorName: user?.name || "admin" }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Merge failed")
      toast({ title: "Customers merged", description: "Orders, subscriptions, addresses and history moved to this profile." })
      setMergeOpen(false); setMergeQuery(""); setMergeResults([]); load(); openCustomer(detail.id, false)
    } catch (e) { toast({ title: "Merge failed", description: e instanceof Error ? e.message : "", variant: "destructive" }) } finally { setMerging(false) }
  }

  const saveEdit = async () => {
    if (!detail) return
    if (form.pincode && !isValidPincode(form.pincode)) { toast({ title: "Invalid PIN Code", variant: "destructive" }); return }
    setSavingEdit(true)
    try {
      const tags = (form.tags || "").split(",").map((t) => t.trim()).filter(Boolean)
      const res = await fetch(`/api/laundry/customers/${detail.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, ...form, tags }) })
      const json = await res.json()
      if (!res.ok || !json.success) { toast({ title: "Update failed", description: json.error, variant: "destructive" }); return }
      toast({ title: "Customer updated" }); closeDialog(); load()
    } catch { toast({ title: "Update failed", variant: "destructive" }) } finally { setSavingEdit(false) }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE))

  // Business-wide counts from the API (not page-scoped) — pagination belongs in
  // the pagination controls below, not the summary cards.
  const KPIS = [
    { label: "Total Customers", value: summary.totalCustomers, icon: Users, color: "text-blue-600 bg-blue-50" },
    { label: "Active Customers", value: summary.activeCustomers, icon: UserCheck, color: "text-green-600 bg-green-50" },
    { label: "Customer Memberships", value: summary.activeMemberships, icon: Repeat, color: "text-violet-600 bg-violet-50" },
  ]

  return (
    <div className="px-4 lg:px-6 py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><Users className="h-5 w-5 text-blue-600" /> Customers</h1>
          <p className="text-sm text-slate-500">Manage all your customers in one place</p>
        </div>
        <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setLaundryPage("new-order")}><Plus className="h-3.5 w-3.5" /> New Order</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {KPIS.map((k) => (
          <Card key={k.label} className="rounded-xl border-slate-200 shadow-sm"><CardContent className="p-4 flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${k.color}`}><k.icon className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold text-slate-800 leading-none tabular-nums">{k.value}</p><p className="text-[11px] text-slate-400 mt-1">{k.label}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardContent className="p-3">
          <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input placeholder="Search by name, mobile, email or customer ID…" className="pl-9 h-9 bg-slate-50 border-slate-200" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} /></div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16"><Users className="h-8 w-8 text-slate-300 mx-auto mb-2" /><p className="text-sm font-medium text-slate-600">{search ? "No customers match" : "No customers yet"}</p><p className="text-xs text-slate-400 mt-0.5">Add a customer from New Order.</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow className="text-[11px] uppercase tracking-wide">
                <TableHead className="w-[26%]">Customer</TableHead><TableHead className="w-[22%]">Contact</TableHead><TableHead>Membership</TableHead>
                <TableHead className="text-right">Wallet</TableHead>
                <TableHead className="text-right">Lifetime Value</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell><div className="flex items-center gap-2.5"><Avatar className="h-9 w-9"><AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">{initials(c.name)}</AvatarFallback></Avatar><div><p className="text-sm font-medium text-slate-800">{c.name}</p><p className="text-[11px] text-slate-400 font-mono">{c.customerCode || "—"}</p></div></div></TableCell>
                    <TableCell><p className="text-sm text-slate-600">{c.phone || "—"}</p><p className="text-[11px] text-slate-400">{c.email || ""}</p></TableCell>
                    <TableCell><Badge variant="outline" className={`text-[11px] ${tierStyle(c.loyaltyTier)}`}>{c.loyaltyTier || "Bronze"}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{inr(c.walletBalance)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{inr(c.totalSpent)}</TableCell>
                    <TableCell><Badge variant="outline" className={c.isActive ? "border-green-300 text-green-700 bg-green-50" : "border-slate-300 text-slate-500 bg-slate-50"}>{c.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600" title="View" onClick={() => openCustomer(c.id, false)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600" title="Edit" onClick={() => openCustomer(c.id, true)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600" title="New Order" onClick={() => setLaundryPage("new-order")}><Plus className="h-4 w-4" /></Button>
                        {canArchive && <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-amber-600" title="Archive customer (keeps order history)" onClick={() => setDeleteTarget(c)}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {total > PAGE && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Showing {page * PAGE + 1}–{page * PAGE + rows.length} of {total}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="px-2 text-xs">Page {page + 1} / {pages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* View / Edit dialog */}
      <Dialog open={!!openId} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">{editing ? <Pencil className="h-5 w-5 text-blue-600" /> : <Eye className="h-5 w-5 text-blue-600" />} {editing ? "Edit Customer" : "Customer Details"}</DialogTitle>
            <DialogDescription>{detail?.customerCode || ""}</DialogDescription>
          </DialogHeader>
          {loadingDetail || !detail ? (
            <div className="flex items-center justify-center py-10 text-slate-400 gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : editing ? (
            <div className="space-y-3">
              <div className="space-y-1"><Label className="text-xs">Name *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Mobile *</Label><Input value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Alternate Mobile</Label><Input value={form.alternateMobile || ""} onChange={(e) => setForm((f) => ({ ...f, alternateMobile: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Company</Label><Input value={form.company || ""} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">GST</Label><Input value={form.gstNumber || ""} onChange={(e) => setForm((f) => ({ ...f, gstNumber: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Status</Label>
                  <select value={form.status || "ACTIVE"} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background">
                    {["ACTIVE", "INACTIVE", "BLOCKED"].map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1"><Label className="text-xs">Tags (comma separated)</Label><Input value={form.tags || ""} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="VIP, Corporate, Premium" /></div>
              <div className="space-y-1"><Label className="text-xs">Address Line 1</Label><Input value={form.addressLine1} onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Address Line 2</Label><Input value={form.addressLine2} onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Area</Label><Input value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">City</Label><Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">State</Label><SearchableSelect value={form.state} onChange={(v) => setForm((f) => ({ ...f, state: v }))} options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} placeholder="Select state" /></div>
                <div className="space-y-1"><Label className="text-xs">PIN Code</Label><Input value={form.pincode} inputMode="numeric" maxLength={6} onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))} /></div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12"><AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">{initials(detail.name)}</AvatarFallback></Avatar>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">{detail.name}</p>
                  <div className="flex flex-wrap items-center gap-1 mt-0.5">
                    <Badge variant="outline" className={`text-[11px] ${tierStyle(detail.loyaltyTier)}`}>{detail.loyaltyTier || "Bronze"}</Badge>
                    {detail.status === "MERGED" && <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-500">Merged</Badge>}
                    {(detail.tags || []).map((t) => <Badge key={t} variant="outline" className="text-[10px] border-blue-200 text-blue-700 bg-blue-50">{t}</Badge>)}
                  </div>
                </div>
              </div>

              {/* Statistics (Part 8) */}
              {detail.stats && (
                <div className="grid grid-cols-3 gap-2">
                  {[{ l: "Orders", v: detail.stats.totalOrders }, { l: "Completed", v: detail.stats.completed }, { l: "Cancelled", v: detail.stats.cancelled }, { l: "Revenue", v: inr(detail.stats.grossValue) }, { l: "Outstanding", v: inr(detail.stats.outstanding), c: detail.stats.outstanding > 0 ? "text-rose-600" : "" }, { l: "Avg Order", v: inr(detail.stats.avgOrderValue) }].map((s) => (
                    <div key={s.l} className="rounded-lg border border-slate-200 px-2 py-1.5"><p className="text-[10px] uppercase text-slate-400">{s.l}</p><p className={`text-sm font-bold ${s.c || "text-slate-800"}`}>{s.v}</p></div>
                  ))}
                </div>
              )}

              {/* Tabs */}
              <div className="flex gap-1 border-b border-slate-100">
                {(["overview", "addresses", "timeline", "notes"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)} className={`px-2.5 h-8 text-xs font-medium capitalize border-b-2 -mb-px ${tab === t ? "border-blue-600 text-blue-700" : "border-transparent text-slate-400 hover:text-slate-600"}`}>{t}</button>
                ))}
              </div>

              {tab === "overview" && <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-slate-400 flex items-center gap-1"><Phone className="h-3 w-3" /> Mobile</p><p className="text-slate-700">{detail.phone || "—"}{detail.alternateMobile ? ` · ${detail.alternateMobile}` : ""}</p></div>
                  <div><p className="text-xs text-slate-400 flex items-center gap-1"><Mail className="h-3 w-3" /> Email</p><p className="text-slate-700">{detail.email || "—"}</p></div>
                  <div><p className="text-xs text-slate-400">Company</p><p className="text-slate-700">{detail.company || "—"}</p></div>
                  <div><p className="text-xs text-slate-400">GST</p><p className="text-slate-700">{detail.gstNumber || "—"}</p></div>
                  <div><p className="text-xs text-slate-400 flex items-center gap-1"><Wallet className="h-3 w-3" /> Wallet</p><p className="text-slate-700">{inr(detail.walletBalance)}</p></div>
                  <div><p className="text-xs text-slate-400">Reference</p><p className="text-slate-700">{detail.reference || "—"}</p></div>
                </div>
                {/* Communication preferences (Part 5) */}
                <div><p className="text-xs text-slate-400">Communication</p><div className="flex flex-wrap gap-1 mt-0.5">{["sms", "whatsapp", "email", "push", "marketing"].map((k) => <Badge key={k} variant="outline" className={`text-[10px] capitalize ${detail.comm?.[k] ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-400"}`}>{k}</Badge>)}</div></div>
                {/* Walk-in: invite the customer to the Customer App (email OTP) */}
                <Button size="sm" variant="outline" className="w-full gap-1.5 border-blue-200 text-blue-700" disabled={!detail.email} onClick={sendInvite}><Mail className="h-3.5 w-3.5" /> Send App Registration Invitation</Button>
                {/* Current subscription (Part 8) */}
                {custSub && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                    <div className="flex items-center justify-between"><p className="text-sm font-semibold text-blue-800 flex items-center gap-1.5"><Repeat className="h-4 w-4" /> {custSub.planName}</p><Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700 bg-blue-50">{custSub.status === "GRACE" ? "In Grace" : "Active"}</Badge></div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {(custSub.allowanceKg ?? 0) > 0 && <span className="rounded bg-white border border-blue-200 text-blue-700 px-2 py-0.5">{custSub.remainingKg} / {custSub.allowanceKg} KG left</span>}
                      {(custSub.allowancePieces ?? 0) > 0 && <span className="rounded bg-white border border-violet-200 text-violet-700 px-2 py-0.5">{custSub.remainingPieces} / {custSub.allowancePieces} pieces left</span>}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">Expires {new Date(custSub.expiry).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · {custSub.autoRenew ? "Auto-renews" : "Manual renewal"}</p>
                  </div>
                )}
                {detail.notes && <div><p className="text-xs text-slate-400">Profile note</p><p className="text-slate-600 text-xs">{detail.notes}</p></div>}
              </div>}

              {tab === "addresses" && <div className="space-y-2">
                {detail.addresses.length === 0 ? <p className="text-slate-400 text-xs py-3 text-center">No addresses.</p> : detail.addresses.map((a) => (
                  <div key={a.id} className="rounded-lg border border-slate-200 p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-xs font-medium text-slate-700">{a.addressType || "HOME"}</span>
                      {a.isDefault && <Badge variant="outline" className="text-[9px] border-emerald-300 text-emerald-700 bg-emerald-50">Default</Badge>}
                      {a.isPickupDefault && <Badge variant="outline" className="text-[9px] border-blue-300 text-blue-700 bg-blue-50">Pickup</Badge>}
                      {a.isDeliveryDefault && <Badge variant="outline" className="text-[9px] border-violet-300 text-violet-700 bg-violet-50">Delivery</Badge>}
                    </div>
                    <p className="text-slate-600 text-xs whitespace-pre-line leading-snug">{formatAddressLines(a).join("\n")}</p>
                  </div>
                ))}
              </div>}

              {tab === "timeline" && <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {timeline.length === 0 ? <p className="text-slate-400 text-xs py-3 text-center">No activity yet.</p> : timeline.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs border-l-2 border-slate-200 pl-2 py-0.5">
                    <Badge variant="outline" className="text-[9px] shrink-0 border-slate-200 text-slate-500 capitalize">{t.type.toLowerCase()}</Badge>
                    <div className="min-w-0 flex-1"><p className="text-slate-700 truncate">{t.title}{t.detail ? ` · ${t.detail}` : ""}</p><p className="text-[10px] text-slate-400">{new Date(t.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p></div>
                    {t.amount != null && <span className="text-slate-500 shrink-0">{inr(t.amount)}</span>}
                  </div>
                ))}
              </div>}

              {tab === "notes" && <div className="space-y-2">
                <div className="flex gap-2"><Input value={newNote} onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} placeholder="Add an internal note…" className="text-xs h-8" /><Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 text-white" onClick={addNote} disabled={!newNote.trim()}>Add</Button></div>
                <p className="text-[10px] text-slate-400">Internal only — never shown to customers.</p>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {notes.length === 0 ? <p className="text-slate-400 text-xs py-2 text-center">No notes.</p> : notes.map((n) => (
                    <div key={n.id} className="rounded border border-slate-100 bg-slate-50 p-2"><div className="flex items-center justify-between"><Badge variant="outline" className="text-[9px] capitalize border-slate-200 text-slate-500">{n.type.toLowerCase()}</Badge><span className="text-[10px] text-slate-400">{n.actorName || "staff"} · {new Date(n.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span></div><p className="text-xs text-slate-600 mt-1">{n.body}</p></div>
                  ))}
                </div>
              </div>}
            </div>
          )}
          <DialogFooter>
            {editing ? (
              <><Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button><Button onClick={saveEdit} disabled={savingEdit} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">{savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</Button></>
            ) : (
              <><Button variant="outline" className="gap-1" onClick={() => { setMergeOpen(true); setMergeQuery(""); setMergeResults([]) }}><Users className="h-4 w-4" /> Merge</Button><Button variant="outline" className="gap-1" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button><Button className="gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setLaundryPage("new-order")}><Plus className="h-4 w-4" /> New Order</Button></>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge duplicate customers (Part 10) */}
      <Dialog open={mergeOpen} onOpenChange={(o) => { if (!o) { setMergeOpen(false); setMergeQuery(""); setMergeResults([]) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-blue-600" /> Merge Duplicate Into {detail?.name}</DialogTitle>
            <DialogDescription>Search the duplicate customer. Its orders, subscriptions, payments, addresses and history move to <span className="font-medium text-slate-700">{detail?.name}</span>; the duplicate is retired. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <Input value={mergeQuery} onChange={(e) => searchMerge(e.target.value)} placeholder="Search by name, mobile or code…" autoFocus />
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {mergeResults.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2">
                <div className="min-w-0"><p className="text-sm font-medium text-slate-800 truncate">{c.name}</p><p className="text-[11px] text-slate-400">{c.phone} {c.customerCode ? `· ${c.customerCode}` : ""} · {c.totalOrders} orders</p></div>
                <Button size="sm" variant="outline" className="h-8 shrink-0" disabled={merging} onClick={() => doMerge(c.id)}>{merging ? <Loader2 className="h-4 w-4 animate-spin" /> : "Merge in"}</Button>
              </div>
            ))}
            {mergeQuery.trim().length >= 2 && mergeResults.length === 0 && <p className="text-xs text-slate-400 text-center py-3">No other customers found.</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive (soft delete) confirmation — orders & history are preserved */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700"><AlertTriangle className="h-5 w-5" /> Archive Customer?</DialogTitle>
            <DialogDescription className="text-slate-600">
              <span className="font-semibold text-slate-800">{deleteTarget?.name}</span> will be archived and hidden from search, New Order and the Customer App. <span className="font-semibold text-slate-700">Their orders, invoices, payments, subscription history and audit are kept.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button className="gap-1 bg-amber-600 hover:bg-amber-700 text-white" disabled={deleting} onClick={doDelete}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Archive Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
