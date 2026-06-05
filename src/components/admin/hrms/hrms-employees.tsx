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
import { Plus, Search, Pencil, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

type EmploymentType = "PERMANENT" | "CONTRACT" | "COMMISSION_BASED" | "CONSULTANT" | "INTERN"
type EmployeeStatus = "ACTIVE" | "INACTIVE" | "TERMINATED"

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
  reportingManager?: string
  status: EmployeeStatus
}

const EMPTY_FORM: Omit<Employee, "id"> = {
  employeeCode: "", name: "", email: "", mobile: "", designation: "",
  department: "", joiningDate: "", employmentType: "PERMANENT",
  reportingManager: "", status: "ACTIVE",
}

const STATUS_COLORS: Record<EmployeeStatus, string> = {
  ACTIVE:     "bg-emerald-100 text-emerald-700",
  INACTIVE:   "bg-amber-100 text-amber-700",
  TERMINATED: "bg-red-100 text-red-700",
}

const EMP_TYPE_LABELS: Record<EmploymentType, string> = {
  PERMANENT:        "Permanent",
  CONTRACT:         "Contract",
  COMMISSION_BASED: "Commission Based",
  CONSULTANT:       "Consultant",
  INTERN:           "Intern",
}

export function HrmsEmployeesView() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [formOpen, setFormOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

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

  const openCreate = () => { setEditEmployee(null); setForm({ ...EMPTY_FORM }); setFormOpen(true) }
  const openEdit   = (emp: Employee) => {
    setEditEmployee(emp)
    setForm({
      employeeCode: emp.employeeCode, name: emp.name, email: emp.email,
      mobile: emp.mobile ?? "", designation: emp.designation,
      department: emp.department ?? "", joiningDate: emp.joiningDate.slice(0, 10),
      employmentType: emp.employmentType, reportingManager: emp.reportingManager ?? "",
      status: emp.status,
    })
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.employeeCode || !form.name || !form.email || !form.designation || !form.joiningDate) {
      toast.error("Fill all required fields")
      return
    }
    setSaving(true)
    try {
      const url    = editEmployee ? `/api/admin/hrms/employees/${editEmployee.id}` : "/api/admin/hrms/employees"
      const method = editEmployee ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success(editEmployee ? "Employee updated" : "Employee created")
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
            placeholder="Search name, email, code, designation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
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
                    <TableHead>Name</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Joining Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20" />
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
                      <TableCell className="text-sm">{emp.designation}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{emp.department || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{EMP_TYPE_LABELS[emp.employmentType]}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{format(new Date(emp.joiningDate), "d MMM yyyy")}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[emp.status]}`}>
                          {emp.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editEmployee ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Employee Code <span className="text-destructive">*</span></Label>
              <Input placeholder="QT-001" {...f("employeeCode")} disabled={!!editEmployee} />
            </div>
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
              <Input placeholder="Name or Employee Code" {...f("reportingManager")} />
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
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((s) => ({ ...s, status: v as EmployeeStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
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
