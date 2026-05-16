"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Phone, Mail, MapPin, ArrowLeft, PhoneCall, MessageCircle, Calendar,
  Pencil, Check, X, Send, ChevronDown, Building2, User, IndianRupee,
  Tag, StickyNote, CalendarClock, UserCheck, Zap, Activity, MessageSquare,
  History, LayoutDashboard, AlertTriangle, CheckCircle2, Clock,
} from "lucide-react"
import { businessTypeConfig, leadStageColors } from "@/components/dashboard/data"
import type { BusinessType, LeadStage } from "@/components/dashboard/data"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { toast } from "sonner"
import { LeadActivityTimeline } from "./lead-activity-timeline"

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeadApiData {
  id: string; leadId?: string | null
  businessName: string; contactName: string; contactEmail: string
  contactPhone: string; city: string | null; state?: string | null; pincode?: string | null
  businessType: string; source: string; stage: string
  estimatedValue: number | null; notes: string | null; followUpDate: string | null
  lastContactedAt: string | null; tags: string; createdAt: string; updatedAt: string
  salesRep: { id: string; name: string; email: string } | null
  negotiatedMonthlyPrice: number | null; negotiatedYearlyPrice: number | null
  lostReason: string | null; selectedBillingCycle: string | null
  demoTenantId: string | null; demoSharedAt: string | null
  paymentVerifiedAt: string | null; convertedBusinessId: string | null; convertedAt: string | null
}

interface SalesTeamMember { id: string; name: string; isActive?: boolean }

interface ApiComment {
  id: string; type: string; content: string
  user: { id: string; name: string; email: string; avatar: string | null } | null
  createdAt: string
}

interface LeadDetailEnhancedProps {
  lead: LeadApiData
  onBack: () => void
  onLeadUpdated?: (updated: LeadApiData) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PIPELINE_STAGES: LeadStage[] = [
  "LEAD", "FOLLOW_UP", "INTERESTED", "HOT_LEAD",
  "DEMO_PLANNED", "DEMO_DONE", "NEGOTIATION",
  "PAYMENT_PENDING", "PAYMENT_RECEIVED", "CLOSED_WON",
]
const TERMINAL_STAGES: LeadStage[] = ["NOT_INTERESTED", "WRONG_NUMBER", "RNR", "LOST", "DUPLICATE"]

const STAGE_LABELS: Record<string, string> = {
  LEAD: "Lead", FOLLOW_UP: "Follow Up", INTERESTED: "Interested", HOT_LEAD: "Hot Lead",
  DEMO_PLANNED: "Demo Planned", DEMO_DONE: "Demo Done", NEGOTIATION: "Negotiation",
  PAYMENT_PENDING: "Payment Pending", PAYMENT_RECEIVED: "Payment Received", CLOSED_WON: "Closed Won",
  NOT_INTERESTED: "Not Interested", WRONG_NUMBER: "Wrong Number", RNR: "RNR",
  LOST: "Lost", DUPLICATE: "Duplicate",
}

const SOURCE_LABELS: Record<string, string> = {
  META_ADS: "Meta Ads", GOOGLE_ADS: "Google Ads", DIRECT_REFERRAL: "Direct Referral",
  WEBSITE_INQUIRY: "Website Inquiry", COLD_OUTREACH: "Cold Outreach",
  WHATSAPP_INQUIRY: "WhatsApp Inquiry", PHONE_CALL: "Phone Call", OTHER: "Other",
}

const COMMENT_TYPES = [
  { value: "comment",      label: "Note",         color: "text-slate-600",   bg: "bg-slate-50",  border: "border-l-slate-400" },
  { value: "call_outcome", label: "Call Outcome",  color: "text-emerald-700", bg: "bg-emerald-50", border: "border-l-emerald-400" },
  { value: "follow_up",   label: "Follow-up",     color: "text-amber-700",   bg: "bg-amber-50",  border: "border-l-amber-400" },
]

function fmtDatetime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    + " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
}
function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
}

