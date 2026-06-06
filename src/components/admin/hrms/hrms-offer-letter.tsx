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
import { Separator } from "@/components/ui/separator"
import { Plus, Eye, Printer, Trash2, FileSignature, Pencil, Zap } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { authFetch } from "@/lib/admin-fetch"

interface OfferLetter {
  id: string
  offerRef?: string | null
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

type DialogMode = "create" | "edit" | "view"

function letterForm(l: OfferLetter): typeof EMPTY_FORM {
  return {
    templateId:      l.templateId    ?? "",
    candidateName:   l.candidateName,
    candidateEmail:  l.candidateEmail   ?? "",
    candidateMobile: l.candidateMobile  ?? "",
    designation:     l.designation,
    joiningDate:     l.joiningDate
      ? l.joiningDate.slice(0, 10)   // ISO → YYYY-MM-DD for <input type="date">
      : "",
    department:      l.department       ?? "",
    reportingManager:l.reportingManager ?? "",
    workLocation:    l.workLocation     ?? "",
    employmentType:  l.employmentType   ?? "PERMANENT",
  }
}

export function HrmsOfferLetterView() {
  const [letters, setLetters] = useState<OfferLetter[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null)
  const [activeLetter, setActiveLetter] = useState<OfferLetter | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)

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

  const openCreate = () => {
    setForm({ ...EMPTY_FORM })
    setActiveLetter(null)
    setDialogMode("create")
  }

  const openEdit = (l: OfferLetter) => {
    setForm(letterForm(l))
    setActiveLetter(l)
    setDialogMode("edit")
  }

  const openView = (l: OfferLetter) => {
    setActiveLetter(l)
    setDialogMode("view")
  }

  const closeDialog = () => { setDialogMode(null); setActiveLetter(null) }

