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
  { value: "comment",      label: "Note",        color: "text-slate-600",   bg: "bg-slate-50",   border: "border-slate-200" },
  { value: "call_outcome", label: "Call Outcome", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  { value: "follow_up",   label: "Follow-up",    color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200" },
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
    <div className="group">
      {/* Label row */}
      <div className="flex items-center gap-1 mb-1">
        {icon && <span className="text-gray-400">{icon}</span>}
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      </div>

      {/* Value row */}
      {editing ? (
        <div className="flex items-start gap-1.5">
          {type === "textarea" ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              className="w-full text-[13px] font-medium text-gray-900 border border-blue-400 rounded-lg px-3 py-2 resize-none bg-white ring-2 ring-blue-400/15 outline-none leading-snug"
              value={draft}
              rows={3}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Escape") cancel() }}
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={type}
              className="flex-1 text-[13px] font-medium text-gray-900 border border-blue-400 rounded-lg px-3 py-2 bg-white ring-2 ring-blue-400/15 outline-none"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel() }}
            />
          )}
          <div className="flex flex-col gap-1 shrink-0">
            <button
              onClick={commit}
              disabled={saving}
              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 border border-emerald-200 bg-white shadow-sm"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={cancel}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 border border-gray-200 bg-white shadow-sm"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          className="flex items-center gap-1.5 text-left w-full"
          onClick={() => !disabled && setEditing(true)}
          disabled={disabled}
        >
          <span className="text-[13px] font-semibold text-gray-900 leading-snug break-words">
            {value
              ? value
              : <span className="text-gray-300 font-normal italic">{placeholder || "—"}</span>
            }
          </span>
          {!disabled && (
            <Pencil className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
          )}
        </button>
      )}
    </div>
  )
}

// ─── Inline Select Field (shared layout for Sales Rep + Business Type) ────────

