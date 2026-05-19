'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Users, Plus, Shield, CheckCircle2, XCircle, Loader2,
  Edit2, KeyRound, UserX, UserCheck, Copy, Check, AlertCircle,
  Store, Clock,
} from 'lucide-react'
import { useAdminStore } from '@/stores/admin-store'
import { getAuthHeaders } from '@/lib/admin-fetch'

// ── Types ────────────────────────────────────────────────────────────────────

interface StoreRecord {
  id: string; name: string; storeCode: string | null
}

interface RoleRecord {
  id: string; name: string; isSystem: boolean; userCount: number
}

interface BusinessUserRecord {
  id: string
  userId: string
  role: string
  businessRoleId: string | null
  businessRoleName: string | null
  isActive: boolean
  createdAt: string
  createdByName: string
  user: {
    id: string; name: string; email: string; phone: string | null
    loginId: string | null; isActive: boolean; lastLoginAt: string | null
  }
  stores: StoreRecord[]
}

interface UserForm {
  name: string
  loginId: string
  email: string
  phone: string
  password: string
  role: string
  businessRoleId: string
  storeIds: string[]
  isActive: boolean
}

const EMPTY_FORM: UserForm = {
  name: '', loginId: '', email: '', phone: '', password: '',
  role: 'STORE_OPERATOR', businessRoleId: '', storeIds: [], isActive: true,
}

