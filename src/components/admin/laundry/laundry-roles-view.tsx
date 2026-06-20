"use client"

import { useEffect, useState } from "react"
import { UserCog, Plus, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface LaundryRole {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
}

export function LaundryRolesView() {
  const { toast } = useToast()
  const [roles, setRoles] = useState<LaundryRole[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingRole, setEditingRole] = useState<LaundryRole | null>(null)

  const [newRole, setNewRole] = useState({
    code: "", name: "", description: "", isActive: true,
  })

  const fetchRoles = async () => {
    try {
      const res = await fetch("/api/laundry/roles")
      const data = await res.json()
      setRoles(data)
    } catch {
      toast({ title: "Error", description: "Failed to load roles", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRoles() }, [])

  const handleCreate = async () => {
    if (!newRole.code || !newRole.name) {
      toast({ title: "Validation", description: "Code and name are required", variant: "destructive" })
      return
    }
    try {
      const res = await fetch("/api/laundry/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRole),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      toast({ title: "Success", description: "Role created" })
      setShowCreate(false)
      setNewRole({ code: "", name: "", description: "", isActive: true })
      fetchRoles()
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" })
    }
  }

  const handleUpdate = async () => {
    if (!editingRole) return
    try {
      const res = await fetch(`/api/laundry/roles/${editingRole.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingRole),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      toast({ title: "Success", description: "Role updated" })
      setEditingRole(null)
      fetchRoles()
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/laundry/roles/${id}`, { method: "DELETE" })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      toast({ title: "Success", description: "Role deleted" })
      fetchRoles()
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" })
    }
  }

  const handleToggleActive = async (role: LaundryRole) => {
    try {
      const res = await fetch(`/api/laundry/roles/${role.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !role.isActive }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      fetchRoles()
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
            <UserCog className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Laundry Roles</h1>
            <p className="text-sm text-muted-foreground">Manage roles for laundry workflow access</p>
          </div>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Role
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Laundry Role</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={newRole.code}
                  onChange={(e) => setNewRole({ ...newRole, code: e.target.value.toUpperCase().replace(/\s+/g, "_") })}
                  placeholder="ROLE_CODE"
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newRole.name}
                  onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                  placeholder="Role Name"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newRole.description}
                  onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={newRole.isActive}
                  onCheckedChange={(v) => setNewRole({ ...newRole, isActive: v === true })}
                />
                <Label className="text-sm">Active</Label>
              </div>
              <Button onClick={handleCreate} className="w-full">Create Role</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Code</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Name</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Description</th>
                <th className="text-center p-3 text-xs font-medium text-muted-foreground w-24">Status</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{role.code}</code>
                  </td>
                  <td className="p-3 text-sm font-medium">{role.name}</td>
                  <td className="p-3 text-sm text-muted-foreground max-w-[250px] truncate">
                    {role.description || "—"}
                  </td>
                  <td className="p-3 text-center">
                    <Switch checked={role.isActive} onCheckedChange={() => handleToggleActive(role)} />
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingRole(role)}>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => handleDelete(role.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {roles.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                    No roles created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!editingRole} onOpenChange={(o) => { if (!o) setEditingRole(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
          </DialogHeader>
          {editingRole && (
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={editingRole.code}
                  onChange={(e) => setEditingRole({ ...editingRole, code: e.target.value.toUpperCase().replace(/\s+/g, "_") })}
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={editingRole.name}
                  onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingRole.description || ""}
                  onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editingRole.isActive}
                  onCheckedChange={(v) => setEditingRole({ ...editingRole, isActive: v === true })}
                />
                <Label className="text-sm">Active</Label>
              </div>
              <Button onClick={handleUpdate} className="w-full">Update Role</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
