"use client"

// ============================================================================
// PROPOSAL GENERATION DESIGN REFERENCE — Claude System Prompt
// ============================================================================
// This constant is passed as the system prompt when calling the AI generation
// endpoint (/api/admin/leads/proposal/generate).  It instructs Claude to use
// an uploaded quotation document only as a structural/spacing reference while
// applying Quantix branding and excluding all payment/bank sections.
// ============================================================================
export const PROPOSAL_DESIGN_PROMPT = `IMPORTANT DESIGN REFERENCE FOR PROPOSAL PDF

Use the uploaded quotation document ONLY as a:
* structural reference
* spacing reference
* proposal formatting reference

DO NOT copy it exactly.

IMPORTANT EXCLUSIONS
DO NOT include:
* bank details
* payment QR
* account numbers
* IFSC
* payment links
* company legal payment section

Also DO NOT use the company name/logo from the sample document.
Instead use: Quantix branding, Quantix logo, Quantix proposal structure.

TARGET DOCUMENT STYLE
The proposal preview should resemble:
* clean business quotation
* corporate proposal PDF
* implementation proposal
* SaaS onboarding proposal

VISUAL DIRECTION
Use:
* clean typography
* professional spacing
* section separators
* modern quotation layout
* proper hierarchy

The PDF should feel: premium, enterprise-grade, printable, client-ready.

PROPOSAL STRUCTURE:
HEADER: Quantix Logo | Proposal Title | Proposal ID | Date
CLIENT SECTION: Client Name | Business Name | Mobile | Email
COMMERCIALS SECTION (table): Service | Amount | Cycle | Notes
Services: Subscription, Implementation, iOS App, Add-ons
TOTAL SECTION: Subtotal | Discounts | Final proposal amount
NOTES SECTION (optional): Onboarding notes | Implementation timelines | Support notes
WORKFLOW / FEATURE SECTION: Standard/Pro badge | Enabled workflows | Store count | Included modules
SIGNATURE SECTION: Customer Signature | Authorized By | Date

IMPORTANT: NO PAYMENT COLLECTION SECTION. This is Proposal Stage, NOT payment invoice.

PDF STYLE: A4 proportion, white background, soft shadow, realistic margins, printable.
FINAL GOAL: Professional enterprise SaaS onboarding quotation — NOT a raw HTML invoice.`

// ============================================================================

import { useState, useCallback, useRef } from "react"
import { PageHeader } from "../shared/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, Download, Sparkles, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { authFetch } from "@/lib/admin-fetch"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

const WORKFLOW_OPTIONS = [
  { id: "ECOMMERCE",            label: "E-Commerce" },
  { id: "PICKUP_DELIVERY",      label: "Pickup & Delivery" },
  { id: "APPOINTMENT",          label: "Appointment" },
  { id: "SUBSCRIPTION",         label: "Subscription" },
  { id: "POST_SERVICE_BILLING", label: "Post-Service Billing" },
]

const MODULE_OPTIONS = [
  "Order Management",
  "Inventory Management",
  "POS (Point of Sale)",
  "Customer Mobile App",
  "Delivery Partner App",
  "WhatsApp Notifications",
  "Analytics & Reports",
  "Multi-store Support",
  "Custom Domain",
]

interface ProposalForm {
  clientName: string
  businessName: string
  mobile: string
  email: string
  subscriptionAmount: string
  subscriptionCycle: string
  subscriptionNotes: string
  implementationAmount: string
  implementationNotes: string
  iosAppAmount: string
  iosAppNotes: string
  addOnsAmount: string
  addOnsNotes: string
  discountAmount: string
  planTier: "STANDARD" | "PRO"
  storeCount: string
  enabledWorkflows: string[]
  includedModules: string[]
  onboardingNotes: string
  implementationTimeline: string
  supportNotes: string
  executiveSummary: string
}

