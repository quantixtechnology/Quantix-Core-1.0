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
import { Plus, Eye, Printer, Trash2, FileSignature, Mail } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

type OfferStatus = "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED"

interface OfferLetter {
  id: string
  businessId: string
  templateId?: string
  employeeId?: string
  candidateName: string
  designation: string
  joiningDate?: string
  department?: string
  reportingManager?: string
  workLocation?: string
  employmentType: string
  content: string
  status: OfferStatus
  emailedAt?: string
  createdAt: string
  employee?: { id: string; name: string; employeeCode: string }
}

interface Template { id: string; name: string; isActive: boolean }
interface Employee { id: string; employeeCode: string; name: string }

const STATUS_STYLES: Record<OfferStatus, string> = {
  DRAFT:    "bg-slate-100 text-slate-700",
  SENT:     "bg-amber-100 text-amber-700",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  DECLINED: "bg-red-100 text-red-700",
  EXPIRED:  "bg-muted text-muted-foreground",
}

const EMPTY_FORM = {
  templateId: "", employeeId: "", candidateName: "", designation: "",
  joiningDate: "", department: "", reportingManager: "", workLocation: "",
  employmentType: "PERMANENT",
}

export function HrmsOfferLetterView() {
  const [businessId, setBusinessId] = useState("")
  const [letters, setLetters] = useState<OfferLetter[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [viewLetter, setViewLetter] = useState<OfferLetter | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/admin/hrms/settings")
      .then((r) => r.json())
      .then((j) => { if (j.success && j.data?.businessId) setBusinessId(j.data.businessId) })
      .catch(() => {})
  }, [])

  const loadDeps = useCallback(async () => {
    if (!businessId) return
    const [tplRes, empRes] = await Promise.all([
      fetch(`/api/admin/hrms/templates?businessId=${businessId}`),
      fetch(`/api/admin/hrms/employees?businessId=${businessId}&limit=200`),
    ])
    const [tplJson, empJson] = await Promise.all([tplRes.json(), empRes.json()])
    if (tplJson.success) setTemplates(tplJson.data.filter((t: Template) => t.isActive))
    if (empJson.success) setEmployees(empJson.data)
  }, [businessId])

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/hrms/offer-letters?businessId=${businessId}&limit=100`)
      const json = await res.json()
      if (json.success) setLetters(json.data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [businessId])

  useEffect(() => { load(); loadDeps() }, [load, loadDeps])

  const handleGenerate = async () => {
    if (!form.candidateName || !form.designation) { toast.error("Candidate Name and Designation are required"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/admin/hrms/offer-letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, businessId, templateId: form.templateId || undefined, employeeId: form.employeeId || undefined }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success("Offer letter generated")
      setFormOpen(false)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally { setSaving(false) }
  }

  const updateStatus = async (id: string, status: OfferStatus) => {
    try {
      const res = await fetch(`/api/admin/hrms/offer-letters/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success(`Status updated to ${status}`)
      setViewLetter(null)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/admin/hrms/offer-letters/${deleteId}`, { method: "DELETE" })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success("Offer letter deleted")
      setDeleteId(null)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    }
  }

  const f = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((s) => ({ ...s, [key]: e.target.value })),
  })

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Offer Letters</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Generate from templates with automatic merge tag rendering.</p>
        </div>
        <Button onClick={() => { setForm({ ...EMPTY_FORM }); setFormOpen(true) }} className="gap-2" disabled={!businessId}>
          <Plus className="h-4 w-4" /> Generate
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
          ) : letters.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <FileSignature className="h-8 w-8 opacity-30" />
              <p className="text-sm">No offer letters yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Joining Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {letters.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="text-sm font-semibold">{l.candidateName}</div>
                        {l.employee && <div className="text-xs text-muted-foreground">{l.employee.employeeCode}</div>}
                      </TableCell>
                      <TableCell className="text-sm">{l.designation}</TableCell>
                      <TableCell className="text-sm">{l.joiningDate ? format(new Date(l.joiningDate), "d MMM yyyy") : "—"}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[l.status]}`}>{l.status}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(l.createdAt), "d MMM yyyy")}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewLetter(l)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(l.id)}>
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

      {/* Generate Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Offer Letter</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5 col-span-2">
              <Label>Template</Label>
              <Select value={form.templateId} onValueChange={(v) => setForm((s) => ({ ...s, templateId: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="— No template (blank letter) —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No template —</SelectItem>
                  {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Link to Employee (optional)</Label>
              <Select value={form.employeeId} onValueChange={(v) => {
                const emp = employees.find((e) => e.id === v)
                setForm((s) => ({ ...s, employeeId: v === "none" ? "" : v, candidateName: emp ? emp.name : s.candidateName }))
              }}>
                <SelectTrigger><SelectValue placeholder="— No employee link —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No link —</SelectItem>
                  {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} ({e.employeeCode})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Candidate Name <span className="text-destructive">*</span></Label>
              <Input placeholder="Rahul Sharma" {...f("candidateName")} />
            </div>
            <div className="space-y-1.5">
              <Label>Designation <span className="text-destructive">*</span></Label>
              <Input placeholder="Business Development Manager" {...f("designation")} />
            </div>
            <div className="space-y-1.5">
              <Label>Joining Date</Label>
              <Input type="date" {...f("joiningDate")} />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input placeholder="Sales" {...f("department")} />
            </div>
            <div className="space-y-1.5">
              <Label>Reporting Manager</Label>
              <Input placeholder="Manager Name" {...f("reportingManager")} />
            </div>
            <div className="space-y-1.5">
              <Label>Work Location</Label>
              <Input placeholder="Mumbai HO" {...f("workLocation")} />
            </div>
            <div className="space-y-1.5">
              <Label>Employment Type</Label>
              <Select value={form.employmentType} onValueChange={(v) => setForm((s) => ({ ...s, employmentType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERMANENT">Permanent</SelectItem>
                  <SelectItem value="CONTRACT">Contract</SelectItem>
                  <SelectItem value="COMMISSION_BASED">Commission Based</SelectItem>
                  <SelectItem value="CONSULTANT">Consultant</SelectItem>
                  <SelectItem value="INTERN">Intern</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={saving}>{saving ? "Generating…" : "Generate"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Letter Dialog */}
      <Dialog open={!!viewLetter} onOpenChange={(o) => !o && setViewLetter(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Offer Letter — {viewLetter?.candidateName}
              <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${viewLetter ? STATUS_STYLES[viewLetter.status] : ""}`}>
                {viewLetter?.status}
              </span>
            </DialogTitle>
          </DialogHeader>
          {viewLetter && (
            <div className="space-y-4">
              <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/30 rounded-lg p-4 min-h-[300px]">
                {viewLetter.content || "(No content — template was blank)"}
              </pre>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" className="gap-1" onClick={() => window.print()}>
                  <Printer className="h-3.5 w-3.5" /> Print / PDF
                </Button>
                {viewLetter.status === "DRAFT" && (
                  <Button size="sm" className="gap-1" onClick={() => updateStatus(viewLetter.id, "SENT")}>
                    <Mail className="h-3.5 w-3.5" /> Mark as Sent
                  </Button>
                )}
                {viewLetter.status === "SENT" && (
                  <>
                    <Button size="sm" onClick={() => updateStatus(viewLetter.id, "ACCEPTED")}>Mark Accepted</Button>
                    <Button size="sm" variant="outline" onClick={() => updateStatus(viewLetter.id, "DECLINED")}>Mark Declined</Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Offer Letter?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the offer letter.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
