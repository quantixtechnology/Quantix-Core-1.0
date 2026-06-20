"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"

type Store = { id: string; storeName: string; storeCode: string; storeType: string }
type Department = { id: string; code: string; name: string; enabled: boolean }
type Role = { id: string; code: string; name: string; isActive: boolean }
type Assignment = {
  id: string
  businessId: string
  storeId: string | null
  departmentId: string | null
  roleId: string
  userId: string | null
  active: boolean
  store: { id: string; storeName: string; storeCode: string } | null
  department: { id: string; name: string; code: string } | null
  role: { id: string; name: string; code: string }
}

export function LaundryAssignmentsView({ businessId }: { businessId: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ storeId: "", departmentId: "", roleId: "" })

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [assignRes, storesRes, deptsRes, rolesRes] = await Promise.all([
        fetch(`/api/laundry/assignments?businessId=${businessId}`),
        fetch(`/api/laundry/businesses/${businessId}/stores`),
        fetch(`/api/laundry/departments?businessId=${businessId}`),
        fetch("/api/laundry/roles"),
      ])
      const [assignData, storesData, deptsData, rolesData] = await Promise.all([
        assignRes.json(), storesRes.json(), deptsRes.json(), rolesRes.json(),
      ])
      setAssignments(assignData)
      setStores(storesData)
      setDepartments(deptsData)
      setRoles(rolesData)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [businessId])

  const handleCreate = async () => {
    if (!form.roleId) return
    const res = await fetch("/api/laundry/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId,
        storeId: form.storeId || null,
        departmentId: form.departmentId || null,
        roleId: form.roleId,
        userId: null,
        active: true,
      }),
    })
    if (res.ok) {
      setDialogOpen(false)
      setForm({ storeId: "", departmentId: "", roleId: "" })
      fetchAll()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this assignment?")) return
    const res = await fetch(`/api/laundry/assignments/${id}`, { method: "DELETE" })
    if (res.ok) fetchAll()
  }

  const handleToggleActive = async (assignment: Assignment) => {
    await fetch(`/api/laundry/assignments/${assignment.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !assignment.active }),
    })
    fetchAll()
  }

  const getStoreName = (id: string | null) => stores.find(s => s.id === id)?.storeName || "All Stores"
  const getDeptName = (id: string | null) => departments.find(d => d.id === id)?.name || "All Departments"
  const activeRoles = roles.filter(r => r.isActive !== false)

  if (loading) return <div className="py-8 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Assignments ({assignments.length})</h2>
        <Button size="sm" onClick={() => { setForm({ storeId: "", departmentId: "", roleId: "" }); setDialogOpen(true) }}>
          <Plus className="mr-1 h-4 w-4" /> Add Assignment
        </Button>
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No assignments configured. Assign roles to stores and departments.
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Role</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Store</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Department</th>
                <th className="text-center p-3 text-xs font-medium text-muted-foreground w-20">Active</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map(a => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <Badge variant="outline">{a.role.name}</Badge>
                  </td>
                  <td className="p-3 text-sm">
                    {a.store ? (
                      <span className="font-mono text-xs">{a.store.storeName} ({a.store.storeCode})</span>
                    ) : (
                      <span className="text-muted-foreground italic">All Stores</span>
                    )}
                  </td>
                  <td className="p-3 text-sm">
                    {a.department ? (
                      <span>{a.department.name}</span>
                    ) : (
                      <span className="text-muted-foreground italic">All Departments</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleToggleActive(a)}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        a.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {a.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => handleDelete(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Assignment</DialogTitle>
            <DialogDescription>Assign a role to a store and/or department.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={form.roleId} onValueChange={v => setForm(p => ({ ...p, roleId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                <SelectContent>
                  {activeRoles.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name} ({r.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Store (optional — leave blank for all stores)</Label>
              <Select value={form.storeId} onValueChange={v => setForm(p => ({ ...p, storeId: v }))}>
                <SelectTrigger><SelectValue placeholder="All Stores" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Stores</SelectItem>
                  {stores.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.storeName} ({s.storeCode})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department (optional — leave blank for all departments)</Label>
              <Select value={form.departmentId} onValueChange={v => setForm(p => ({ ...p, departmentId: v }))}>
                <SelectTrigger><SelectValue placeholder="All Departments" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Departments</SelectItem>
                  {departments.filter(d => d.enabled).map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name} ({d.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!form.roleId}>Create Assignment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