const SYSTEM_ROLES = [
  { value: 'STORE_MANAGER',   label: 'Store Manager' },
  { value: 'STORE_OPERATOR',  label: 'Store Operator' },
  { value: 'BILLING_STAFF',   label: 'POS User' },
  { value: 'INVENTORY_STAFF', label: 'Inventory User' },
  { value: 'DELIVERY_STAFF',  label: 'Delivery Agent' },
  { value: 'SUPPORT_STAFF',   label: 'Customer Support' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function UserCreationView() {
  const { currentBusinessId } = useAdminStore()

  const [users, setUsers]   = useState<BusinessUserRecord[]>([])
  const [stores, setStores] = useState<StoreRecord[]>([])
  const [roles, setRoles]   = useState<RoleRecord[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filterRole, setFilterRole] = useState('all')

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<BusinessUserRecord | null>(null)
  const [form, setForm] = useState<UserForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Credentials display after create
  const [credentials, setCredentials] = useState<{ email: string; loginId: string; password: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  // Reset password dialog
  const [resetDialog, setResetDialog] = useState<{ open: boolean; user: BusinessUserRecord | null }>({ open: false, user: null })
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  // Fetch
  const fetchAll = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const headers = getAuthHeaders()
      const [usersRes, storesRes, rolesRes] = await Promise.all([
        fetch(`/api/core/businesses/${currentBusinessId}/users`, { headers }),
        fetch(`/api/core/stores?businessId=${currentBusinessId}`, { headers }),
        fetch(`/api/core/businesses/${currentBusinessId}/roles`, { headers }),
      ])
      const [usersJson, storesJson, rolesJson] = await Promise.all([
        usersRes.json(), storesRes.json(), rolesRes.json(),
      ])
      if (usersJson.success)  setUsers(usersJson.data  ?? [])
      if (storesJson.success) setStores(storesJson.data ?? [])
      if (rolesJson.success)  setRoles(rolesJson.data   ?? [])
    } finally {
      setLoading(false)
    }
  }, [currentBusinessId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Derived
  const totalUsers  = users.length
  const activeUsers = users.filter(u => u.isActive).length
  const rolesCount  = roles.length

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      u.user.name.toLowerCase().includes(q) ||
      u.user.email.toLowerCase().includes(q) ||
      (u.user.loginId ?? '').toLowerCase().includes(q) ||
      (u.businessRoleName ?? u.role).toLowerCase().includes(q)
    const matchRole = filterRole === 'all' || u.role === filterRole || u.businessRoleId === filterRole
    return matchSearch && matchRole
  })

  // ── Form helpers ────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingUser(null)
    setForm(EMPTY_FORM)
    setSaveError(null)
    setCredentials(null)
    setDialogOpen(true)
  }

  function openEdit(u: BusinessUserRecord) {
    setEditingUser(u)
    setForm({
      name: u.user.name,
      loginId: u.user.loginId ?? u.user.email,
      email: u.user.email,
      phone: u.user.phone ?? '',
      password: '',
      role: u.role,
      businessRoleId: u.businessRoleId ?? '',
      storeIds: u.stores.map(s => s.id),
      isActive: u.isActive,
    })
    setSaveError(null)
    setCredentials(null)
    setDialogOpen(true)
  }

  function toggleStore(storeId: string) {
    setForm(f => ({
      ...f,
      storeIds: f.storeIds.includes(storeId)
        ? f.storeIds.filter(id => id !== storeId)
        : [...f.storeIds, storeId],
    }))
  }

  async function handleSave() {
    if (!form.name || !form.email || !form.role) {
      setSaveError('Name, email and role are required')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      if (editingUser) {
        // Update
        const res = await fetch(
          `/api/core/businesses/${currentBusinessId}/users/${editingUser.id}`,
          {
            method: 'PATCH',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: form.name, phone: form.phone || undefined,
              loginId: form.loginId || undefined,
              role: form.role,
              businessRoleId: form.businessRoleId || undefined,
              storeIds: form.storeIds,
              isActive: form.isActive,
            }),
          },
        )
        const json = await res.json()
        if (!json.success) throw new Error(json.error || 'Update failed')
        setDialogOpen(false)
      } else {
        // Create
        const res = await fetch(
          `/api/core/businesses/${currentBusinessId}/users`,
          {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: form.name, loginId: form.loginId || undefined,
              email: form.email, phone: form.phone || undefined,
              password: form.password || undefined, role: form.role,
              businessRoleId: form.businessRoleId || undefined,
              storeIds: form.storeIds, isActive: form.isActive,
            }),
          },
        )
        const json = await res.json()
        if (!json.success) throw new Error(json.error || 'Create failed')
        setCredentials({ email: json.data.email, loginId: json.data.loginId, password: json.data.password })
      }
      await fetchAll()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDisable(u: BusinessUserRecord) {
    await fetch(`/api/core/businesses/${currentBusinessId}/users/${u.id}`, {
      method: 'PATCH',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !u.isActive }),
    })
    await fetchAll()
  }

  async function handleResetPassword() {
    if (!resetDialog.user || !newPassword) return
    setResetting(true)
    try {
      await fetch(`/api/core/businesses/${currentBusinessId}/users/${resetDialog.user.id}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      })
      setResetDialog({ open: false, user: null })
      setNewPassword('')
    } finally {
      setResetting(false)
    }
  }

  function copyText(label: string, text: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function displayRole(u: BusinessUserRecord) {
    if (u.businessRoleName) return u.businessRoleName
    return SYSTEM_ROLES.find(r => r.value === u.role)?.label ?? u.role
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Users',   value: totalUsers,            icon: Users,        color: 'text-blue-600' },
          { label: 'Active',        value: activeUsers,           icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Inactive',      value: totalUsers - activeUsers, icon: XCircle,   color: 'text-red-500' },
          { label: 'Roles Created', value: rolesCount,            icon: Shield,       color: 'text-violet-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`rounded-lg bg-muted p-2 ${color}`}><Icon className="size-4" /></div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Header */}
      <Card className="border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <CardTitle className="text-base font-semibold">Business Users</CardTitle>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="size-4" /> Add User
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Search by name, email or login ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 text-sm sm:max-w-xs"
            />
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="h-8 w-[160px] text-sm">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {SYSTEM_ROLES.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
                {roles.filter(r => !r.isSystem).map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 size-5 animate-spin" /> Loading users…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <Users className="size-10 opacity-30" />
              <p className="text-sm">{search ? 'No users match your search' : 'No users yet — add one to get started'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    {['Name', 'Login ID', 'Role', 'Assigned Stores', 'Status', 'Last Login', 'Created By', 'Actions'].map(h => (
                      <th key={h} className="pb-2 pr-4 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(u => (
                    <tr key={u.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 pr-4 font-medium">{u.user.name}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">
                        {u.user.loginId ?? u.user.email}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge variant="outline" className="text-xs">{displayRole(u)}</Badge>
                      </td>
                      <td className="py-2.5 pr-4">
                        {u.stores.length === 0 ? (
                          <span className="text-xs text-muted-foreground">All stores</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {u.stores.slice(0, 2).map(s => (
                              <Badge key={s.id} variant="secondary" className="text-xs">{s.name}</Badge>
                            ))}
                            {u.stores.length > 2 && (
                              <Badge variant="secondary" className="text-xs">+{u.stores.length - 2}</Badge>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge
                          variant={u.isActive ? 'default' : 'secondary'}
                          className={`text-xs ${u.isActive ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : ''}`}
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatDate(u.user.lastLoginAt)}
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground">{u.createdByName}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="size-7" title="Edit" onClick={() => openEdit(u)}>
                            <Edit2 className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="size-7"
                            title="Reset Password"
                            onClick={() => { setResetDialog({ open: true, user: u }); setNewPassword('') }}
                          >
                            <KeyRound className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="size-7"
                            title={u.isActive ? 'Disable' : 'Enable'}
                            onClick={() => handleDisable(u)}
                          >
                            {u.isActive
                              ? <UserX className="size-3.5 text-red-500" />
                              : <UserCheck className="size-3.5 text-emerald-600" />
                            }
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open && !credentials) setDialogOpen(false) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
          </DialogHeader>

          {credentials ? (
            /* Credentials display after successful creation */
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
                <CheckCircle2 className="mx-auto mb-2 size-8 text-emerald-600" />
                <p className="font-semibold text-emerald-800">User Created Successfully</p>
                <p className="text-xs text-emerald-600 mt-1">Share these credentials with the user</p>
              </div>
              {[
                { label: 'Email', value: credentials.email },
                { label: 'Login ID', value: credentials.loginId },
                { label: 'Password', value: credentials.password },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-mono text-sm">{value}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => copyText(label, value)}>
                    {copied === label ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
              ))}
              <Button className="w-full" onClick={() => { setDialogOpen(false); setCredentials(null) }}>Close</Button>
            </div>
          ) : (
            /* Form */
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Full Name *</Label>
                  <Input
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Rahul Sharma" className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Login ID</Label>
                  <Input
                    value={form.loginId} onChange={e => setForm(f => ({ ...f, loginId: e.target.value }))}
                    placeholder="rahul.sharma (or email)" className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Email *</Label>
                  <Input
                    type="email" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="rahul@example.com" className="h-8 text-sm"
                    disabled={!!editingUser}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input
                    value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="9876543210" className="h-8 text-sm"
                  />
                </div>
              </div>
              {!editingUser && (
                <div className="space-y-1">
                  <Label className="text-xs">Password <span className="text-muted-foreground">(leave blank to auto-generate)</span></Label>
                  <Input
                    type="password" value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min 8 characters" className="h-8 text-sm"
                  />
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">System Role *</Label>
                  <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SYSTEM_ROLES.map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Custom Role <span className="text-muted-foreground">(optional)</span></Label>
                  <Select
                    value={form.businessRoleId || '_none'}
                    onValueChange={v => setForm(f => ({ ...f, businessRoleId: v === '_none' ? '' : v }))}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {roles.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Store Assignment */}
              <div className="space-y-2">
                <Label className="text-xs">Assigned Stores <span className="text-muted-foreground">(leave empty = all stores)</span></Label>
                {stores.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No stores found</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {stores.map(s => {
                      const selected = form.storeIds.includes(s.id)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleStore(s.id)}
                          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                            selected
                              ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                              : 'border-border hover:bg-muted/50'
                          }`}
                        >
                          <Store className="size-3 shrink-0" />
                          <span className="truncate">{s.name}</span>
                          {selected && <Check className="ml-auto size-3 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <Label className="text-xs">Status</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{form.isActive ? 'Active' : 'Inactive'}</span>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))}
                  />
                </div>
              </div>

              {saveError && (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  <AlertCircle className="size-3.5 shrink-0" /> {saveError}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="mr-2 size-3.5 animate-spin" />}
                  {editingUser ? 'Save Changes' : 'Create User'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialog.open} onOpenChange={open => setResetDialog(s => ({ ...s, open }))}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Set a new password for <strong>{resetDialog.user?.user.name}</strong>
            </p>
            <div className="space-y-1">
              <Label className="text-xs">New Password</Label>
              <Input
                type="password" value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 8 characters" className="h-8 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setResetDialog({ open: false, user: null })}>Cancel</Button>
            <Button size="sm" onClick={handleResetPassword} disabled={resetting || !newPassword}>
              {resetting && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
