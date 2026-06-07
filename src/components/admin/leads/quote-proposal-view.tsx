"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { PageHeader } from "../shared/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, Sparkles, RefreshCw, Save, Eye, CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { authFetch } from "@/lib/admin-fetch"
import { useAuthStore } from "@/stores/auth-store"
import { getCachedBranding, setCachedBranding, urlToDataUrl } from "@/lib/branding-cache"

// ─────────────────────────────────────────────────────────────────────────────
// Constants
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

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProposalForm {
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

export interface BankDetails {
  accountName:   string
  bankName:      string
  accountNumber: string
  ifsc:          string
  upiId:         string
  branch:        string
  qrUrl:         string
  active:        boolean
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
// A4 Proposal Document (2 pages) — exported for reuse in Document Center
// ─────────────────────────────────────────────────────────────────────────────

interface ProposalBranding {
  logoUrl: string | null
  companyName: string
  companyWebsite: string
  accentColor: string
}

const DEFAULT_BRANDING: ProposalBranding = {
  logoUrl: null,
  companyName: 'Quantix Technology',
  companyWebsite: 'www.quantixtechnology.in',
  accentColor: '#2563EB',
}

export function ProposalDocument({
  form, proposalId, proposalDate, bankDetails, onBrandingReady,
}: {
  form: ProposalForm
  proposalId: string
  proposalDate: string
  bankDetails?: BankDetails | null
  onBrandingReady?: () => void
}) {
  const [branding, setBranding] = useState<ProposalBranding>(() => {
    const cached = getCachedBranding()
    if (!cached) return DEFAULT_BRANDING
    return {
      logoUrl:        cached.logoDataUrl ?? cached.logoUrl,
      companyName:    cached.companyName,
      companyWebsite: cached.companyWebsite,
      accentColor:    cached.accentColor,
    }
  })

  // Keep the callback ref stable so the effect doesn't need it as a dep
  const onReadyRef = useRef(onBrandingReady)
  useEffect(() => { onReadyRef.current = onBrandingReady }, [onBrandingReady])

  useEffect(() => {
    // If cache was warm, branding is already applied from initial state above
    if (getCachedBranding() !== null) {
      onReadyRef.current?.()
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const r = await authFetch('/api/admin/branding', { silentFailure: true } as Parameters<typeof authFetch>[1])
        if (cancelled) return
        const j = r.ok ? await r.json() : null
        const d = j?.success ? j.data : null

        const rawLogoUrl     = (d?.salesLogoUrl || d?.logoUrl) ?? null
        const companyName    = d?.companyName || DEFAULT_BRANDING.companyName
        const companyWebsite = (d?.companyWebsite || 'https://quantixtechnology.in').replace(/^https?:\/\//, '')
        const accentColor    = d?.salesAccentColor || d?.primaryColor || DEFAULT_BRANDING.accentColor

        // Convert to base64 data URL — logo embeds directly in print window HTML,
        // eliminating the blank-logo-in-PDF problem caused by the 400ms timeout.
        const logoDataUrl = rawLogoUrl ? await urlToDataUrl(rawLogoUrl) : null
        if (cancelled) return

        setCachedBranding({ logoUrl: rawLogoUrl, logoDataUrl, companyName, companyWebsite, accentColor })
        setBranding({ logoUrl: logoDataUrl ?? rawLogoUrl, companyName, companyWebsite, accentColor })
      } catch {
        // Keep defaults on any error — don't block the user
      } finally {
        if (!cancelled) onReadyRef.current?.()
      }
    })()

    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const headerBg   = "#0f1729"
  const accentBlue = branding.accentColor
  const companyName    = branding.companyName
  const companyWebsite = branding.companyWebsite
  const confirmDate = formatDateDDMMMYYYY(new Date())
  const showBank   = !!(bankDetails?.active && bankDetails?.bankName)
  const qrUrl      = bankDetails?.active && bankDetails?.qrUrl ? bankDetails.qrUrl : null

  const sectionLabel = (text: string, mb = "10px") => (
    <div style={{
      fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em",
      textTransform: "uppercase" as const, color: accentBlue, marginBottom: mb,
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
            {branding.logoUrl
              ? <img src={branding.logoUrl} alt={companyName} style={{ maxHeight: "50px", width: "auto", objectFit: "contain", display: "block" }} onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
              : <span style={{ fontWeight: 800, fontSize: "15px", color: "#111827", letterSpacing: "-0.3px" }}>{companyName}</span>
            }
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
          <span>{companyName} · {companyWebsite}</span>
          <span style={{ fontWeight: 600, color: "#6b7280" }}>Page 1 of 2</span>
          <span>© {new Date().getFullYear()} {companyName}</span>
        </div>
      </div>

      {/* ═══════════════════════════ PAGE 2 ═══════════════════════════════ */}
      {/* Budget: 1123px page. Top pad 40px + content ~670px + bottom pad 120px = 830px → footer clears at 944px (bottom:40 + footer~139px). */}
      <div style={{
        width: "794px", minHeight: "1123px", background: "#ffffff",
        fontSize: "13px", padding: "40px 52px 120px 52px", boxSizing: "border-box" as const,
        position: "relative" as const,
        borderTop: "3px solid #e5e7eb",
        pageBreakBefore: "always" as const,
      }}>

        {/* PAGE 2 HEADER strip */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: "10px", padding: "5px 12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}>
            {branding.logoUrl
              ? <img src={branding.logoUrl} alt={companyName} style={{ maxHeight: "32px", width: "auto", objectFit: "contain", display: "block" }} onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
              : <span style={{ fontWeight: 700, fontSize: "12px", color: "#111827" }}>{companyName}</span>
            }
          </div>
          <div style={{ fontSize: "11px", color: "#6b7280" }}>
            <span style={{ fontWeight: 600, color: "#374151" }}>Proposal No:</span> {proposalId || "QX-000000-000"}
            &nbsp;&nbsp;·&nbsp;&nbsp;
            <span style={{ fontWeight: 600, color: "#374151" }}>Page 2 of 2</span>
          </div>
        </div>

        <div style={{ height: "2px", background: `linear-gradient(90deg, ${accentBlue}, #06b6d4)`, borderRadius: "2px", marginBottom: "20px" }} />

        {/* ── TERMS & CONDITIONS ───────────────────────────────────────── */}
        <div style={{ marginBottom: "14px" }}>
          {sectionLabel("TERMS & CONDITIONS", "8px")}
          <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "13px 18px", background: "#f9fafb" }}>
            {[
              `${companyName} will initiate development based on selected services and business details.`,
              `Mobile application and website will be developed and prepared by ${companyName}.`,
              "The next subscription date becomes the final delivery date.",
              "Customer must provide (.com / .in) domain.",
            ].map((term, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", marginBottom: i < 3 ? "7px" : 0 }}>
                <span style={{ color: accentBlue, fontWeight: 700, flexShrink: 0 }}>•</span>
                <span style={{ color: "#374151", lineHeight: 1.4 }}>{term}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── PAYMENT TERMS ────────────────────────────────────────────── */}
        <div style={{ marginBottom: "14px" }}>
          {sectionLabel("PAYMENT TERMS", "8px")}
          <div style={{ border: "1px solid #fde68a", borderRadius: "8px", padding: "13px 18px", background: "#fffbeb" }}>
            {[
              "Implementation fee is non-refundable.",
              "First subscription amount must be paid in advance with implementation fee.",
              `${companyName} reserves rights to pause services if subscriptions are unpaid.`,
            ].map((term, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", marginBottom: i < 2 ? "7px" : 0 }}>
                <span style={{ color: "#d97706", fontWeight: 700, flexShrink: 0 }}>•</span>
                <span style={{ color: "#92400e", lineHeight: 1.4, fontWeight: 500 }}>{term}</span>
              </div>
            ))}

            {showBank && (
              <div style={{
                marginTop: "10px", paddingTop: "8px", borderTop: "1px solid #fde68a",
                display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px 12px",
              }}>
                {[
                  { label: "Account Name",   value: bankDetails!.accountName },
                  { label: "Bank Name",      value: bankDetails!.bankName },
                  { label: "Account No.",    value: bankDetails!.accountNumber },
                  { label: "IFSC",           value: bankDetails!.ifsc },
                  { label: "UPI ID",         value: bankDetails!.upiId },
                  { label: "Branch",         value: bankDetails!.branch },
                ].filter(f => f.value).map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize: "9px", color: "#92400e", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>{f.label}</div>
                    <div style={{ fontWeight: 700, color: "#78350f", fontSize: "11px", marginTop: "1px" }}>{f.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── CUSTOMER CONFIRMATION ────────────────────────────────────── */}
        <div style={{ marginBottom: "14px" }}>
          {sectionLabel("CUSTOMER CONFIRMATION", "8px")}
          <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "13px 18px", background: "#f9fafb" }}>
            <p style={{ margin: "0 0 8px 0", color: "#374151", fontWeight: 600, fontSize: "12px" }}>Customer confirms:</p>
            {[
              "Acceptance of selected services and pricing",
              `Authorization to ${companyName} to proceed`,
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", marginBottom: i < 1 ? "6px" : 0 }}>
                <span style={{ color: "#16a34a", fontWeight: 800, flexShrink: 0 }}>✓</span>
                <span style={{ color: "#374151", lineHeight: 1.4 }}>{item}</span>
              </div>
            ))}

            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              gap: "12px", marginTop: "12px", paddingTop: "10px",
              borderTop: "1px solid #e5e7eb",
            }}>
              {[
                { label: "Date",                   value: confirmDate },
                { label: "Authorized By",          value: form.clientName || "—" },
                { label: "Mode of Confirmation",   value: "Digital (Email Acknowledgement)" },
              ].map(col => (
                <div key={col.label}>
                  <div style={{ fontSize: "9.5px", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>{col.label}</div>
                  <div style={{ fontWeight: 700, color: "#111827", marginTop: "3px", fontSize: "12px" }}>{col.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── SALES TEAM — compact single-row ──────────────────────────── */}
        {(form.salesTeamMember || form.salesTeamEmail) && (
          <div style={{ marginBottom: "10px" }}>
            {sectionLabel("YOUR SALES CONTACT", "7px")}
            <div style={{
              border: "1px solid #e5e7eb", borderRadius: "8px",
              padding: "9px 16px", background: "#f9fafb",
              display: "flex", flexWrap: "wrap" as const, gap: "6px 32px",
            }}>
              {form.salesTeamMember && (
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                  <span style={{ fontSize: "10px", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.07em", whiteSpace: "nowrap" as const }}>Sales Contact:</span>
                  <span style={{ fontWeight: 700, color: "#111827", fontSize: "12px" }}>{form.salesTeamMember}</span>
                </div>
              )}
              {form.salesTeamEmail && (
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                  <span style={{ fontSize: "10px", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.07em", whiteSpace: "nowrap" as const }}>Email:</span>
                  <span style={{ fontWeight: 700, color: "#111827", fontSize: "12px" }}>{form.salesTeamEmail}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── FOOTER: left=website · center=system note · right=QR ─────── */}
        {/* Absolute at bottom:40px. Footer height ≈ 139px (QR 120px + label 14px + gap 5px). */}
        <div style={{
          position: "absolute" as const, bottom: "40px", left: "52px", right: "52px",
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
        }}>
          {/* LEFT — branding */}
          <div style={{ flex: "0 0 auto" }}>
            <div style={{ fontWeight: 700, color: accentBlue, fontSize: "12px", marginBottom: "3px" }}>{companyWebsite}</div>
            <div style={{ fontSize: "9.5px", color: "#9ca3af" }}>{companyName} · Enterprise SaaS Platform</div>
            <div style={{ fontSize: "9.5px", color: "#9ca3af" }}>© {new Date().getFullYear()} {companyName}. All rights reserved.</div>
          </div>

          {/* CENTER — system note */}
          <div style={{
            flex: "1 1 auto", textAlign: "center" as const,
            fontSize: "9.5px", color: "#9ca3af", fontStyle: "italic",
            padding: "0 16px", lineHeight: 1.4,
          }}>
            This is a system-generated document<br />and does not require physical signature.
          </div>

          {/* RIGHT — QR */}
          <div style={{ flex: "0 0 auto", textAlign: "center" as const }}>
            {qrUrl ? (
              <>
                <div style={{ fontSize: "8.5px", color: "#9ca3af", marginBottom: "5px", textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>Scan to Pay</div>
                <img
                  src={qrUrl}
                  alt="Payment QR"
                  style={{ width: "120px", height: "120px", display: "block" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF print helper — exported for reuse in Document Center
// ─────────────────────────────────────────────────────────────────────────────

export function printProposalPDF(proposalId: string, htmlContent: string) {
  const style = `
    @page { size: A4; margin: 0; }
    body { margin: 0; padding: 0; background: #fff; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    #proposal-preview > div + div { page-break-before: always; }
  `
  const win = window.open("", "_blank")
  if (!win) { toast.error("Allow popups to download PDF"); return }
  win.document.write(`<!DOCTYPE html><html><head><title>Proposal ${proposalId}</title><style>${style}</style></head><body>${htmlContent}</body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 400)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main View — Save-first flow
// ─────────────────────────────────────────────────────────────────────────────

export function QuoteProposalView() {
  const { user, permissions } = useAuthStore()
  const [form, setForm]         = useState<ProposalForm>({ ...EMPTY_FORM })
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [savedId, setSavedId]   = useState<string>("")
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null)
  // Starts true when the branding cache is already warm (e.g. user visited before)
  const [proposalReady, setProposalReady] = useState(() => getCachedBranding() !== null)
  const handleBrandingReady = useCallback(() => setProposalReady(true), [])

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

  // Fetch payment/bank config on mount (QR + bank details for PDF)
  useEffect(() => {
    authFetch("/api/admin/payment-config")
      .then(r => r.json())
      .then(json => { if (json.success && json.data) setBankDetails(json.data) })
      .catch(() => { /* optional — fail silently */ })
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

  // Save-first: generate ID atomically in DB, then save document
  const handleSaveProposal = async () => {
    if (!form.businessName.trim()) {
      toast.error("Business Name is required before saving")
      return
    }
    setSaving(true)
    try {
      // Step 1: Generate proposal ID (atomic — server generates sequence)
      const idRes  = await authFetch("/api/admin/documents/proposal-id", { method: "POST" })
      const idJson = await idRes.json()
      if (!idJson.success) throw new Error(idJson.error ?? "Failed to generate proposal ID")
      const newId: string = idJson.proposalId

      // Step 2: Save to Document Center
      const saveRes  = await authFetch("/api/admin/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId:      newId,
          documentType:    "PROPOSAL",
          businessName:    form.businessName,
          clientName:      form.clientName,
          contactPhone:    form.mobile,
          contactEmail:    form.email,
          salesTeamMember: form.salesTeamMember,
          salesTeamEmail:  form.salesTeamEmail,
          totalAmount:     total,
          formSnapshot:    form,
          createdBy:       user?.id   ?? "unknown",
          createdByName:   user?.name ?? "",
        }),
      })
      const saveJson = await saveRes.json()
      if (!saveJson.success) throw new Error(saveJson.error ?? "Failed to save document")

      setSavedId(newId)
      toast.success(`Proposal saved as ${newId} — download from Document Center`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  // Print preview — opens current form data as printable PDF without saving
  const handlePrintPreview = () => {
    const preview = document.getElementById("proposal-preview")
    if (!preview) return
    const style = `
      @page { size: A4; margin: 0; }
      body { margin: 0; padding: 0; background: #fff; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      #proposal-preview > div + div { page-break-before: always; }
    `
    const win = window.open("", "_blank")
    if (!win) { toast.error("Allow popups for print preview"); return }
    win.document.write(`<!DOCTYPE html><html><head><title>Proposal Preview</title><style>${style}</style></head><body>${preview.outerHTML}</body></html>`)
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
          executiveSummary:    d.executiveSummary                    ?? prev.executiveSummary,
          subscriptionNotes:   d.serviceDescriptions?.subscription    ?? prev.subscriptionNotes,
          implementationNotes: d.serviceDescriptions?.implementation  ?? prev.implementationNotes,
          iosAppNotes:         d.serviceDescriptions?.ios             ?? prev.iosAppNotes,
          addOnsDescription:   d.serviceDescriptions?.addons          ?? prev.addOnsDescription,
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

  const canSave = (permissions as string[]).includes("proposals:create")

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
            <Button
              variant="outline"
              className="gap-2"
              onClick={handlePrintPreview}
              disabled={!proposalReady}
              title={!proposalReady ? "Loading company branding…" : undefined}
            >
              {proposalReady
                ? <><Eye className="h-4 w-4" /> Download PDF</>
                : <><Loader2 className="h-4 w-4 animate-spin" /> Loading Branding…</>
              }
            </Button>
            {canSave && (
              <Button className="gap-2" onClick={handleSaveProposal} disabled={saving}>
                {saving
                  ? <RefreshCw className="h-4 w-4 animate-spin" />
                  : savedId
                  ? <CheckCircle2 className="h-4 w-4" />
                  : <Save className="h-4 w-4" />}
                {saving ? "Saving…" : savedId ? `Saved (${savedId})` : "Save Proposal"}
              </Button>
            )}
          </div>
        }
      />

      {/* Saved banner */}
      {savedId && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="text-xs text-emerald-800 font-medium">
            Proposal <span className="font-mono font-bold">{savedId}</span> saved to Document Center. Go to Document Center to download the PDF.
          </p>
        </div>
      )}

      <div className="flex gap-6 flex-1 min-h-0 mt-5">
        {/* ── LEFT: FORM ─────────────────────────────────────────────── */}
        <div className="w-[340px] shrink-0">
          <ScrollArea className="h-[calc(100vh-160px)]">
            <div className="space-y-6 pr-3 pb-8">

              {/* Proposal Meta */}
              <div className="rounded-xl border bg-card p-4 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Proposal ID</p>
                {savedId ? (
                  <p className="text-sm font-mono font-semibold text-emerald-700">{savedId}</p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Generated when you save</p>
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
                    <Label className="text-xs">Business Name <span className="text-destructive">*</span></Label>
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
        <div className="flex-1 overflow-auto bg-muted/30 rounded-xl border p-6 relative">
          {/* Loading overlay — shown until branding + logo data URL are ready */}
          {!proposalReady && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-muted/70 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3 text-center">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Preparing Proposal</p>
                  <p className="text-xs text-muted-foreground">Loading company branding…</p>
                </div>
              </div>
            </div>
          )}
          <div
            className="mx-auto"
            style={{
              width: "794px",
              boxShadow: "0 8px 40px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.07)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <ProposalDocument
              form={form}
              proposalId={savedId || "QX-PENDING"}
              proposalDate={proposalDate}
              bankDetails={bankDetails}
              onBrandingReady={handleBrandingReady}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
