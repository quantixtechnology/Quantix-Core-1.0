"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Pencil, TrendingUp, History } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface Employee { id: string; name: string; employeeCode: string; designation: string }
interface Business { id: string; name: string; status: string }
interface Assignment {
  id: string
  clientBusinessId: string
  signupOwnerId?: string
  renewalOwnerId?: string
  addonOwnerId?: string
  notes?: string
  updatedAt: string
  clientBusiness: Business
  signupOwner?: Employee | null
  renewalOwner?: Employee | null
  addonOwner?: Employee | null
}
interface AuditEntry {
  id: string
  clientBusinessId: string
  assignmentType: string
  previousOwnerId?: string
  newOwnerId?: string
  changedBy?: string
  remarks?: string
  createdAt: string
  previousOwner?: Employee | null
  newOwner?: Employee | null
  clientBusiness: Business
}

export function RevenueSignupOwnershipView() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [editItem, setEditItem] = useState<Assignment | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [ownerId, setOwnerId] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [aRes, auRes, eRes] = await Promise.all([
        fetch("/api/admin/hrms/ownership"),
        fetch("/api/admin/hrms/ownership-audit"),
        fetch("/api/admin/hrms/employees?limit=200"),
      ])
      const [aJson, auJson, eJson] = await Promise.all([aRes.json(), auRes.json(), eRes.json()])
      if (aJson.success) setAssignments(aJson.data)
      if (auJson.success) setAudit(auJson.data.filter((e: AuditEntry) => e.assignmentType === "SIGNUP"))
      if (eJson.success) setEmployees(eJson.data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = assignments.filter((a) =>
    !search || a.clientBusiness?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const openEdit = (a: Assignment) => {
    setEditItem(a)
    setOwnerId(a.signupOwnerId ?? "")
    setNotes(a.notes ?? "")
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!editItem) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/hrms/ownership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientBusinessId: editItem.clientBusinessId,
          signupOwnerId: ownerId || undefined,
          renewalOwnerId: editItem.renewalOwnerId || undefined,
          addonOwnerId: editItem.addonOwnerId || undefined,
          notes,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success("Signup owner updated")
      setFormOpen(false)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally { setSaving(false) }
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-2xl font-bold tracking-tight">Signup Ownership</h1>
          <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">Quantix Internal</span>
        </div>
        <p className="text-sm text-muted-foreground">Assign Quantix employees as signup owners for client businesses.</p>
      </div>

      <Tabs defaultValue="assignments">
        <TabsList>
          <TabsTrigger value="assignments" className="gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Assignments</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><History className="h-3.5 w-3.5" />Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="space-y-4 mt-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search business…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center h-40"><div className="h-6 w-6 animate-spin rounded-full border-4 border-muted border-t-primary" /></div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                  <TrendingUp className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No assignments found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client Business</TableHead>
                        <TableHead>Signup Owner</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead className="w-16" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            <div className="font-semibold text-sm">{a.clientBusiness?.name ?? a.clientBusinessId}</div>
                            <div className="text-xs text-muted-foreground">{a.clientBusiness?.status}</div>
                          </TableCell>
                          <TableCell>
                            {a.signupOwner ? (
                              <div>
                                <div className="text-sm font-medium">{a.signupOwner.name}</div>
                                <div className="text-xs text-muted-foreground">{a.signupOwner.designation}</div>
                              </div>
                            ) : <span className="text-sm text-muted-foreground">— Unassigned —</span>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{format(new Date(a.updatedAt), "d MMM yyyy")}</TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
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
              <CardTitle className="text-sm">Signup Ownership Change History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {audit.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
                  <History className="h-6 w-6 opacity-30" />
                  <p className="text-sm">No audit history yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Business</TableHead>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Signup Owner — {editItem?.clientBusiness?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Signup Owner</Label>
              <Select value={ownerId} onValueChange={(v) => setOwnerId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="— Unassigned —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Unassigned —</SelectItem>
                  {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} ({e.employeeCode})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input placeholder="Optional remarks…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
