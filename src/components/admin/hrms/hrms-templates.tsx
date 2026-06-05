"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Switch } from "@/components/ui/switch"
import { Plus, Pencil, Trash2, LayoutTemplate, Star } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface OfferLetterTemplate {
  id: string
  name: string
  description?: string
  content: string
  isDefault: boolean
  isActive: boolean
  createdAt: string
}

const MERGE_TAGS = [
  "{{CandidateName}}",
  "{{Designation}}",
  "{{JoiningDate}}",
  "{{ReportingManager}}",
  "{{WorkLocation}}",
  "{{Department}}",
  "{{EmploymentType}}",
]

const DEFAULT_TEMPLATES = [
  {
    name: "Standard Offer Letter",
    description: "General employment offer for permanent hires",
    content: `Dear {{CandidateName}},

We are pleased to offer you the position of {{Designation}} at Quantix Technology Pvt. Ltd.

Your date of joining will be {{JoiningDate}}. You will report to {{ReportingManager}} at our {{WorkLocation}} office.

Department: {{Department}}
Employment Type: {{EmploymentType}}

Please confirm your acceptance by signing and returning this letter.

Warm regards,
HR Department
Quantix Technology Pvt. Ltd.`,
  },
  {
    name: "Contract Offer Letter",
    description: "Fixed-term contract position offer",
    content: `Dear {{CandidateName}},

We are pleased to offer you a contract position as {{Designation}} at Quantix Technology Pvt. Ltd.

Contract Start Date: {{JoiningDate}}
Reporting to: {{ReportingManager}}
Location: {{WorkLocation}}

Please sign and return this letter within 3 business days.

Regards,
HR Team
Quantix Technology Pvt. Ltd.`,
  },
  {
    name: "Internship Offer Letter",
    description: "Internship program offer",
    content: `Dear {{CandidateName}},

Congratulations! We are delighted to offer you an internship as {{Designation}} at Quantix Technology Pvt. Ltd.

Start Date: {{JoiningDate}}
Department: {{Department}}
Reporting Manager: {{ReportingManager}}
Location: {{WorkLocation}}

We look forward to having you on the team.

Best regards,
HR Team
Quantix Technology Pvt. Ltd.`,
  },
  {
    name: "Commission-Based Offer Letter",
    description: "Commission-based role offer",
    content: `Dear {{CandidateName}},

We are excited to offer you the role of {{Designation}} on a commission-based engagement at Quantix Technology Pvt. Ltd.

Commencement Date: {{JoiningDate}}
Reporting to: {{ReportingManager}}
Base Location: {{WorkLocation}}

Your compensation will be governed by the active Commission Policy. Details will be shared separately.

Regards,
HR Department
Quantix Technology Pvt. Ltd.`,
  },
]

const EMPTY_FORM = { name: "", description: "", content: "", isDefault: false, isActive: true }

export function HrmsTemplatesView() {
  const [templates, setTemplates] = useState<OfferLetterTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<OfferLetterTemplate | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/hrms/templates")
      const json = await res.json()
      if (json.success) setTemplates(json.data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditItem(null); setForm({ ...EMPTY_FORM }); setFormOpen(true) }
  const openEdit   = (t: OfferLetterTemplate) => {
    setEditItem(t)
    setForm({ name: t.name, description: t.description ?? "", content: t.content, isDefault: t.isDefault, isActive: t.isActive })
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.content) { toast.error("Name and Content are required"); return }
    setSaving(true)
    try {
      const url    = editItem ? `/api/admin/hrms/templates/${editItem.id}` : "/api/admin/hrms/templates"
      const method = editItem ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success(editItem ? "Template updated" : "Template created")
      setFormOpen(false)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/admin/hrms/templates/${deleteId}`, { method: "DELETE" })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success("Template deleted")
      setDeleteId(null)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    }
  }

  const handleSeedDefaults = async () => {
    setSeeding(true)
    try {
      for (const tpl of DEFAULT_TEMPLATES) {
        await fetch("/api/admin/hrms/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...tpl, isDefault: false, isActive: true }),
        })
      }
      toast.success("4 default templates added")
      load()
    } catch { toast.error("Seed failed") }
    finally { setSeeding(false) }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl font-bold tracking-tight">Offer Letter Templates</h1>
            <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">Quantix Internal</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Use merge tags like {MERGE_TAGS[0]} to personalise letters.</p>
        </div>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button variant="outline" onClick={handleSeedDefaults} disabled={seeding} className="gap-2">
              <LayoutTemplate className="h-4 w-4" /> {seeding ? "Seeding…" : "Add Default Templates"}
            </Button>
          )}
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> New Template
          </Button>
        </div>
      </div>

      {/* Merge tag reference */}
      <Card className="border-dashed">
        <CardContent className="py-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Available merge tags:</p>
          <div className="flex flex-wrap gap-1.5">
            {MERGE_TAGS.map((tag) => (
              <code key={tag} className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{tag}</code>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-muted border-t-primary" />
          </div>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <LayoutTemplate className="h-8 w-8 opacity-30" />
              <p className="text-sm">No templates yet</p>
            </CardContent>
          </Card>
        ) : templates.map((t) => (
          <Card key={t.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {t.name}
                    {t.isDefault && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                    <span className={`text-xs font-normal px-1.5 py-0.5 rounded-full ${t.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                      {t.isActive ? "Active" : "Inactive"}
                    </span>
                  </CardTitle>
                  {t.description && <CardDescription className="text-xs">{t.description}</CardDescription>}
                  <p className="text-xs text-muted-foreground">Created {format(new Date(t.createdAt), "d MMM yyyy")}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(t.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans line-clamp-4 bg-muted/40 rounded p-2">{t.content}</pre>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Template" : "New Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input placeholder="Standard Offer Letter" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="Short description…" value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Content <span className="text-destructive">*</span></Label>
              <Textarea
                className="font-mono text-sm min-h-[300px]"
                placeholder={`Dear {{CandidateName}},\n\nWe are pleased to offer you the position of {{Designation}}…`}
                value={form.content}
                onChange={(e) => setForm((s) => ({ ...s, content: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch id="isDefault" checked={form.isDefault} onCheckedChange={(v) => setForm((s) => ({ ...s, isDefault: v }))} />
                <Label htmlFor="isDefault">Default Template</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="isActive" checked={form.isActive} onCheckedChange={(v) => setForm((s) => ({ ...s, isActive: v }))} />
                <Label htmlFor="isActive">Active</Label>
              </div>
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
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>Offer letters generated from this template will retain their content.</AlertDialogDescription>
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
