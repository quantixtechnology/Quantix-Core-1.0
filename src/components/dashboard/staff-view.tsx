"use client"

import { useState, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Users, Plus, Search, RefreshCw, KeyRound, ShieldOff, ShieldCheck,
  Copy, Check, AlertTriangle, UserCog,
} from "lucide-react"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { ROLE_LABELS, PERMISSION_GROUPS, PERMISSION_LABELS, type Permission } from "@/lib/permissions"
import { useAdminStore } from "@/stores/admin-store"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// ─── Types ───────────────────────────────────────────────────────────────────

interface StaffMember {
  businessUserId: string
  userId: string
  name: string
  email: string
  phone: string | null
  avatar: string | null
  role: string
  isActive: boolean
  permissions: string[]
  joinedAt: string | null
  acceptedAt: string | null
  lastLoginAt: string | null
  createdAt: string
}

const ASSIGNABLE_ROLES = [
  "STORE_MANAGER",
  "BILLING_STAFF",
  "INVENTORY_STAFF",
  "SUPPORT_STAFF",
  "DELIVERY_STAFF",
] as const

const roleColors: Record<string, string> = {
  CLIENT_OWNER:    "bg-emerald-100 text-emerald-700",
  STORE_MANAGER:   "bg-teal-100 text-teal-700",
  BILLING_STAFF:   "bg-amber-100 text-amber-700",
  INVENTORY_STAFF: "bg-orange-100 text-orange-700",
  SUPPORT_STAFF:   "bg-sky-100 text-sky-700",
  DELIVERY_STAFF:  "bg-gray-100 text-gray-700",
}

// ─── Credential box ───────────────────────────────────────────────────────────

function CredentialBox({ email, password }: { email: string; password: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm space-y-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-emerald-700">Login Credentials</span>
        <button onClick={copy} className="text-emerald-600 hover:text-emerald-800">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <div className="font-mono text-emerald-900 text-xs">{email}</div>
      <div className="font-mono text-emerald-900 text-xs">{password}</div>
    </div>
  )
}

// ─── Permission Editor ────────────────────────────────────────────────────────

const BUSINESS_PERM_GROUPS = PERMISSION_GROUPS.filter(g =>
  !["Platform", "Users"].includes(g.label)
)

