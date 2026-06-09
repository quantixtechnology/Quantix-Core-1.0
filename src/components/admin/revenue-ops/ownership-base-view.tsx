"use client"

import { useState, useEffect, useCallback } from "react"
import { authFetch } from "@/lib/admin-fetch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Search, Plus, Pencil, RefreshCcw, XCircle, History, TrendingUp, Users, AlertTriangle, LayoutList, Loader2
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

// ─── Types ────────────────────────────────────────────────────────────────────

type OwnershipType = "signup" | "renewal" | "addon"
type OwnershipStatus = "ACTIVE" | "INACTIVE" | "PENDING_REASSIGN"

interface OwnershipRecord {
  id: string
  businessId: string
  businessName: string
  employeeId: string
  employeeName: string
  employeeCode: string
  designation: string | null
  effectiveDate: string
  notes: string | null
  status: OwnershipStatus
  assignedByName: string | null
  createdAt: string
  updatedAt: string
}

interface AuditEntry {
  id: string
  clientBusinessId: string
  assignmentType: string
  action: string
  businessName: string | null
  previousOwnerName: string | null
  newOwnerName: string | null
  changedBy: string | null
  remarks: string | null
  createdAt: string
}

interface BusinessOption {
  id: string
  name: string
  status: string
  businessType: string
}

interface EmployeeOption {
  id: string
  name: string
  employeeCode: string
  designation: string
}