// ─── Inline Editable Field ────────────────────────────────────────────────────

interface EditableFieldProps {
  label: string
  value: string
  onSave: (v: string) => Promise<void>
  type?: "text" | "email" | "tel" | "number" | "date" | "textarea"
  placeholder?: string
  icon?: React.ReactNode
  disabled?: boolean
}

function EditableField({ label, value, onSave, type = "text", placeholder, icon, disabled }: EditableFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const commit = async () => {
    if (draft === value) { setEditing(false); return }
    setSaving(true)
    try { await onSave(draft) } finally { setSaving(false); setEditing(false) }
  }

  const cancel = () => { setDraft(value); setEditing(false) }

  return (
    <div className="group flex items-start gap-2 py-2.5 border-b border-dashed border-border/50 last:border-0">
      {icon && <span className="mt-0.5 shrink-0 text-muted-foreground/60">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">{label}</p>
        {editing ? (
          <div className="flex items-center gap-1.5">
            {type === "textarea" ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                className="w-full text-xs rounded border border-input bg-background px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                value={draft}
                rows={3}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Escape") cancel() }}
              />
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type={type}
                className="flex-1 text-xs rounded border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel() }}
              />
            )}
            <button onClick={commit} disabled={saving} className="p-1 rounded text-emerald-600 hover:bg-emerald-50 disabled:opacity-40">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={cancel} className="p-1 rounded text-muted-foreground hover:bg-muted">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            className="flex items-center gap-1.5 text-left w-full"
            onClick={() => !disabled && setEditing(true)}
            disabled={disabled}
          >
            <span className="text-xs font-medium text-foreground">
              {value || <span className="text-muted-foreground/50 italic">{placeholder || "—"}</span>}
            </span>
            {!disabled && (
              <Pencil className="h-2.5 w-2.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            )}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LeadDetailEnhanced({ lead: initialLead, onBack, onLeadUpdated }: LeadDetailEnhancedProps) {
  const [lead, setLead] = useState<LeadApiData>(initialLead)
  const [salesTeam, setSalesTeam] = useState<SalesTeamMember[]>([])
  const [comments, setComments] = useState<ApiComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentType, setCommentType] = useState("comment")
  const [commentText, setCommentText] = useState("")
  const [postingComment, setPostingComment] = useState(false)
  const [advancingStage, setAdvancingStage] = useState(false)
  const [tab, setTab] = useState("overview")

  // Sync if parent passes a new lead
  useEffect(() => { setLead(initialLead) }, [initialLead.id])

  const fetchComments = useCallback(async () => {
    setCommentsLoading(true)
    try {
      const res = await fetch(`/api/core/leads/${lead.id}/comments`, { headers: getAuthHeaders() })
      const json = await res.json()
      setComments(json.success && Array.isArray(json.data) ? json.data : [])
    } catch { setComments([]) }
    finally { setCommentsLoading(false) }
  }, [lead.id])

  useEffect(() => {
    fetch("/api/admin/sales-team?active=true", { headers: getAuthHeaders() })
      .then(r => r.json()).then(j => { if (j.success) setSalesTeam(j.data) }).catch(() => {})
    fetchComments()
  }, [lead.id])

  // ── Patch helper ─────────────────────────────────────────────────────────────
  const patch = useCallback(async (fields: Record<string, unknown>) => {
    const res = await fetch(`/api/core/leads/${lead.id}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(fields),
    })
    const json = await res.json()
    if (!json.success && !json.data) throw new Error(json.error || "Update failed")
    const updated = { ...lead, ...json.data }
    setLead(updated)
    onLeadUpdated?.(updated)
    return updated
  }, [lead, onLeadUpdated])

  const saveField = useCallback((field: string) => async (value: string) => {
    try {
      await patch({ [field]: field === "estimatedValue" ? Number(value) || null : value || null })
      toast.success("Saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed")
      throw e
    }
  }, [patch])

  // ── Stage advance ─────────────────────────────────────────────────────────────
  const advanceToStage = useCallback(async (stage: string) => {
    if (stage === lead.stage) return
    setAdvancingStage(true)
    try {
      const res = await fetch(`/api/core/leads/${lead.id}/advance-stage`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ stage }),
      })
      const json = await res.json()
      if (json.success) {
        const updated = { ...lead, stage }
        setLead(updated)
        onLeadUpdated?.(updated)
        toast.success(`Stage → ${STAGE_LABELS[stage] ?? stage}`)
      } else {
        await patch({ stage })
        toast.success(`Stage → ${STAGE_LABELS[stage] ?? stage}`)
      }
    } catch { toast.error("Stage update failed") }
    finally { setAdvancingStage(false) }
  }, [lead, patch, onLeadUpdated])

  // ── Comments ─────────────────────────────────────────────────────────────────
  const postComment = async () => {
    if (!commentText.trim()) return
    setPostingComment(true)
    try {
      const res = await fetch(`/api/core/leads/${lead.id}/comments`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ type: commentType, content: commentText.trim() }),
      })
      const json = await res.json()
      if (json.success) {
        setCommentText("")
        fetchComments()
        toast.success("Note added")
      } else toast.error(json.error || "Failed")
    } catch { toast.error("Failed to add note") }
    finally { setPostingComment(false) }
  }

  // ── Computed ──────────────────────────────────────────────────────────────────
  const pipelineIdx = PIPELINE_STAGES.indexOf(lead.stage as LeadStage)
  const isTerminal = TERMINAL_STAGES.includes(lead.stage as LeadStage)
  const stageColor = leadStageColors[lead.stage as LeadStage] || "bg-slate-100 text-slate-700"
  const typeConf = businessTypeConfig[lead.businessType as BusinessType]
  const sortedComments = [...comments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const daysSince = lead.lastContactedAt
    ? Math.floor((Date.now() - new Date(lead.lastContactedAt).getTime()) / 86400000) : null
  const isOverdue = daysSince !== null && daysSince > 3

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b px-5 py-3 space-y-2.5">
        {/* Row 1: business name + id + stage dropdown + meta */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold truncate max-w-[320px]">{lead.businessName}</h2>
              {lead.leadId && (
                <span className="text-[10px] font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">
                  {lead.leadId}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {/* Stage dropdown — replaces the static badge */}
              <Select value={lead.stage} onValueChange={advanceToStage} disabled={advancingStage}>
                <SelectTrigger className={`h-6 rounded-full px-2.5 text-[10px] font-semibold border-0 shadow-none focus:ring-0 w-auto gap-1 ${stageColor}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel className="text-[10px] px-2 py-1">Pipeline</SelectLabel>
                    {PIPELINE_STAGES.map(s => (
                      <SelectItem key={s} value={s} className="text-xs">{STAGE_LABELS[s]}</SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel className="text-[10px] px-2 py-1">Terminal</SelectLabel>
                    {TERMINAL_STAGES.map(s => (
                      <SelectItem key={s} value={s} className="text-xs">{STAGE_LABELS[s]}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <span className="text-[11px] text-muted-foreground">{typeConf?.label ?? lead.businessType}</span>
              {lead.salesRep && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground/40" />
                  {lead.salesRep.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: quick actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <a href={`tel:${lead.contactPhone}`} className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium border border-input bg-background hover:bg-muted transition-colors">
            <PhoneCall className="h-3 w-3" /> Call
          </a>
          <a
            href={`https://wa.me/${lead.contactPhone.replace(/\D/g, "")}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            <MessageCircle className="h-3 w-3" /> WhatsApp
          </a>
          <button
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium border border-input bg-background hover:bg-muted transition-colors"
            onClick={() => setTab("notes")}
          >
            <StickyNote className="h-3 w-3" /> Add Note
          </button>
        </div>

        {/* Overdue banner */}
        {isOverdue && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
            <p className="text-xs text-red-700 flex-1">
              <span className="font-semibold">Follow-up overdue</span> — last contact {daysSince}d ago
            </p>
          </div>
        )}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
        <div className="shrink-0 border-b px-4">
          <TabsList className="h-9 bg-transparent p-0 gap-4">
            {[
              { value: "overview", label: "Overview", icon: LayoutDashboard },
              { value: "notes",    label: `Notes${comments.length > 0 ? ` (${comments.length})` : ""}`, icon: MessageSquare },
              { value: "activity", label: "Activity", icon: Activity },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-9 px-0 text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                <Icon className="h-3 w-3 mr-1" />{label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ── Overview ──────────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="flex-1 overflow-y-auto mt-0">
          <div className="px-5 py-3">
            {/* Two-column grid — each side has enough room now that sheet is 760px */}
            <div className="grid grid-cols-2 gap-x-6">
              {/* Left: Contact */}
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Contact</p>
                <EditableField
                  label="Prospect Name"
                  value={lead.contactName}
                  onSave={saveField("contactName")}
                  icon={<User className="h-3.5 w-3.5" />}
                />
                <EditableField
                  label="Phone"
                  value={lead.contactPhone}
                  type="tel"
                  onSave={saveField("contactPhone")}
                  icon={<Phone className="h-3.5 w-3.5" />}
                />
                <EditableField
                  label="Email"
                  value={lead.contactEmail}
                  type="email"
                  onSave={saveField("contactEmail")}
                  icon={<Mail className="h-3.5 w-3.5" />}
                />
                <EditableField
                  label="Business Name"
                  value={lead.businessName}
                  onSave={saveField("businessName")}
                  icon={<Building2 className="h-3.5 w-3.5" />}
                />
                <EditableField
                  label="City"
                  value={lead.city ?? ""}
                  onSave={saveField("city")}
                  icon={<MapPin className="h-3.5 w-3.5" />}
                  placeholder="Add city"
                />
              </div>

              {/* Right: Deal */}
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Deal</p>
                <EditableField
                  label="Estimated Value (₹)"
                  value={lead.estimatedValue != null ? String(lead.estimatedValue) : ""}
                  type="number"
                  onSave={saveField("estimatedValue")}
                  icon={<IndianRupee className="h-3.5 w-3.5" />}
                  placeholder="Annual contract value"
                />

                {/* Sales Rep */}
                <div className="group flex items-start gap-2 py-2.5 border-b border-dashed border-border/50">
                  <UserCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/60" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">Sales Rep</p>
                    <Select
                      value={lead.salesRep?.id ?? "none"}
                      onValueChange={async (v) => {
                        try {
                          await patch({ salesRepId: v === "none" ? null : v })
                          toast.success("Rep updated")
                        } catch { toast.error("Failed") }
                      }}
                    >
                      <SelectTrigger className="h-6 text-xs border-0 p-0 shadow-none focus:ring-0 w-full text-left font-medium [&>svg]:ml-1">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs italic text-muted-foreground">Unassigned</SelectItem>
                        {salesTeam.filter(r => r.isActive !== false).map(r => (
                          <SelectItem key={r.id} value={r.id} className="text-xs">{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Business Type */}
                <div className="group flex items-start gap-2 py-2.5 border-b border-dashed border-border/50">
                  <Tag className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/60" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">Business Type</p>
                    <Select
                      value={lead.businessType}
                      onValueChange={async (v) => {
                        try { await patch({ businessType: v }); toast.success("Saved") }
                        catch { toast.error("Failed") }
                      }}
                    >
                      <SelectTrigger className="h-6 text-xs border-0 p-0 shadow-none focus:ring-0 w-full font-medium [&>svg]:ml-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(businessTypeConfig).map(([key, val]) => (
                          <SelectItem key={key} value={key} className="text-xs">{val.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <EditableField
                  label="Follow-up Date"
                  value={lead.followUpDate ? lead.followUpDate.split("T")[0] : ""}
                  type="date"
                  onSave={saveField("followUpDate")}
                  icon={<CalendarClock className="h-3.5 w-3.5" />}
                />
                {/* Notes — read-only; editing happens in the Notes tab */}
                <div className="flex items-start gap-2 py-2.5">
                  <StickyNote className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/60" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">Notes</p>
                    <button
                      onClick={() => setTab("notes")}
                      className="text-xs text-primary hover:underline text-left"
                    >
                      {comments.length > 0 || lead.notes
                        ? `${comments.length + (lead.notes ? 1 : 0)} note${(comments.length + (lead.notes ? 1 : 0)) !== 1 ? "s" : ""} — view in Notes tab →`
                        : "Add a note →"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats strip */}
            <div className="border-t mt-3 pt-3 grid grid-cols-3 gap-3">
              {[
                { label: "Created", value: new Date(lead.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) },
                { label: "Last Updated", value: new Date(lead.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) },
                { label: "Last Contact", value: lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Never" },
              ].map(s => (
                <div key={s.label} className="rounded-lg bg-muted/40 px-3 py-2 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                  <p className="text-xs font-semibold mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── Notes ─────────────────────────────────────────────────────────── */}
        <TabsContent value="notes" className="flex-1 flex flex-col min-h-0 mt-0">
          {/* Compose box */}
          <div className="shrink-0 border-b px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              {COMMENT_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setCommentType(t.value)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                    commentType === t.value
                      ? `${t.bg} ${t.color} border-current`
                      : "border-transparent text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <Textarea
              placeholder={
                commentType === "call_outcome" ? "What was the outcome of the call? Any next steps?"
                : commentType === "follow_up" ? "What should be followed up on and when?"
                : "Add a note about this lead…"
              }
              rows={3}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              className="text-xs resize-none"
              onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) postComment() }}
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Ctrl+Enter to post</span>
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5"
                disabled={!commentText.trim() || postingComment}
                onClick={postComment}
              >
                <Send className="h-3 w-3" />
                {postingComment ? "Posting…" : "Post Note"}
              </Button>
            </div>
          </div>

          {/* Notes feed — all entries read-only */}
          <ScrollArea className="flex-1">
            <div className="px-4 py-3 space-y-3">
              {commentsLoading ? (
                [1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
              ) : sortedComments.length === 0 && !lead.notes ? (
                <div className="py-10 text-center">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">No notes yet — add the first one above</p>
                </div>
              ) : (
                <>
                  {/* API comments — newest first, read-only */}
                  {sortedComments.map(c => {
                    const cfg = COMMENT_TYPES.find(t => t.value === c.type) ?? COMMENT_TYPES[0]
                    return (
                      <div key={c.id} className={`rounded-lg border border-l-4 ${cfg.border} ${cfg.bg} p-3`}>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <Avatar className="h-5 w-5 shrink-0">
                            <AvatarFallback className="text-[9px] font-bold">
                              {initials(c.user?.name ?? "?")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-semibold">{c.user?.name ?? "Unknown"}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
                            {fmtDatetime(c.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                      </div>
                    )
                  })}

                  {/* Legacy lead.notes — shown at bottom with updatedAt as timestamp */}
                  {lead.notes && (
                    <div className="rounded-lg border border-l-4 border-l-slate-300 bg-slate-50 dark:bg-slate-900/40 p-3">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <div className="h-5 w-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                          <StickyNote className="h-2.5 w-2.5 text-slate-500" />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">Lead Note</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          Note
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
                          {fmtDatetime(lead.updatedAt)}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{lead.notes}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ── Activity ───────────────────────────────────────────────────────── */}
        <TabsContent value="activity" className="flex-1 overflow-y-auto mt-0 px-4 py-3">
          <LeadActivityTimeline leadId={lead.id} maxHeight="100%" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
