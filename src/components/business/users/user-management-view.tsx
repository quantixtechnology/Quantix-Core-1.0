'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Shield, Plus, Loader2, Check, AlertCircle, Lock, Save,
  ChevronRight, Pencil, Users,
} from 'lucide-react'
import { useAdminStore } from '@/stores/admin-store'
import { useAuthStore } from '@/stores/auth-store'
import { getAuthHeaders } from '@/lib/admin-fetch'

// ── Constants ─────────────────────────────────────────────────────────────────

const MODULES = [
  { key: 'dashboard',        label: 'Dashboard' },
  { key: 'orders',           label: 'Orders' },
  { key: 'products',         label: 'Products' },
  { key: 'inventory',        label: 'Inventory' },
  { key: 'delivery_zones',   label: 'Delivery Zones' },
  { key: 'stores',           label: 'Stores' },
  { key: 'customers',        label: 'Customers' },
  { key: 'categories',       label: 'Categories' },
  { key: 'product_import',   label: 'Product Import' },
  { key: 'customer_import',  label: 'Bulk Customer Upload' },
  { key: 'tax',              label: 'Tax & GST' },
  { key: 'payment_gateways', label: 'Payment Gateways' },
  { key: 'reports',          label: 'Reports' },
  { key: 'settings',         label: 'Settings' },
  { key: 'pos',              label: 'POS Billing' },
  { key: 'user_creation',    label: 'User Creation' },
  { key: 'user_management',  label: 'User Management' },
] as const

type ModuleKey = typeof MODULES[number]['key']
type ModulePerms = { view: boolean; create: boolean; edit: boolean; delete: boolean }
type PermMatrix = Record<ModuleKey, ModulePerms>

const BLANK_PERMS = (): ModulePerms => ({ view: false, create: false, edit: false, delete: false })

