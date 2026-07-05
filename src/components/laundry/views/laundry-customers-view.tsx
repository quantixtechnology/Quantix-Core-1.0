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

interface Row {
  id: string; name: string; phone: string | null; email: string | null; customerCode: string | null
  loyaltyTier: string; walletBalance: number; totalOrders: number; totalSpent: number
  status: string; isActive: boolean; lastOrderAt: string | null
}
interface Detail extends Row { addresses: { id: string; addressLine1: string; addressLine2: string | null; area: string | null; landmark: string | null; city: string; state: string; pincode: string; country: string }[]; fullAddress?: string }

const PAGE = 10
const inr = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`
const tierStyle = (t: string) => ({ GOLD: "border-amber-300 text-amber-700 bg-amber-50", PLATINUM: "border-violet-300 text-violet-700 bg-violet-50", SILVER: "border-slate-300 text-slate-600 bg-slate-50" }[(t || "").toUpperCase()] || "border-orange-300 text-orange-700 bg-orange-50")
const initials = (n: string) => n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()

export function LaundryCustomersView() {
  const { currentBusinessId, user } = useAuthStore()
  const isSuperAdmin = user?.role === "QUANTIX_SUPER_ADMIN"
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
  const [form, setForm] = useState<Record<string, string>>({})
  const [savingEdit, setSavingEdit] = useState(false)

  // Super-admin permanent delete
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleting, setDeleting] = useState(false)

  const doDelete = async () => {
    if (!deleteTarget || deleteConfirm !== "DELETE") return
    setDeleting(true)
    try {
      const res = await fetch(`/api/core/admin/customers/${deleteTarget.id}?businessId=${currentBusinessId}`, { method: "DELETE", headers: getAuthHeaders() })
      const json = await res.json()
      if (!res.ok || !json.success) { toast({ title: "Delete failed", description: json.error, variant: "destructive" }); return }
      const n = json.data?.deletedCounts || {}
      toast({ title: "Customer deleted", description: `${deleteTarget.name} and all related data removed (${n.laundryOrders || 0} orders, ${n.addresses || 0} addresses, ${n.customerSubscriptions || 0} subscriptions).` })
      setDeleteTarget(null); setDeleteConfirm(""); load()
    } catch { toast({ title: "Delete failed", variant: "destructive" }) } finally { setDeleting(false) }
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
    setOpenId(id); setEditing(edit); setDetail(null); setLoadingDetail(true)
    try {
      const json = await fetch(`/api/laundry/customers/${id}?businessId=${currentBusinessId}`).then((r) => r.json())
      if (json.success) {
        const d = json.data as Detail; setDetail(d)
        const a = d.addresses?.[0]
        setForm({ name: d.name, mobile: d.phone || "", email: d.email || "", addressLine1: a?.addressLine1 || "", addressLine2: a?.addressLine2 || "", area: a?.area || "", landmark: a?.landmark || "", city: a?.city || "", state: a?.state || "", pincode: a?.pincode || "" })
      }
    } catch { /* noop */ } finally { setLoadingDetail(false) }
  }
  const closeDialog = () => { setOpenId(null); setDetail(null); setEditing(false) }

  const saveEdit = async () => {
    if (!detail) return
    if (form.pincode && !isValidPincode(form.pincode)) { toast({ title: "Invalid PIN Code", variant: "destructive" }); return }
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/laundry/customers/${detail.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, ...form }) })
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
                        {isSuperAdmin && <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-600" title="Delete permanently (Super Admin)" onClick={() => { setDeleteTarget(c); setDeleteConfirm("") }}><Trash2 className="h-4 w-4" /></Button>}
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
                <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
              </div>
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
              <div className="flex items-center gap-3"><Avatar className="h-12 w-12"><AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">{initials(detail.name)}</AvatarFallback></Avatar><div><p className="font-semibold text-slate-800">{detail.name}</p><Badge variant="outline" className={`text-[11px] mt-0.5 ${tierStyle(detail.loyaltyTier)}`}>{detail.loyaltyTier || "Bronze"}</Badge></div></div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-slate-400 flex items-center gap-1"><Phone className="h-3 w-3" /> Mobile</p><p className="text-slate-700">{detail.phone || "—"}</p></div>
                <div><p className="text-xs text-slate-400 flex items-center gap-1"><Mail className="h-3 w-3" /> Email</p><p className="text-slate-700">{detail.email || "—"}</p></div>
                <div><p className="text-xs text-slate-400 flex items-center gap-1"><Wallet className="h-3 w-3" /> Wallet</p><p className="text-slate-700">{inr(detail.walletBalance)}</p></div>
                <div><p className="text-xs text-slate-400 flex items-center gap-1"><Repeat className="h-3 w-3" /> Orders</p><p className="text-slate-700">{detail.totalOrders} · LTV {inr(detail.totalSpent)}</p></div>
              </div>
              {detail.addresses?.[0] && <div><p className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="h-3 w-3" /> Address</p><p className="text-slate-700 whitespace-pre-line leading-snug">{formatAddressLines(detail.addresses[0]).join("\n")}</p></div>}
            </div>
          )}
          <DialogFooter>
            {editing ? (
              <><Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button><Button onClick={saveEdit} disabled={savingEdit} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">{savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</Button></>
            ) : (
              <><Button variant="outline" className="gap-1" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button><Button className="gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setLaundryPage("new-order")}><Plus className="h-4 w-4" /> New Order</Button></>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Super-admin permanent delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteConfirm("") } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700"><AlertTriangle className="h-5 w-5" /> Delete Customer Permanently?</DialogTitle>
            <DialogDescription className="text-slate-600">
              This will permanently delete <span className="font-semibold text-slate-800">{deleteTarget?.name}</span> and all related orders, addresses, subscriptions, payments and operational history. <span className="font-semibold text-rose-600">This action cannot be undone.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">Type <span className="font-mono font-bold">DELETE</span> to confirm</Label>
            <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteConfirm("") }}>Cancel</Button>
            <Button className="gap-1 bg-rose-600 hover:bg-rose-700 text-white" disabled={deleteConfirm !== "DELETE" || deleting} onClick={doDelete}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete Customer &amp; All Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
