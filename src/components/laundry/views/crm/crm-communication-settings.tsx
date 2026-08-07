// CRM Communication Settings — per-tenant toggles (calls/whatsapp/email/recording)
// and WhatsApp + Email message templates with placeholder substitution preview.
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Loader2, Plus, Pencil, Trash2, Phone, MessageSquare, Mail, Mic, Save,
} from "lucide-react"
import { toast } from "sonner"
import { useCrmActor } from "./crm-shared"
import {
  type CommSettings, type CommTemplate, DEFAULT_COMM_SETTINGS,
  COMM_PLACEHOLDERS, applyPlaceholders,
} from "./crm-comms"

const fmt = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })

export function CrmCommunicationSettings({ businessId }: { businessId: string }) {
  const actor = useCrmActor()
  const [settings, setSettings] = useState<CommSettings>(DEFAULT_COMM_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [savingToggles, setSavingToggles] = useState(false)
  const [channel, setChannel] = useState<"WHATSAPP" | "EMAIL">("WHATSAPP")
  const [templates, setTemplates] = useState<CommTemplate[]>([])
  const [editing, setEditing] = useState<CommTemplate | null>(null)
  const [creating, setCreating] = useState(false)

  const loadSettings = async () => {
    try {
      const j = await fetch(`/api/laundry/crm/communication/settings?businessId=${encodeURIComponent(businessId)}`).then((r) => r.json())
      if (j.success) setSettings(j.data)
    } catch { setSettings(DEFAULT_COMM_SETTINGS) } finally { setLoaded(true) }
  }
  const loadTemplates = async () => {
    try {
      const j = await fetch(`/api/laundry/crm/communication/templates?businessId=${encodeURIComponent(businessId)}&channel=${channel}`).then((r) => r.json())
      if (j.success) setTemplates(j.data)
    } catch { setTemplates([]) }
  }
  useEffect(() => { loadSettings() }, [businessId])
  useEffect(() => { loadTemplates() }, [businessId, channel])

  const toggle = async (key: keyof CommSettings, value: boolean) => {
    setSavingToggles(true)
    const next = { ...settings, [key]: value }
    setSettings(next)
    try {
      const res = await fetch(`/api/laundry/crm/communication/settings`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, ...next, ...actor }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Save failed")
      toast.success("Communication settings saved")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSavingToggles(false) }
  }

  const saveTemplate = async (t: {
    id?: string; name: string; category?: string; subject?: string; body: string; active: boolean
  }) => {
    const res = await fetch(t.id
      ? `/api/laundry/crm/communication/templates/${t.id}?businessId=${encodeURIComponent(businessId)}`
      : `/api/laundry/crm/communication/templates?businessId=${encodeURIComponent(businessId)}`, {
      method: t.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, channel, ...t, ...actor }),
    })
    const j = await res.json()
    if (!res.ok || !j.success) throw new Error(j.error || "Save failed")
    return j.data
  }

  const removeTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/laundry/crm/communication/templates/${id}?businessId=${encodeURIComponent(businessId)}`, { method: "DELETE" })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Delete failed")
      toast.success("Template deleted"); loadTemplates()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed") }
  }

  const rows: { key: keyof CommSettings; label: string; desc: string; icon: React.ReactNode }[] = [
    { key: "enableCalls", label: "Call", desc: "Offer a one-tap Call button (tel:) next to every lead.", icon: <Phone className="h-4 w-4" /> },
    { key: "enableWhatsApp", label: "WhatsApp", desc: "Open an in-device WhatsApp chat via wa.me with template support.", icon: <MessageSquare className="h-4 w-4 text-green-600" /> },
    { key: "enableEmail", label: "Email", desc: "Pre-fill an email to the lead using mailto: with your saved templates.", icon: <Mail className="h-4 w-4 text-blue-600" /> },
    { key: "enableRecordingUpload", label: "Call Recording Upload", desc: "Allow manual upload of call recordings (mp3/m4a/wav/aac, up to 25 MB).", icon: <Mic className="h-4 w-4 text-rose-500" /> },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Communication Channels</h3>
            <p className="text-xs text-slate-500">Phase 1 uses your device&apos;s native dialer, WhatsApp and email apps — no third-party calling/chat APIs required.</p>
          </div>
          {!loaded && <p className="text-xs text-slate-400"><Loader2 className="h-3 w-3 inline animate-spin" /> Loading…</p>}
          {rows.map((r) => (
            <div key={r.key} className="flex items-start justify-between gap-3 py-2">
              <div className="flex items-start gap-3">
                <span className="mt-0.5">{r.icon}</span>
                <div>
                  <p className="text-sm font-medium text-slate-700">{r.label}</p>
                  <p className="text-xs text-slate-500">{r.desc}</p>
                </div>
              </div>
              <Switch checked={settings[r.key]} onCheckedChange={(v) => toggle(r.key, v)} disabled={savingToggles}
                aria-label={r.label} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Message Templates</h3>
              <p className="text-xs text-slate-500">Reusable WhatsApp & email templates. Use placeholders — they are replaced automatically when sending.</p>
            </div>
            <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New Template
            </Button>
          </div>

          <Tabs value={channel} onValueChange={(v) => setChannel(v as "WHATSAPP" | "EMAIL")}>
            <TabsList className="h-auto">
              <TabsTrigger value="WHATSAPP" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> WhatsApp</TabsTrigger>
              <TabsTrigger value="EMAIL" className="gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="mt-4 space-y-2">
            {templates.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-400">
                No {channel === "WHATSAPP" ? "WhatsApp" : "email"} templates yet. Create one to send faster.
              </div>
            )}
            {templates.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800">{t.name}</p>
                    {!t.active && <span className="text-[10px] text-slate-400 border rounded px-1.5">Inactive</span>}
                    {t.category && <span className="text-[10px] text-slate-400 border rounded px-1.5">{t.category}</span>}
                    <span className="text-[11px] text-slate-400 ml-auto">{fmt(t.updatedAt)}</span>
                  </div>
                  {channel === "EMAIL" && t.subject && <p className="text-xs text-slate-500 mt-0.5">Subject: {t.subject}</p>}
                  <pre className="text-xs text-slate-500 whitespace-pre-wrap mt-1 [font-family:inherit]">{t.body}</pre>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setEditing(t)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => removeTemplate(t.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {(creating || editing) && (
        <TemplateDialog
          channel={channel}
          template={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={async (t) => {
            try { await saveTemplate(t); toast.success("Template saved"); setCreating(false); setEditing(null); loadTemplates() }
            catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") }
          }}
        />
      )}
    </div>
  )
}

function TemplateDialog({ channel, template, onClose, onSaved }: {
  channel: "WHATSAPP" | "EMAIL"
  template: CommTemplate | null
  onClose: () => void
  onSaved: (t: { id?: string; name: string; category?: string; subject?: string; body: string; active: boolean }) => void
}) {
  const [name, setName] = useState(template?.name || "")
  const [category, setCategory] = useState(template?.category || "")
  const [subject, setSubject] = useState(template?.subject || "")
  const [body, setBody] = useState(template?.body || "")
  const [active, setActive] = useState(template?.active ?? true)
  const sample = {
    customerName: "Rahul", businessName: "Sunshine Laundry", employeeName: "Priya",
    leadId: "LD-1024", mobile: "+91 98765 43210", email: "rahul@example.com", currentDate: "07 Aug 2026",
  }
  const preview = applyPlaceholders(body, sample)

  const save = () => {
    if (!name.trim()) return toast.error("Template name is required")
    if (!body.trim()) return toast.error("Message body is required")
    onSaved({ id: template?.id, name: name.trim(), category: category.trim() || undefined,
      subject: channel === "EMAIL" ? subject : undefined, body, active })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{template ? "Edit" : "New"} {channel === "WHATSAPP" ? "WhatsApp" : "Email"} Template</DialogTitle>
          <DialogDescription>Placeholders below are replaced on every send. Preview uses sample values.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Template name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Follow-up greeting" />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Follow-up, Welcome, Reference" />
          </div>
          {channel === "EMAIL" && (
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject…" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{channel === "WHATSAPP" ? "Message" : "Body"}</Label>
            <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hi {{customerName}}, …" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {COMM_PLACEHOLDERS.map((p) => <code key={p} className="text-[10px] bg-slate-100 border rounded px-1.5 py-0.5 text-slate-500">{p}</code>)}
          </div>
          <div className="rounded-lg bg-slate-50 border p-2.5 text-[11px] text-slate-500">
            <span className="font-medium text-slate-600">Preview:</span> {preview || "—"}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={active} onCheckedChange={setActive} />
            <span className="text-slate-600">Active (available when composing)</span>
          </label>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} className="gap-1"><Save className="h-4 w-4" /> Save Template</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}