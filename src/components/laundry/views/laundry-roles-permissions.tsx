"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Shield, Plus, Copy, Trash2, ChevronDown, ChevronRight, Search, Save, Lock, Users } from "lucide-react"

interface ScreenEntry { key: string; label: string }
interface ModuleEntry { key: string; label: string; screens: ScreenEntry[] }
interface Role { id: string; code: string; name: string; description: string | null; isSystem: boolean; isOwner: boolean; isActive: boolean; _count?: { permissions: number; assignments: number } }

const LEVELS = [
  { value: 0, label: "Hide" },
  { value: 1, label: "View" },
  { value: 2, label: "Create" },
  { value: 3, label: "Edit" },
]

const levelLabel = (l: number) => LEVELS.find((x) => x.value === l)?.label || "Hide"

export function LaundryRolesPermissions({ businessId: bizProp }: { businessId?: string }) {
  const { currentBusinessId } = useAuthStore()
  const businessId = bizProp || currentBusinessId
  const { toast } = useToast()
  const [moduleData, setModuleData] = useState<ModuleEntry[]>([])
  const [levelDefs] = useState<Record<number, string>>({
    1: "View — Read-only (search, filter, print, export, lookup, scan)",
    2: "Create — Create records + workflow progression (process, pack, dispatch, receive, deliver)",
    3: "Edit — Destructive/exceptional actions (delete, cancel, reject, override, reverse workflow)",
  })
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [levels, setLevels] = useState<Record<string, number>>({})
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)
  const [deleting, setDeleting] = useState(false)

  const selected = roles.find((r) => r.id === selectedId) || null

  const allScreenKeys = useMemo(() => moduleData.flatMap((m) => m.screens.map((s) => `${m.key}.${s.key}`)), [moduleData])

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    setLoadError(null)
    try {
      const [c, r] = await Promise.all([
        fetch(`/api/laundry/rbac/catalog`).then((x) => x.json()),
        fetch(`/api/laundry/rbac/roles?businessId=${businessId}`).then((x) => x.json()),
      ])
      if (c.success) {
        const modules = c.data.modules || c.data
        setModuleData(modules)
        setExpanded(new Set(modules.map((m: ModuleEntry) => m.key)))
      }
      if (r.success) setRoles(r.data)
      else if (r.error) setLoadError(r.error === "FORBIDDEN" ? "You don't have permission to view roles." : r.error)
    } catch { setLoadError("Failed to load roles. Check your connection.") } finally { setLoading(false) }
  }, [businessId])
  useEffect(() => { load() }, [load])

  const selectRole = async (r: Role) => {
    setSelectedId(r.id); setName(r.name); setDescription(r.description || ""); setDirty(false)
    if (r.isOwner) {
      const full: Record<string, number> = {}
      for (const sk of allScreenKeys) full[sk] = 3
      setLevels(full)
      return
    }
    const j = await fetch(`/api/laundry/rbac/roles/${r.id}/permissions?businessId=${businessId}`).then((x) => x.json())
    if (j.success) setLevels(j.data.levels || {})
  }

  const setLevel = (screenKey: string, newLevel: number) => {
    if (selected?.isOwner) return
    setLevels((prev) => ({ ...prev, [screenKey]: newLevel }))
    setDirty(true)
  }

  const countSelected = () => Object.values(levels).filter((v) => v >= 1).length
  const setAllLevel = (lvl: number) => {
    if (selected?.isOwner) return
    const next: Record<string, number> = {}
    for (const sk of allScreenKeys) next[sk] = lvl
    setLevels(next)
    setDirty(true)
  }

  const save = async () => {
    if (!selected || selected.isOwner) return
    setSaving(true)
    try {
      await fetch(`/api/laundry/rbac/roles/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, name, description }) })
      const res = await fetch(`/api/laundry/rbac/roles/${selected.id}/permissions`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, screens: levels }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Save failed")
      toast({ title: "Role saved", description: `${name} · ${countSelected()} screens with access` }); setDirty(false); load()
    } catch (e) { toast({ title: "Save failed", description: e instanceof Error ? e.message : "", variant: "destructive" }) } finally { setSaving(false) }
  }

  const openNewRole = () => { setNewName(""); setNewDesc(""); setNewOpen(true) }
  const createRole = async () => {
    const nm = newName.trim(); if (!nm) { toast({ title: "Role name is required", variant: "destructive" }); return }
    setCreating(true)
    try {
      const j = await fetch(`/api/laundry/rbac/roles`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, name: nm, description: newDesc.trim() || null, screens: {} }) }).then((x) => x.json())
      if (j.success) { setNewOpen(false); await load(); selectRole(j.data) } else toast({ title: "Create failed", description: j.error, variant: "destructive" })
    } finally { setCreating(false) }
  }
  const clone = async (r: Role) => {
    const j = await fetch(`/api/laundry/rbac/roles/${r.id}/clone`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId }) }).then((x) => x.json())
    if (j.success) { toast({ title: "Role cloned", description: j.data.name }); await load(); selectRole(j.data) } else toast({ title: "Clone failed", description: j.error, variant: "destructive" })
  }
  const confirmDelete = async () => {
    const r = deleteTarget; if (!r || r.isOwner) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/laundry/rbac/roles/${r.id}?businessId=${businessId}`, { method: "DELETE" })
      const j = await res.json()
      if (!res.ok || !j.success) { toast({ title: "Delete failed", description: j.error, variant: "destructive" }); return }
      toast({ title: "Role deleted" }); setDeleteTarget(null); setSelectedId(null); load()
    } finally { setDeleting(false) }
  }
  const seed = async () => {
    const j = await fetch(`/api/laundry/rbac/seed`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId }) }).then((x) => x.json())
    if (j.success) { toast({ title: "Default roles created", description: `${j.data.seeded.length} system roles` }); load() } else toast({ title: "Failed", description: j.error, variant: "destructive" })
  }

  const q = search.trim().toLowerCase()
  const matchScreen = (m: ModuleEntry, s: ScreenEntry) => !q || m.label.toLowerCase().includes(q) || s.label.toLowerCase().includes(q)

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>

  return (
    <div className="px-4 lg:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><Shield className="h-5 w-5 text-blue-600" /> Roles &amp; Permissions</h1><p className="text-sm text-slate-500">Control what every employee can see and do. Each screen has a access level: View, Create, or Edit.</p></div>
        <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={openNewRole}><Plus className="h-4 w-4" /> New Role</Button>
      </div>

      {roles.length === 0 ? (
        <Card><CardContent className="text-center py-16">
          <Shield className={`h-8 w-8 mx-auto mb-2 ${loadError ? "text-rose-300" : "text-muted-foreground/40"}`} />
          <p className="text-sm font-medium">{loadError || "No roles yet"}</p>
          {!loadError && <p className="text-xs text-muted-foreground mt-1 mb-3">Create the default system roles to get started.</p>}
          {!loadError && <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={seed}>Create Default Roles</Button>}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 items-start">
          <Card><CardContent className="p-2 space-y-1">
            {roles.map((r) => (
              <button key={r.id} onClick={() => selectRole(r)} className={`w-full text-left rounded-lg px-3 py-2 border ${selectedId === r.id ? "border-blue-300 bg-blue-50" : "border-transparent hover:bg-slate-50"} ${r.isActive ? "" : "opacity-50"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800 flex items-center gap-1.5">{r.isOwner && <Lock className="h-3 w-3 text-amber-500" />}{r.name}</span>
                  <Badge variant="outline" className={`text-[9px] ${r.isSystem ? "border-slate-300 text-slate-500" : "border-blue-200 text-blue-600"}`}>{r.isOwner ? "Owner" : r.isSystem ? "System" : "Custom"}</Badge>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{r.isOwner ? "Full access" : `${r._count?.permissions ?? 0} screens`} · {r._count?.assignments ?? 0} staff</p>
              </button>
            ))}
          </CardContent></Card>

          {selected ? (
            <Card><CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px] space-y-1.5">
                  <Input value={name} onChange={(e) => { setName(e.target.value); setDirty(true) }} disabled={selected.isOwner} className="font-semibold" />
                  <Input value={description} onChange={(e) => { setDescription(e.target.value); setDirty(true) }} disabled={selected.isOwner} placeholder="Description" className="text-xs h-8" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => clone(selected)}><Copy className="h-3.5 w-3.5" /> Clone</Button>
                  {!selected.isOwner && <Button size="sm" variant="outline" className="h-8 gap-1 text-rose-600 border-rose-200" onClick={() => setDeleteTarget(selected)}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>}
                  <Button size="sm" className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-white" disabled={saving || !dirty || selected.isOwner} onClick={save}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save</Button>
                </div>
              </div>

              {selected.isOwner ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700 flex items-center gap-2"><Lock className="h-4 w-4" /> The Business Owner always has full, unremovable access. This role cannot be edited or deleted.</div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search screens…" className="pl-8 h-8 text-sm" /></div>
                    <Select onValueChange={(v) => setAllLevel(Number(v))}>
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue placeholder="Set all to…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Hide all</SelectItem>
                        <SelectItem value="1">View all</SelectItem>
                        <SelectItem value="2">Create all</SelectItem>
                        <SelectItem value="3">Edit all</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-slate-400">{countSelected()} screens with access</span>
                  </div>

                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {moduleData.map((m) => {
                      const open = expanded.has(m.key)
                      const visScreens = m.screens.filter((s) => matchScreen(m, s))
                      if (q && visScreens.length === 0) return null
                      return (
                        <div key={m.key} className="rounded-lg border border-slate-200">
                          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-t-lg">
                            <button className="flex items-center gap-1.5 text-sm font-semibold text-slate-700" onClick={() => setExpanded((e) => { const n = new Set(e); n.has(m.key) ? n.delete(m.key) : n.add(m.key); return n })}>
                              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} {m.label}
                            </button>
                          </div>
                          {open && (
                            <div className="p-2 space-y-1.5">
                              {visScreens.map((s) => {
                                const sk = `${m.key}.${s.key}`
                                const currentLevel = levels[sk] ?? 0
                                return (
                                  <div key={s.key} className="grid grid-cols-[1fr_140px] gap-2 items-center px-1.5 py-1 border-b border-slate-50 last:border-0">
                                    <span className="text-xs font-medium text-slate-600">{s.label}</span>
                                    <Select value={String(currentLevel)} onValueChange={(v) => setLevel(sk, Number(v))}>
                                      <SelectTrigger className={`h-7 text-xs ${currentLevel === 0 ? "text-slate-400" : currentLevel === 1 ? "text-blue-600" : currentLevel === 2 ? "text-amber-600" : "text-rose-600"}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="0">Hide</SelectItem>
                                        <SelectItem value="1">View</SelectItem>
                                        <SelectItem value="2">Create</SelectItem>
                                        <SelectItem value="3">Edit</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </CardContent></Card>
          ) : (
            <Card><CardContent className="py-16 text-center text-sm text-slate-400"><Users className="h-6 w-6 mx-auto mb-2 text-slate-300" />Select a role to view or edit its permissions.</CardContent></Card>
          )}
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-blue-600" /> New Role</DialogTitle>
            <DialogDescription>Create a custom role. You can set its permissions right after.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Role name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Reception Supervisor" autoFocus onKeyDown={(e) => { if (e.key === "Enter") createRole() }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Description <span className="text-slate-400">(optional)</span></Label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What this role is for" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button type="button" onClick={createRole} disabled={creating || !newName.trim()} className="bg-blue-600 hover:bg-blue-700 text-white gap-1">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600"><Trash2 className="h-5 w-5" /> Delete Role</DialogTitle>
            <DialogDescription>
              Delete role <span className="font-semibold text-slate-700">“{deleteTarget?.name}”</span>? Employees on this role lose it and fall back to their default access. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" onClick={confirmDelete} disabled={deleting} className="bg-rose-600 hover:bg-rose-700 text-white gap-1">{deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