interface Stats {
  totalAssignedBusinesses: number
  activeOwners: number
  pendingReassignments: number
  totalRecords: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<OwnershipType, { title: string; description: string; icon: React.ReactNode }> = {
  signup: {
    title: "Signup Ownership",
    description: "Assign Quantix employees responsible for client signup and onboarding.",
    icon: <TrendingUp className="h-5 w-5" />,
  },
  renewal: {
    title: "Renewal Ownership",
    description: "Assign Quantix employees responsible for subscription renewals.",
    icon: <RefreshCcw className="h-5 w-5" />,
  },
  addon: {
    title: "Add-On Ownership",
    description: "Assign Quantix employees responsible for upselling add-ons and upgrades.",
    icon: <Plus className="h-5 w-5" />,
  },
}

function StatusBadge({ status }: { status: OwnershipStatus }) {
  if (status === "ACTIVE")
    return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Active</Badge>
  if (status === "INACTIVE")
    return <Badge variant="secondary">Inactive</Badge>
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Pending Reassign</Badge>
}

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, string> = {
    CREATED: "bg-green-100 text-green-700",
    UPDATED: "bg-blue-100 text-blue-700",
    REASSIGNED: "bg-purple-100 text-purple-700",
    DEACTIVATED: "bg-red-100 text-red-700",
  }
  return (
    <Badge className={`${map[action] ?? "bg-slate-100 text-slate-700"} border-transparent hover:${map[action] ?? ""}`}>
      {action}
    </Badge>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OwnershipBaseView({ type }: { type: OwnershipType }) {
  const meta = TYPE_LABELS[type]
  const apiBase = `/api/admin/revenue-ops/ownership/${type}`

  // List state
  const [records, setRecords] = useState<OwnershipRecord[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Reference data
  const [businesses, setBusinesses] = useState<BusinessOption[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [refLoading, setRefLoading] = useState(false)

  // Dialog state
  const [assignOpen, setAssignOpen] = useState(false)
  const [editItem, setEditItem] = useState<OwnershipRecord | null>(null)
  const [reassignItem, setReassignItem] = useState<OwnershipRecord | null>(null)
  const [deactivateItem, setDeactivateItem] = useState<OwnershipRecord | null>(null)
  const [saving, setSaving] = useState(false)

  // Assign form
  const [aBusinessId, setABusinessId] = useState("")
  const [aEmployeeId, setAEmployeeId] = useState("")
  const [aDate, setADate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [aNotes, setANotes] = useState("")

  // Edit form
  const [eNotes, setENotes] = useState("")
  const [eDate, setEDate] = useState("")

  // Reassign form
  const [rEmployeeId, setREmployeeId] = useState("")
  const [rDate, setRDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [rNotes, setRNotes] = useState("")

  // ── Load data ─────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (statusFilter !== "all") params.set("status", statusFilter)

    try {
      const [recRes, auditRes, statsRes] = await Promise.all([
        authFetch(`${apiBase}?${params}`),
        authFetch(`/api/admin/revenue-ops/ownership/audit?type=${type.toUpperCase()}`),
        authFetch("/api/admin/revenue-ops/ownership/stats"),
      ])
      const [recJson, auditJson, statsJson] = await Promise.all([
        recRes.json(), auditRes.json(), statsRes.json(),
      ])
      if (recJson.success) setRecords(recJson.data)
      if (auditJson.success) setAudit(auditJson.data)
      if (statsJson.success) setStats(statsJson.data)
    } catch (e) {
      console.error(`[OwnershipView:${type}] load failed`, e)
    }
    finally { setLoading(false) }
  }, [apiBase, search, statusFilter, type])

  useEffect(() => { load() }, [load])

  const loadRefData = async () => {
    if (businesses.length && employees.length) return
    setRefLoading(true)
    try {
      console.log(`[OwnershipView:${type}] fetching businesses + employees`)
      const [bRes, eRes] = await Promise.all([
        authFetch("/api/admin/revenue-ops/ownership/businesses"),
        authFetch("/api/admin/hrms/employees?status=ACTIVE&limit=200"),
      ])
      const [bJson, eJson] = await Promise.all([bRes.json(), eRes.json()])
      console.log(`[OwnershipView:${type}] businesses API →`, { success: bJson.success, count: bJson.data?.length, error: bJson.error })
      console.log(`[OwnershipView:${type}] employees API →`, { success: eJson.success, count: eJson.data?.length, error: eJson.error })
      if (bJson.success) {
        setBusinesses(bJson.data)
        console.log(`[OwnershipView:${type}] businesses loaded:`, bJson.data?.length ?? 0)
      } else {
        console.warn(`[OwnershipView:${type}] businesses failed:`, bJson.error)
      }
      if (eJson.success) setEmployees(eJson.data)
    } catch (e) {
      console.error(`[OwnershipView:${type}] loadRefData failed`, e)
    }
    finally { setRefLoading(false) }
  }

  const openAssign = () => { loadRefData(); setABusinessId(""); setAEmployeeId(""); setADate(format(new Date(), "yyyy-MM-dd")); setANotes(""); setAssignOpen(true) }
  const openEdit = (r: OwnershipRecord) => { setEditItem(r); setENotes(r.notes ?? ""); setEDate(format(new Date(r.effectiveDate), "yyyy-MM-dd")) }
  const openReassign = (r: OwnershipRecord) => { loadRefData(); setReassignItem(r); setREmployeeId(""); setRDate(format(new Date(), "yyyy-MM-dd")); setRNotes("") }

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleAssign = async () => {
    if (!aBusinessId || !aEmployeeId || !aDate) { toast.error("Business, employee, and date are required"); return }
    setSaving(true)
    try {
      const res = await authFetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: aBusinessId, employeeId: aEmployeeId, effectiveDate: aDate, notes: aNotes }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success("Ownership assigned successfully")
      setAssignOpen(false)
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") }
    finally { setSaving(false) }
  }

  const handleEdit = async () => {
    if (!editItem) return
    setSaving(true)
    try {
      const res = await authFetch(`${apiBase}/${editItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit", notes: eNotes, effectiveDate: eDate }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success("Assignment updated")
      setEditItem(null)
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") }
    finally { setSaving(false) }
  }

  const handleReassign = async () => {
    if (!reassignItem || !rEmployeeId || !rDate) { toast.error("New employee and date are required"); return }
    setSaving(true)
    try {
      const res = await authFetch(`${apiBase}/${reassignItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reassign", newEmployeeId: rEmployeeId, newEffectiveDate: rDate, newNotes: rNotes }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success("Ownership reassigned successfully")
      setReassignItem(null)
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") }
    finally { setSaving(false) }
  }

  const handleDeactivate = async () => {
    if (!deactivateItem) return
    setSaving(true)
    try {
      const res = await authFetch(`${apiBase}/${deactivateItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deactivate" }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success("Assignment deactivated")
      setDeactivateItem(null)
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") }
    finally { setSaving(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl font-bold tracking-tight">{meta.title}</h1>
            <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">Quantix Internal</span>
          </div>
          <p className="text-sm text-muted-foreground">{meta.description}</p>
        </div>
        <Button onClick={openAssign} className="shrink-0 gap-1.5">
          <Plus className="h-4 w-4" /> Assign Business
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Assigned Businesses", value: stats?.totalAssignedBusinesses ?? "—", icon: <LayoutList className="h-4 w-4" />, color: "text-blue-600" },
          { label: "Active Owners", value: stats?.activeOwners ?? "—", icon: <Users className="h-4 w-4" />, color: "text-green-600" },
          { label: "Pending Reassigns", value: stats?.pendingReassignments ?? "—", icon: <AlertTriangle className="h-4 w-4" />, color: "text-amber-600" },
          { label: "Total Records", value: stats?.totalRecords ?? "—", icon: <History className="h-4 w-4" />, color: "text-slate-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted ${s.color}`}>{s.icon}</div>
              <div>
                <div className="text-xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="assignments">
        <TabsList>
          <TabsTrigger value="assignments" className="gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Assignments</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><History className="h-3.5 w-3.5" />Audit Trail</TabsTrigger>
        </TabsList>

        {/* ── Assignments Tab ── */}
        <TabsContent value="assignments" className="space-y-4 mt-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search business…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="PENDING_REASSIGN">Pending Reassign</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : records.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                  <TrendingUp className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No assignments found</p>
                  <Button variant="outline" size="sm" onClick={openAssign} className="gap-1.5 mt-1">
                    <Plus className="h-3.5 w-3.5" /> Assign First Business
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Business</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Assigned By</TableHead>
                        <TableHead>Effective Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((r) => (
                        <TableRow key={r.id} className={r.status === "INACTIVE" ? "opacity-60" : ""}>
                          <TableCell>
                            <div className="font-semibold text-sm">{r.businessName}</div>
                            <div className="text-xs text-muted-foreground">{r.businessId.slice(0, 8)}…</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{r.employeeName}</div>
                            <div className="text-xs text-muted-foreground">{r.employeeCode} · {r.designation ?? "—"}</div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{r.assignedByName ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{format(new Date(r.effectiveDate), "d MMM yyyy")}</TableCell>
                          <TableCell><StatusBadge status={r.status} /></TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon" variant="ghost" className="h-7 w-7" title="Edit"
                                onClick={() => openEdit(r)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {r.status === "ACTIVE" && (
                                <>
                                  <Button
                                    size="icon" variant="ghost" className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    title="Reassign"
                                    onClick={() => openReassign(r)}
                                  >
                                    <RefreshCcw className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    title="Deactivate"
                                    onClick={() => setDeactivateItem(r)}
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
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

        {/* ── Audit Trail Tab ── */}
        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Change History — {meta.title}</CardTitle>
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
                        <TableHead>Action</TableHead>
                        <TableHead>Business</TableHead>
                        <TableHead>Previous Owner</TableHead>
                        <TableHead>New Owner</TableHead>
                        <TableHead>Performed By</TableHead>
                        <TableHead>Date & Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {audit.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell><ActionBadge action={e.action} /></TableCell>
                          <TableCell className="text-sm font-medium">{e.businessName ?? e.clientBusinessId}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{e.previousOwnerName ?? "—"}</TableCell>
                          <TableCell className="text-sm">{e.newOwnerName ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{e.changedBy ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(e.createdAt), "d MMM yyyy, HH:mm")}
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
      </Tabs>

      {/* ── Assign Business Dialog ── */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Business — {meta.title}</DialogTitle>
          </DialogHeader>
          {refLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading…</span>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Business <span className="text-destructive">*</span></Label>
                {businesses.length === 0 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    No customer businesses available. Create a customer first.
                  </div>
                ) : (
                  <Select value={aBusinessId} onValueChange={setABusinessId}>
                    <SelectTrigger><SelectValue placeholder={`Select from ${businesses.length} businesses…`} /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {businesses.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                          <span className="ml-1 text-xs text-muted-foreground">({b.status})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Employee <span className="text-destructive">*</span></Label>
                <Select value={aEmployeeId} onValueChange={setAEmployeeId}>
                  <SelectTrigger><SelectValue placeholder="Select an employee…" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                        <span className="ml-1 text-xs text-muted-foreground">({e.employeeCode} · {e.designation})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Effective Date <span className="text-destructive">*</span></Label>
                <Input type="date" value={aDate} onChange={(e) => setADate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Notes <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <Textarea placeholder="Add any relevant notes…" value={aNotes} onChange={(e) => setANotes(e.target.value)} rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={saving || refLoading} className="gap-1.5">
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</> : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editItem} onOpenChange={(o) => { if (!o) setEditItem(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Assignment — {editItem?.businessName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">
              Current owner: <span className="font-medium text-foreground">{editItem?.employeeName}</span>
            </div>
            <div className="space-y-1.5">
              <Label>Effective Date</Label>
              <Input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea placeholder="Add any relevant notes…" value={eNotes} onChange={(e) => setENotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reassign Dialog ── */}
      <Dialog open={!!reassignItem} onOpenChange={(o) => { if (!o) setReassignItem(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign Ownership — {reassignItem?.businessName}</DialogTitle>
          </DialogHeader>
          {refLoading ? (
            <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading employees…</span>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm">
                <span className="font-medium text-amber-800">Current owner:</span>{" "}
                <span className="text-amber-700">{reassignItem?.employeeName}</span> will be deactivated and a new assignment created.
              </div>
              <div className="space-y-1.5">
                <Label>New Employee <span className="text-destructive">*</span></Label>
                <Select value={rEmployeeId} onValueChange={setREmployeeId}>
                  <SelectTrigger><SelectValue placeholder="Select new employee…" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {employees
                      .filter((e) => e.id !== reassignItem?.employeeId)
                      .map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                          <span className="ml-1 text-xs text-muted-foreground">({e.employeeCode})</span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>New Effective Date <span className="text-destructive">*</span></Label>
                <Input type="date" value={rDate} onChange={(e) => setRDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Reason for Reassignment <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <Textarea placeholder="Why is this being reassigned?" value={rNotes} onChange={(e) => setRNotes(e.target.value)} rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignItem(null)}>Cancel</Button>
            <Button onClick={handleReassign} disabled={saving || refLoading} className="gap-1.5">
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Reassigning…</> : "Confirm Reassign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Deactivate Confirm Dialog ── */}
      <Dialog open={!!deactivateItem} onOpenChange={(o) => { if (!o) setDeactivateItem(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Deactivate Assignment</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2 text-sm text-muted-foreground">
            <p>Are you sure you want to deactivate the {type} ownership for:</p>
            <p className="font-semibold text-foreground">{deactivateItem?.businessName}</p>
            <p>Owner <span className="font-medium text-foreground">{deactivateItem?.employeeName}</span> will be removed from this assignment. This can be reversed by creating a new assignment.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeactivate} disabled={saving} className="gap-1.5">
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Deactivating…</> : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