function SelectField({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="group">
      <div className="flex items-center gap-1 mb-1">
        {icon && <span className="text-gray-400">{icon}</span>}
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      </div>
      {children}
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

  // ── Patch helper ──────────────────────────────────────────────────────────────
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

  // ── Comments ──────────────────────────────────────────────────────────────────
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
  const totalNotes = comments.length + (lead.notes ? 1 : 0)

  // ── Select trigger classname (shared) ─────────────────────────────────────────
  const inlineSelectTrigger = "h-auto p-0 border-0 shadow-none focus:ring-0 w-full justify-start gap-1.5 text-[13px] font-semibold text-gray-900 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-gray-300 [&>svg]:opacity-0 group-hover:[&>svg]:opacity-100 [&>svg]:transition-opacity"

  return (
    <div className="flex flex-col h-screen bg-[#f4f5f7] overflow-hidden">

      {/* ═══════════════════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-6 pt-5 pb-4">

        {/* Business name + lead ID */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-[17px] font-bold text-gray-900 leading-tight truncate">
                {lead.businessName}
              </h2>
              {lead.leadId && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-[11px] font-mono font-medium text-gray-500 shrink-0">
                  {lead.leadId}
                </span>
              )}
            </div>

            {/* Stage + meta row */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Select value={lead.stage} onValueChange={advanceToStage} disabled={advancingStage}>
                <SelectTrigger className={`h-6 rounded-full px-3 text-[11px] font-bold border-0 shadow-none focus:ring-0 w-auto gap-1.5 ${stageColor}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel className="text-[10px] font-bold px-2 py-1 text-gray-400 uppercase tracking-widest">Pipeline</SelectLabel>
                    {PIPELINE_STAGES.map(s => (
                      <SelectItem key={s} value={s} className="text-xs">{STAGE_LABELS[s]}</SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel className="text-[10px] font-bold px-2 py-1 text-gray-400 uppercase tracking-widest">Terminal</SelectLabel>
                    {TERMINAL_STAGES.map(s => (
                      <SelectItem key={s} value={s} className="text-xs">{STAGE_LABELS[s]}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-[11px] font-medium text-gray-600">
                {typeConf?.label ?? lead.businessType}
              </span>

              <span className="text-[11px] text-gray-400">
                {SOURCE_LABELS[lead.source] ?? lead.source.replace(/_/g, " ")}
              </span>

              {lead.salesRep && (
                <div className="flex items-center gap-1.5 ml-1">
                  <div className="h-5 w-5 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-indigo-700">{initials(lead.salesRep.name)}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-gray-600">{lead.salesRep.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <a
            href={`tel:${lead.contactPhone}`}
            className="inline-flex items-center gap-2 h-8 px-4 rounded-lg text-[12px] font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-sm transition-all"
          >
            <PhoneCall className="h-3.5 w-3.5 text-gray-500" /> Call
          </a>
          <a
            href={`https://wa.me/${lead.contactPhone.replace(/\D/g, "")}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-8 px-4 rounded-lg text-[12px] font-semibold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 shadow-sm transition-all"
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
          <button
            onClick={() => setTab("notes")}
            className="inline-flex items-center gap-2 h-8 px-4 rounded-lg text-[12px] font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-sm transition-all"
          >
            <StickyNote className="h-3.5 w-3.5 text-gray-500" /> Add Note
          </button>
        </div>

        {/* Overdue banner */}
        {isOverdue && (
          <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-[12px] text-red-700">
              <span className="font-bold">Follow-up overdue</span> — last contact was {daysSince} days ago
            </p>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TABS
      ═══════════════════════════════════════════════════════════════════════ */}
      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
        <div className="shrink-0 bg-white border-b border-gray-200 px-6">
          <TabsList className="h-11 bg-transparent p-0 gap-6">
            {[
              { value: "overview", label: "Overview",                                                          icon: LayoutDashboard },
              { value: "notes",    label: `Notes${totalNotes > 0 ? ` (${totalNotes})` : ""}`,                 icon: MessageSquare   },
              { value: "activity", label: "Activity",                                                          icon: Activity        },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-11 px-0 text-[13px] font-medium text-gray-500 rounded-none border-b-2 border-transparent data-[state=active]:border-gray-900 data-[state=active]:text-gray-900 data-[state=active]:font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors"
              >
                <Icon className="h-3.5 w-3.5 mr-1.5" />{label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            OVERVIEW TAB
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="overview" className="flex-1 overflow-y-auto mt-0">
          <div className="p-5 space-y-4">

            {/* ── Contact Information Card ─────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">Contact Information</p>
              </div>
              <div className="p-5 grid grid-cols-2 gap-x-8 gap-y-5">
                <EditableField
                  label="Prospect Name"
                  value={lead.contactName}
                  onSave={saveField("contactName")}
                  icon={<User className="h-3 w-3" />}
                />
                <EditableField
                  label="Phone"
                  value={lead.contactPhone}
                  type="tel"
                  onSave={saveField("contactPhone")}
                  icon={<Phone className="h-3 w-3" />}
                />
                <EditableField
                  label="Email"
                  value={lead.contactEmail}
                  type="email"
                  onSave={saveField("contactEmail")}
                  icon={<Mail className="h-3 w-3" />}
                />
                <EditableField
                  label="City"
                  value={lead.city ?? ""}
                  onSave={saveField("city")}
                  icon={<MapPin className="h-3 w-3" />}
                  placeholder="Add city"
                />
                <div className="col-span-2 border-t border-gray-50 pt-4">
                  <EditableField
                    label="Business Name"
                    value={lead.businessName}
                    onSave={saveField("businessName")}
                    icon={<Building2 className="h-3 w-3" />}
                  />
                </div>
              </div>
            </div>

            {/* ── Deal Information Card ────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">Deal Information</p>
              </div>
              <div className="p-5 grid grid-cols-2 gap-x-8 gap-y-5">
                <EditableField
                  label="Estimated Value (₹)"
                  value={lead.estimatedValue != null ? String(lead.estimatedValue) : ""}
                  type="number"
                  onSave={saveField("estimatedValue")}
                  icon={<IndianRupee className="h-3 w-3" />}
                  placeholder="Annual contract value"
                />

                <SelectField label="Sales Rep" icon={<UserCheck className="h-3 w-3" />}>
                  <Select
                    value={lead.salesRep?.id ?? "none"}
                    onValueChange={async (v) => {
                      try {
                        await patch({ salesRepId: v === "none" ? null : v })
                        toast.success("Rep updated")
                      } catch { toast.error("Failed") }
                    }}
                  >
                    <SelectTrigger className={inlineSelectTrigger}>
                      <SelectValue placeholder={<span className="text-[13px] font-normal italic text-gray-300">Unassigned</span>} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs italic text-muted-foreground">Unassigned</SelectItem>
                      {salesTeam.filter(r => r.isActive !== false).map(r => (
                        <SelectItem key={r.id} value={r.id} className="text-xs">{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SelectField>

                <SelectField label="Business Type" icon={<Tag className="h-3 w-3" />}>
                  <Select
                    value={lead.businessType}
                    onValueChange={async (v) => {
                      try { await patch({ businessType: v }); toast.success("Saved") }
                      catch { toast.error("Failed") }
                    }}
                  >
                    <SelectTrigger className={inlineSelectTrigger}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(businessTypeConfig).map(([key, val]) => (
                        <SelectItem key={key} value={key} className="text-xs">{val.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SelectField>

                <EditableField
                  label="Follow-up Date"
                  value={lead.followUpDate ? lead.followUpDate.split("T")[0] : ""}
                  type="date"
                  onSave={saveField("followUpDate")}
                  icon={<CalendarClock className="h-3 w-3" />}
                />

                {/* Notes shortcut */}
                <div className="group">
                  <div className="flex items-center gap-1 mb-1">
                    <StickyNote className="h-3 w-3 text-gray-400" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Notes</p>
                  </div>
                  <button
                    onClick={() => setTab("notes")}
                    className="text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 hover:underline text-left transition-colors"
                  >
                    {totalNotes > 0
                      ? `${totalNotes} note${totalNotes !== 1 ? "s" : ""} — view →`
                      : "Add a note →"}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Metadata mini-cards ──────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: "Created",
                  value: new Date(lead.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
                  icon: <Clock className="h-4 w-4 text-gray-300" />,
                },
                {
                  label: "Last Updated",
                  value: new Date(lead.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
                  icon: <CheckCircle2 className="h-4 w-4 text-gray-300" />,
                },
                {
                  label: "Last Contact",
                  value: lead.lastContactedAt
                    ? new Date(lead.lastContactedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                    : "Never",
                  icon: <Activity className="h-4 w-4 text-gray-300" />,
                },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1.5">{s.icon}
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{s.label}</p>
                  </div>
                  <p className="text-[13px] font-bold text-gray-900">{s.value}</p>
                </div>
              ))}
            </div>

          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════
            NOTES TAB
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="notes" className="flex-1 flex flex-col min-h-0 mt-0">

          {/* Compose area */}
          <div className="shrink-0 bg-white border-b border-gray-200 px-5 py-4">
            {/* Type selector pills */}
            <div className="flex items-center gap-2 mb-3">
              {COMMENT_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setCommentType(t.value)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                    commentType === t.value
                      ? `${t.bg} ${t.color} ${t.border} shadow-sm`
                      : "border-gray-200 text-gray-500 bg-white hover:bg-gray-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <Textarea
              placeholder={
                commentType === "call_outcome" ? "What was the outcome of the call? Any next steps?"
                : commentType === "follow_up"   ? "What should be followed up on and when?"
                : "Add a note about this lead…"
              }
              rows={3}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              className="text-sm resize-none rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-300 transition-colors"
              onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) postComment() }}
            />

            <div className="flex items-center justify-between mt-3">
              <span className="text-[11px] text-gray-400">Ctrl+Enter to post</span>
              <Button
                size="sm"
                className="h-8 px-4 text-[12px] font-semibold gap-1.5 rounded-lg shadow-sm"
                disabled={!commentText.trim() || postingComment}
                onClick={postComment}
              >
                <Send className="h-3.5 w-3.5" />
                {postingComment ? "Posting…" : "Post Note"}
              </Button>
            </div>
          </div>

          {/* Notes feed */}
          <ScrollArea className="flex-1">
            <div className="px-5 py-4 space-y-3">
              {commentsLoading ? (
                [1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
              ) : sortedComments.length === 0 && !lead.notes ? (
                <div className="py-14 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="h-7 w-7 text-gray-300" />
                  </div>
                  <p className="text-sm font-semibold text-gray-600">No notes yet</p>
                  <p className="text-xs text-gray-400 mt-1">Add the first note using the form above</p>
                </div>
              ) : (
                <>
                  {/* API comments — newest first, read-only */}
                  {sortedComments.map(c => {
                    const cfg = COMMENT_TYPES.find(t => t.value === c.type) ?? COMMENT_TYPES[0]
                    return (
                      <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className={`px-4 py-2.5 border-b border-gray-100 flex items-center gap-2.5 flex-wrap ${cfg.bg}`}>
                          <Avatar className="h-6 w-6 shrink-0">
                            <AvatarFallback className="text-[9px] font-bold bg-gray-200 text-gray-600">
                              {initials(c.user?.name ?? "?")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-[12px] font-semibold text-gray-800">{c.user?.name ?? "Unknown"}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                            {cfg.label}
                          </span>
                          <span className="text-[11px] text-gray-400 ml-auto whitespace-nowrap font-medium">
                            {fmtDatetime(c.createdAt)}
                          </span>
                        </div>
                        <div className="px-4 py-3.5">
                          <p className="text-[13px] text-gray-800 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                        </div>
                      </div>
                    )
                  })}

                  {/* Legacy lead.notes — pinned at bottom with updatedAt timestamp */}
                  {lead.notes && (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2.5 flex-wrap bg-gray-50/80">
                        <div className="h-6 w-6 rounded-full bg-gray-200 border border-gray-300 flex items-center justify-center shrink-0">
                          <StickyNote className="h-3 w-3 text-gray-500" />
                        </div>
                        <span className="text-[12px] font-semibold text-gray-700">Lead Note</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                          Note
                        </span>
                        <span className="text-[11px] text-gray-400 ml-auto whitespace-nowrap font-medium">
                          {fmtDatetime(lead.updatedAt)}
                        </span>
                      </div>
                      <div className="px-4 py-3.5">
                        <p className="text-[13px] text-gray-800 leading-relaxed whitespace-pre-wrap">{lead.notes}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════
            ACTIVITY TAB
        ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="activity" className="flex-1 overflow-y-auto mt-0">
          <div className="p-5">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <LeadActivityTimeline leadId={lead.id} maxHeight="100%" />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
