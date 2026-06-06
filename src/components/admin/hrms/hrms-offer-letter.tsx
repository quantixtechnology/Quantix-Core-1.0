"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Plus, Eye, Printer, Trash2, FileSignature } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { authFetch } from "@/lib/admin-fetch"

interface OfferLetter {
  id: string
  offerRef?: string
  templateId?: string
  candidateName: string
  candidateEmail?: string
  candidateMobile?: string
  designation: string
  joiningDate?: string
  department?: string
  reportingManager?: string
  workLocation?: string
  employmentType: string
  content: string
  createdBy?: string
  createdAt: string
}

interface Template { id: string; name: string; isActive: boolean }

const EMPTY_FORM = {
  templateId: "", candidateName: "", candidateEmail: "", candidateMobile: "",
  designation: "", joiningDate: "", department: "", reportingManager: "",
  workLocation: "", employmentType: "PERMANENT",
}

export function HrmsOfferLetterView() {
  const [letters, setLetters] = useState<OfferLetter[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [viewLetter, setViewLetter] = useState<OfferLetter | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  const loadTemplates = useCallback(async () => {
    const res = await authFetch("/api/admin/hrms/templates")
    const json = await res.json()
    if (json.success) setTemplates(json.data.filter((t: Template) => t.isActive))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch("/api/admin/hrms/offer-letters?limit=100")
      const json = await res.json()
      if (json.success) setLetters(json.data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(); loadTemplates() }, [load, loadTemplates])

  const handleGenerate = async () => {
    if (!form.candidateName || !form.designation) {
      toast.error("Candidate Name and Designation are required")
      return
    }
    setSaving(true)
    try {
      const res = await authFetch("/api/admin/hrms/offer-letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, templateId: form.templateId || undefined }),
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

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await authFetch(`/api/admin/hrms/offer-letters/${deleteId}`, { method: "DELETE" })
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
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((s) => ({ ...s, [key]: e.target.value })),
  })

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl font-bold tracking-tight">Offer Letters</h1>
            <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
              Quantix Internal
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Issue appointment offers. Attach policies via the Annexure module.
          </p>
        </div>
        <Button
          onClick={() => { setForm({ ...EMPTY_FORM }); setFormOpen(true) }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> Generate
        </Button>
      </div>

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
                    <TableHead className="w-44">Offer Ref</TableHead>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Joining Date</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {letters.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <span className="font-mono text-xs font-semibold text-primary bg-primary/8 px-2 py-0.5 rounded">
                          {l.offerRef || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-semibold">{l.candidateName}</div>
                        {l.candidateEmail && (
                          <div className="text-xs text-muted-foreground">{l.candidateEmail}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{l.designation}</TableCell>
                      <TableCell className="text-sm">
                        {l.joiningDate ? format(new Date(l.joiningDate), "d MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(l.createdAt), "d MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => setViewLetter(l)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => window.open(`/offer-letter-print/${l.id}`, "_blank")}
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(l.id)}
                          >
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
              <Select
                value={form.templateId}
                onValueChange={(v) => setForm((s) => ({ ...s, templateId: v === "none" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="— No template (blank letter) —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No template —</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Candidate Name <span className="text-destructive">*</span></Label>
              <Input placeholder="Rahul Sharma" {...f("candidateName")} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" placeholder="rahul@example.com" {...f("candidateEmail")} />
            </div>
            <div className="space-y-1.5">
              <Label>Mobile</Label>
              <Input placeholder="+91 98765 43210" {...f("candidateMobile")} />
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
              <Select
                value={form.employmentType}
                onValueChange={(v) => setForm((s) => ({ ...s, employmentType: v }))}
              >
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
            <Button onClick={handleGenerate} disabled={saving}>
              {saving ? "Generating…" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewLetter} onOpenChange={(o) => !o && setViewLetter(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewLetter?.offerRef && (
                <span className="font-mono text-sm text-primary">
                  {viewLetter.offerRef}
                </span>
              )}
              <span className="font-normal text-muted-foreground">—</span>
              <span>{viewLetter?.candidateName}</span>
            </DialogTitle>
          </DialogHeader>
          {viewLetter && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm bg-muted/30 rounded-lg p-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Designation</p>
                  <p className="font-medium mt-0.5">{viewLetter.designation}</p>
                  {viewLetter.department && (
                    <p className="text-xs text-muted-foreground">{viewLetter.department}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Joining Date</p>
                  <p className="font-medium mt-0.5">
                    {viewLetter.joiningDate
                      ? format(new Date(viewLetter.joiningDate), "d MMM yyyy")
                      : "—"}
                  </p>
                </div>
              </div>

              <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/30 rounded-lg p-4 min-h-[200px] max-h-96 overflow-y-auto">
                {viewLetter.content || "(No content — template was blank)"}
              </pre>

              <div className="flex gap-2">
                <Button
                  size="sm" variant="outline" className="gap-1"
                  onClick={() => window.open(`/offer-letter-print/${viewLetter.id}`, "_blank")}
                >
                  <Printer className="h-3.5 w-3.5" /> Print / PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Offer Letter?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the offer letter record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