function PermissionEditor({
  current, onChange,
}: { current: string[]; onChange: (p: string[]) => void }) {
  const toggle = (perm: string) =>
    onChange(current.includes(perm) ? current.filter(p => p !== perm) : [...current, perm])

  return (
    <div className="space-y-4">
      {BUSINESS_PERM_GROUPS.map(group => (
        <div key={group.label}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {group.label}
          </p>
          <div className="grid grid-cols-1 gap-2">
            {group.permissions.map(perm => (
              <div key={perm} className="flex items-center justify-between py-0.5">
                <span className="text-sm">{PERMISSION_LABELS[perm as Permission] ?? perm}</span>
                <Switch
                  checked={current.includes(perm)}
                  onCheckedChange={() => toggle(perm)}
                  className="scale-90"
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Add Staff Dialog ─────────────────────────────────────────────────────────

function AddStaffDialog({
  businessId,
  onCreated,
}: { businessId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "", password: "" })
  const [loading, setLoading] = useState(false)
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null)

  const submit = async () => {
    if (!form.name || !form.email || !form.role) {
      toast.error("Name, email, and role are required")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/core/businesses/${businessId}/staff`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          role: form.role,
          password: form.password || undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setCreds(json.credentials)
      toast.success("Staff member added")
      onCreated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setCreds(null)
    setForm({ name: "", email: "", phone: "", role: "", password: "" })
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 mr-1.5" /> Add Staff
      </Button>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription>Credentials are admin-assigned. No self-signup.</DialogDescription>
          </DialogHeader>

          {creds ? (
            <div className="space-y-4">
              <CredentialBox email={creds.email} password={creds.password} />
              <p className="text-xs text-muted-foreground">Share these credentials with the staff member securely.</p>
              <DialogFooter>
                <Button onClick={handleClose}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Suresh Kumar" />
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="suresh@example.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Role *</Label>
                  <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map(r => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r] ?? r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Password <span className="text-muted-foreground text-xs">(leave blank to auto-generate)</span></Label>
                <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Auto-generated if blank" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button onClick={submit} disabled={loading}>
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
                  Add Staff
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Staff Detail Sheet ───────────────────────────────────────────────────────

function StaffDetailSheet({
  member,
  businessId,
  onClose,
  onRefresh,
}: {
  member: StaffMember | null
  businessId: string
  onClose: () => void
  onRefresh: () => void
}) {
  const qc = useQueryClient()
  const [resetCreds, setResetCreds] = useState<{ email: string; password: string } | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [editPerms, setEditPerms] = useState<string[] | null>(null)

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!member) return null
      const res = await fetch(`/api/core/users/${member.userId}/reset-password`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: newPassword || undefined }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json as { credentials: { email: string; password: string } }
    },
    onSuccess: (data) => {
      if (data) setResetCreds(data.credentials)
      setNewPassword("")
      toast.success("Password reset")
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Reset failed"),
  })

  const toggleMutation = useMutation({
    mutationFn: async (active: boolean) => {
      if (!member) return
      const res = await fetch(`/api/core/users/${member.userId}/toggle-status`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
    },
    onSuccess: (_data, active) => {
      toast.success(active ? "Staff member activated" : "Staff member suspended")
      qc.invalidateQueries({ queryKey: ["business-staff"] })
      onRefresh()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })

  const savePermsMutation = useMutation({
    mutationFn: async () => {
      if (!member || !editPerms) return
      const res = await fetch(`/api/core/users/${member.userId}`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: editPerms, businessId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
    },
    onSuccess: () => {
      toast.success("Permissions saved")
      setEditPerms(null)
      qc.invalidateQueries({ queryKey: ["business-staff"] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })

  if (!member) return null

  return (
    <Sheet open={!!member} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Staff Details</SheetTitle>
          <SheetDescription>Manage access, password, and permissions</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-5">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {member.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold">{member.name}</p>
                <p className="text-sm text-muted-foreground">{member.email}</p>
                {member.phone && <p className="text-xs text-muted-foreground">{member.phone}</p>}
              </div>
              <Badge className={`text-[10px] border-0 ${roleColors[member.role] ?? "bg-gray-100 text-gray-700"}`}>
                {ROLE_LABELS[member.role] ?? member.role}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-y-1.5 text-sm">
              <span className="text-muted-foreground">Status</span>
              <Badge className={`w-fit text-[10px] border-0 ${member.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                {member.isActive ? "Active" : "Suspended"}
              </Badge>
              <span className="text-muted-foreground">Last Login</span>
              <span className="font-medium">
                {member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleDateString("en-IN") : "Never"}
              </span>
              <span className="text-muted-foreground">Joined</span>
              <span className="font-medium">{new Date(member.createdAt).toLocaleDateString("en-IN")}</span>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-sm font-semibold">Account Status</p>
              {member.isActive ? (
                <Button
                  variant="outline" size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => toggleMutation.mutate(false)}
                  disabled={toggleMutation.isPending}
                >
                  <ShieldOff className="w-4 h-4 mr-1.5" /> Suspend
                </Button>
              ) : (
                <Button
                  variant="outline" size="sm"
                  className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                  onClick={() => toggleMutation.mutate(true)}
                  disabled={toggleMutation.isPending}
                >
                  <ShieldCheck className="w-4 h-4 mr-1.5" /> Activate
                </Button>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-sm font-semibold">Reset Password</p>
              <p className="text-xs text-muted-foreground">Only you (Business Owner) can reset staff passwords.</p>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="New password (blank = auto)"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="text-sm"
                />
                <Button size="sm" variant="outline" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
                  <KeyRound className="w-4 h-4" />
                </Button>
              </div>
              {resetCreds && <CredentialBox email={resetCreds.email} password={resetCreds.password} />}
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Permissions</p>
                {editPerms === null ? (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditPerms([...member.permissions])}>
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-7 text-xs" onClick={() => savePermsMutation.mutate()} disabled={savePermsMutation.isPending}>
                      Save
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditPerms(null)}>Cancel</Button>
                  </div>
                )}
              </div>

              {editPerms !== null ? (
                <PermissionEditor current={editPerms} onChange={setEditPerms} />
              ) : member.permissions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {member.permissions.map(p => (
                    <Badge key={p} variant="secondary" className="text-[10px]">
                      {PERMISSION_LABELS[p as Permission] ?? p}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No custom permissions — using role defaults.</p>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function StaffView() {
  const { currentBusinessId } = useAdminStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("ALL")
  const [selectedMember, setSelectedMember] = useState<StaffMember | null>(null)

  const { data: staff = [], isLoading, refetch } = useQuery({
    queryKey: ["business-staff", currentBusinessId, roleFilter],
    queryFn: async () => {
      if (!currentBusinessId) return []
      const p = new URLSearchParams({ limit: "100" })
      if (roleFilter !== "ALL") p.set("role", roleFilter)
      const res = await fetch(`/api/core/businesses/${currentBusinessId}/staff?${p}`, {
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data as StaffMember[]
    },
    enabled: !!currentBusinessId,
    staleTime: 30_000,
  })

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["business-staff"] })
    refetch()
  }, [qc, refetch])

  const filtered = useMemo(() => {
    if (!search) return staff
    const q = search.toLowerCase()
    return staff.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.phone ?? "").includes(q)
    )
  }, [staff, search])

  const stats = useMemo(() => ({
    total: staff.length,
    active: staff.filter(s => s.isActive).length,
    roles: new Set(staff.map(s => s.role)).size,
  }), [staff])

  if (!currentBusinessId) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center">
        <UserCog className="w-10 h-10 text-muted-foreground/40 mb-3" />
        <p className="font-medium text-muted-foreground">No business selected</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
            <UserCog className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Staff Management</h1>
            <p className="text-xs text-muted-foreground">Manage your team — credentials are admin-assigned</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <AddStaffDialog businessId={currentBusinessId} onCreated={refresh} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-0 border-b">
        {[
          { label: "Total Staff", value: stats.total, color: "text-foreground" },
          { label: "Active",      value: stats.active, color: "text-emerald-600" },
          { label: "Roles",       value: stats.roles,  color: "text-blue-600" },
        ].map((s) => (
          <div key={s.label} className="px-6 py-3 border-r last:border-r-0">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 px-6 py-3 border-b">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 h-8 text-sm" placeholder="Search staff…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder="All roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            {ASSIGNABLE_ROLES.map(r => (
              <SelectItem key={r} value={r}>{ROLE_LABELS[r] ?? r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 px-6 py-2 bg-amber-50 border-b border-amber-100">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <p className="text-xs text-amber-700">
          Staff cannot self-register or reset their own passwords. All access is controlled by you.
        </p>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="px-6 py-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 border rounded-xl">
                <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-muted-foreground">No staff members found</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Add your first staff member to get started</p>
          </div>
        ) : (
          <div className="px-6 py-4 space-y-2">
            {filtered.map((member) => (
              <button
                key={member.businessUserId}
                onClick={() => setSelectedMember(member)}
                className="w-full flex items-center gap-4 p-4 border rounded-xl text-left hover:border-primary/30 hover:bg-muted/40 transition-colors"
              >
                <Avatar className="w-10 h-10 shrink-0">
                  <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">
                    {member.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight">{member.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  {member.phone && <p className="text-xs text-muted-foreground">{member.phone}</p>}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <Badge className={`text-[10px] border-0 ${roleColors[member.role] ?? "bg-gray-100 text-gray-700"}`}>
                    {ROLE_LABELS[member.role] ?? member.role}
                  </Badge>
                  <Badge className={`text-[10px] border-0 ${member.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    {member.isActive ? "Active" : "Suspended"}
                  </Badge>
                </div>
                <div className="text-muted-foreground text-xs text-right shrink-0 min-w-[80px]">
                  <p className="text-[10px]">Last login</p>
                  <p>{member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleDateString("en-IN") : "Never"}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <StaffDetailSheet
        member={selectedMember}
        businessId={currentBusinessId}
        onClose={() => setSelectedMember(null)}
        onRefresh={refresh}
      />
    </div>
  )
}
