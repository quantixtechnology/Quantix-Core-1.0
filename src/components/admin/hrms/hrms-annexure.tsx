"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Plus, Eye, Printer, Trash2, Paperclip } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { authFetch } from "@/lib/admin-fetch"

interface OfferLetterSummary {
  id: string
  offerRef?: string
  candidateName: string
}

interface AnnexureRecord {
  id: string
  offerLetterId: string
  label: string
  annexureRef?: string
  title: string
  content: string
  createdAt: string
  offerLetter: {
    offerRef?: string
    candidateName: string
  }
}

interface Template {
  id: string
  name: string
  content: string
  isActive: boolean
}

const EMPTY_FORM = {
  offerLetterId: "",
  title: "",
  templateId: "",
  content: "",
}

export function HrmsAnnexureView() {
  const [annexures, setAnnexures] = useState<AnnexureRecord[]>([])
  const [letters, setLetters] = useState<OfferLetterSummary[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [viewAnnexure, setViewAnnexure] = useState<AnnexureRecord | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [ar, lr, tr] = await Promise.all([
        authFetch("/api/admin/hrms/annexures?limit=100"),
        authFetch("/api/admin/hrms/offer-letters?limit=100"),
        authFetch("/api/admin/hrms/templates"),
      ])
      const [aj, lj, tj] = await Promise.all([ar.json(), lr.json(), tr.json()])
      if (aj.success) setAnnexures(aj.data)
      if (lj.success) setLetters(lj.data)
      if (tj.success) setTemplates(tj.data.filter((t: Template) => t.isActive))
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const handleTemplateChange = (value: string) => {
    const tpl = templates.find((t) => t.id === value)
    setForm((s) => ({
      ...s,
      templateId: value === "none" ? "" : value,
      content: tpl ? tpl.content : s.content,
    }))
  }

  const handleCreate = async () => {
    if (!form.offerLetterId) { toast.error("Select an offer letter"); return }
    if (!form.title.trim()) { toast.error("Annexure title is required"); return }
    setSaving(true)
    try {
      const res = await authFetch("/api/admin/hrms/annexures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerLetterId: form.offerLetterId,
          title:         form.title.trim(),
          content:       form.content,
          templateId:    form.templateId || undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      const ref = json.data.annexureRef || `Annexure ${json.data.label}`
      toast.success(`${ref} created`)
      setFormOpen(false)
      setForm({ ...EMPTY_FORM })
      loadAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await authFetch(`/api/admin/hrms/annexures/${deleteId}`, { method: "DELETE" })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success("Annexure deleted")
      setDeleteId(null)
      loadAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl font-bold tracking-tight">Annexures</h1>
            <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
              Quantix Internal
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Attach policy documents to issued offer letters. Each annexure is independently versioned.
          </p>
        </div>
        <Button
          onClick={() => { setForm({ ...EMPTY_FORM }); setFormOpen(true) }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> Create Annexure
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-muted border-t-primary" />
            </div>
          ) : annexures.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <Paperclip className="h-8 w-8 opacity-30" />
              <p className="text-sm">No annexures yet</p>
              <p className="text-xs opacity-60">Create an annexure linked to an offer letter</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Annexure Ref</TableHead>
                    <TableHead>Offer Letter</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {annexures.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <span className="font-mono text-xs font-semibold text-primary bg-primary/8 px-2 py-0.5 rounded">
                          {a.annexureRef || `Annexure ${a.label}`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-xs font-semibold">
                          {a.offerLetter.offerRef || "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {a.offerLetter.candidateName}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{a.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(a.createdAt), "d MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7"
                            title="View"
                            onClick={() => setViewAnnexure(a)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7"
                            title="Print / PDF"
                            onClick={() => window.open(`/annexure-print/${a.id}`, "_blank")}
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            title="Delete"
                            onClick={() => setDeleteId(a.id)}
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

      {/* ── Create Dialog ─────────────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Annexure</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            <div className="space-y-1.5">
              <Label>Offer Letter <span className="text-destructive">*</span></Label>
              <Select
                value={form.offerLetterId}
                onValueChange={(v) => setForm((s) => ({ ...s, offerLetterId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="— Select offer letter —" />
                </SelectTrigger>
                <SelectContent>
                  {letters.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.offerRef || l.id.slice(-6)} — {l.candidateName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Label (A, B, C…) is auto-assigned based on existing annexures for this offer.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Annexure Title <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Commission & Incentive Policy"
                value={form.title}
                onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                Template{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  (optional — pre-fills content)
                </span>
              </Label>
              <Select
                value={form.templateId || "none"}
                onValueChange={handleTemplateChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="— No template —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No template (blank) —</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Content</Label>
              <Textarea
                rows={14}
                placeholder="Enter annexure content…"
                value={form.content}
                onChange={(e) => setForm((s) => ({ ...s, content: e.target.value }))}
                className="font-mono text-sm resize-y"
              />
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating…" : "Create Annexure"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Dialog ───────────────────────────────────────────────── */}
      <Dialog open={!!viewAnnexure} onOpenChange={(o) => !o && setViewAnnexure(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-primary">
                {viewAnnexure?.annexureRef || `Annexure ${viewAnnexure?.label}`}
              </span>
              <span className="text-muted-foreground font-normal">—</span>
              <span>{viewAnnexure?.title}</span>
            </DialogTitle>
          </DialogHeader>
          {viewAnnexure && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm bg-muted/30 rounded-lg p-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">
                    Linked Offer Letter
                  </p>
                  <p className="font-mono text-xs font-semibold">
                    {viewAnnexure.offerLetter.offerRef || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {viewAnnexure.offerLetter.candidateName}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">
                    Created
                  </p>
                  <p className="font-medium">
                    {format(new Date(viewAnnexure.createdAt), "d MMM yyyy, HH:mm")}
                  </p>
                </div>
              </div>

              <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/30 rounded-lg p-4 min-h-[200px] max-h-96 overflow-y-auto">
                {viewAnnexure.content || "(No content)"}
              </pre>

              <div className="flex gap-2">
                <Button
                  size="sm" variant="outline" className="gap-1"
                  onClick={() => window.open(`/annexure-print/${viewAnnexure.id}`, "_blank")}
                >
                  <Printer className="h-3.5 w-3.5" /> Print / PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ───────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Annexure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the annexure. The linked offer letter is not affected.
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