  const handleSaveDraft = async () => {
    if (!form.candidateName || !form.designation) {
      toast.error("Candidate Name and Designation are required")
      return
    }
    setSaving(true)
    try {
      if (dialogMode === "create") {
        const res = await authFetch("/api/admin/hrms/offer-letters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, templateId: form.templateId || undefined }),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error)
        toast.success("Draft saved")
      } else if (dialogMode === "edit" && activeLetter) {
        const res = await authFetch(`/api/admin/hrms/offer-letters/${activeLetter.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, templateId: form.templateId || null }),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error)
        toast.success("Draft updated")
      }
      closeDialog()
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally { setSaving(false) }
  }

  // Save draft edits first, then assign the offer number
  const handleGenerate = async (letterId: string) => {
    setGenerating(letterId)
    try {
      // If called from the edit dialog, persist any field changes before generating
      if (dialogMode === "edit" && activeLetter?.id === letterId) {
        const saveRes = await authFetch(`/api/admin/hrms/offer-letters/${letterId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, templateId: form.templateId || null }),
        })
        const saveJson = await saveRes.json()
        if (!saveJson.success) throw new Error(saveJson.error)
      }

      const res = await authFetch(`/api/admin/hrms/offer-letters/${letterId}/generate`, {
        method: "POST",
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success(`Offer letter issued — ${json.data.offerRef}`)
      closeDialog()
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally { setGenerating(null) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await authFetch(`/api/admin/hrms/offer-letters/${deleteId}`, { method: "DELETE" })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success("Deleted")
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

  const isDraft  = (l: OfferLetter) => !l.offerRef
  const isIssued = (l: OfferLetter) => !!l.offerRef

  const dialogTitle =
    dialogMode === "create" ? "New Offer Letter Draft" :
    dialogMode === "edit"   ? `Edit Draft — ${activeLetter?.candidateName ?? ""}` :
    dialogMode === "view"   ? `${activeLetter?.offerRef} — ${activeLetter?.candidateName}` :
    ""

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
            Save drafts first. Offer number is assigned only when you click <strong>Generate Offer Letter</strong>.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Save Draft
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
                    <TableHead className="w-52">Offer Ref</TableHead>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Joining Date</TableHead>
                    <TableHead>Saved</TableHead>
                    <TableHead className="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {letters.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        {isDraft(l) ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            Draft
                          </span>
                        ) : (
                          <span className="font-mono text-xs font-semibold text-primary bg-primary/8 px-2 py-0.5 rounded">
                            {l.offerRef}
                          </span>
                        )}
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
                          {isDraft(l) ? (
                            <>
                              <Button
                                size="icon" variant="ghost" className="h-7 w-7"
                                title="Edit draft"
                                onClick={() => openEdit(l)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon" variant="ghost" className="h-7 w-7 text-amber-600 hover:text-amber-700"
                                title="Generate offer letter"
                                disabled={generating === l.id}
                                onClick={() => handleGenerate(l.id)}
                              >
                                <Zap className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="icon" variant="ghost" className="h-7 w-7"
                                title="View"
                                onClick={() => openView(l)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon" variant="ghost" className="h-7 w-7"
                                title="Print / PDF"
                                onClick={() => window.open(`/offer-letter-print/${l.id}`, "_blank")}
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="icon" variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            title="Delete"
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

      {/* ── Create / Edit Draft Dialog ──────────────────────────────── */}
      <Dialog open={dialogMode === "create" || dialogMode === "edit"} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5 col-span-2">
              <Label>Template</Label>
              <Select
                value={form.templateId || "none"}
                onValueChange={(v) => setForm((s) => ({ ...s, templateId: v === "none" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="— No template (blank) —" /></SelectTrigger>
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

          {dialogMode === "edit" && (
            <>
              <Separator />
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                <p className="font-semibold mb-0.5">Ready to issue?</p>
                <p>Click <strong>Generate Offer Letter</strong> to assign the next sequential number
                   (QT/HR/{new Date().getFullYear()}/…). This cannot be undone.</p>
              </div>
            </>
          )}

          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button variant="outline" onClick={handleSaveDraft} disabled={saving}>
              {saving ? "Saving…" : dialogMode === "create" ? "Save Draft" : "Save Changes"}
            </Button>
            {dialogMode === "edit" && activeLetter && (
              <Button
                onClick={() => handleGenerate(activeLetter.id)}
                disabled={generating === activeLetter.id || saving}
                className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Zap className="h-4 w-4" />
                {generating === activeLetter.id ? "Generating…" : "Generate Offer Letter"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Dialog (generated letters) ────────────────────────── */}
      <Dialog open={dialogMode === "view"} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-primary">{activeLetter?.offerRef}</span>
              <span className="font-normal text-muted-foreground">—</span>
              <span>{activeLetter?.candidateName}</span>
            </DialogTitle>
          </DialogHeader>
          {activeLetter && isIssued(activeLetter) && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm bg-muted/30 rounded-lg p-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Designation</p>
                  <p className="font-medium mt-0.5">{activeLetter.designation}</p>
                  {activeLetter.department && (
                    <p className="text-xs text-muted-foreground">{activeLetter.department}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Joining Date</p>
                  <p className="font-medium mt-0.5">
                    {activeLetter.joiningDate
                      ? format(new Date(activeLetter.joiningDate), "d MMM yyyy")
                      : "—"}
                  </p>
                </div>
                {activeLetter.workLocation && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Work Location</p>
                    <p className="font-medium mt-0.5">{activeLetter.workLocation}</p>
                  </div>
                )}
                {activeLetter.reportingManager && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Reporting Manager</p>
                    <p className="font-medium mt-0.5">{activeLetter.reportingManager}</p>
                  </div>
                )}
              </div>

              <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/30 rounded-lg p-4 min-h-[160px] max-h-80 overflow-y-auto">
                {activeLetter.content || "(No content — template was blank)"}
              </pre>

              <div className="flex gap-2">
                <Button
                  size="sm" variant="outline" className="gap-1"
                  onClick={() => window.open(`/offer-letter-print/${activeLetter.id}`, "_blank")}
                >
                  <Printer className="h-3.5 w-3.5" /> Print / PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ─────────────────────────────────────── */}
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