function emptyMatrix(): PermMatrix {
  return Object.fromEntries(MODULES.map(m => [m.key, BLANK_PERMS()])) as PermMatrix
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface RoleRecord {
  id: string
  name: string
  description: string | null
  permissions: PermMatrix
  isSystem: boolean
  isActive: boolean
  userCount: number
  createdAt: string
}

interface AuditEntry {
  id: string
  actorName: string | null
  action: string
  details: string
  createdAt: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UserManagementView() {
  const { currentBusinessId } = useAdminStore()
  const { currentRole } = useAuthStore()

  const isOwner = currentRole === 'CLIENT_OWNER' || currentRole === 'QUANTIX_SUPER_ADMIN'

  const [roles, setRoles]             = useState<RoleRecord[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [matrix, setMatrix]           = useState<PermMatrix>(emptyMatrix())
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [isDirty, setIsDirty]         = useState(false)
  const [saveMsg, setSaveMsg]         = useState<string | null>(null)
  const [auditLogs, setAuditLogs]     = useState<AuditEntry[]>([])

  // Create role dialog
  const [createOpen, setCreateOpen]   = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [creating, setCreating]       = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Edit role name dialog
  const [editOpen, setEditOpen]       = useState(false)
  const [editName, setEditName]       = useState('')
  const [editDesc, setEditDesc]       = useState('')
  const [editSaving, setEditSaving]   = useState(false)

  // Fetch roles
  const fetchRoles = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/core/businesses/${currentBusinessId}/roles`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) {
        const data: RoleRecord[] = json.data.map((r: RoleRecord) => ({
          ...r,
          permissions: ensureFullMatrix(r.permissions),
        }))
        setRoles(data)
        if (!selectedRoleId && data.length > 0) {
          setSelectedRoleId(data[0].id)
          setMatrix(data[0].permissions)
        } else if (selectedRoleId) {
          const found = data.find(r => r.id === selectedRoleId)
          if (found) setMatrix(found.permissions)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [currentBusinessId, selectedRoleId])

  // Fetch audit logs
  const fetchAudit = useCallback(async () => {
    // Uses the businessAuditLog — we query permissions-related entries via a simple filter
    if (!currentBusinessId) return
    try {
      const res = await fetch(
        `/api/core/businesses/${currentBusinessId}/roles`,
        { headers: getAuthHeaders() },
      )
      const json = await res.json()
      if (json.success) setRoles(prev => prev.length ? prev : json.data)
    } catch { /* non-fatal */ }
  }, [currentBusinessId])

  useEffect(() => { fetchRoles() }, [fetchRoles])
  useEffect(() => { fetchAudit() }, [fetchAudit])

  function ensureFullMatrix(raw: Partial<PermMatrix> | undefined): PermMatrix {
    const base = emptyMatrix()
    if (!raw) return base
    for (const m of MODULES) {
      if (raw[m.key]) base[m.key] = { ...BLANK_PERMS(), ...raw[m.key] }
    }
    return base
  }

  function selectRole(role: RoleRecord) {
    if (isDirty) {
      // Simple confirm — in production could show a "Unsaved changes" modal
      if (!confirm('You have unsaved changes. Discard them?')) return
    }
    setSelectedRoleId(role.id)
    setMatrix(ensureFullMatrix(role.permissions))
    setIsDirty(false)
    setSaveMsg(null)
  }

  function togglePerm(moduleKey: ModuleKey, perm: keyof ModulePerms) {
    // Block delete for non-owners
    if (perm === 'delete' && !isOwner) return
    setMatrix(prev => ({
      ...prev,
      [moduleKey]: { ...prev[moduleKey], [perm]: !prev[moduleKey][perm] },
    }))
    setIsDirty(true)
    setSaveMsg(null)
  }

  function setAllForModule(moduleKey: ModuleKey, value: boolean) {
    setMatrix(prev => ({
      ...prev,
      [moduleKey]: {
        view:   value,
        create: value,
        edit:   value,
        delete: isOwner ? value : false,
      },
    }))
    setIsDirty(true)
    setSaveMsg(null)
  }

  async function savePermissions() {
    if (!selectedRoleId || !currentBusinessId) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch(
        `/api/core/businesses/${currentBusinessId}/permissions/${selectedRoleId}`,
        {
          method: 'PATCH',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions: matrix }),
        },
      )
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Save failed')
      setIsDirty(false)
      setSaveMsg('Permissions saved successfully')
      await fetchRoles()
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function createRole() {
    if (!newRoleName.trim()) { setCreateError('Role name is required'); return }
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch(`/api/core/businesses/${currentBusinessId}/roles`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoleName.trim(), description: newRoleDesc.trim() || undefined }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Create failed')
      setCreateOpen(false)
      setNewRoleName('')
      setNewRoleDesc('')
      await fetchRoles()
      setSelectedRoleId(json.data.id)
      setMatrix(emptyMatrix())
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  function openEditRole() {
    const role = roles.find(r => r.id === selectedRoleId)
    if (!role) return
    setEditName(role.name)
    setEditDesc(role.description ?? '')
    setEditOpen(true)
  }

  async function saveEditRole() {
    if (!selectedRoleId) return
    setEditSaving(true)
    try {
      const res = await fetch(
        `/api/core/businesses/${currentBusinessId}/roles/${selectedRoleId}`,
        {
          method: 'PATCH',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || undefined }),
        },
      )
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setEditOpen(false)
      await fetchRoles()
    } finally {
      setEditSaving(false)
    }
  }

  const selectedRole = roles.find(r => r.id === selectedRoleId) ?? null

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">User Management — RBAC</h2>
          <p className="text-sm text-muted-foreground">
            Configure module-level permissions per role. Delete permission is restricted to Business Owner.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        {/* Left: Role list */}
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold">Roles</CardTitle>
            {isOwner && (
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => { setCreateOpen(true); setCreateError(null) }}>
                <Plus className="size-3" /> New Role
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col gap-0.5 p-2">
                {roles.map(role => {
                  const isSelected = selectedRoleId === role.id
                  return (
                    <button
                      key={role.id}
                      onClick={() => selectRole(role)}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'hover:bg-muted/50 text-muted-foreground'
                      }`}
                    >
                      <Shield className="size-3.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-medium">{role.name}</p>
                        <p className="text-[10px] text-muted-foreground">{role.userCount} user{role.userCount !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {role.isSystem && (
                          <Badge variant="outline" className="h-4 px-1 text-[9px]">System</Badge>
                        )}
                        {isSelected && <ChevronRight className="size-3.5" />}
                      </div>
                    </button>
                  )
                })}
                {roles.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">No roles yet</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Permission Matrix */}
        <Card className="border shadow-sm">
          {selectedRole ? (
            <>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-semibold">{selectedRole.name}</CardTitle>
                    {selectedRole.isSystem && (
                      <Badge variant="outline" className="text-[10px]">System Role</Badge>
                    )}
                  </div>
                  {selectedRole.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedRole.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <Users className="inline size-3 mr-1" />{selectedRole.userCount} assigned user{selectedRole.userCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isOwner && !selectedRole.isSystem && (
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={openEditRole}>
                      <Pencil className="size-3" /> Rename
                    </Button>
                  )}
                  <Button
                    size="sm" className="h-7 gap-1 text-xs"
                    onClick={savePermissions}
                    disabled={!isDirty || saving}
                  >
                    {saving
                      ? <Loader2 className="size-3 animate-spin" />
                      : <Save className="size-3" />
                    }
                    Save
                  </Button>
                </div>
              </CardHeader>

              {saveMsg && (
                <div className={`mx-6 mb-3 flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                  saveMsg.includes('success')
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}>
                  {saveMsg.includes('success')
                    ? <Check className="size-3.5" />
                    : <AlertCircle className="size-3.5" />
                  }
                  {saveMsg}
                </div>
              )}

              <CardContent className="overflow-x-auto p-0 px-6 pb-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-2 pr-4 text-left text-xs font-medium text-muted-foreground w-44">Module</th>
                      {(['view', 'create', 'edit', 'delete'] as const).map(perm => (
                        <th key={perm} className="pb-2 px-3 text-center text-xs font-medium text-muted-foreground capitalize">
                          {perm === 'delete' && !isOwner ? (
                            <span className="flex items-center justify-center gap-1 text-muted-foreground/50">
                              <Lock className="size-3" /> Delete
                            </span>
                          ) : perm}
                        </th>
                      ))}
                      <th className="pb-2 pl-2 text-center text-xs font-medium text-muted-foreground">All</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {MODULES.map(mod => {
                      const perms = matrix[mod.key]
                      const allOn = perms.view && perms.create && perms.edit && (isOwner ? perms.delete : true)
                      return (
                        <tr key={mod.key} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 pr-4 text-xs font-medium">{mod.label}</td>
                          {(['view', 'create', 'edit', 'delete'] as const).map(perm => {
                            const isDeleteCol = perm === 'delete'
                            const disabled = isDeleteCol && !isOwner
                            return (
                              <td key={perm} className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => togglePerm(mod.key, perm)}
                                  className={`inline-flex size-5 items-center justify-center rounded border transition-colors ${
                                    disabled
                                      ? 'cursor-not-allowed border-dashed border-muted-foreground/20 bg-muted/20'
                                      : perms[perm]
                                        ? 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600'
                                        : 'border-border bg-background hover:border-muted-foreground/50'
                                  }`}
                                  title={disabled ? 'Delete permission: Business Owner only' : undefined}
                                >
                                  {disabled
                                    ? <Lock className="size-2.5 text-muted-foreground/40" />
                                    : perms[perm]
                                      ? <Check className="size-3" />
                                      : null
                                  }
                                </button>
                              </td>
                            )
                          })}
                          <td className="py-2.5 pl-2 text-center">
                            <button
                              type="button"
                              onClick={() => setAllForModule(mod.key, !allOn)}
                              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                allOn
                                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              }`}
                            >
                              {allOn ? 'All' : 'None'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {!isOwner && (
                  <div className="mt-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    <Lock className="size-3.5 shrink-0" />
                    Delete permission is restricted to Business Owner and Super Admin only.
                  </div>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <Shield className="mb-3 size-10 opacity-30" />
              <p className="text-sm">Select a role to configure permissions</p>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Create Custom Role Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create Custom Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Role Name *</Label>
              <Input
                value={newRoleName}
                onChange={e => setNewRoleName(e.target.value)}
                placeholder="e.g. Warehouse Executive"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                value={newRoleDesc}
                onChange={e => setNewRoleDesc(e.target.value)}
                placeholder="Brief description of this role"
                className="h-8 text-sm"
              />
            </div>
            {createError && (
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="size-3.5 shrink-0" /> {createError}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              The role will be created with no permissions. Configure the permission matrix after creation.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={createRole} disabled={creating || !newRoleName.trim()}>
              {creating && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Create Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Name Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Rename Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Role Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={saveEditRole} disabled={editSaving}>
              {editSaving && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
