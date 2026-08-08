// CRM Communication Center — device-native Phase 1 channels (Call / WhatsApp / Email)
// with template selection + placeholder preview, plus manual call-recording upload & list.
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Phone, MessageSquare, Mail, Mic, Upload, Trash2, Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type React from "react"
import { type CrmLead, useCrmActor, fmtDateTime } from "./crm-shared"
import {
  type CommSettings, type CallRecording, type CommContext,
  useCommTemplates, useCommContext, applyPlaceholders, telHref, waHref, mailtoHref,
} from "./crm-comms"

const fmtBytes = (b: number) => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`

export function CommunicationCenter({ lead, settings, businessId }: {
  lead: CrmLead
  settings: CommSettings
  businessId: string
}) {
  const comm = useCommContext(lead)
  const [channel, setChannel] = useState<"WHATSAPP" | "EMAIL" | null>(null)
  const [recording, setRecording] = useState(false)

  const phone = comm.ctx.mobile
  const email = comm.ctx.email
  const canCall = settings.enableCalls && !!phone
  const canWa = settings.enableWhatsApp && !!phone
  const canMail = settings.enableEmail && !!email

  return (
    <Card>
      <div className="p-4">
        <p className="text-sm font-semibold text-slate-800 mb-3">Communication Center</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <QuickAction disabled={!canCall} onClick={() => phone && openDeepLink(telHref(phone))}
            icon={<Phone className="h-4 w-4" />} label="Call" hint={phone || "No number"} />
          <QuickAction disabled={!canWa} onClick={() => setChannel("WHATSAPP")}
            icon={<MessageSquare className="h-4 w-4 text-green-600" />} label="WhatsApp" hint={phone || "No number"} />
          <QuickAction disabled={!canMail} onClick={() => setChannel("EMAIL")}
            icon={<Mail className="h-4 w-4 text-blue-600" />} label="Email" hint={email || "No email"} />
          <QuickAction disabled={!settings.enableRecordingUpload} onClick={() => setRecording(true)}
            icon={<Mic className="h-4 w-4 text-rose-500" />} label="Recording" hint="Upload call audio" />
        </div>
      </div>

      {channel && (
        <SendDialog channel={channel} comm={comm} leadId={lead.id} onClose={() => setChannel(null)} />
      )}
      {recording && (
        <RecordingDialog businessId={businessId} lead={lead} onClose={() => setRecording(false)} />
      )}
    </Card>
  )
}

export function openDeepLink(href: string) {
  window.open(href, "_blank", "noopener,noreferrer")
}

function QuickAction({ disabled, onClick, icon, label, hint }: {
  disabled?: boolean; onClick?: () => void; icon: React.ReactNode; label: string; hint: string
}) {
  return (
    <button
      type="button" disabled={disabled} onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center transition hover:border-slate-300 hover:bg-white disabled:opacity-40 disabled:pointer-events-none"
    >
      {icon}
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className="text-[11px] text-slate-400 break-all leading-tight">{hint}</span>
    </button>
  )
}

// ─── Send via WhatsApp / Email ──────────────────────────────────────────────
// Exported so every CRM surface (lead detail, opportunity grid) shares ONE
// send flow — templates, placeholder substitution and activity logging included.
export function SendDialog({ channel, comm, leadId, onClose }: {
  channel: "WHATSAPP" | "EMAIL"
  comm: CommContext
  leadId: string
  onClose: () => void
}) {
  const actor = useCrmActor()
  const { templates, loading } = useCommTemplates(comm.businessId, channel)
  const activeT = templates.filter((t) => t.active)
  const blankId = "__blank"
  const [templateId, setTemplateId] = useState("")
  const [body, setBody] = useState("")
  const [subject, setSubject] = useState("")

  const pick = (id: string) => {
    setTemplateId(id)
    const t = templates.find((x) => x.id === id)
    setBody(t?.body || "")
    setSubject(t?.subject || "")
  }

  const sendIt = () => {
    if (!body.trim()) return toast.error("Message is required")
    if (channel === "WHATSAPP") {
      if (!comm.ctx.mobile) return toast.error("No WhatsApp number")
      openDeepLink(waHref(comm.ctx.mobile, applyPlaceholders(body, comm.ctx)))
    } else {
      if (!comm.ctx.email) return toast.error("No email address")
      openDeepLink(mailtoHref(comm.ctx.email, applyPlaceholders(subject, comm.ctx), applyPlaceholders(body, comm.ctx)))
    }
    logSent()
    onClose()
  }

  const logSent = async () => {
    try {
      await fetch("/api/laundry/crm/activities", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: comm.businessId, leadId,
          type: channel === "WHATSAPP" ? "WhatsApp" : "Email",
          subject: channel === "WHATSAPP" ? "WhatsApp message sent" : (applyPlaceholders(subject, comm.ctx) || "Email sent"),
          description: applyPlaceholders(body, comm.ctx), outcome: "Composed via template", ...actor,
        }),
      })
    } catch { /* non-fatal */ }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send {channel === "WHATSAPP" ? "WhatsApp" : "Email"} — {comm.ctx.customerName}</DialogTitle>
          <DialogDescription>
            Compose from a saved template (placeholders are replaced automatically) or write a blank message.
            Opens your device&apos;s {channel === "WHATSAPP" ? "WhatsApp" : "email"} app.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Template</Label>
            <Select value={templateId || (activeT[0]?.id || blankId)} onValueChange={pick}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={loading ? "Loading…" : "Blank message"} />
              </SelectTrigger>
              <SelectContent>
                {activeT.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                <SelectItem value="'__blank'">Blank message</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {channel === "EMAIL" && (
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject…" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{channel === "WHATSAPP" ? "Message" : "Body"}</Label>
            <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type or pick a template…" />
          </div>

          <div className="rounded-lg bg-slate-50 border p-2.5 text-[11px] text-slate-500">
            <span className="font-medium text-slate-600">Preview:</span>{" "}
            {applyPlaceholders(body, comm.ctx) || "—"}
            {channel === "EMAIL" && subject ? (
              <span className="block mt-1"><span className="font-medium text-slate-600">Subject:</span> {applyPlaceholders(subject, comm.ctx)}</span>
            ) : null}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={sendIt}>{channel === "WHATSAPP" ? "Open WhatsApp" : "Open Email"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ChannelSelect({ nope }: { nope?: boolean }) { return null }

// ─── Recording upload + list ────────────────────────────────────────────────
export function RecordingDialog({ businessId, lead, onClose }: {
  // Structural: only id + displayName are used, so an opportunity's linked lead
  // works here without materialising a full CrmLead.
  businessId: string; lead: { id: string; displayName: string }; onClose: () => void
}) {
  const [recordings, setRecordings] = useState<CallRecording[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [remarks, setRemarks] = useState("")
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const load = async () => {
    try {
      const j = await fetch(`/api/laundry/crm/leads/${lead.id}/recordings?businessId=${encodeURIComponent(businessId)}`).then((r) => r.json())
      if (j.success) setRecordings(j.data)
    } catch { setRecordings([]) } finally { setLoaded(true) }
  }
  useEffect(() => { load() }, [lead.id, businessId])

  const upload = async () => {
    if (!file) return toast.error("Choose an audio file")
    const fd = new FormData()
    fd.append("file", file)
    if (remarks.trim()) fd.append("remarks", remarks.trim())
    setUploading(true)
    try {
      const res = await fetch(`/api/laundry/crm/leads/${lead.id}/recordings?businessId=${encodeURIComponent(businessId)}`, {
        method: "POST", body: fd,
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Upload failed")
      toast.success("Recording uploaded")
      setFile(null); setRemarks(""); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed") } finally { setUploading(false) }
  }

  const remove = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/laundry/crm/recordings/${id}?businessId=${encodeURIComponent(businessId)}`, { method: "DELETE" })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Delete failed")
      toast.success("Recording deleted"); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed") } finally { setDeletingId(null) }
  }

  const fileUrl = (id: string) => `/api/laundry/crm/recordings/${id}/file?businessId=${encodeURIComponent(businessId)}`

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Call Recording — {lead.displayName}</DialogTitle>
          <DialogDescription>Upload a manual call recording (mp3, m4a, wav, aac, up to 25 MB).</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Audio file</Label>
            <Input type="file" accept=".mp3,.m4a,.wav,.aac,audio/mpeg,audio/mp4,audio/wav,audio/aac"
              onChange={(e) => setFile(e.target.files?.[0] || null)} />
            {file && <p className="text-[11px] text-slate-400">{file.name} · {fmtBytes(file.size)}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Follow-up call with owner" />
          </div>
          <Button className="w-full gap-1" onClick={upload} disabled={uploading || !file}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload Recording
          </Button>

          <div className="space-y-2">
            {!loaded && <p className="text-xs text-slate-400">Loading recordings…</p>}
            {loaded && recordings.length === 0 && <p className="text-xs text-slate-400">No recordings yet.</p>}
            {recordings.map((r) => (
              <div key={r.id} className="rounded-lg border p-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700 truncate flex-1">{r.fileName}</span>
                  <a href={fileUrl(r.id)} download className="p-1 text-slate-400 hover:text-slate-700"><Download className="h-4 w-4" /></a>
                  <button onClick={() => remove(r.id)} disabled={deletingId === r.id} className="p-1 text-slate-400 hover:text-red-600">
                    {deletingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
                <audio controls src={fileUrl(r.id)} className="w-full h-9 mt-1.5" preload="none">Playback</audio>
                <p className="text-[11px] text-slate-400 mt-1">
                  {fmtBytes(r.size)}{r.durationSec ? ` · ${r.durationSec}s` : ""}{r.remarks ? ` · ${r.remarks}` : ""} · {fmtDateTime(r.createdAt)} · {r.uploadedByName}
                </p>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}