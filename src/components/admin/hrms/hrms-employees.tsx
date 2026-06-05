"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Separator } from "@/components/ui/separator"
import { Plus, Search, Pencil, Trash2, Users, Clock, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

type EmploymentType = "PERMANENT" | "CONTRACT" | "COMMISSION_BASED" | "CONSULTANT" | "INTERN"
type EmployeeStatus = "PROSPECT" | "OFFERED" | "JOINED" | "ACTIVE" | "RESIGNED" | "TERMINATED"
type PayrollType    = "SALARY" | "COMMISSION" | "HYBRID"

interface Employee {
  id: string
  employeeCode: string
  name: string
  email: string
  mobile?: string
  designation: string
  department?: string
  joiningDate: string
  employmentType: EmploymentType
  payrollType?: PayrollType | null
  reportingManager?: string
  status: EmployeeStatus
}

interface TimelineEntry {
  id: string
  event: string
  description?: string
  performedBy?: string
  createdAt: string
}

const EMPTY_FORM = {
  name: "", email: "", mobile: "", designation: "",
  department: "", joiningDate: "", employmentType: "PERMANENT" as EmploymentType,
  payrollType: "" as PayrollType | "",
  reportingManager: "", status: "PROSPECT" as EmployeeStatus,
}

const STATUS_COLORS: Record<EmployeeStatus, string> = {
  PROSPECT:   "bg-slate-100 text-slate-700",
  OFFERED:    "bg-amber-100 text-amber-700",
  JOINED:     "bg-blue-100 text-blue-700",
  ACTIVE:     "bg-emerald-100 text-emerald-700",
  RESIGNED:   "bg-orange-100 text-orange-700",
  TERMINATED: "bg-red-100 text-red-700",
}

const STATUS_LABELS: Record<EmployeeStatus, string> = {
  PROSPECT:   "Prospect",
  OFFERED:    "Offered",
  JOINED:     "Joined",
  ACTIVE:     "Active",
  RESIGNED:   "Resigned",
  TERMINATED: "Terminated",
}

const EMP_TYPE_LABELS: Record<EmploymentType, string> = {
  PERMANENT:        "Permanent",
  CONTRACT:         "Contract",
  COMMISSION_BASED: "Commission Based",
  CONSULTANT:       "Consultant",
  INTERN:           "Intern",
}

const PAYROLL_LABELS: Record<PayrollType, string> = {
  SALARY:     "Salary",
  COMMISSION: "Commission",
  HYBRID:     "Hybrid",
}

const PAYROLL_COLORS: Record<PayrollType, string> = {
  SALARY:     "bg-blue-50 text-blue-700",
  COMMISSION: "bg-green-50 text-green-700",
  HYBRID:     "bg-purple-50 text-purple-700",
}

export function HrmsEmployeesView() {
  const [employees, setEmployees]       = useState<Employee[]>([])
  const [total, setTotal]               = useState(0)
  const [loading, setLoading]           = useState(false)
  const [search, setSearch]             = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [formOpen, setFormOpen]         = useState(false)
  const [deleteId, setDeleteId]         = useState<string | null>(null)
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null)
  const [form, setForm]                 = useState({ ...EMPTY_FORM })
  const [saving, setSaving]             = useState(false)

  // Timeline dialog state
  const [timelineEmp, setTimelineEmp]       = useState<Employee | null>(null)
  const [timeline, setTimeline]             = useState<TimelineEntry[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ search, limit: "100" })
      if (statusFilter !== "all") params.set("status", statusFilter)
      const res = await fetch(`/api/admin/hrms/employees?${params}`)
      const json = await res.json()
      if (json.success) { setEmployees(json.data); setTotal(json.pagination?.total ?? json.data.length) }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])

  const loadTimeline = async (emp: Employee) => {
    setTimelineEmp(emp)
    setTimelineLoading(true)
    try {
      const res = await fetch(`/api/admin/hrms/employee-timeline?employeeId=${emp.id}`)
      const json = await res.json()
      if (json.success) setTimeline(json.data)
    } catch { /* silent */ }
    finally { setTimelineLoading(false) }
  }

  const openCreate = () => { setEditEmployee(null); setForm({ ...EMPTY_FORM }); setFormOpen(true) }
  const openEdit   = (emp: Employee) => {
    setEditEmployee(emp)
    setForm({
      name: emp.name, email: emp.email,
      mobile: emp.mobile ?? "", designation: emp.designation,
      department: emp.department ?? "", joiningDate: emp.joiningDate.slice(0, 10),
      employmentType: emp.employmentType,
      payrollType: emp.payrollType ?? "",
      reportingManager: emp.reportingManager ?? "",
      status: emp.status,
    })
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.email || !form.designation || !form.joiningDate) {
      toast.error("Fill all required fields")
      return
    }
    setSaving(true)
    try {
      const url    = editEmployee ? `/api/admin/hrms/employees/${editEmployee.id}` : "/api/admin/hrms/employees"
      const method = editEmployee ? "PUT" : "POST"
      const payload = {
        ...form,
        payrollType: form.payrollType || undefined,
      }
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success(editEmployee ? "Employee updated" : "Employee added")
      setFormOpen(false)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/admin/hrms/employees/${deleteId}`, { method: "DELETE" })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success("Employee removed")
      setDeleteId(null)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    }
  }

  const f = (key: keyof typeof form) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((s) => ({ ...s, [key]: e.target.value })),
  })

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl font-bold tracking-tight">Employee Master</h1>
            <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">Quantix Internal</span>
          </div>
          <p className="text-sm text-muted-foreground">{total} employee{total !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add Employee
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, Employee ID, designation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PROSPECT">Prospect</SelectItem>
            <SelectItem value="OFFERED">Offered</SelectItem>
            <SelectItem value="JOINED">Joined</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="RESIGNED">Resigned</SelectItem>
            <SelectItem value="TERMINATED">Terminated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-muted border-t-primary" />
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <Users className="h-8 w-8 opacity-30" />
              <p className="text-sm">No employees found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name / Email</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Payroll</TableHead>
                    <TableHead>Joining Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-mono text-xs font-semibold">{emp.employeeCode}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-sm">{emp.name}</div>
                        <div className="text-xs text-muted-foreground">{emp.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{emp.designation}</div>
                        {emp.department && <div className="text-xs text-muted-foreground">{emp.department}</div>}
                      </TableCell>
                      <TableCell>
                        {emp.payrollType ? (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PAYROLL_COLORS[emp.payrollType]}`}>
                            {PAYROLL_LABELS[emp.payrollType]}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm">{format(new Date(emp.joiningDate), "d MMM yyyy")}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[emp.status]}`}>
                          {STATUS_LABELS[emp.status]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="View Timeline" onClick={() => loadTimeline(emp)}>
                            <Clock className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(emp)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(emp.id)}>
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

      {/* Add / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editEmployee ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            {editEmployee ? (
              <div className="space-y-1.5 col-span-2">
                <Label>Employee ID</Label>
                <Input value={editEmployee.employeeCode} disabled className="font-mono bg-muted/50" />
              </div>
            ) : (
              <div className="col-span-2 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
                Employee ID will be generated automatically upon creation (e.g. QT-2026-001).
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input placeholder="Rahul Sharma" {...f("name")} />
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input type="email" placeholder="rahul@quantix.in" {...f("email")} />
            </div>
            <div className="space-y-1.5">
              <Label>Mobile</Label>
              <Input type="tel" placeholder="+91 98xxx xxxxx" {...f("mobile")} />
            </div>
            <div className="space-y-1.5">
              <Label>Designation <span className="text-destructive">*</span></Label>
              <Input placeholder="Business Development Manager" {...f("designation")} />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input placeholder="Sales" {...f("department")} />
            </div>
            <div className="space-y-1.5">
              <Label>Date of Joining <span className="text-destructive">*</span></Label>
              <Input type="date" {...f("joiningDate")} />
            </div>
            <div className="space-y-1.5">
              <Label>Reporting Manager</Label>
              <Input placeholder="Name or Employee ID" {...f("reportingManager")} />
            </div>
            <div className="space-y-1.5">
              <Label>Employment Type</Label>
              <Select value={form.employmentType} onValueChange={(v) => setForm((s) => ({ ...s, employmentType: v as EmploymentType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EMP_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Payroll Type</Label>
              <Select value={form.payrollType || "none"} onValueChange={(v) => setForm((s) => ({ ...s, payrollType: v === "none" ? "" : v as PayrollType }))}>
                <SelectTrigger><SelectValue placeholder="— Not set —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Not set —</SelectItem>
                  <SelectItem value="SALARY">Salary</SelectItem>
                  <SelectItem value="COMMISSION">Commission</SelectItem>
                  <SelectItem value="HYBRID">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((s) => ({ ...s, status: v as EmployeeStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROSPECT">Prospect</SelectItem>
                  <SelectItem value="OFFERED">Offered</SelectItem>
                  <SelectItem value="JOINED">Joined</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="RESIGNED">Resigned</SelectItem>
                  <SelectItem value="TERMINATED">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Timeline Dialog */}
      <Dialog open={!!timelineEmp} onOpenChange={(o) => !o && setTimelineEmp(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Activity Timeline
            </DialogTitle>
          </DialogHeader>
          {timelineEmp && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                <div>
                  <p className="font-semibold text-sm">{timelineEmp.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{timelineEmp.employeeCode} · {timelineEmp.designation}</p>
                </div>
                <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[timelineEmp.status]}`}>
                  {STATUS_LABELS[timelineEmp.status]}
                </span>
              </div>
              <Separator />
              {timelineLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="h-5 w-5 animate-spin rounded-full border-4 border-muted border-t-primary" />
                </div>
              ) : timeline.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <Clock className="h-6 w-6 opacity-30" />
                  <p className="text-sm">No timeline events yet</p>
                </div>
              ) : (
                <div className="relative pl-5">
                  <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />
                  {timeline.map((entry, i) => (
                    <div key={entry.id} className="relative mb-4 last:mb-0">
                      <div className="absolute -left-[13px] top-1 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{entry.event}</p>
                          {i === 0 && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Latest</span>}
                        </div>
                        {entry.description && <p className="text-xs text-muted-foreground">{entry.description}</p>}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{format(new Date(entry.createdAt), "d MMM yyyy, HH:mm")}</span>
                          {entry.performedBy && (
                            <>
                              <ChevronRight className="h-3 w-3" />
                              <span>{entry.performedBy}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Employee?</AlertDialogTitle>
            <AlertDialogDescription>
              This will soft-delete the employee record. Commission Slip history is preserved.
            </AlertDialogDescription>
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
