"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Plus, Pencil, Trash2, Link2 } from "lucide-react"
import { toast } from "sonner"

interface Employee { id: string; employeeCode: string; name: string }

interface OwnershipAssignment {
  id: string
  hrmsBusinessId: string
  clientBusinessId: string
  signupOwnerId?: string
  renewalOwnerId?: string
  addonOwnerId?: string
  assignedBy?: string
  notes?: string
  signupOwner?: Employee
  renewalOwner?: Employee
  addonOwner?: Employee
}

const EMPTY_FORM = {
  clientBusinessId: "", signupOwnerId: "", renewalOwnerId: "", addonOwnerId: "", notes: "",
}

export function HrmsOwnershipView() {
  const [businessId, setBusinessId] = useState("")
  const [assignments, setAssignments] = useState<OwnershipAssignment[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<OwnershipAssignment | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/admin/hrms/settings")
      .then((r) => r.json())
      .then((j) => { if (j.success && j.data?.businessId) setBusinessId(j.data.businessId) })
      .catch(() => {})
  }, [])

  const loadEmployees = useCallback(async () => {
    if (!businessId) return
    const res = await fetch(`/api/admin/hrms/employees?businessId=${businessId}&limit=200`)
    const json = await res.json()
    if (json.success) setEmployees(json.data)
  }, [businessId])

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/hrms/ownership?hrmsBusinessId=${businessId}`)
      const json = await res.json()
      if (json.success) setAssignments(json.data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [businessId])

  useEffect(() => { load(); loadEmployees() }, [load, loadEmployees])

  const openCreate = () => { setEditItem(null); setForm({ ...EMPTY_FORM }); setFormOpen(true) }
  const openEdit = (item: OwnershipAssignment) => {
    setEditItem(item)
    setForm({
      clientBusinessId: item.clientBusinessId,
      signupOwnerId:    item.signupOwnerId ?? "",
      renewalOwnerId:   item.renewalOwnerId ?? "",
      addonOwnerId:     item.addonOwnerId ?? "",
      notes:            item.notes ?? "",
    })
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.clientBusinessId.trim()) { toast.error("Client Business ID is required"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/admin/hrms/ownership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hrmsBusinessId: businessId, ...form }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success("Ownership assignment saved")
      setFormOpen(false)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/admin/hrms/ownership/${deleteId}`, { method: "DELETE" })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success("Assignment removed")
      setDeleteId(null)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    }
  }

  const empLabel = (id?: string) => {
    if (!id) return "—"
    const e = employees.find((x) => x.id === id)
    return e ? `${e.name} (${e.employeeCode})` : id
  }

  const EmployeePicker = ({ label, field }: { label: string; field: keyof typeof form }) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={form[field]} onValueChange={(v) => setForm((s) => ({ ...s, [field]: v === "none" ? "" : v }))}>
        <SelectTrigger><SelectValue placeholder="— Not assigned —" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">— Not assigned —</SelectItem>
          {employees.map((e) => (
            <SelectItem key={e.id} value={e.id}>{e.name} ({e.employeeCode})</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Revenue Ownership</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Map client businesses to Signup / Renewal / Addon owners for commission calculation.</p>
        </div>
        <Button onClick={openCreate} className="gap-2" disabled={!businessId || employees.length === 0}>
          <Plus className="h-4 w-4" /> Assign
        </Button>
      </div>

      {!businessId && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-800">
            Configure your Business ID in <strong>HRMS Settings</strong> first.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-muted border-t-primary" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <Link2 className="h-8 w-8 opacity-30" />
              <p className="text-sm">No ownership assignments yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Business ID</TableHead>
                    <TableHead>Signup Owner</TableHead>
                    <TableHead>Renewal Owner</TableHead>
                    <TableHead>Addon Owner</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs font-semibold">{a.clientBusinessId}</TableCell>
                      <TableCell className="text-sm">{empLabel(a.signupOwnerId)}</TableCell>
                      <TableCell className="text-sm">{empLabel(a.renewalOwnerId)}</TableCell>
                      <TableCell className="text-sm">{empLabel(a.addonOwnerId)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.notes || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(a.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Ownership" : "Assign Ownership"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Client Business ID <span className="text-destructive">*</span></Label>
              <Input
                placeholder="clxxx… (Quantix Business ID)"
                value={form.clientBusinessId}
                onChange={(e) => setForm((s) => ({ ...s, clientBusinessId: e.target.value }))}
                disabled={!!editItem}
              />
            </div>
            <EmployeePicker label="Signup Owner" field="signupOwnerId" />
            <EmployeePicker label="Renewal Owner" field="renewalOwnerId" />
            <EmployeePicker label="Addon Owner" field="addonOwnerId" />
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input placeholder="Optional note…" value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Assignment?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the ownership mapping.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
