"use client"

import { useState, useEffect } from "react"
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"

type Department = {
  id: string
  businessId: string
  storeId: string | null
  code: string
  name: string
  enabled: boolean
  sequence: number
}

export function LaundryDepartmentsView({ businessId }: { businessId: string }) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [form, setForm] = useState({ code: "", name: "", enabled: true, sequence: 0 })

  const fetchDepartments = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/laundry/departments?businessId=${businessId}`)
      if (res.ok) setDepartments(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchDepartments() }, [businessId])

  const openCreate = () => {
    setEditingDept(null)
    const nextSeq = departments.length > 0 ? Math.max(...departments.map(d => d.sequence)) + 1 : 0
    setForm({ code: "", name: "", enabled: true, sequence: nextSeq })
    setDialogOpen(true)
  }

  const openEdit = (dept: Department) => {
    setEditingDept(dept)
    setForm({ code: dept.code, name: dept.name, enabled: dept.enabled, sequence: dept.sequence })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.code || !form.name) return
    const url = editingDept
      ? `/api/laundry/departments/${editingDept.id}`
      : "/api/laundry/departments"
    const method = editingDept ? "PUT" : "POST"
    const body = editingDept
      ? form
      : { ...form, businessId, storeId: null }

    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    if (res.ok) {
      setDialogOpen(false)
      fetchDepartments()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this department?")) return
    const res = await fetch(`/api/laundry/departments/${id}`, { method: "DELETE" })
    if (res.ok) fetchDepartments()
  }

  const handleToggle = async (dept: Department) => {
    await fetch(`/api/laundry/departments/${dept.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !dept.enabled }),
    })
    fetchDepartments()
  }

  const reorder = async (id: string, newSeq: number) => {
    await fetch(`/api/laundry/departments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sequence: newSeq }),
    })
    fetchDepartments()
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    const sorted = [...departments].sort((a, b) => a.sequence - b.sequence)
    const current = sorted[index]
    const prev = sorted[index - 1]
    reorder(current.id, prev.sequence)
    reorder(prev.id, current.sequence)
  }

  const moveDown = (index: number) => {
    const sorted = [...departments].sort((a, b) => a.sequence - b.sequence)
    if (index >= sorted.length - 1) return
    const current = sorted[index]
    const next = sorted[index + 1]
    reorder(current.id, next.sequence)
    reorder(next.id, current.sequence)
  }

  if (loading) return <div className="py-8 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>

  const sorted = [...departments].sort((a, b) => a.sequence - b.sequence)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Departments ({departments.length})</h2>
        <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> Add Department</Button>
      </div>

      {departments.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No departments configured. Add departments to define operational areas.
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-xs font-medium text-muted-foreground w-16">Seq</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Code</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Name</th>
                <th className="text-center p-3 text-xs font-medium text-muted-foreground w-24">Enabled</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((dept, index) => (
                <tr key={dept.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-mono text-muted-foreground w-4">{dept.sequence}</span>
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveUp(index)} disabled={index === 0} className="disabled:opacity-20 hover:text-foreground text-muted-foreground"><ArrowUp className="h-3 w-3" /></button>
                        <button onClick={() => moveDown(index)} disabled={index === sorted.length - 1} className="disabled:opacity-20 hover:text-foreground text-muted-foreground"><ArrowDown className="h-3 w-3" /></button>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{dept.code}</code>
                  </td>
                  <td className="p-3 text-sm font-medium">{dept.name}</td>
                  <td className="p-3 text-center">
                    <Switch checked={dept.enabled} onCheckedChange={() => handleToggle(dept)} />
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(dept)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => handleDelete(dept.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
            <DialogTitle>{editingDept ? "Edit Department" : "Add Department"}</DialogTitle>
            <DialogDescription>Configure department for this laundry business.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase().replace(/\s+/g, "_") }))}
                  placeholder="WASHING"
                />
              </div>
              <div className="space-y-2">
                <Label>Sequence</Label>
                <Input type="number" value={form.sequence} onChange={e => setForm(p => ({ ...p, sequence: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Washing Department" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.enabled} onCheckedChange={v => setForm(p => ({ ...p, enabled: v }))} />
              <Label className="text-sm">Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.code || !form.name}>{editingDept ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
