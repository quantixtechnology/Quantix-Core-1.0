"use client"

// ============================================================================
// PROPOSAL GENERATION DESIGN REFERENCE — Claude System Prompt
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
SUBSCRIPTION INCLUDES: Premium checklist of included deliverables
PAGE 2: Terms & Conditions | Payment Terms | Customer Confirmation | QR

IMPORTANT: NO PAYMENT COLLECTION SECTION. This is Proposal Stage, NOT payment invoice.

PDF STYLE: A4 proportion, white background, soft shadow, realistic margins, printable.
FINAL GOAL: Professional enterprise SaaS onboarding quotation — NOT a raw HTML invoice.`

// ============================================================================

import { useState, useCallback, useEffect } from "react"
import { PageHeader } from "../shared/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, Download, Sparkles, RefreshCw, Save } from "lucide-react"
import { toast } from "sonner"
import { authFetch } from "@/lib/admin-fetch"
import { useAuthStore } from "@/stores/auth-store"

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

const BILLING_CYCLES = ["Monthly", "Quarterly", "Half Yearly", "Yearly"]

const SUBSCRIPTION_INCLUDES = [
  "Customer Android App",
  "Delivery Mobile App",
  "Android Admin App",
  "Ecommerce Website",
  "Admin Panel",
  "POS (Point Of Sale)",
  "Server & Hosting",
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
  iosAppCycle: string
  iosAppNotes: string
  addOnsAmount: string
  addOnsCycle: string
  addOnsDescription: string
  addOnsNotes: string
  discountAmount: string
  planTier: "STANDARD" | "PRO"
  storeCount: string
  enabledWorkflows: string[]
  salesTeamMember: string
  salesTeamEmail: string
  executiveSummary: string
}

const EMPTY_FORM: ProposalForm = {
  clientName: "", businessName: "", mobile: "", email: "",
  subscriptionAmount: "", subscriptionCycle: "Monthly", subscriptionNotes: "",
  implementationAmount: "", implementationNotes: "",
  iosAppAmount: "", iosAppCycle: "One-time", iosAppNotes: "",
  addOnsAmount: "", addOnsCycle: "Monthly", addOnsDescription: "", addOnsNotes: "",
  discountAmount: "",
  planTier: "PRO", storeCount: "1",
  enabledWorkflows: ["ECOMMERCE"],
  salesTeamMember: "", salesTeamEmail: "",
  executiveSummary: "",
}

function formatINR(val: string): string {
  const n = parseFloat(val)
  if (!n || isNaN(n)) return "—"
  return `₹${n.toLocaleString("en-IN")}`
}

function formatDateDDMMMYYYY(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    .replace(/ /g, "-")
}

// ─────────────────────────────────────────────────────────────────────────────
// A4 Proposal Document (2 pages)
// ─────────────────────────────────────────────────────────────────────────────

function ProposalDocument({
  form, proposalId, proposalDate, qrUrl,
}: {
  form: ProposalForm
  proposalId: string
  proposalDate: string
  qrUrl: string | null
}) {
  const sub    = parseFloat(form.subscriptionAmount)   || 0
  const impl   = parseFloat(form.implementationAmount) || 0
  const ios    = parseFloat(form.iosAppAmount)         || 0
  const addOn  = parseFloat(form.addOnsAmount)         || 0
  const disc   = parseFloat(form.discountAmount)       || 0
  const subtotal = sub + impl + ios + addOn
  const total    = Math.max(0, subtotal - disc)

  const services = [
    { name: "Subscription",   amount: form.subscriptionAmount,   cycle: form.subscriptionCycle,   notes: form.subscriptionNotes },
    { name: "Implementation", amount: form.implementationAmount, cycle: "One-time",               notes: form.implementationNotes },
    { name: "iOS App",        amount: form.iosAppAmount,         cycle: form.iosAppCycle,         notes: form.iosAppNotes },
    { name: "Add-ons",        amount: form.addOnsAmount,         cycle: form.addOnsCycle,         notes: form.addOnsDescription || form.addOnsNotes },
  ].filter(s => parseFloat(s.amount) > 0)

  const headerBg  = "#0f1729"
  const accentBlue = "#2563EB"
  const confirmDate = formatDateDDMMMYYYY(new Date())

  const sectionLabel = (text: string) => (
    <div style={{
      fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em",
      textTransform: "uppercase" as const, color: accentBlue, marginBottom: "10px",
    }}>{text}</div>
  )

  return (
    <div id="proposal-preview" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", color: "#1a1a2e" }}>

      {/* ═══════════════════════════ PAGE 1 ═══════════════════════════════ */}
      <div style={{
        width: "794px", minHeight: "1123px", background: "#ffffff",
        fontSize: "13px", padding: "48px 52px", boxSizing: "border-box" as const, position: "relative" as const,
      }}>

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px" }}>
          <div style={{
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: "10px", padding: "8px 16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}>
            <img src="/quantix-logo.png" alt="Quantix Technology" style={{ height: "32px", display: "block" }} />
          </div>
          <div style={{ textAlign: "right" as const }}>
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

        {/* ── CLIENT SECTION ──────────────────────────────────────────── */}
        <div style={{ marginBottom: "28px" }}>
          {sectionLabel("PREPARED FOR")}
          <div style={{
            border: "1px solid #e5e7eb", borderRadius: "10px",
            padding: "16px 20px", background: "#f9fafb",
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px",
          }}>
            {[
              { label: "Client Name",   value: form.clientName    || "—" },
              { label: "Business Name", value: form.businessName  || "—" },
              { label: "Mobile",        value: form.mobile        || "—" },
              { label: "Email",         value: form.email         || "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: "10px", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>{label}</div>
                <div style={{ fontWeight: 600, color: "#111827", marginTop: "2px" }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── EXECUTIVE SUMMARY ───────────────────────────────────────── */}
        {form.executiveSummary && (
          <div style={{ marginBottom: "28px" }}>
            {sectionLabel("EXECUTIVE SUMMARY")}
            <p style={{ color: "#374151", lineHeight: 1.7, margin: 0 }}>{form.executiveSummary}</p>
          </div>
        )}

        {/* ── COMMERCIALS TABLE ────────────────────────────────────────── */}
        <div style={{ marginBottom: "28px" }}>
          {sectionLabel("COMMERCIALS")}
          <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: "12.5px" }}>
            <thead>
              <tr style={{ background: headerBg }}>
                {["SERVICE", "AMOUNT", "BILLING CYCLE", "NOTES"].map((h, i) => (
                  <th key={h} style={{
                    padding: "10px 14px", color: "#fff", fontWeight: 700,
                    fontSize: "10.5px", letterSpacing: "0.1em", textTransform: "uppercase" as const,
                    textAlign: (i === 0 ? "left" : i === 1 ? "right" : "center") as "left" | "right" | "center",
                    borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : undefined,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: "18px 14px", textAlign: "center" as const, color: "#9ca3af", fontStyle: "italic" }}>
                    No services added yet
                  </td>
                </tr>
              ) : services.map((svc, idx) => (
                <tr key={svc.name} style={{ background: idx % 2 === 0 ? "#ffffff" : "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "11px 14px", fontWeight: 600, color: "#111827" }}>{svc.name}</td>
                  <td style={{ padding: "11px 14px", textAlign: "right" as const, fontWeight: 700, color: "#111827" }}>
                    {formatINR(svc.amount)}
                  </td>
                  <td style={{ padding: "11px 14px", textAlign: "center" as const, color: "#6b7280" }}>{svc.cycle}</td>
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
                <span style={{ fontWeight: 800, color: "#4ade80", fontSize: "15px" }}>
                  {total > 0 ? `₹${total.toLocaleString("en-IN")}` : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── PLAN OVERVIEW ────────────────────────────────────────────── */}
        <div style={{ marginBottom: "28px" }}>
          {sectionLabel("PLAN OVERVIEW")}
          <div style={{
            border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px 20px",
            background: "#f9fafb", display: "flex", alignItems: "center", gap: "20px",
          }}>
            <div style={{
              padding: "6px 18px", borderRadius: "8px", fontWeight: 800, fontSize: "14px",
              background: form.planTier === "PRO" ? accentBlue : "#6b7280",
              color: "#fff", whiteSpace: "nowrap" as const, letterSpacing: "0.06em", flexShrink: 0,
            }}>
              {form.planTier}
            </div>
            <div style={{ display: "flex", gap: "28px" }}>
              <div>
                <div style={{ fontSize: "10px", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Stores</div>
                <div style={{ fontWeight: 700, color: "#111827", marginTop: "2px" }}>{form.storeCount || "1"}</div>
              </div>
              {form.enabledWorkflows.length > 0 && (
                <div>
                  <div style={{ fontSize: "10px", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: "4px" }}>Workflows</div>
                  <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "5px" }}>
                    {form.enabledWorkflows.map(wf => {
                      const opt = WORKFLOW_OPTIONS.find(w => w.id === wf)
                      return (
                        <span key={wf} style={{
                          padding: "2px 8px", borderRadius: "20px", fontSize: "10px", fontWeight: 600,
                          background: "#dbeafe", color: "#1d4ed8", border: "1px solid #bfdbfe",
                        }}>{opt?.label ?? wf}</span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── SUBSCRIPTION INCLUDES ────────────────────────────────────── */}
        <div style={{ marginBottom: "36px" }}>
          {sectionLabel("SUBSCRIPTION INCLUDES")}
          <div style={{
            border: "1px solid #e5e7eb", borderRadius: "10px",
            padding: "20px 24px", background: "#f0fdf4",
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 32px",
          }}>
            {SUBSCRIPTION_INCLUDES.map(item => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "20px", height: "20px", borderRadius: "50%",
                  background: "#16a34a", display: "flex", alignItems: "center",
                  justifyContent: "center", flexShrink: 0,
                }}>
                  <span style={{ color: "#fff", fontSize: "12px", fontWeight: 800 }}>✓</span>
                </div>
                <span style={{ fontWeight: 600, color: "#166534", fontSize: "12.5px" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* PAGE 1 FOOTER */}
        <div style={{
          marginTop: "auto", paddingTop: "16px", borderTop: "1px solid #f3f4f6",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: "10px", color: "#9ca3af",
        }}>
          <span>Quantix Technology · www.quantixtechnology.in</span>
          <span style={{ fontWeight: 600, color: "#6b7280" }}>Page 1 of 2</span>
          <span>© {new Date().getFullYear()} Quantix Technology</span>
        </div>
      </div>

      {/* ═══════════════════════════ PAGE 2 ═══════════════════════════════ */}
      <div style={{
        width: "794px", minHeight: "1123px", background: "#ffffff",
        fontSize: "13px", padding: "48px 52px", boxSizing: "border-box" as const,
        position: "relative" as const,
        borderTop: "3px solid #e5e7eb",
        pageBreakBefore: "always" as const,
      }}>

        {/* PAGE 2 HEADER strip */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
          <div style={{
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: "10px", padding: "6px 12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}>
            <img src="/quantix-logo.png" alt="Quantix Technology" style={{ height: "24px", display: "block" }} />
          </div>
          <div style={{ fontSize: "11px", color: "#6b7280" }}>
            <span style={{ fontWeight: 600, color: "#374151" }}>Proposal No:</span> {proposalId || "QX-000000-000"}
            &nbsp;&nbsp;·&nbsp;&nbsp;
            <span style={{ fontWeight: 600, color: "#374151" }}>Page 2 of 2</span>
          </div>
        </div>

        <div style={{ height: "3px", background: `linear-gradient(90deg, ${accentBlue}, #06b6d4)`, borderRadius: "2px", marginBottom: "32px" }} />

        {/* ── TERMS & CONDITIONS ───────────────────────────────────────── */}
        <div style={{ marginBottom: "28px" }}>
          {sectionLabel("TERMS & CONDITIONS")}
          <div style={{ border: "1px solid #e5e7eb", borderRadius: "10px", padding: "20px 24px", background: "#f9fafb" }}>
            {[
              "Quantix Technology will initiate development based on selected services and business details.",
              "Mobile application and website will be developed and prepared by Quantix Technology.",
              "The next subscription date becomes the final delivery date.",
              "Customer must provide (.com / .in) domain.",
            ].map((term, i) => (
              <div key={i} style={{ display: "flex", gap: "10px", marginBottom: i < 3 ? "10px" : 0 }}>
                <span style={{ color: accentBlue, fontWeight: 700, flexShrink: 0, marginTop: "1px" }}>•</span>
                <span style={{ color: "#374151", lineHeight: 1.6 }}>{term}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── PAYMENT TERMS ────────────────────────────────────────────── */}
        <div style={{ marginBottom: "28px" }}>
          {sectionLabel("PAYMENT TERMS")}
          <div style={{ border: "1px solid #fde68a", borderRadius: "10px", padding: "20px 24px", background: "#fffbeb" }}>
            {[
              "Implementation fee is non-refundable.",
              "First subscription amount must be paid in advance with implementation fee.",
              "Quantix Technology reserves rights to pause services if subscriptions are unpaid.",
            ].map((term, i) => (
              <div key={i} style={{ display: "flex", gap: "10px", marginBottom: i < 2 ? "10px" : 0 }}>
                <span style={{ color: "#d97706", fontWeight: 700, flexShrink: 0, marginTop: "1px" }}>•</span>
                <span style={{ color: "#92400e", lineHeight: 1.6, fontWeight: 500 }}>{term}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── CUSTOMER CONFIRMATION ────────────────────────────────────── */}
        <div style={{ marginBottom: "28px" }}>
          {sectionLabel("CUSTOMER CONFIRMATION")}
          <div style={{ border: "1px solid #e5e7eb", borderRadius: "10px", padding: "20px 24px", background: "#f9fafb" }}>
            <p style={{ margin: "0 0 12px 0", color: "#374151", fontWeight: 600 }}>Customer confirms:</p>
            {[
              "Acceptance of selected services and pricing",
              "Authorization to Quantix Technology to proceed",
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: "10px", marginBottom: i < 1 ? "8px" : 0 }}>
                <span style={{ color: "#16a34a", fontWeight: 800, flexShrink: 0 }}>✓</span>
                <span style={{ color: "#374151", lineHeight: 1.6 }}>{item}</span>
              </div>
            ))}

            {/* Confirmation details */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              gap: "20px", marginTop: "20px", paddingTop: "16px",
              borderTop: "1px solid #e5e7eb",
            }}>
              <div>
                <div style={{ fontSize: "10px", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Date</div>
                <div style={{ fontWeight: 700, color: "#111827", marginTop: "4px", fontSize: "13px" }}>{confirmDate}</div>
              </div>
              <div>
                <div style={{ fontSize: "10px", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Authorized By</div>
                <div style={{ fontWeight: 700, color: "#111827", marginTop: "4px", fontSize: "13px" }}>{form.clientName || "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: "10px", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Mode of Confirmation</div>
                <div style={{ fontWeight: 700, color: "#111827", marginTop: "4px", fontSize: "13px" }}>Digital (Email Acknowledgement)</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── SALES TEAM ───────────────────────────────────────────────── */}
        {(form.salesTeamMember || form.salesTeamEmail) && (
          <div style={{ marginBottom: "28px" }}>
            {sectionLabel("YOUR SALES CONTACT")}
            <div style={{
              border: "1px solid #e5e7eb", borderRadius: "10px",
              padding: "14px 20px", background: "#f9fafb",
              display: "flex", gap: "40px",
            }}>
              {form.salesTeamMember && (
                <div>
                  <div style={{ fontSize: "10px", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Sales Team Member</div>
                  <div style={{ fontWeight: 700, color: "#111827", marginTop: "2px" }}>{form.salesTeamMember}</div>
                </div>
              )}
              {form.salesTeamEmail && (
                <div>
                  <div style={{ fontSize: "10px", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Sales Team Email</div>
                  <div style={{ fontWeight: 700, color: "#111827", marginTop: "2px" }}>{form.salesTeamEmail}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── BOTTOM: QR + FOOTER ──────────────────────────────────────── */}
        <div style={{
          position: "absolute" as const, bottom: "48px", left: "52px", right: "52px",
        }}>
          {/* system note */}
          <div style={{
            textAlign: "center" as const, fontSize: "10px", color: "#9ca3af",
            fontStyle: "italic", marginBottom: "20px",
          }}>
            This is a system-generated document and does not require physical signature.
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            {/* website + footer left */}
            <div>
              <div style={{ fontWeight: 700, color: accentBlue, fontSize: "13px", marginBottom: "4px" }}>www.quantixtechnology.in</div>
              <div style={{ fontSize: "10px", color: "#9ca3af" }}>Quantix Technology · Enterprise SaaS Platform</div>
              <div style={{ fontSize: "10px", color: "#9ca3af" }}>© {new Date().getFullYear()} Quantix Technology. All rights reserved.</div>
            </div>

            {/* Proprietor QR — only rendered when configured in Platform Settings */}
            {qrUrl && (
              <div style={{ textAlign: "center" as const }}>
                <div style={{ fontSize: "9px", color: "#9ca3af", marginBottom: "6px", textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>Scan to Pay</div>
                <img
                  src={qrUrl}
                  alt="Payment QR"
                  style={{
                    width: "90px", height: "90px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px", display: "block",
                  }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main View
// ─────────────────────────────────────────────────────────────────────────────

export function QuoteProposalView() {
  const { user, permissions } = useAuthStore()
  const [form, setForm] = useState<ProposalForm>({ ...EMPTY_FORM })
  const [proposalId, setProposalId] = useState<string>("")
  const [idLoading, setIdLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [qrUrl, setQrUrl] = useState<string | null>(null)

  const proposalDate = new Date().toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  })

  // Auto-fill sales team from logged-in user
  useEffect(() => {
    if (user) {
      setForm(prev => ({
        ...prev,
        salesTeamMember: prev.salesTeamMember || user.name || "",
        salesTeamEmail:  prev.salesTeamEmail  || user.email || "",
      }))
    }
  }, [user])

  // Fetch immutable proposal ID + QR config on mount (parallel)
  useEffect(() => {
    const fetchId = authFetch("/api/admin/documents/proposal-id", { method: "POST" })
      .then(r => r.json())
      .then(json => { if (json.success) setProposalId(json.proposalId) })
      .catch(() => toast.error("Could not generate proposal ID"))
      .finally(() => setIdLoading(false))

    // QR URL from PlatformConfig key "branding.proprietor_qr_url" — optional, no error if missing
    const fetchQr = authFetch("/api/core/platform/config")
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          const url = json.data?.map?.["branding.proprietor_qr_url"] as string | undefined
          setQrUrl(url ?? null)
        }
      })
      .catch(() => { /* QR is optional — fail silently */ })

    return () => { void fetchId; void fetchQr }
  }, [])

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

  const sub   = parseFloat(form.subscriptionAmount)   || 0
  const impl  = parseFloat(form.implementationAmount) || 0
  const ios   = parseFloat(form.iosAppAmount)         || 0
  const addOn = parseFloat(form.addOnsAmount)         || 0
  const disc  = parseFloat(form.discountAmount)       || 0
  const total = Math.max(0, sub + impl + ios + addOn - disc)

  const handleSaveToDocCenter = async () => {
    if (!proposalId) { toast.error("Proposal ID not ready"); return }
    setSaving(true)
    try {
      await authFetch("/api/admin/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId,
          documentType: "PROPOSAL",
          businessName:    form.businessName || "Unknown",
          clientName:      form.clientName,
          contactPhone:    form.mobile,
          contactEmail:    form.email,
          salesTeamMember: form.salesTeamMember,
          salesTeamEmail:  form.salesTeamEmail,
          totalAmount:     total,
          formSnapshot:    form,
          createdBy:       user?.id ?? "unknown",
          createdByName:   user?.name ?? "",
        }),
      })
      toast.success("Saved to Document Center")
    } catch {
      toast.error("Failed to save document")
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadPDF = async () => {
    const preview = document.getElementById("proposal-preview")
    if (!preview) return

    // Auto-save to Document Center on download
    await handleSaveToDocCenter()

    const style = `
      @page { size: A4; margin: 0; }
      body { margin: 0; padding: 0; background: #fff; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      #proposal-preview > div + div { page-break-before: always; }
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
          executiveSummary:    d.executiveSummary                         ?? prev.executiveSummary,
          subscriptionNotes:   d.serviceDescriptions?.subscription         ?? prev.subscriptionNotes,
          implementationNotes: d.serviceDescriptions?.implementation       ?? prev.implementationNotes,
          iosAppNotes:         d.serviceDescriptions?.ios                  ?? prev.iosAppNotes,
          addOnsDescription:   d.serviceDescriptions?.addons               ?? prev.addOnsDescription,
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

  const canSave = (permissions as string[]).includes("documents:view")

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
            {canSave && (
              <Button variant="outline" className="gap-2" onClick={handleSaveToDocCenter} disabled={saving || !proposalId}>
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving…" : "Save to Docs"}
              </Button>
            )}
            <Button className="gap-2" onClick={handleDownloadPDF} disabled={idLoading}>
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          </div>
        }
      />

      <div className="flex gap-6 flex-1 min-h-0 mt-5">
        {/* ── LEFT: FORM ─────────────────────────────────────────────── */}
        <div className="w-[340px] shrink-0">
          <ScrollArea className="h-[calc(100vh-160px)]">
            <div className="space-y-6 pr-3 pb-8">

              {/* Proposal Meta */}
              <div className="rounded-xl border bg-card p-4 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Proposal ID</p>
                {idLoading ? (
                  <div className="h-5 w-36 bg-muted animate-pulse rounded" />
                ) : (
                  <p className="text-sm font-mono font-semibold">{proposalId}</p>
                )}
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

              {/* Services & Pricing */}
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
                            {BILLING_CYCLES.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
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
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Amount (₹)</Label>
                        <Input placeholder="e.g. 8000" className="h-7 text-xs" value={form.iosAppAmount} onChange={e => set("iosAppAmount", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Cycle</Label>
                        <Select value={form.iosAppCycle} onValueChange={v => set("iosAppCycle", v)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["One-time", ...BILLING_CYCLES].map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Input placeholder="Notes" className="h-7 text-xs" value={form.iosAppNotes} onChange={e => set("iosAppNotes", e.target.value)} />
                  </div>

                  {/* Add-ons */}
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs font-semibold">Add-ons</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Amount (₹)</Label>
                        <Input placeholder="e.g. 2000" className="h-7 text-xs" value={form.addOnsAmount} onChange={e => set("addOnsAmount", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Cycle</Label>
                        <Select value={form.addOnsCycle} onValueChange={v => set("addOnsCycle", v)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {BILLING_CYCLES.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Input placeholder="Description (appears on PDF)" className="h-7 text-xs" value={form.addOnsDescription} onChange={e => set("addOnsDescription", e.target.value)} />
                    <Input placeholder="Notes (optional)" className="h-7 text-xs" value={form.addOnsNotes} onChange={e => set("addOnsNotes", e.target.value)} />
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

                  {/* Workflows */}
                  <div>
                    <Label className="text-[10px] mb-2 block">Workflows</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {WORKFLOW_OPTIONS.map(wf => (
                        <button
                          key={wf.id}
                          type="button"
                          onClick={() => toggleWorkflow(wf.id)}
                          className={`text-[10px] px-2 py-1 rounded-full border font-medium transition-colors ${
                            form.enabledWorkflows.includes(wf.id)
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-background text-muted-foreground border-border hover:border-blue-400"
                          }`}
                        >
                          {wf.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <Separator />

              {/* Sales Team */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-3">Sales Team</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Sales Team Member</Label>
                    <Input placeholder="e.g. Mukhtar Khan" className="h-8 text-xs" value={form.salesTeamMember} onChange={e => set("salesTeamMember", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Sales Team Email</Label>
                    <Input placeholder="sales@quantixtechnology.in" className="h-8 text-xs" value={form.salesTeamEmail} onChange={e => set("salesTeamEmail", e.target.value)} />
                  </div>
                </div>
              </section>

            </div>
          </ScrollArea>
        </div>

        {/* ── RIGHT: A4 PREVIEW ─────────────────────────────────────── */}
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
            <ProposalDocument form={form} proposalId={proposalId} proposalDate={proposalDate} qrUrl={qrUrl} />
          </div>
        </div>
      </div>
    </div>
  )
}
