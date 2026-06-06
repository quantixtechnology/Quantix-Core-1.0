"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Pencil, Trash2, Link2, History } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { authFetch } from "@/lib/admin-fetch"

interface Employee { id: string; employeeCode: string; name: string; designation?: string }

interface OwnershipAssignment {
  id: string
  clientBusinessId: string
  signupOwnerId?: string
  renewalOwnerId?: string
  addonOwnerId?: string
  assignedBy?: string
  notes?: string
  clientBusiness?: { id: string; name: string; status: string }
  signupOwner?: Employee | null
  renewalOwner?: Employee | null
  addonOwner?: Employee | null
}

interface AuditEntry {
  id: string
  clientBusinessId: string
  assignmentType: string
  previousOwner?: Employee | null
  newOwner?: Employee | null
  changedBy?: string
  remarks?: string
  createdAt: string
  clientBusiness: { id: string; name: string }
}

const EMPTY_FORM = {
  clientBusinessId: "", signupOwnerId: "", renewalOwnerId: "", addonOwnerId: "", notes: "",
}

const TYPE_BADGE: Record<string, string> = {
  SIGNUP:  "bg-emerald-100 text-emerald-700",
  RENEWAL: "bg-blue-100 text-blue-700",
  ADDON:   "bg-purple-100 text-purple-700",
}

export function HrmsOwnershipView() {
  const [assignments, setAssignments] = useState<OwnershipAssignment[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<OwnershipAssignment | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [aRes, auRes, eRes] = await Promise.all([
        authFetch("/api/admin/hrms/ownership"),
        authFetch("/api/admin/hrms/ownership-audit"),
        authFetch("/api/admin/hrms/employees?limit=200"),
      ])
      const [aJson, auJson, eJson] = await Promise.all([aRes.json(), auRes.json(), eRes.json()])
      if (aJson.success)  setAssignments(aJson.data)
      if (auJson.success) setAudit(auJson.data)
      if (eJson.success)  setEmployees(eJson.data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

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
      const res = await authFetch("/api/admin/hrms/ownership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
      const res = await authFetch(`/api/admin/hrms/ownership/${deleteId}`, { method: "DELETE" })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success("Assignment removed")
      setDeleteId(null)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    }
  }

  const empLabel = (owner?: Employee | null) =>
    owner ? `${owner.name} (${owner.employeeCode})` : "—"

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
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl font-bold tracking-tight">Revenue Ownership</h1>
            <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">Quantix Internal</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Map client businesses to Quantix employees for Signup, Renewal and Addon commission calculation.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Assign
        </Button>
      </div>

      <Card className="border-blue-100 bg-blue-50/50">
        <CardContent className="py-3 text-xs text-blue-800">
          Revenue Ownership is read-only to the Business Module — it reads business data for commission calculations but never modifies business records.
        </CardContent>
      </Card>

      <Tabs defaultValue="assignments">
        <TabsList>
          <TabsTrigger value="assignments" className="gap-1.5"><Link2 className="h-3.5 w-3.5" />Assignments</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><History className="h-3.5 w-3.5" />Change History</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="mt-4">
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
                        <TableHead>Client Business</TableHead>
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
                          <TableCell>
                            <div className="text-sm font-semibold">{a.clientBusiness?.name ?? a.clientBusinessId}</div>
                            <div className="text-xs text-muted-foreground font-mono">{a.clientBusinessId}</div>
                          </TableCell>
                          <TableCell className="text-sm">{empLabel(a.signupOwner)}</TableCell>
                          <TableCell className="text-sm">{empLabel(a.renewalOwner)}</TableCell>
                          <TableCell className="text-sm">{empLabel(a.addonOwner)}</TableCell>
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
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">All Ownership Changes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {audit.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
                  <History className="h-6 w-6 opacity-30" />
                  <p className="text-sm">No changes recorded yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Business</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Previous Owner</TableHead>
                        <TableHead>New Owner</TableHead>
                        <TableHead>Changed By</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {audit.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-sm font-medium">{e.clientBusiness?.name ?? e.clientBusinessId}</TableCell>
                          <TableCell>
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${TYPE_BADGE[e.assignmentType] ?? "bg-muted text-muted-foreground"}`}>
                              {e.assignmentType}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{e.previousOwner?.name ?? "—"}</TableCell>
                          <TableCell className="text-sm">{e.newOwner?.name ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{e.changedBy ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{format(new Date(e.createdAt), "d MMM yyyy, HH:mm")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Ownership" : "Assign Revenue Ownership"}</DialogTitle>
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
            <AlertDialogDescription>This will permanently remove the ownership mapping for this client business.</AlertDialogDescription>
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