const EMPTY_FORM: ProposalForm = {
  clientName: "", businessName: "", mobile: "", email: "",
  subscriptionAmount: "", subscriptionCycle: "Monthly", subscriptionNotes: "",
  implementationAmount: "", implementationNotes: "",
  iosAppAmount: "", iosAppNotes: "",
  addOnsAmount: "", addOnsNotes: "",
  discountAmount: "",
  planTier: "PRO", storeCount: "1",
  enabledWorkflows: ["ECOMMERCE"],
  includedModules: ["Order Management", "Customer Mobile App", "WhatsApp Notifications"],
  onboardingNotes: "", implementationTimeline: "", supportNotes: "",
  executiveSummary: "",
}

function generateProposalId(): string {
  const now = new Date()
  const yy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const rand = String(Math.floor(Math.random() * 900) + 100)
  return `QX-${yy}${mm}-${rand}`
}

function formatINR(val: string): string {
  const n = parseFloat(val)
  if (!n || isNaN(n)) return "—"
  return `₹${n.toLocaleString("en-IN")}`
}

// ─────────────────────────────────────────────────────────────────────────────
// A4 Preview component
// ─────────────────────────────────────────────────────────────────────────────

function ProposalDocument({
  form, proposalId, proposalDate,
}: {
  form: ProposalForm
  proposalId: string
  proposalDate: string
}) {
  const sub   = parseFloat(form.subscriptionAmount)     || 0
  const impl  = parseFloat(form.implementationAmount)   || 0
  const ios   = parseFloat(form.iosAppAmount)           || 0
  const addOn = parseFloat(form.addOnsAmount)           || 0
  const disc  = parseFloat(form.discountAmount)         || 0
  const subtotal = sub + impl + ios + addOn
  const total    = Math.max(0, subtotal - disc)

  const services = [
    { name: "Subscription",    amount: form.subscriptionAmount,   cycle: form.subscriptionCycle,   notes: form.subscriptionNotes },
    { name: "Implementation",  amount: form.implementationAmount, cycle: "One-time",               notes: form.implementationNotes },
    { name: "iOS App",         amount: form.iosAppAmount,         cycle: "One-time",               notes: form.iosAppNotes },
    { name: "Add-ons",         amount: form.addOnsAmount,         cycle: form.subscriptionCycle,   notes: form.addOnsNotes },
  ].filter(s => parseFloat(s.amount) > 0)

  const headerBg = "#0f1729"
  const accentBlue = "#2563EB"

  return (
    <div
      id="proposal-preview"
      style={{
        width: "794px",
        minHeight: "1123px",
        background: "#ffffff",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        fontSize: "13px",
        color: "#1a1a2e",
        padding: "48px 52px",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "10px",
            padding: "8px 16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}>
            <img src="/quantix-logo.png" alt="Quantix Technology" style={{ height: "32px", display: "block" }} />
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "22px", fontWeight: 800, color: headerBg, letterSpacing: "-0.5px", lineHeight: 1 }}>
            IMPLEMENTATION PROPOSAL
          </div>
          <div style={{ marginTop: "6px", color: "#6b7280", fontSize: "11.5px", lineHeight: 1.6 }}>
            <span style={{ fontWeight: 600, color: "#374151" }}>Proposal No:</span> {proposalId || "QX-000000-000"}<br />
            <span style={{ fontWeight: 600, color: "#374151" }}>Date:</span> {proposalDate}
          </div>
        </div>
      </div>

      {/* thin accent line */}
      <div style={{ height: "3px", background: `linear-gradient(90deg, ${accentBlue}, #06b6d4)`, borderRadius: "2px", marginBottom: "28px" }} />

      {/* ── CLIENT SECTION ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{
          fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em",
          textTransform: "uppercase", color: accentBlue, marginBottom: "10px",
        }}>
          PREPARED FOR
        </div>
        <div style={{
          border: "1px solid #e5e7eb", borderRadius: "10px",
          padding: "16px 20px", background: "#f9fafb",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px",
        }}>
          {[
            { label: "Client Name",    value: form.clientName    || "—" },
            { label: "Business Name",  value: form.businessName  || "—" },
            { label: "Mobile",         value: form.mobile        || "—" },
            { label: "Email",          value: form.email         || "—" },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: "10px", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
              <div style={{ fontWeight: 600, color: "#111827", marginTop: "2px" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── EXECUTIVE SUMMARY ──────────────────────────────────────────── */}
      {form.executiveSummary && (
        <div style={{ marginBottom: "28px" }}>
          <div style={{
            fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em",
            textTransform: "uppercase", color: accentBlue, marginBottom: "10px",
          }}>EXECUTIVE SUMMARY</div>
          <p style={{ color: "#374151", lineHeight: 1.7, margin: 0 }}>{form.executiveSummary}</p>
        </div>
      )}

      {/* ── COMMERCIALS TABLE ───────────────────────────────────────────── */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{
          fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em",
          textTransform: "uppercase", color: accentBlue, marginBottom: "10px",
        }}>COMMERCIALS</div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
          <thead>
            <tr style={{ background: headerBg }}>
              {["SERVICE", "AMOUNT", "BILLING CYCLE", "NOTES"].map((h, i) => (
                <th key={h} style={{
                  padding: "10px 14px", color: "#fff", fontWeight: 700,
                  fontSize: "10.5px", letterSpacing: "0.1em", textTransform: "uppercase",
                  textAlign: i === 0 ? "left" : i === 1 ? "right" : "center",
                  borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : undefined,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {services.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: "18px 14px", textAlign: "center", color: "#9ca3af", fontStyle: "italic" }}>
                  No services added yet
                </td>
              </tr>
            ) : services.map((svc, idx) => (
              <tr key={svc.name} style={{ background: idx % 2 === 0 ? "#ffffff" : "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "11px 14px", fontWeight: 600, color: "#111827" }}>{svc.name}</td>
                <td style={{ padding: "11px 14px", textAlign: "right", fontWeight: 700, color: "#111827", fontVariantNumeric: "tabular-nums" }}>
                  {formatINR(svc.amount)}
                </td>
                <td style={{ padding: "11px 14px", textAlign: "center", color: "#6b7280" }}>{svc.cycle}</td>
                <td style={{ padding: "11px 14px", color: "#6b7280", maxWidth: "180px" }}>{svc.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
          <div style={{ minWidth: "260px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #e5e7eb", color: "#6b7280" }}>
              <span>Subtotal</span>
              <span style={{ fontWeight: 600, color: "#374151" }}>{subtotal > 0 ? `₹${subtotal.toLocaleString("en-IN")}` : "—"}</span>
            </div>
            {disc > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #e5e7eb", color: "#dc2626" }}>
                <span>Discount</span>
                <span style={{ fontWeight: 600 }}>−₹{disc.toLocaleString("en-IN")}</span>
              </div>
            )}
            <div style={{
              display: "flex", justifyContent: "space-between", padding: "10px 14px",
              marginTop: "6px", background: headerBg, borderRadius: "8px",
            }}>
              <span style={{ fontWeight: 700, color: "#fff", fontSize: "14px" }}>TOTAL PROPOSAL VALUE</span>
              <span style={{ fontWeight: 800, color: "#4ade80", fontSize: "15px", fontVariantNumeric: "tabular-nums" }}>
                {total > 0 ? `₹${total.toLocaleString("en-IN")}` : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── PLAN & FEATURES ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{
          fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em",
          textTransform: "uppercase", color: accentBlue, marginBottom: "10px",
        }}>PLAN & FEATURES</div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: "10px", padding: "16px 20px", background: "#f9fafb" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "20px" }}>
            {/* Plan badge */}
            <div style={{
              padding: "8px 18px", borderRadius: "8px", fontWeight: 800, fontSize: "15px",
              background: form.planTier === "PRO" ? accentBlue : "#6b7280",
              color: "#fff", whiteSpace: "nowrap", letterSpacing: "0.06em", flexShrink: 0,
            }}>
              {form.planTier}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: "10px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Stores:&nbsp;
                </span>
                <span style={{ fontWeight: 600 }}>{form.storeCount || "1"}</span>
              </div>
              {form.enabledWorkflows.length > 0 && (
                <div style={{ marginBottom: "10px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
                    Workflows
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {form.enabledWorkflows.map(wf => {
                      const opt = WORKFLOW_OPTIONS.find(w => w.id === wf)
                      return (
                        <span key={wf} style={{
                          padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
                          background: "#dbeafe", color: "#1d4ed8", border: "1px solid #bfdbfe",
                        }}>{opt?.label ?? wf}</span>
                      )
                    })}
                  </div>
                </div>
              )}
              {form.includedModules.length > 0 && (
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
                    Included Modules
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {form.includedModules.map(mod => (
                      <span key={mod} style={{
                        padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
                        background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0",
                      }}>{mod}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── NOTES ───────────────────────────────────────────────────────── */}
      {(form.onboardingNotes || form.implementationTimeline || form.supportNotes) && (
        <div style={{ marginBottom: "28px" }}>
          <div style={{
            fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em",
            textTransform: "uppercase", color: accentBlue, marginBottom: "10px",
          }}>NOTES & TIMELINES</div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: "10px", padding: "16px 20px", background: "#f9fafb", display: "grid", gap: "14px" }}>
            {form.onboardingNotes && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
                  Onboarding
                </div>
                <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.65 }}>{form.onboardingNotes}</p>
              </div>
            )}
            {form.implementationTimeline && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
                  Implementation Timeline
                </div>
                <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.65 }}>{form.implementationTimeline}</p>
              </div>
            )}
            {form.supportNotes && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
                  Support
                </div>
                <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.65 }}>{form.supportNotes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SIGNATURE ───────────────────────────────────────────────────── */}
      <div style={{ marginTop: "40px", paddingTop: "24px", borderTop: "2px solid #e5e7eb" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "32px" }}>
              Customer Signature
            </div>
            <div style={{ borderBottom: "1.5px solid #374151", marginBottom: "8px" }} />
            <div style={{ fontSize: "11px", color: "#6b7280" }}>Name &amp; Date</div>
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "32px" }}>
              Authorized By
            </div>
            <div style={{ borderBottom: "1.5px solid #374151", marginBottom: "8px" }} />
            <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600 }}>Quantix Technology</div>
          </div>
        </div>
      </div>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <div style={{
        marginTop: "36px", paddingTop: "16px", borderTop: "1px solid #f3f4f6",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: "10px", color: "#9ca3af",
      }}>
        <span>Quantix Technology · quantix.in</span>
        <span>This document is a proposal and not a payment invoice.</span>
        <span>© {new Date().getFullYear()} Quantix Technology</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────────────────────

export function QuoteProposalView() {
  const [form, setForm] = useState<ProposalForm>({ ...EMPTY_FORM })
  const [proposalId] = useState(generateProposalId)
  const [generating, setGenerating] = useState(false)

  const proposalDate = new Date().toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  })

  const set = useCallback(<K extends keyof ProposalForm>(key: K, value: ProposalForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }, [])

  const toggleWorkflow = (id: string) => {
    setForm(prev => ({
      ...prev,
      enabledWorkflows: prev.enabledWorkflows.includes(id)
        ? prev.enabledWorkflows.filter(w => w !== id)
        : [...prev.enabledWorkflows, id],
    }))
  }

  const toggleModule = (mod: string) => {
    setForm(prev => ({
      ...prev,
      includedModules: prev.includedModules.includes(mod)
        ? prev.includedModules.filter(m => m !== mod)
        : [...prev.includedModules, mod],
    }))
  }

  const handleDownloadPDF = () => {
    const preview = document.getElementById("proposal-preview")
    if (!preview) return
    const style = `
      @page { size: A4; margin: 0; }
      body { margin: 0; padding: 0; background: #fff; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    `
    const win = window.open("", "_blank")
    if (!win) { toast.error("Allow popups to download PDF"); return }
    win.document.write(`<!DOCTYPE html><html><head><title>Proposal ${proposalId}</title><style>${style}</style></head><body>${preview.outerHTML}</body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  const handleGenerateAI = async () => {
    setGenerating(true)
    try {
      const res = await authFetch("/api/admin/leads/proposal/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: form }),
      })
      const json = await res.json()
      if (json.success && json.data) {
        const d = json.data
        setForm(prev => ({
          ...prev,
          executiveSummary:      d.executiveSummary      ?? prev.executiveSummary,
          subscriptionNotes:     d.serviceDescriptions?.subscription  ?? prev.subscriptionNotes,
          implementationNotes:   d.serviceDescriptions?.implementation ?? prev.implementationNotes,
          iosAppNotes:           d.serviceDescriptions?.ios            ?? prev.iosAppNotes,
          addOnsNotes:           d.serviceDescriptions?.addons         ?? prev.addOnsNotes,
          onboardingNotes:       d.notes?.onboarding    ?? prev.onboardingNotes,
          implementationTimeline:d.notes?.timeline      ?? prev.implementationTimeline,
          supportNotes:          d.notes?.support       ?? prev.supportNotes,
        }))
        toast.success("AI enhanced proposal content applied")
      } else {
        toast.error(json.error ?? "AI generation failed")
      }
    } catch {
      toast.error("Could not connect to AI generation service")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Quote & Proposals"
        description="Generate professional SaaS onboarding proposals for clients"
        icon={FileText}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={handleGenerateAI} disabled={generating}>
              {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Enhancing…" : "Enhance with AI"}
            </Button>
            <Button className="gap-2" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          </div>
        }
      />

      <div className="flex gap-6 flex-1 min-h-0 mt-5">
        {/* ── LEFT: FORM ─────────────────────────────────────────────────── */}
        <div className="w-[340px] shrink-0">
          <ScrollArea className="h-[calc(100vh-160px)]">
            <div className="space-y-6 pr-3 pb-8">

              {/* Proposal Meta */}
              <div className="rounded-xl border bg-card p-4 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Proposal ID</p>
                <p className="text-sm font-mono font-semibold">{proposalId}</p>
                <p className="text-[11px] text-muted-foreground">{proposalDate}</p>
              </div>

              {/* Client Information */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-3">Client Information</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Client Name</Label>
                    <Input placeholder="e.g. Amit Patel" className="h-8 text-xs" value={form.clientName} onChange={e => set("clientName", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Business Name</Label>
                    <Input placeholder="e.g. FreshMart Grocers" className="h-8 text-xs" value={form.businessName} onChange={e => set("businessName", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Mobile</Label>
                      <Input placeholder="+91 98765 43210" className="h-8 text-xs" value={form.mobile} onChange={e => set("mobile", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Email</Label>
                      <Input placeholder="client@email.com" className="h-8 text-xs" value={form.email} onChange={e => set("email", e.target.value)} />
                    </div>
                  </div>
                </div>
              </section>

              <Separator />

              {/* Services */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-3">Services & Pricing</p>
                <div className="space-y-4">
                  {/* Subscription */}
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs font-semibold">Subscription</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Amount (₹)</Label>
                        <Input placeholder="e.g. 4999" className="h-7 text-xs" value={form.subscriptionAmount} onChange={e => set("subscriptionAmount", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Cycle</Label>
                        <Select value={form.subscriptionCycle} onValueChange={v => set("subscriptionCycle", v)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Monthly", "Yearly", "One-time"].map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Input placeholder="Notes" className="h-7 text-xs" value={form.subscriptionNotes} onChange={e => set("subscriptionNotes", e.target.value)} />
                  </div>

                  {/* Implementation */}
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs font-semibold">Implementation</p>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Amount (₹)</Label>
                      <Input placeholder="e.g. 15000" className="h-7 text-xs" value={form.implementationAmount} onChange={e => set("implementationAmount", e.target.value)} />
                    </div>
                    <Input placeholder="Notes" className="h-7 text-xs" value={form.implementationNotes} onChange={e => set("implementationNotes", e.target.value)} />
                  </div>

                  {/* iOS App */}
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs font-semibold">iOS App</p>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Amount (₹)</Label>
                      <Input placeholder="e.g. 8000" className="h-7 text-xs" value={form.iosAppAmount} onChange={e => set("iosAppAmount", e.target.value)} />
                    </div>
                    <Input placeholder="Notes" className="h-7 text-xs" value={form.iosAppNotes} onChange={e => set("iosAppNotes", e.target.value)} />
                  </div>

                  {/* Add-ons */}
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs font-semibold">Add-ons</p>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Amount (₹)</Label>
                      <Input placeholder="e.g. 2000" className="h-7 text-xs" value={form.addOnsAmount} onChange={e => set("addOnsAmount", e.target.value)} />
                    </div>
                    <Input placeholder="Notes" className="h-7 text-xs" value={form.addOnsNotes} onChange={e => set("addOnsNotes", e.target.value)} />
                  </div>

                  {/* Discount */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Discount Amount (₹)</Label>
                    <Input placeholder="e.g. 2000" className="h-8 text-xs" value={form.discountAmount} onChange={e => set("discountAmount", e.target.value)} />
                  </div>
                </div>
              </section>

              <Separator />

              {/* Plan & Features */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-3">Plan & Features</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Plan Tier</Label>
                      <Select value={form.planTier} onValueChange={v => set("planTier", v as "STANDARD" | "PRO")}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="STANDARD" className="text-xs">Standard</SelectItem>
                          <SelectItem value="PRO" className="text-xs">Pro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Store Count</Label>
                      <Input placeholder="1" className="h-8 text-xs" value={form.storeCount} onChange={e => set("storeCount", e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Enabled Workflows</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {WORKFLOW_OPTIONS.map(wf => (
                        <button
                          key={wf.id}
                          onClick={() => toggleWorkflow(wf.id)}
                          className={`text-[10px] px-2.5 py-1 rounded-full border font-medium transition-colors ${
                            form.enabledWorkflows.includes(wf.id)
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {wf.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Included Modules</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {MODULE_OPTIONS.map(mod => (
                        <button
                          key={mod}
                          onClick={() => toggleModule(mod)}
                          className={`text-[10px] px-2.5 py-1 rounded-full border font-medium transition-colors ${
                            form.includedModules.includes(mod)
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {mod}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <Separator />

              {/* Notes */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Notes & Timelines</p>
                  <Badge variant="secondary" className="text-[9px]">Optional</Badge>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Onboarding Notes</Label>
                    <Textarea placeholder="Describe the onboarding process…" rows={2} className="text-xs resize-none" value={form.onboardingNotes} onChange={e => set("onboardingNotes", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Implementation Timeline</Label>
                    <Textarea placeholder="e.g. Go-live within 7–10 business days…" rows={2} className="text-xs resize-none" value={form.implementationTimeline} onChange={e => set("implementationTimeline", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Support Notes</Label>
                    <Textarea placeholder="Support hours, escalation process…" rows={2} className="text-xs resize-none" value={form.supportNotes} onChange={e => set("supportNotes", e.target.value)} />
                  </div>
                </div>
              </section>

            </div>
          </ScrollArea>
        </div>

        {/* ── RIGHT: A4 PREVIEW ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto bg-muted/30 rounded-xl border p-6">
          <div
            className="mx-auto"
            style={{
              width: "794px",
              boxShadow: "0 8px 40px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.07)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <ProposalDocument form={form} proposalId={proposalId} proposalDate={proposalDate} />
          </div>
        </div>
      </div>
    </div>
  )
}
