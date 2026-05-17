"use client"

import { useState, useMemo, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Users, Plus, Search, RefreshCw, KeyRound, ShieldOff, ShieldCheck,
  Eye, Copy, Check, AlertTriangle, ChevronRight, MoreVertical,
  Shuffle, LogIn, X, Shield, ExternalLink, Info,
} from "lucide-react"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/admin-fetch"
import {
  ROLE_LABELS, PERMISSION_GROUPS, PERMISSION_LABELS, type Permission,
} from "@/lib/permissions"
import { useAdminStore } from "@/stores/admin-store"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlatformUser {
  id: string; name: string; email: string; phone: string | null
  avatar: string | null; role: string | null; businessId: string | null
  businessName: string | null; businessType: string | null
  isActive: boolean; createdAt: string; lastLoginAt: string | null
}

interface UserDetail extends PlatformUser {
  authProvider: string; emailVerified: boolean
  platformPermissions: string | null
  platformRole: string | null
  businessUsers: Array<{
    id: string; role: string; businessId: string; isActive: boolean; permissions: string
    business: { id: string; name: string; slug: string; businessType: string; status: string }
  }>
}

interface RolePermsData {
  role: string; permissions: string[]; isCustomized: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { key: "ALL",        label: "All Staff",   scope: "PLATFORM", role: undefined },
  { key: "ADMIN",      label: "Admins",      scope: "PLATFORM", role: "QUANTIX_SUPER_ADMIN" },
  { key: "SALES",      label: "Sales",       scope: "PLATFORM", role: "QUANTIX_SALES_TEAM" },
  { key: "SUPPORT",    label: "Support",     scope: "PLATFORM", role: "SUPPORT_TEAM" },
  { key: "DEPLOYMENT", label: "Deployment",  scope: "PLATFORM", role: "DEPLOYMENT_TEAM" },
  { key: "FINANCE",    label: "Finance",     scope: "PLATFORM", role: "FINANCE_TEAM" },
] as const
type TabKey = typeof TABS[number]["key"]

const PLATFORM_ROLES = [
  "QUANTIX_SUPER_ADMIN",
  "PLATFORM_ADMIN",
  "QUANTIX_SALES_TEAM",
  "SUPPORT_TEAM",
  "DEPLOYMENT_TEAM",
  "FINANCE_TEAM",
]

const roleColors: Record<string, string> = {
  QUANTIX_SUPER_ADMIN: "bg-red-100 text-red-700",
  PLATFORM_ADMIN:      "bg-purple-100 text-purple-700",
  QUANTIX_SALES_TEAM:  "bg-blue-100 text-blue-700",
  SUPPORT_TEAM:        "bg-sky-100 text-sky-700",
  DEPLOYMENT_TEAM:     "bg-indigo-100 text-indigo-700",
  FINANCE_TEAM:        "bg-emerald-100 text-emerald-700",
  CLIENT_OWNER:        "bg-teal-100 text-teal-700",
  STORE_MANAGER:       "bg-cyan-100 text-cyan-700",
  BILLING_STAFF:       "bg-amber-100 text-amber-700",
  INVENTORY_STAFF:     "bg-orange-100 text-orange-700",
  SUPPORT_STAFF:       "bg-pink-100 text-pink-700",
  DELIVERY_STAFF:      "bg-gray-100 text-gray-700",
  CUSTOMER:            "bg-slate-100 text-slate-600",
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchUsers(scope: string, search: string, role?: string): Promise<PlatformUser[]> {
  const p = new URLSearchParams({ scope, limit: "100" })
  if (search) p.set("search", search)
  if (role)   p.set("role", role)
  const res = await fetch(`/api/core/users?${p}`, { headers: getAuthHeaders() })
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return json.data as PlatformUser[]
}

async function fetchUserDetail(userId: string): Promise<UserDetail> {
  const res = await fetch(`/api/core/users/${userId}`, { headers: getAuthHeaders() })
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return json.data as UserDetail
}

// ─── Shared Utilities ─────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return "Never"
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
}

// ─── Credential Box ───────────────────────────────────────────────────────────

