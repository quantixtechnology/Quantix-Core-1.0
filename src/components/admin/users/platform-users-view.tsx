"use client"

import { useState, useMemo, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
  Shuffle, LogIn, X, Filter,
} from "lucide-react"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/admin-fetch"
import {
  ROLE_LABELS, PERMISSION_GROUPS, PERMISSION_LABELS, type Permission,
} from "@/lib/permissions"
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
  businessUsers: Array<{
    id: string; role: string; businessId: string; isActive: boolean; permissions: string
    business: { id: string; name: string; slug: string; businessType: string; status: string }
  }>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { key: "ALL",         label: "All Staff",        scope: "PLATFORM" },
  { key: "ADMIN",       label: "Admins",            scope: "PLATFORM", role: "QUANTIX_SUPER_ADMIN" },
  { key: "SALES",       label: "Sales",             scope: "PLATFORM", role: "QUANTIX_SALES_TEAM" },
  { key: "SUPPORT",     label: "Support",           scope: "PLATFORM", role: "SUPPORT_STAFF" },
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

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.permissions as string[])
const VIEW_ONLY_PERMS = ALL_PERMISSIONS.filter(p => p.endsWith(":view"))
const POS_PRESET      = ["pos:access", "orders:view", "products:view", "customers:view", "reports:view"]

