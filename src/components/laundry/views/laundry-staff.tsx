"use client"

// Staff (Business Management → Staff). The Business Owner creates and manages
// employees: role, store, status, password. Role/store come from Laundry RBAC
// and take effect immediately. All data via /api/laundry/staff + /rbac/roles.

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useToast } from "@/hooks/use-toast"
import { useLaundryPermissions, refreshLaundryPermissions } from "@/hooks/use-laundry-permissions"
import { clearRuntimeAuthCache } from "@/components/auth/runtime-auth-provider"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Loader2, UsersRound, Plus, Search, Pencil, KeyRound, Power, Shield, Lock, Copy, Trash2, AlertTriangle } from "lucide-react"

interface Emp {
  userId: string; businessUserId: string; employeeCode: string | null; loginId: string; email: string | null; name: string; phone: string | null
  active: boolean; lastLoginAt: string | null; roleId: string | null; roleCode: string | null
  roleName: string | null; isOwner: boolean; storeId: string | null; storeName: string | null
}
interface RoleOpt { id: string; name: string; isOwner: boolean; isActive: boolean }
interface StoreOpt { id: string; storeName: string }

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Never"

export function LaundryStaff({ businessId: bizProp }: { businessId?: string }) {
  const { currentBusinessId } = useAuthStore()
  const businessId = bizProp || currentBusinessId
  const { toast } = useToast()
  const { can, isPlatformSuperAdmin } = useLaundryPermissions()

  const [emps, setEmps] = useState<Emp[]>([])
  const [roles, setRoles] = useState<RoleOpt[]>([])
  const [stores, setStores] = useState<StoreOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")

  // Dialog state
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Emp | null>(null)
  const [fName, setFName] = useState(""); const [fEmail, setFEmail] = useState(""); const [fPhone, setFPhone] = useState("")
  const [fPassword, setFPassword] = useState(""); const [fRoleId, setFRoleId] = useState(""); const [fStoreId, setFStoreId] = useState("")
  const [saving, setSaving] = useState(false)
  const [creds, setCreds] = useState<{ loginId: string; tempPassword: string; mustChange: boolean } | null>(null)
  // Deletion is a Quantix Super Admin action, confirmed before it runs.
  const [deleting, setDeleting] = useState<Emp | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const [s, r] = await Promise.all([
        fetch(`/api/laundry/staff?businessId=${businessId}`).then((x) => x.json()),
        fetch(`/api/laundry/rbac/roles?businessId=${businessId}`).then((x) => x.json()),
      ])
      if (s.success) { setEmps(s.data); setStores(s.stores || []) }
      if (r.success) setRoles((r.data as RoleOpt[]).filter((x) => x.isActive))
    } catch { /* noop */ } finally { setLoading(false) }
  }, [businessId])
  useEffect(() => { load() }, [load])

  const canManage = can("laundry.staff.create") || can("laundry.staff.edit") || can("laundry.staff.assign_role")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return emps.filter((e) => {
      if (q && !(`${e.name} ${e.email} ${e.phone || ""}`.toLowerCase().includes(q))) return false
      if (roleFilter !== "ALL" && e.roleId !== roleFilter) return false
      if (statusFilter === "ACTIVE" && !e.active) return false
      if (statusFilter === "INACTIVE" && e.active) return false
      return true
    })
  }, [emps, search, roleFilter, statusFilter])

  const openCreate = () => {
    setEditing(null); setFName(""); setFEmail(""); setFPhone(""); setFPassword("")
    setFRoleId(roles.find((r) => !r.isOwner)?.id || ""); setFStoreId(""); setFormOpen(true)
  }
  const openEdit = (e: Emp) => {
    setEditing(e); setFName(e.name); setFEmail(e.email || ""); setFPhone(e.phone || ""); setFPassword("")
    setFRoleId(e.roleId || ""); setFStoreId(e.storeId || ""); setFormOpen(true)
  }

  const submit = async () => {
    if (!fName.trim()) { toast({ title: "Name is required", variant: "destructive" }); return }
    // Email is optional — staff sign in with their Employee ID. Only its shape
    // is checked, and only when one was actually typed.
    if (!editing && fEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fEmail.trim())) { toast({ title: "That email address is not valid", variant: "destructive" }); return }
    setSaving(true)
    try {
      if (editing) {
        const res = await fetch(`/api/laundry/staff/${editing.userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, name: fName.trim(), phone: fPhone.trim() || null, roleId: fRoleId || undefined, storeId: fStoreId || null }) })
        const j = await res.json()
        if (!res.ok || !j.success) throw new Error(j.error || "Update failed")
        toast({ title: "Employee updated" }); setFormOpen(false); refreshLaundryPermissions(businessId); if (businessId) clearRuntimeAuthCache(businessId); load()
      } else {
        const res = await fetch(`/api/laundry/staff`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, name: fName.trim(), email: fEmail.trim() || undefined, phone: fPhone.trim() || null, password: fPassword.trim() || undefined, roleId: fRoleId || undefined, storeId: fStoreId || null }) })
        const j = await res.json()
        if (!res.ok || !j.success) throw new Error(j.error || "Create failed")
        setFormOpen(false); setCreds({ loginId: j.data.loginId || j.data.email, tempPassword: j.data.tempPassword, mustChange: !!j.data.mustChangePassword }); if (businessId) clearRuntimeAuthCache(businessId); load()
      }
    } catch (e) { toast({ title: "Save failed", description: e instanceof Error ? e.message : "", variant: "destructive", duration: 10000 }) } finally { setSaving(false) }
  }

  const toggleActive = async (e: Emp) => {
    const res = await fetch(`/api/laundry/staff/${e.userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, active: !e.active }) })
    const j = await res.json()
    if (!res.ok || !j.success) { toast({ title: "Failed", description: j.error, variant: "destructive" }); return }
    toast({ title: e.active ? "Employee deactivated" : "Employee activated" }); if (businessId) clearRuntimeAuthCache(businessId); load()
  }

  const resetPassword = async (e: Emp) => {
    const res = await fetch(`/api/laundry/staff/${e.userId}/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId }) })
    const j = await res.json()
    if (!res.ok || !j.success) { toast({ title: "Reset failed", description: j.error, variant: "destructive" }); return }
    setCreds({ loginId: e.loginId || e.email || "", tempPassword: j.data.tempPassword, mustChange: true })
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeletingBusy(true)
    try {
      const res = await fetch(`/api/laundry/staff/${deleting.userId}?businessId=${encodeURIComponent(businessId || "")}`, { method: "DELETE" })
      const j = await res.json().catch(() => ({}))
      // On failure the list is left exactly as it was — the row is still there.
      if (!res.ok || !j.success) { toast({ title: "Delete failed", description: j.error || "Could not delete user", variant: "destructive" }); return }
      toast({ title: "User deleted successfully." })
      setDeleting(null)
      if (businessId) clearRuntimeAuthCache(businessId)
      load()
    } catch {
      toast({ title: "Delete failed", description: "Network error — nothing was changed.", variant: "destructive" })
    } finally { setDeletingBusy(false) }
  }

  const copyCreds = () => { if (creds) navigator.clipboard?.writeText(`${creds.loginId} / ${creds.tempPassword}`).then(() => toast({ title: "Copied" })).catch(() => {}) }

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>

  return (
    <div className="px-4 lg:px-6 py-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div><h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><UsersRound className="h-5 w-5 text-blue-600" /> Staff</h1><p className="text-sm text-slate-500">Manage employees, their role, store and access.</p></div>
        {can("laundry.staff.create") && <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={openCreate}><Plus className="h-4 w-4" /> Create Employee</Button>}
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone…" className="pl-8 h-9 text-sm" /></div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white text-sm px-2"><option value="ALL">All roles</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white text-sm px-2"><option value="ALL">All status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
      </div>

      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-200">
            <th className="text-left font-semibold px-4 py-2.5">Employee</th>
            <th className="text-left font-semibold px-4 py-2.5">Employee ID</th>
            <th className="text-left font-semibold px-4 py-2.5">Role</th>
            <th className="text-left font-semibold px-4 py-2.5">Store</th>
            <th className="text-left font-semibold px-4 py-2.5">Status</th>
            <th className="text-left font-semibold px-4 py-2.5">Last Login</th>
            <th className="text-right font-semibold px-4 py-2.5">Actions</th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-slate-400">No employees found.</td></tr>}
            {filtered.map((e) => (
              <tr key={e.userId} className={`border-b border-slate-100 last:border-0 ${e.active ? "" : "opacity-60"}`}>
                <td className="px-4 py-2.5"><div className="font-medium text-slate-800 flex items-center gap-1.5">{e.isOwner && <Lock className="h-3 w-3 text-amber-500" />}{e.name}</div><div className="text-[11px] text-slate-400">{e.email || e.loginId}</div></td>
                {/* The Business Owner is the business, not an employee of it —
                    no number is consumed for them. */}
                <td className="px-4 py-2.5">
                  {e.employeeCode
                    ? <span className="font-mono text-xs text-slate-700">{e.employeeCode}</span>
                    : <span className="text-[11px] text-slate-400">{e.isOwner ? "Not required" : "—"}</span>}
                </td>
                <td className="px-4 py-2.5">{e.roleName ? <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-600 gap-1"><Shield className="h-3 w-3" />{e.roleName}</Badge> : <span className="text-slate-300 text-xs">—</span>}</td>
                <td className="px-4 py-2.5 text-slate-600">{e.storeName || <span className="text-slate-300">All stores</span>}</td>
                <td className="px-4 py-2.5">{e.active ? <span className="text-[11px] font-medium text-emerald-600">● Active</span> : <span className="text-[11px] font-medium text-slate-400">● Inactive</span>}</td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">{fmtDate(e.lastLoginAt)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    {can("laundry.staff.edit") && <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit" onClick={() => openEdit(e)}><Pencil className="h-3.5 w-3.5 text-slate-500" /></Button>}
                    {can("laundry.staff.edit") && <Button size="icon" variant="ghost" className="h-7 w-7" title="Reset password" onClick={() => resetPassword(e)}><KeyRound className="h-3.5 w-3.5 text-slate-500" /></Button>}
                    {can("laundry.staff.edit") && !e.isOwner && <Button size="icon" variant="ghost" className="h-7 w-7" title={e.active ? "Deactivate" : "Activate"} onClick={() => toggleActive(e)}><Power className={`h-3.5 w-3.5 ${e.active ? "text-rose-500" : "text-emerald-500"}`} /></Button>}
                    {/* Quantix Super Admin only, and never for the owner — the
                        server refuses both regardless of what is rendered. */}
                    {isPlatformSuperAdmin && (
                      e.isOwner ? (
                        <Button size="icon" variant="ghost" className="h-7 w-7 cursor-not-allowed" disabled
                          title="Business Owner cannot be deleted. Transfer ownership first."><Trash2 className="h-3.5 w-3.5 text-slate-300" /></Button>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Delete user" onClick={() => setDeleting(e)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>

      {!canManage && <p className="text-xs text-slate-400 mt-3">You have read-only access to Staff.</p>}

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-blue-600" /> {editing ? "Edit Employee" : "Create Employee"}</DialogTitle>
            <DialogDescription>{editing ? "Update details, role and store." : "The employee signs in with their Employee ID. Set a password, or leave it blank for a temporary one."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs text-slate-600">Full name</Label><Input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Jane Doe" /></div>
              <div className="space-y-1"><Label className="text-xs text-slate-600">Phone</Label><Input value={fPhone} onChange={(e) => setFPhone(e.target.value)} placeholder="Optional" /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs text-slate-600">Email <span className="text-slate-400">(optional)</span></Label><Input value={fEmail} onChange={(e) => setFEmail(e.target.value)} placeholder="Optional — for contact only" disabled={!!editing} />{!editing && <p className="text-[11px] text-slate-400">Contact only. The employee signs in with their Employee ID, not this.</p>}</div>
            {/* Issued by the platform from this business's Business Code. Read
                only: an administrator must never be able to type a tenant
                prefix, and must never have to maintain the sequence. */}
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Employee ID</Label>
              <Input
                value={editing?.isOwner ? "" : editing?.employeeCode || ""}
                readOnly disabled
                placeholder={editing?.isOwner ? "Not required for the Business Owner" : "Generated automatically on save"}
                className="bg-slate-50 font-mono text-sm"
              />
              <p className="text-[11px] text-slate-400">
                {editing?.isOwner
                  ? "The Business Owner does not need an employee ID."
                  : "This is also the User ID the employee signs in with. Generated from your business initial and Business Code — permanent, and never reused."}
              </p>
            </div>
            {!editing && <div className="space-y-1"><Label className="text-xs text-slate-600">Password <span className="text-slate-400">(optional)</span></Label><Input value={fPassword} onChange={(e) => setFPassword(e.target.value)} placeholder="Leave blank to auto-generate" /><p className="text-[11px] text-slate-400">{fPassword.trim() ? "This exact password is set. The employee is not asked to change it." : "A temporary password is generated and must be changed at first login."}</p></div>}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Role</Label>
                <select value={fRoleId} onChange={(e) => setFRoleId(e.target.value)} disabled={editing?.isOwner} className="w-full h-9 rounded-md border border-slate-200 bg-white text-sm px-2">
                  <option value="">— No role —</option>
                  {roles.map((r) => <option key={r.id} value={r.id} disabled={r.isOwner && !editing?.isOwner}>{r.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Store</Label>
                <select value={fStoreId} onChange={(e) => setFStoreId(e.target.value)} className="w-full h-9 rounded-md border border-slate-200 bg-white text-sm px-2">
                  <option value="">All stores</option>
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.storeName}</option>)}
                </select>
              </div>
            </div>
            {editing?.isOwner && <p className="text-[11px] text-amber-600 flex items-center gap-1"><Lock className="h-3 w-3" /> The Business Owner always keeps full access — role cannot be changed here.</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="button" onClick={submit} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white gap-1">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation — destructive, and explicit about what survives. */}
      <Dialog open={!!deleting} onOpenChange={(o) => { if (!o && !deletingBusy) setDeleting(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-rose-600" /> Delete Staff Member?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="font-semibold text-slate-800">{deleting?.name}</p>
              <p className="text-xs text-slate-500">{deleting?.email}</p>
            </div>
            <p className="text-sm text-slate-600 leading-snug">
              This will permanently remove this user&apos;s access to the business. Their historical orders, garment records,
              processing history and other business records will remain intact.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)} disabled={deletingBusy}>Cancel</Button>
            <Button type="button" onClick={confirmDelete} disabled={deletingBusy} className="bg-rose-600 hover:bg-rose-700 text-white gap-1">
              {deletingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials reveal (create / reset) */}
      <Dialog open={!!creds} onOpenChange={(o) => { if (!o) setCreds(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-emerald-600" /> Login Credentials</DialogTitle>
            <DialogDescription>Share these with the employee.{creds?.mustChange ? " They must change the password on first login." : " This is the password you set — no change is required."}</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">User ID</span><span className="font-mono font-semibold text-slate-800">{creds?.loginId}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Password</span><span className="font-mono font-semibold text-slate-800">{creds?.tempPassword}</span></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="gap-1" onClick={copyCreds}><Copy className="h-3.5 w-3.5" /> Copy</Button>
            <Button type="button" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setCreds(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