function CredentialBox({ email, password, onDismiss }: { email: string; password: string; onDismiss?: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">Login Credentials</span>
        <div className="flex items-center gap-1">
          <button onClick={copy} className="text-emerald-600 hover:text-emerald-800 p-0.5">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
          {onDismiss && (
            <button onClick={onDismiss} className="text-emerald-500 hover:text-emerald-700 p-0.5">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      <div className="font-mono text-[11px] text-emerald-900">{email}</div>
      <div className="font-mono text-[11px] text-emerald-900 mt-0.5">{password}</div>
    </div>
  )
}

// ─── Collapsible Section ──────────────────────────────────────────────────────

function AccordionSection({
  label, count, isOpen, onToggle, rightSlot, children,
}: {
  label: string; count?: number; isOpen: boolean; onToggle: () => void
  rightSlot?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/30 transition-colors group"
      >
        <div className="flex items-center gap-1.5">
          <ChevronRight
            className={`w-3 h-3 text-muted-foreground transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
          />
          <span className="text-xs font-semibold text-foreground">{label}</span>
          {count !== undefined && (
            <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-px leading-none">
              {count}
            </span>
          )}
        </div>
        {rightSlot && <div onClick={e => e.stopPropagation()}>{rightSlot}</div>}
      </button>
      {isOpen && <div className="animate-in fade-in-0 slide-in-from-top-1 duration-100">{children}</div>}
    </div>
  )
}

// ─── Permission Override Editor ───────────────────────────────────────────────
// Shows delta from role: what permissions are added / removed for this specific user.

function PermissionOverrideEditor({
  rolePerms,
  draftAdded,
  draftRemoved,
  onChangeAdded,
  onChangeRemoved,
}: {
  rolePerms: string[]
  draftAdded: string[]
  draftRemoved: string[]
  onChangeAdded: (p: string[]) => void
  onChangeRemoved: (p: string[]) => void
}) {
  const allPerms = PERMISSION_GROUPS.flatMap(g => g.permissions as string[])

  // Permissions NOT in role that can be added
  const addablePerms = allPerms.filter(p => !rolePerms.includes(p) && !draftAdded.includes(p))
  // Role permissions NOT already in removed list
  const removablePerms = rolePerms.filter(p => !draftRemoved.includes(p))

  return (
    <div className="px-4 pb-4 pt-2 space-y-4">
      <p className="text-[11px] text-muted-foreground">
        Overrides apply on top of the role. Role changes cascade automatically — overrides persist until cleared.
      </p>

      {/* Added overrides */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
            + Added ({draftAdded.length})
          </span>
          {addablePerms.length > 0 && (
            <Select onValueChange={v => { if (v) onChangeAdded([...draftAdded, v]) }}>
              <SelectTrigger className="h-5 px-2 text-[10px] w-auto gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                <SelectValue placeholder="+ Add permission" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {PERMISSION_GROUPS.map(g => {
                  const available = g.permissions.filter(p => addablePerms.includes(p))
                  if (available.length === 0) return null
                  return (
                    <div key={g.label}>
                      <p className="px-2 py-1 text-[9px] font-bold uppercase text-muted-foreground">{g.label}</p>
                      {available.map(p => (
                        <SelectItem key={p} value={p} className="text-xs">
                          {PERMISSION_LABELS[p as Permission] ?? p}
                        </SelectItem>
                      ))}
                    </div>
                  )
                })}
              </SelectContent>
            </Select>
          )}
        </div>
        {draftAdded.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">No permissions added beyond role.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {draftAdded.map(p => (
              <span key={p} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {PERMISSION_LABELS[p as Permission] ?? p}
                <button onClick={() => onChangeAdded(draftAdded.filter(x => x !== p))} className="hover:text-emerald-900 ml-0.5">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Removed overrides */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-red-700">
            − Removed ({draftRemoved.length})
          </span>
          {removablePerms.length > 0 && (
            <Select onValueChange={v => { if (v) onChangeRemoved([...draftRemoved, v]) }}>
              <SelectTrigger className="h-5 px-2 text-[10px] w-auto gap-1 border-red-200 text-red-700 hover:bg-red-50">
                <SelectValue placeholder="− Remove from role" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {PERMISSION_GROUPS.map(g => {
                  const available = g.permissions.filter(p => removablePerms.includes(p))
                  if (available.length === 0) return null
                  return (
                    <div key={g.label}>
                      <p className="px-2 py-1 text-[9px] font-bold uppercase text-muted-foreground">{g.label}</p>
                      {available.map(p => (
                        <SelectItem key={p} value={p} className="text-xs">
                          {PERMISSION_LABELS[p as Permission] ?? p}
                        </SelectItem>
                      ))}
                    </div>
                  )
                })}
              </SelectContent>
            </Select>
          )}
        </div>
        {draftRemoved.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">No permissions removed from role.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {draftRemoved.map(p => (
              <span key={p} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 line-through">
                {PERMISSION_LABELS[p as Permission] ?? p}
                <button onClick={() => onChangeRemoved(draftRemoved.filter(x => x !== p))} className="hover:text-red-900 ml-0.5 no-underline" style={{ textDecoration: "none" }}>
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Create User Dialog ───────────────────────────────────────────────────────

function CreateUserDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: "", email: "", phone: "", role: "", password: "",
    region: "Pan India", target: "", commissionPercent: "5",
    designation: "", reportingManager: "",
  })
  const [loading, setLoading] = useState(false)
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null)

  const isSales = form.role === "QUANTIX_SALES_TEAM"

  const submit = async () => {
    if (!form.name || !form.email || !form.role) {
      toast.error("Name, email, and role are required")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/core/users", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name:    form.name,
          email:   form.email,
          phone:   form.phone || undefined,
          role:    form.role,
          password: form.password || undefined,
          ...(isSales && {
            region:            form.region || "Pan India",
            target:            form.target ? Number(form.target) : 0,
            commissionPercent: Number(form.commissionPercent) || 5,
            designation:       form.designation || undefined,
            reportingManager:  form.reportingManager || undefined,
          }),
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setCreds(json.credentials)
      toast.success("User created successfully")
      onCreated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create user")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setOpen(false); setCreds(null)
    setForm({ name: "", email: "", phone: "", role: "", password: "", region: "Pan India", target: "", commissionPercent: "5", designation: "", reportingManager: "" })
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 mr-1.5" /> Create User
      </Button>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Platform User</DialogTitle>
            <DialogDescription>All credentials are admin-assigned. No self-signup.</DialogDescription>
          </DialogHeader>
          {creds ? (
            <div className="space-y-3">
              <CredentialBox email={creds.email} password={creds.password} onDismiss={handleClose} />
              <p className="text-xs text-muted-foreground">Share these credentials securely. Password will not be shown again.</p>
              <DialogFooter><Button onClick={handleClose}>Done</Button></DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Full Name *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Rahul Sharma" className="h-8" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Email *</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="rahul@quantixtechnology.in" className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91..." className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Role *</Label>
                  <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">Platform Team</p>
                      {PLATFORM_ROLES.map((r: string) => (
                        <SelectItem key={r} value={r} className="text-xs">{ROLE_LABELS[r] ?? r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Password <span className="text-muted-foreground">(blank = auto)</span></Label>
                  <Input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Auto-generated if blank" className="h-8 font-mono" />
                </div>
                {isSales && (
                  <>
                    <div className="col-span-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 mt-1 border-t pt-2">Sales Profile</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Region</Label>
                      <Select value={form.region} onValueChange={v => setForm(f => ({ ...f, region: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["North India","South India","East India","West India","Central India","Pan India"].map(r => (
                            <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Target (₹)</Label>
                      <Input type="number" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} placeholder="500000" className="h-8" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Designation</Label>
                      <Input value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} placeholder="Account Executive" className="h-8" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Commission %</Label>
                      <Input type="number" value={form.commissionPercent} onChange={e => setForm(f => ({ ...f, commissionPercent: e.target.value }))} className="h-8" />
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
                <Button size="sm" onClick={submit} disabled={loading}>
                  {loading ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                  Create User
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── User Detail Sheet ────────────────────────────────────────────────────────

function UserDetailSheet({
  userId, onClose, onRefresh,
}: {
  userId: string | null; onClose: () => void; onRefresh: () => void
}) {
  const qc = useQueryClient()
  const { setActivePage } = useAdminStore()
  const pwInputRef = useRef<HTMLInputElement>(null)

  const [resetCreds, setResetCreds] = useState<{ email: string; password: string } | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [editingOverrides, setEditingOverrides] = useState(false)
  const [draftAdded, setDraftAdded] = useState<string[]>([])
  const [draftRemoved, setDraftRemoved] = useState<string[]>([])
  const [showInherited, setShowInherited] = useState(false)
  const [changingRole, setChangingRole] = useState(false)
  const [newRole, setNewRole] = useState("")
  const [sections, setSections] = useState({
    passwordReset: false,
    roleAndPerms: true,
    businessAccess: true,
  })

  const toggle = (k: keyof typeof sections) => setSections(s => ({ ...s, [k]: !s[k] }))

  // ── Fetch user detail ──────────────────────────────────────────────────────
  const { data: user, isLoading } = useQuery({
    queryKey: ["user-detail", userId],
    queryFn: () => fetchUserDetail(userId!),
    enabled: !!userId,
  })

  // ── Fetch RBAC permissions for this user's role ───────────────────────────
  const { data: rbacData, isLoading: rbacLoading } = useQuery({
    queryKey: ["user-role-perms", user?.platformRole ?? user?.role],
    queryFn: async () => {
      const role = user!.platformRole ?? user!.role
      if (!role) return null
      const res = await fetch(`/api/admin/rbac/${role}`, { headers: getAuthHeaders() })
      const json = await res.json()
      return json.data as RolePermsData | null
    },
    enabled: !!(user?.platformRole ?? user?.role),
  })

  const rolePerms: string[] = rbacData?.permissions ?? []

  // ── Parse existing overrides from User.platformPermissions ────────────────
  const { overrideAdded, overrideRemoved } = useMemo(() => {
    if (!user?.platformPermissions || rolePerms.length === 0) {
      return { overrideAdded: [] as string[], overrideRemoved: [] as string[] }
    }
    try {
      const stored: unknown = JSON.parse(user.platformPermissions)
      if (Array.isArray(stored)) {
        // Legacy full array — compute delta from current role
        const added = (stored as string[]).filter(p => !rolePerms.includes(p))
        const removed = rolePerms.filter(p => !(stored as string[]).includes(p))
        return { overrideAdded: added, overrideRemoved: removed }
      }
      if (stored && typeof stored === "object") {
        const obj = stored as Record<string, unknown>
        return {
          overrideAdded: Array.isArray(obj.added) ? (obj.added as string[]) : [],
          overrideRemoved: Array.isArray(obj.removed) ? (obj.removed as string[]) : [],
        }
      }
    } catch { /* ignore */ }
    return { overrideAdded: [] as string[], overrideRemoved: [] as string[] }
  }, [user?.platformPermissions, rolePerms])

  const hasOverrides = overrideAdded.length > 0 || overrideRemoved.length > 0

  const startEditingOverrides = () => {
    setDraftAdded([...overrideAdded])
    setDraftRemoved([...overrideRemoved])
    setEditingOverrides(true)
  }

  const copyInfo = () => {
    if (!user) return
    navigator.clipboard.writeText(`Name: ${user.name}\nEmail: ${user.email}\nPhone: ${user.phone ?? "N/A"}`)
    toast.success("Copied")
  }

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!"
    setNewPassword(Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""))
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/core/users/${userId}/reset-password`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: newPassword || undefined }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json
    },
    onSuccess: (data) => { setResetCreds(data.credentials); setNewPassword(""); toast.success("Password reset") },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Reset failed"),
  })

  const toggleStatusMutation = useMutation({
    mutationFn: async (active: boolean) => {
      const res = await fetch(`/api/core/users/${userId}/toggle-status`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
    },
    onSuccess: (_d, active) => {
      toast.success(active ? "User activated" : "User suspended")
      qc.invalidateQueries({ queryKey: ["user-detail", userId] })
      onRefresh()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })

  const saveOverridesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/core/users/${userId}`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ permissionOverrides: { added: draftAdded, removed: draftRemoved } }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
    },
    onSuccess: () => {
      toast.success("Permission overrides saved")
      setEditingOverrides(false)
      qc.invalidateQueries({ queryKey: ["user-detail", userId] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })

  const saveRoleMutation = useMutation({
    mutationFn: async (role: string) => {
      const res = await fetch(`/api/core/users/${userId}`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
    },
    onSuccess: () => {
      toast.success("Role updated")
      setChangingRole(false)
      setNewRole("")
      qc.invalidateQueries({ queryKey: ["user-detail", userId] })
      qc.invalidateQueries({ queryKey: ["user-role-perms"] })
      onRefresh()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })

  if (!userId) return null

  const displayRole = user?.platformRole ?? user?.role

  return (
    <Sheet open={!!userId} onOpenChange={onClose}>
      <SheetContent className="w-[440px] max-w-[440px] p-0 flex flex-col h-full overflow-hidden">

        {/* ── STICKY HEADER ──────────────────────────────────────── */}
        <div className="shrink-0 border-b bg-background">

          {/* Identity row */}
          <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
            {isLoading || !user ? (
              <>
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-44" />
                </div>
              </>
            ) : (
              <>
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">
                    {initials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold leading-tight truncate">{user.name}</span>
                    {displayRole && (
                      <Badge className={`text-[9px] px-1 py-px border-0 h-4 ${roleColors[displayRole] ?? "bg-gray-100 text-gray-700"}`}>
                        {ROLE_LABELS[displayRole] ?? displayRole}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                  {user.phone && <p className="text-[10px] text-muted-foreground">{user.phone}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge className={`text-[9px] px-1.5 py-px border-0 h-4 ${user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    {user.isActive ? "Active" : "Suspended"}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><MoreVertical className="w-3.5 h-3.5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="text-xs w-44">
                      <DropdownMenuItem onClick={copyInfo} className="text-xs gap-2"><Copy className="w-3.5 h-3.5" /> Copy Info</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {user.isActive ? (
                        <DropdownMenuItem className="text-xs gap-2 text-red-600 focus:text-red-600" onClick={() => toggleStatusMutation.mutate(false)} disabled={toggleStatusMutation.isPending}>
                          <ShieldOff className="w-3.5 h-3.5" /> Suspend User
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem className="text-xs gap-2 text-emerald-600 focus:text-emerald-600" onClick={() => toggleStatusMutation.mutate(true)} disabled={toggleStatusMutation.isPending}>
                          <ShieldCheck className="w-3.5 h-3.5" /> Activate User
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="text-xs gap-2 text-muted-foreground" disabled>
                        <LogIn className="w-3.5 h-3.5" /> Login As User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            )}
          </div>

          {/* Quick action toolbar */}
          {user && (
            <TooltipProvider delayDuration={300}>
              <div className="flex items-center gap-0.5 px-3 py-1.5 border-t bg-muted/20">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost" size="sm"
                      className={`h-7 px-2 text-[11px] gap-1.5 ${user.isActive ? "text-red-600 hover:text-red-700 hover:bg-red-50" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"}`}
                      onClick={() => toggleStatusMutation.mutate(!user.isActive)}
                      disabled={toggleStatusMutation.isPending}
                    >
                      {user.isActive ? <><ShieldOff className="w-3.5 h-3.5" /> Suspend</> : <><ShieldCheck className="w-3.5 h-3.5" /> Activate</>}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">{user.isActive ? "Block all logins immediately" : "Restore access"}</TooltipContent>
                </Tooltip>
                <Separator orientation="vertical" className="h-4 mx-0.5" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] gap-1.5" onClick={() => { setSections(s => ({ ...s, passwordReset: true })); setTimeout(() => pwInputRef.current?.focus(), 120) }}>
                      <KeyRound className="w-3.5 h-3.5" /> Reset PW
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Admin password reset</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] gap-1.5" onClick={copyInfo}>
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Copy name, email, phone</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] gap-1.5 text-muted-foreground cursor-not-allowed" disabled>
                      <LogIn className="w-3.5 h-3.5" /> Login As
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Coming soon</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          )}

          {/* Meta row */}
          {user && (
            <div className="grid grid-cols-3 divide-x border-t">
              {[
                { label: "Auth",       value: user.authProvider },
                { label: "Joined",     value: fmtDate(user.createdAt) },
                { label: "Last Login", value: fmtDate(user.lastLoginAt) },
              ].map(m => (
                <div key={m.label} className="px-3 py-1.5">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{m.label}</p>
                  <p className="text-[11px] font-medium text-foreground leading-tight">{m.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── SCROLLABLE BODY ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className={`h-8 w-full rounded ${i % 3 === 0 ? "opacity-50" : ""}`} />
              ))}
            </div>
          ) : user ? (
            <>
              {/* ── Password Reset ─────────────────────────────── */}
              <AccordionSection label="Password Reset" isOpen={sections.passwordReset} onToggle={() => toggle("passwordReset")}>
                <div className="px-4 pb-3 pt-1 space-y-2">
                  <p className="text-[11px] text-muted-foreground">Admin-assigned only. Users cannot reset their own passwords.</p>
                  <div className="flex items-center gap-1.5">
                    <Input ref={pwInputRef} type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password…" className="h-7 text-xs flex-1 font-mono" />
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={generatePassword}>
                            <Shuffle className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">Generate random password</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Button size="sm" className="h-7 px-3 text-xs shrink-0" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
                      {resetMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Reset"}
                    </Button>
                  </div>
                  {resetCreds && <CredentialBox email={resetCreds.email} password={resetCreds.password} onDismiss={() => setResetCreds(null)} />}
                </div>
              </AccordionSection>

              {/* ── Role & Permissions ─────────────────────────── */}
              <AccordionSection
                label="Role & Permissions"
                isOpen={sections.roleAndPerms}
                onToggle={() => toggle("roleAndPerms")}
                rightSlot={
                  hasOverrides ? (
                    <Badge className="text-[9px] bg-amber-100 text-amber-700 border-0 h-4 px-1.5">Overrides Active</Badge>
                  ) : undefined
                }
              >
                <div className="px-4 pb-3 pt-2 space-y-3">

                  {/* Assigned role */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Assigned Role</p>
                      {displayRole ? (
                        <Badge className={`text-[10px] px-2 py-0.5 border-0 h-5 ${roleColors[displayRole] ?? "bg-gray-100 text-gray-700"}`}>
                          {ROLE_LABELS[displayRole] ?? displayRole}
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">No role assigned</span>
                      )}
                    </div>
                    {!changingRole ? (
                      <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => { setNewRole(displayRole ?? ""); setChangingRole(true) }}>
                        Change Role
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Select value={newRole} onValueChange={setNewRole}>
                          <SelectTrigger className="h-6 text-[10px] w-[140px]"><SelectValue placeholder="Select role" /></SelectTrigger>
                          <SelectContent>
                            {PLATFORM_ROLES.map(r => (
                              <SelectItem key={r} value={r} className="text-xs">{ROLE_LABELS[r] ?? r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" className="h-6 px-2 text-[10px]" onClick={() => newRole && saveRoleMutation.mutate(newRole)} disabled={saveRoleMutation.isPending || !newRole}>
                          {saveRoleMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Save"}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setChangingRole(false)}><X className="w-3 h-3" /></Button>
                      </div>
                    )}
                  </div>

                  {/* Authority note */}
                  <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                    <Info className="w-3 h-3 text-sky-600 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-sky-700 leading-relaxed">
                      Role permissions are managed centrally in <strong>Roles & Permissions</strong>. Changes there cascade to all users with this role.
                    </p>
                  </div>

                  {/* Go to RBAC */}
                  <button
                    onClick={() => { setActivePage("roles-permissions"); onClose() }}
                    className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    <Shield className="w-3 h-3" /> Manage Role Permissions
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>

                  <Separator />

                  {/* Inherited permissions (collapsible) */}
                  {rbacLoading ? (
                    <Skeleton className="h-6 w-full" />
                  ) : rolePerms.length > 0 ? (
                    <div className="space-y-1.5">
                      <button
                        onClick={() => setShowInherited(v => !v)}
                        className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ChevronRight className={`w-3 h-3 transition-transform ${showInherited ? "rotate-90" : ""}`} />
                        Inherited from Role ({rolePerms.length} permissions)
                        {rbacData?.isCustomized && (
                          <Badge variant="secondary" className="text-[8px] h-3.5 px-1">Customized</Badge>
                        )}
                      </button>
                      {showInherited && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {rolePerms.map(p => (
                            <span
                              key={p}
                              className={`text-[9px] px-1.5 py-0.5 rounded border ${
                                overrideRemoved.includes(p)
                                  ? "bg-red-50 text-red-400 border-red-200 line-through"
                                  : "bg-muted text-muted-foreground border-border"
                              }`}
                            >
                              {PERMISSION_LABELS[p as Permission] ?? p}
                            </span>
                          ))}
                          {overrideAdded.map(p => (
                            <span key={p} className="text-[9px] px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">
                              +{PERMISSION_LABELS[p as Permission] ?? p}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}

                  <Separator />

                  {/* Override section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">User-Level Overrides</p>
                      <div className="flex items-center gap-1">
                        {hasOverrides && !editingOverrides && (
                          <Button
                            variant="ghost" size="sm"
                            className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-red-600"
                            onClick={() => saveOverridesMutation.mutate()}
                            disabled={saveOverridesMutation.isPending}
                          >
                            Clear All
                          </Button>
                        )}
                        {!editingOverrides ? (
                          <Button variant="outline" size="sm" className="h-5 px-1.5 text-[10px]" onClick={startEditingOverrides}>
                            Edit
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {!editingOverrides ? (
                      hasOverrides ? (
                        <div className="rounded-lg border px-3 py-2 space-y-1.5">
                          {overrideAdded.length > 0 && (
                            <div>
                              <span className="text-[9px] font-semibold text-emerald-700 uppercase">+ Added ({overrideAdded.length})</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {overrideAdded.map(p => (
                                  <span key={p} className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    {PERMISSION_LABELS[p as Permission] ?? p}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {overrideRemoved.length > 0 && (
                            <div>
                              <span className="text-[9px] font-semibold text-red-700 uppercase">− Removed ({overrideRemoved.length})</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {overrideRemoved.map(p => (
                                  <span key={p} className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 line-through">
                                    {PERMISSION_LABELS[p as Permission] ?? p}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          No overrides — this user inherits all {rolePerms.length > 0 ? `${rolePerms.length} ` : ""}permissions from their role.
                        </p>
                      )
                    ) : (
                      <PermissionOverrideEditor
                        rolePerms={rolePerms}
                        draftAdded={draftAdded}
                        draftRemoved={draftRemoved}
                        onChangeAdded={setDraftAdded}
                        onChangeRemoved={setDraftRemoved}
                      />
                    )}
                  </div>
                </div>
              </AccordionSection>

              {/* ── Business Access ────────────────────────────── */}
              <AccordionSection label="Business Access" count={user.businessUsers.length} isOpen={sections.businessAccess} onToggle={() => toggle("businessAccess")}>
                <div className="px-4 pb-3 pt-1">
                  {user.businessUsers.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">No business associations — platform-level account.</p>
                  ) : (
                    <div className="space-y-1">
                      {user.businessUsers.map(bu => (
                        <div key={bu.id} className="border rounded-md px-3 py-2 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold leading-tight truncate">{bu.business.name}</p>
                            <p className="text-[10px] text-muted-foreground">{bu.business.businessType}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge className={`text-[9px] px-1 py-px border-0 h-4 ${roleColors[bu.role] ?? "bg-gray-100 text-gray-700"}`}>
                              {ROLE_LABELS[bu.role] ?? bu.role}
                            </Badge>
                            {!bu.isActive && (
                              <Badge className="text-[9px] px-1 py-px border-0 h-4 bg-red-100 text-red-600">Inactive</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                      <p className="text-[10px] text-muted-foreground pt-1">
                        Business-level permissions are managed via <button onClick={() => { setActivePage("roles-permissions"); onClose() }} className="font-medium text-primary hover:underline">Roles & Permissions</button>.
                      </p>
                    </div>
                  )}
                </div>
              </AccordionSection>
            </>
          ) : (
            <div className="p-4"><p className="text-sm text-muted-foreground">User not found.</p></div>
          )}
        </div>

        {/* ── STICKY FOOTER — override save ──────────────────── */}
        {editingOverrides && (
          <div className="shrink-0 border-t bg-background px-4 py-2 flex items-center gap-2">
            <Button
              size="sm" className="h-7 text-xs"
              onClick={() => saveOverridesMutation.mutate()}
              disabled={saveOverridesMutation.isPending}
            >
              {saveOverridesMutation.isPending && <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />}
              Save Overrides
            </Button>
            <Button
              variant="ghost" size="sm" className="h-7 text-xs"
              onClick={() => { setEditingOverrides(false); setDraftAdded([]); setDraftRemoved([]) }}
            >
              Cancel
            </Button>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {draftAdded.length > 0 && `+${draftAdded.length} added`}
              {draftAdded.length > 0 && draftRemoved.length > 0 && " · "}
              {draftRemoved.length > 0 && `−${draftRemoved.length} removed`}
              {draftAdded.length === 0 && draftRemoved.length === 0 && "No overrides"}
            </span>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function PlatformUsersView() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabKey>("ALL")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    const t = setTimeout(() => setDebouncedSearch(value), 350)
    return () => clearTimeout(t)
  }, [])

  const activeTabDef = TABS.find(t => t.key === activeTab)
  const scope   = activeTabDef?.scope ?? "PLATFORM"
  const tabRole = activeTabDef?.role   ?? undefined

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["platform-users", scope, tabRole, debouncedSearch],
    queryFn: () => fetchUsers(scope, debouncedSearch, tabRole),
    staleTime: 30_000,
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["platform-users"] })
    refetch()
  }

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.isActive).length,
    suspended: users.filter(u => !u.isActive).length,
    admins: users.filter(u => u.role === "QUANTIX_SUPER_ADMIN" || u.role === "PLATFORM_ADMIN").length,
  }), [users])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-background">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">Platform Team Management</h1>
            <p className="text-[11px] text-muted-foreground">Quantix internal staff only — no self-signup</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={refresh}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
          <CreateUserDialog onCreated={refresh} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-0 border-b">
        {[
          { label: "Total",     value: stats.total,     color: "text-foreground" },
          { label: "Active",    value: stats.active,    color: "text-emerald-600" },
          { label: "Suspended", value: stats.suspended, color: "text-red-600" },
          { label: "Admins",    value: stats.admins,    color: "text-blue-600" },
        ].map(s => (
          <div key={s.label} className="px-5 py-2 border-r last:border-r-0">
            <p className={`text-xl font-bold leading-tight ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center gap-3 px-5 py-2 border-b">
        <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-7 text-xs"
            placeholder="Search name, email, phone…"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* Security notice */}
      <div className="flex items-center gap-2 px-5 py-1.5 bg-amber-50 border-b border-amber-100">
        <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
        <p className="text-[11px] text-amber-700">
          Passwords are admin-assigned. No self-registration or self-reset allowed.
        </p>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="px-5 py-3 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="space-y-1 flex-1"><Skeleton className="h-3.5 w-36" /><Skeleton className="h-3 w-52" /></div>
                <Skeleton className="h-4 w-16 rounded-full" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-9 h-9 text-muted-foreground/30 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">No users found</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Create a user to get started</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableHead className="w-[260px] text-xs">User</TableHead>
                <TableHead className="text-xs">Role</TableHead>
                <TableHead className="text-xs">Business</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Last Login</TableHead>
                <TableHead className="text-xs">Joined</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => (
                <TableRow key={user.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedUserId(user.id)}>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="w-7 h-7 shrink-0">
                        <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                          {initials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-semibold leading-tight">{user.name}</p>
                        <p className="text-[10px] text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    {user.role ? (
                      <Badge className={`text-[9px] px-1 border-0 h-4 ${roleColors[user.role] ?? "bg-gray-100 text-gray-700"}`}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    {user.businessName ? (
                      <div>
                        <p className="text-xs font-medium leading-tight">{user.businessName}</p>
                        <p className="text-[10px] text-muted-foreground">{user.businessType}</p>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Platform</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge className={`text-[9px] px-1.5 border-0 h-4 ${user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {user.isActive ? "Active" : "Suspended"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-[11px] text-muted-foreground">{fmtDate(user.lastLoginAt)}</TableCell>
                  <TableCell className="py-2 text-[11px] text-muted-foreground">{fmtDate(user.createdAt)}</TableCell>
                  <TableCell className="py-2"><Eye className="w-3.5 h-3.5 text-muted-foreground/50" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Detail sheet */}
      <UserDetailSheet userId={selectedUserId} onClose={() => setSelectedUserId(null)} onRefresh={refresh} />
    </div>
  )
}