const roleColors: Record<string, string> = {
  QUANTIX_SUPER_ADMIN: "bg-red-100 text-red-700",
  PLATFORM_ADMIN:      "bg-purple-100 text-purple-700",
  QUANTIX_SALES_TEAM:  "bg-blue-100 text-blue-700",
  CLIENT_OWNER:        "bg-emerald-100 text-emerald-700",
  STORE_MANAGER:       "bg-teal-100 text-teal-700",
  BILLING_STAFF:       "bg-amber-100 text-amber-700",
  INVENTORY_STAFF:     "bg-orange-100 text-orange-700",
  SUPPORT_STAFF:       "bg-sky-100 text-sky-700",
  DELIVERY_STAFF:      "bg-gray-100 text-gray-700",
  CUSTOMER:            "bg-slate-100 text-slate-600",
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchUsers(scope: string, search: string): Promise<PlatformUser[]> {
  const p = new URLSearchParams({ scope, limit: "100" })
  if (search) p.set("search", search)
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

// ─── Compact Permission Editor ────────────────────────────────────────────────

function CompactPermissionEditor({
  current, onChange,
}: { current: string[]; onChange: (p: string[]) => void }) {
  const [search, setSearch] = useState("")

  const toggle = (perm: string) =>
    onChange(current.includes(perm) ? current.filter(p => p !== perm) : [...current, perm])

  const applyPreset = (perms: string[]) => onChange(perms)

  const filteredGroups = useMemo(() => {
    if (!search) return PERMISSION_GROUPS
    const q = search.toLowerCase()
    return PERMISSION_GROUPS.map(g => ({
      ...g,
      permissions: g.permissions.filter(p =>
        (PERMISSION_LABELS[p as Permission] ?? p).toLowerCase().includes(q)
      ),
    })).filter(g => g.permissions.length > 0)
  }, [search])

  const activeCount = current.length

  return (
    <div>
      {/* Search + presets */}
      <div className="px-4 pt-2 pb-2 space-y-2">
        <div className="relative">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter permissions…"
            className="pl-7 h-7 text-xs"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-muted-foreground mr-0.5">Preset:</span>
          {[
            { label: "Full Access",  fn: () => applyPreset([...ALL_PERMISSIONS]) },
            { label: "View Only",    fn: () => applyPreset([...VIEW_ONLY_PERMS]) },
            { label: "POS Only",     fn: () => applyPreset([...POS_PRESET]) },
            { label: "Clear All",    fn: () => applyPreset([]) },
          ].map(p => (
            <button
              key={p.label}
              onClick={p.fn}
              className="text-[10px] px-1.5 py-px rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              {p.label}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-muted-foreground">{activeCount} active</span>
        </div>
      </div>

      {/* Permission grid */}
      <div className="px-4 pb-3 space-y-3">
        {filteredGroups.map(group => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              {group.label}
            </p>
            <div className="grid grid-cols-2 gap-x-2">
              {group.permissions.map(perm => {
                const label = PERMISSION_LABELS[perm as Permission] ?? perm
                const isOn = current.includes(perm)
                return (
                  <label
                    key={perm}
                    className="flex items-center justify-between py-[3px] px-1.5 rounded cursor-pointer hover:bg-muted/50 group"
                  >
                    <span className={`text-[11px] leading-tight select-none ${isOn ? "text-foreground" : "text-muted-foreground"}`}>
                      {label}
                    </span>
                    <Switch
                      checked={isOn}
                      onCheckedChange={() => toggle(perm)}
                      className="scale-[0.65] origin-right shrink-0"
                    />
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Create User Dialog ───────────────────────────────────────────────────────

function CreateUserDialog({ onCreated }: { onCreated: () => void }) {
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
      const res = await fetch("/api/core/users", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, email: form.email,
          phone: form.phone || undefined, role: form.role,
          password: form.password || undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setCreds(json.credentials)
      toast.success("User created")
      onCreated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create user")
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
        <Plus className="w-4 h-4 mr-1.5" /> Create User
      </Button>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Platform User</DialogTitle>
            <DialogDescription>All credentials are admin-assigned. No self-signup.</DialogDescription>
          </DialogHeader>

          {creds ? (
            <div className="space-y-3">
              <CredentialBox email={creds.email} password={creds.password} onDismiss={handleClose} />
              <p className="text-xs text-muted-foreground">Share these credentials securely.</p>
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
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="rahul@example.com" className="h-8" />
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
                      {PLATFORM_ROLES.map((r: string) => <SelectItem key={r} value={r} className="text-xs">{ROLE_LABELS[r] ?? r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Password <span className="text-muted-foreground">(blank = auto)</span></Label>
                  <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Auto-generated if blank" className="h-8" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
                <Button size="sm" onClick={submit} disabled={loading}>
                  {loading ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                  Create
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Compact User Detail Sheet ────────────────────────────────────────────────

function UserDetailSheet({
  userId, onClose, onRefresh,
}: {
  userId: string | null; onClose: () => void; onRefresh: () => void
}) {
  const qc = useQueryClient()
  const pwInputRef = useRef<HTMLInputElement>(null)

  const [resetCreds, setResetCreds] = useState<{ email: string; password: string } | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [editPermissions, setEditPermissions] = useState<string[] | null>(null)
  const [selectedBizId, setSelectedBizId] = useState<string | null>(null)
  const [sections, setSections] = useState({
    passwordReset: false,
    businessAccess: true,
    permissions: false,
  })

  const toggle = (k: keyof typeof sections) =>
    setSections(s => ({ ...s, [k]: !s[k] }))

  const { data: user, isLoading } = useQuery({
    queryKey: ["user-detail", userId],
    queryFn: () => fetchUserDetail(userId!),
    enabled: !!userId,
  })

  // Generate random password
  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!"
    const pw = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
    setNewPassword(pw)
  }

  // Copy user info
  const copyInfo = () => {
    if (!user) return
    navigator.clipboard.writeText(`Name: ${user.name}\nEmail: ${user.email}\nPhone: ${user.phone ?? "N/A"}`)
    toast.success("Copied")
  }

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
    onSuccess: (data) => {
      setResetCreds(data.credentials)
      setNewPassword("")
      toast.success("Password reset")
    },
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
      return json
    },
    onSuccess: (_d, active) => {
      toast.success(active ? "User activated" : "User suspended")
      qc.invalidateQueries({ queryKey: ["user-detail", userId] })
      onRefresh()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })

  const savePermMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBizId || !editPermissions) return
      const res = await fetch(`/api/core/users/${userId}`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: editPermissions, businessId: selectedBizId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
    },
    onSuccess: () => {
      toast.success("Permissions saved")
      setEditPermissions(null)
      setSelectedBizId(null)
      qc.invalidateQueries({ queryKey: ["user-detail", userId] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  })

  const initPermEdit = (bu: NonNullable<UserDetail["businessUsers"]>[0]) => {
    setSelectedBizId(bu.businessId)
    try { setEditPermissions(JSON.parse(bu.permissions) as string[]) }
    catch { setEditPermissions([]) }
    setSections(s => ({ ...s, permissions: true, businessAccess: true }))
  }

  const openPasswordReset = () => {
    setSections(s => ({ ...s, passwordReset: true }))
    setTimeout(() => pwInputRef.current?.focus(), 120)
  }

  if (!userId) return null

  return (
    <Sheet open={!!userId} onOpenChange={onClose}>
      {/* Fixed 440px width, full height, no overflow on the panel itself */}
      <SheetContent className="w-[440px] max-w-[440px] p-0 flex flex-col h-full overflow-hidden">

        {/* ── STICKY HEADER ──────────────────────────────────────── */}
        <div className="shrink-0 border-b bg-background">

          {/* Identity row */}
          <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
            {isLoading || !user ? (
              <>
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-44" />
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
                    {user.role && (
                      <Badge className={`text-[9px] px-1 py-px border-0 h-4 ${roleColors[user.role] ?? "bg-gray-100 text-gray-700"}`}>
                        {ROLE_LABELS[user.role] ?? user.role}
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
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <MoreVertical className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="text-xs w-44">
                      <DropdownMenuItem onClick={copyInfo} className="text-xs gap-2">
                        <Copy className="w-3.5 h-3.5" /> Copy Info
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {user.isActive ? (
                        <DropdownMenuItem
                          className="text-xs gap-2 text-red-600 focus:text-red-600"
                          onClick={() => toggleStatusMutation.mutate(false)}
                          disabled={toggleStatusMutation.isPending}
                        >
                          <ShieldOff className="w-3.5 h-3.5" /> Suspend User
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          className="text-xs gap-2 text-emerald-600 focus:text-emerald-600"
                          onClick={() => toggleStatusMutation.mutate(true)}
                          disabled={toggleStatusMutation.isPending}
                        >
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
                      {user.isActive
                        ? <><ShieldOff className="w-3.5 h-3.5" /> Suspend</>
                        : <><ShieldCheck className="w-3.5 h-3.5" /> Activate</>
                      }
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {user.isActive ? "Block all logins immediately" : "Restore access"}
                  </TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-4 mx-0.5" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 px-2 text-[11px] gap-1.5"
                      onClick={openPasswordReset}
                    >
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
                  <TooltipContent side="bottom" className="text-xs">Coming soon — admin impersonation</TooltipContent>
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
              <AccordionSection
                label="Password Reset"
                isOpen={sections.passwordReset}
                onToggle={() => toggle("passwordReset")}
              >
                <div className="px-4 pb-3 pt-1 space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Admin-assigned only. Users cannot reset their own passwords.
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Input
                      ref={pwInputRef}
                      type="text"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="New password…"
                      className="h-7 text-xs flex-1 font-mono"
                    />
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline" size="sm"
                            className="h-7 w-7 p-0 shrink-0"
                            onClick={generatePassword}
                          >
                            <Shuffle className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">Generate random password</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Button
                      size="sm"
                      className="h-7 px-3 text-xs shrink-0"
                      onClick={() => resetMutation.mutate()}
                      disabled={resetMutation.isPending}
                    >
                      {resetMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Reset"}
                    </Button>
                  </div>
                  {resetCreds && (
                    <CredentialBox
                      email={resetCreds.email}
                      password={resetCreds.password}
                      onDismiss={() => setResetCreds(null)}
                    />
                  )}
                </div>
              </AccordionSection>

              {/* ── Business Access ────────────────────────────── */}
              <AccordionSection
                label="Business Access"
                count={user.businessUsers.length}
                isOpen={sections.businessAccess}
                onToggle={() => toggle("businessAccess")}
              >
                <div className="px-4 pb-3 pt-1">
                  {user.businessUsers.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">No business associations — platform-level account.</p>
                  ) : (
                    <div className="space-y-1">
                      {user.businessUsers.map(bu => {
                        const isEditing = editPermissions !== null && selectedBizId === bu.businessId
                        let permCount = 0
                        try { permCount = (JSON.parse(bu.permissions) as string[]).length } catch { /* ok */ }

                        return (
                          <div
                            key={bu.id}
                            className={`border rounded-md px-3 py-2 transition-colors ${isEditing ? "border-primary/30 bg-primary/5" : "hover:border-muted-foreground/20"}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold leading-tight truncate">{bu.business.name}</p>
                                <p className="text-[10px] text-muted-foreground">{bu.business.businessType}</p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Badge className={`text-[9px] px-1 py-px border-0 h-4 ${roleColors[bu.role] ?? "bg-gray-100 text-gray-700"}`}>
                                  {ROLE_LABELS[bu.role] ?? bu.role}
                                </Badge>
                                {permCount > 0 && (
                                  <span className="text-[10px] text-muted-foreground">{permCount}p</span>
                                )}
                                <Button
                                  variant={isEditing ? "default" : "ghost"}
                                  size="sm"
                                  className="h-5 px-1.5 text-[10px]"
                                  onClick={() => isEditing ? (setEditPermissions(null), setSelectedBizId(null)) : initPermEdit(bu)}
                                >
                                  {isEditing ? "Close" : "Perms"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </AccordionSection>

              {/* ── Permissions ────────────────────────────────── */}
              <AccordionSection
                label="Permissions"
                isOpen={sections.permissions}
                onToggle={() => toggle("permissions")}
                rightSlot={
                  editPermissions !== null ? (
                    <Badge className="text-[9px] bg-primary/10 text-primary border-0 h-4 px-1.5">
                      Editing
                    </Badge>
                  ) : undefined
                }
              >
                {editPermissions !== null ? (
                  <CompactPermissionEditor
                    current={editPermissions}
                    onChange={setEditPermissions}
                  />
                ) : (
                  <div className="px-4 pb-3 pt-1">
                    <p className="text-[11px] text-muted-foreground">
                      Click <span className="font-semibold text-foreground">Perms</span> on a business above to edit permissions for that role.
                    </p>
                  </div>
                )}
              </AccordionSection>
            </>
          ) : (
            <div className="p-4">
              <p className="text-sm text-muted-foreground">User not found.</p>
            </div>
          )}
        </div>

        {/* ── STICKY FOOTER — only when editing permissions ──────── */}
        {editPermissions !== null && (
          <div className="shrink-0 border-t bg-background px-4 py-2 flex items-center gap-2">
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => savePermMutation.mutate()}
              disabled={savePermMutation.isPending}
            >
              {savePermMutation.isPending && <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />}
              Save Permissions
            </Button>
            <Button
              variant="ghost" size="sm"
              className="h-7 text-xs"
              onClick={() => { setEditPermissions(null); setSelectedBizId(null) }}
            >
              Cancel
            </Button>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {editPermissions.length} permission{editPermissions.length !== 1 ? "s" : ""} selected
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
  const scope = activeTabDef?.scope ?? "PLATFORM"

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["platform-users", scope, debouncedSearch],
    queryFn: () => fetchUsers(scope, debouncedSearch),
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
          { label: "Total",    value: stats.total,     color: "text-foreground" },
          { label: "Active",   value: stats.active,    color: "text-emerald-600" },
          { label: "Suspended",value: stats.suspended, color: "text-red-600" },
          { label: "Admins",   value: stats.admins,    color: "text-blue-600" },
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
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3 w-52" />
                </div>
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
                <TableRow
                  key={user.id}
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => setSelectedUserId(user.id)}
                >
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
                  <TableCell className="py-2">
                    <Eye className="w-3.5 h-3.5 text-muted-foreground/50" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Detail sheet */}
      <UserDetailSheet
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
        onRefresh={refresh}
      />
    </div>
  )
}
