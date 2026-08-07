// Client helpers for the CRM Communication Center (Phase 1).
// Device-native channel deep links (tel / wa.me / mailto) + template
// placeholder resolution + hooks for communication settings & templates.
import { useCallback, useEffect, useState } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useCrmActor } from "./crm-shared"

export interface CommSettings {
  enableCalls: boolean
  enableWhatsApp: boolean
  enableEmail: boolean
  enableRecordingUpload: boolean
}

export const DEFAULT_COMM_SETTINGS: CommSettings = {
  enableCalls: true, enableWhatsApp: true, enableEmail: true, enableRecordingUpload: true,
}

export interface CommTemplate {
  id: string
  channel: string // WHATSAPP | EMAIL
  name: string
  category: string | null
  subject: string | null
  body: string
  active: boolean
  createdByName: string | null
  createdAt: string
  updatedAt: string
}

export interface CallRecording {
  id: string
  fileName: string
  mimeType: string
  size: number
  durationSec: number | null
  remarks: string | null
  uploadedByName: string | null
  createdAt: string
  storageName: string
}

export interface PlaceholderCtx {
  customerName: string
  businessName: string
  employeeName: string
  leadId: string
  mobile: string
  email: string
  currentDate: string
}

export const COMM_PLACEHOLDERS = [
  "{{customerName}}", "{{businessName}}", "{{employeeName}}", "{{leadId}}",
  "{{mobile}}", "{{email}}", "{{currentDate}}",
]

export function buildPlaceholderCtx(lead: {
  displayName?: string; phone?: string | null; email?: string | null; leadCode?: string
}, businessName: string, actorName: string): PlaceholderCtx {
  const now = new Date()
  return {
    customerName: lead.displayName || "Customer",
    businessName: businessName || "Our Store",
    employeeName: actorName || "Team",
    leadId: lead.leadCode || "",
    mobile: lead.phone || "",
    email: lead.email || "",
    currentDate: now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
  }
}

export function applyPlaceholders(text: string, ctx: PlaceholderCtx): string {
  return text
    .replace(/\{\{customerName\}\}/g, ctx.customerName)
    .replace(/\{\{businessName\}\}/g, ctx.businessName)
    .replace(/\{\{employeeName\}\}/g, ctx.employeeName)
    .replace(/\{\{leadId\}\}/g, ctx.leadId)
    .replace(/\{\{mobile\}\}/g, ctx.mobile)
    .replace(/\{\{email\}\}/g, ctx.email)
    .replace(/\{\{currentDate\}\}/g, ctx.currentDate)
}

/** Normalize a lead phone into digits for tel:/wa.me links. */
export function digits(phone: string | null | undefined): string {
  return (phone || "").replace(/[^\d]/g, "")
}

export function telHref(mobile: string): string {
  const d = digits(mobile)
  return d ? `tel:${d}` : "#"
}

export function waHref(mobile: string, text: string): string {
  const d = digits(mobile)
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`
}

export function mailtoHref(email: string, subject: string, body: string): string {
  const params = new URLSearchParams()
  if (subject) params.set("subject", subject)
  if (body) params.set("body", body)
  return `mailto:${email}?${params.toString()}`
}

// Minimal "void anchor click without navigation" guard — open a deep link.
export function openDeepLink(href: string): void {
  window.open(href, "_blank", "noopener,noreferrer")
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useCommSettings(businessId: string) {
  const [settings, setSettings] = useState<CommSettings>(DEFAULT_COMM_SETTINGS)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!businessId) { setLoading(false); return }
    try {
      const j = await fetch(`/api/laundry/crm/communication/settings?businessId=${encodeURIComponent(businessId)}`).then((r) => r.json())
      if (j.success) setSettings(j.data)
    } catch { /* keep defaults */ } finally { setLoading(false) }
  }, [businessId])

  useEffect(() => { reload() }, [reload])
  return { settings, loading, reload }
}

export function useCommTemplates(businessId: string, channel: "WHATSAPP" | "EMAIL") {
  const [templates, setTemplates] = useState<CommTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!businessId) { setLoading(false); return }
    try {
      const j = await fetch(`/api/laundry/crm/communication/templates?businessId=${encodeURIComponent(businessId)}&channel=${channel}`).then((r) => r.json())
      setTemplates(j.success ? j.data : [])
    } catch { setTemplates([]) } finally { setLoading(false) }
  }, [businessId, channel])

  useEffect(() => { reload() }, [reload])
  return { templates, loading, reload }
}

export interface CommContext {
  businessId: string
  businessName: string
  actorName: string
ctx: PlaceholderCtx
}

export function useCommContext(lead: {
  displayName?: string; phone?: string | null; email?: string | null; leadCode?: string
}): CommContext {
  const { currentBusinessId } = useAuthStore()
  const { user } = useAuthStore()
  const currentBusinessName = useAuthStore((s) => s.currentBusinessName)
  const actor = useCrmActor()
  const businessId = currentBusinessId || ""
  const businessName = currentBusinessName || ""
  const actorName = actor.actorName || user?.name || ""
  const ctx = buildPlaceholderCtx(lead, businessName, actorName)
  return { businessId, businessName, actorName, ctx }
}