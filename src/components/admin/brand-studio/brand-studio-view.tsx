"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Monitor, FileText, Users, Upload, X, Save, Loader2,
  ImageIcon, Palette, CheckCircle2, PanelLeft, Crop,
  Receipt, Building2, Landmark, CreditCard, StickyNote,
  ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"
import { authFetch } from "@/lib/admin-fetch"
import { CropModal } from "./crop-modal"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrandSettings {
  // Company / platform identity
  companyName:    string
  tagline:        string
  companyAddress: string
  companyEmail:   string
  companyPhone:   string
  companyWebsite: string

  // Zone 1 — Core Platform: asset URLs
  logoUrl:            string | null
  darkLogoUrl:        string | null   // white logo
  compactLogoUrl:     string | null
  faviconUrl:         string | null
  watermarkUrl:       string | null
  loginScreenLogoUrl: string | null

  // Zone 1 — Core Platform: colors
  primaryColor:   string
  secondaryColor: string
  accentColor:    string
  successColor:   string
  warningColor:   string
  infoColor:      string

  // Zone 2 — Sales Documents: assets
  salesLogoUrl:      string | null
  salesWatermarkUrl: string | null

  // Zone 2 — Sales Documents: config
  salesAccentColor: string
  salesFooterText:  string

  // Zone 3 — HRMS: assets
  hrmsLogoUrl:      string | null
  hrmsWatermarkUrl: string | null

  // Zone 3 — HRMS: config
  hrmsAccentColor:      string
  signatoryName:        string
  signatoryDesignation: string
  signatorySignUrl:     string | null
  signatoryStampUrl:    string | null

  // Zone 4 — Sidebar Theme
  sidebarBg:           string
  sidebarActiveColor:  string
  sidebarTextColor:    string
  sidebarHeadingColor: string
  sidebarLogoUrl:      string | null

  // Zone 5 — Invoice Settings
  invoiceLogoUrl:         string | null
  invoiceLegalName:       string
  invoiceBusinessName:    string
  invoiceAddress:         string
  invoiceCity:            string
  invoiceState:           string
  invoicePincode:         string
  invoiceCountry:         string
  invoicePhone:           string
  invoiceEmail:           string
  invoiceWebsite:         string
  companyPan:             string
  companyMsme:            string
  companyShopEst:         string
  companyIec:             string
  companyCin:             string
  bankAccountName:        string
  bankName:               string
  bankAccountNumber:      string
  bankIfsc:               string
  bankUpiId:              string
  invoiceFooterNotes:     string
  invoiceLegalDisclaimer: string
  invoiceDefaultNotes:    string
}

const DEFAULTS: BrandSettings = {
  companyName: "Quantix Technology", tagline: "Powering Business Growth",
  companyAddress: "", companyEmail: "", companyPhone: "", companyWebsite: "",
  logoUrl: null, darkLogoUrl: null, compactLogoUrl: null, faviconUrl: null, watermarkUrl: null,
  loginScreenLogoUrl: null,
  primaryColor: "#2563EB", secondaryColor: "#64748B", accentColor: "#0EA5E9",
  successColor: "#10B981", warningColor: "#F59E0B", infoColor: "#6366F1",
  salesLogoUrl: null, salesWatermarkUrl: null,
  salesAccentColor: "#2563EB", salesFooterText: "",
  hrmsLogoUrl: null, hrmsWatermarkUrl: null,
  hrmsAccentColor: "#2563EB", signatoryName: "", signatoryDesignation: "",
  signatorySignUrl: null, signatoryStampUrl: null,
  sidebarBg: "#04132E", sidebarActiveColor: "#2563EB",
  sidebarTextColor: "#FFFFFF", sidebarHeadingColor: "#38BDF8",
  sidebarLogoUrl: null,
  // Zone 5
  invoiceLogoUrl: null,
  invoiceLegalName: "", invoiceBusinessName: "", invoiceAddress: "",
  invoiceCity: "", invoiceState: "", invoicePincode: "", invoiceCountry: "India",
  invoicePhone: "", invoiceEmail: "", invoiceWebsite: "",
  companyPan: "", companyMsme: "", companyShopEst: "", companyIec: "", companyCin: "",
  bankAccountName: "", bankName: "", bankAccountNumber: "", bankIfsc: "", bankUpiId: "",
  invoiceFooterNotes: "", invoiceLegalDisclaimer: "", invoiceDefaultNotes: "",
}

type AssetField = keyof { [K in keyof BrandSettings as BrandSettings[K] extends string | null ? K : never]: unknown }

// ─── Color Input ──────────────────────────────────────────────────────────────

function ColorSwatch({
  label, field, value, onChange,
}: { label: string; field: string; value: string; onChange: (f: string, v: string) => void }) {
  const id = `color-${field}`
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</Label>
      <div className="flex items-center gap-2 h-9">
        <label htmlFor={id} className="shrink-0 h-9 w-9 rounded-lg border-2 border-white/20 cursor-pointer shadow-sm transition-transform hover:scale-105 ring-1 ring-black/10" style={{ background: value || "#000" }} />
        <input
          id={id}
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(field, e.target.value)}
          className="sr-only"
        />
        <Input
          value={value}
          onChange={(e) => onChange(field, e.target.value)}
          placeholder="#000000"
          className="font-mono text-sm h-9"
        />
      </div>
    </div>
  )
}

// ─── Asset Upload ─────────────────────────────────────────────────────────────

function AssetUpload({
  label, hint, field, url, onUploaded, onDeleted,
}: {
  label: string
  hint: string
  field: string
  url: string | null
  onUploaded: (field: string, url: string) => void
  onDeleted: (field: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [cropOpen, setCropOpen]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("assetField", field)
      const res  = await authFetch("/api/admin/platform-settings/upload", { method: "POST", body: form })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? `Upload failed (${res.status})`)
      onUploaded(field, json.url)
      toast.success(`${label} uploaded`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res  = await authFetch(`/api/admin/platform-settings/upload?assetField=${field}`, { method: "DELETE" })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? `Delete failed (${res.status})`)
      onDeleted(field)
      toast.success(`${label} removed`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</Label>
        {url && (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1 text-muted-foreground" onClick={() => setCropOpen(true)} disabled={deleting || uploading}>
              <Crop className="h-3 w-3" /> Crop
            </Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive hover:text-destructive gap-1" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />} Remove
            </Button>
          </div>
        )}
      </div>
      {url ? (
        <div className="relative rounded-xl border border-border/50 bg-[repeating-conic-gradient(#f0f0f0_0%_25%,#fafafa_0%_50%)] bg-[length:16px_16px] overflow-hidden" style={{ height: "80px" }}>
          <img src={url} alt={label} className="h-full w-full object-contain p-3" />
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-20 rounded-xl border-2 border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/[0.02] transition-all flex flex-col items-center justify-center gap-1.5 text-muted-foreground group"
        >
          {uploading
            ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
            : <Upload className="h-4 w-4 group-hover:text-primary transition-colors" />}
          <span className="text-[11px] font-medium group-hover:text-primary transition-colors">{uploading ? "Uploading…" : hint}</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {url && (
        <CropModal
          open={cropOpen}
          imageUrl={url}
          assetField={field}
          label={label}
          onSave={(newUrl) => onUploaded(field, newUrl)}
          onClose={() => setCropOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Zone Previews ────────────────────────────────────────────────────────────

function CorePlatformPreview({ s }: { s: BrandSettings }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Live Preview</p>
      {/* Sidebar mockup */}
      <div className="rounded-xl overflow-hidden border border-border/40 shadow-sm" style={{ background: "#081028" }}>
        <div className="px-3 py-2.5 flex items-center gap-2.5 border-b border-white/[0.07]">
          <div className="h-6 w-6 rounded-md flex items-center justify-center text-white font-black text-[11px] shrink-0" style={{ background: s.primaryColor || "#2563EB" }}>Q</div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.08em] text-white uppercase leading-tight truncate">{s.companyName || "Quantix Core"}</p>
            <p className="text-[8px] leading-tight" style={{ color: "rgba(255,255,255,0.35)" }}>{s.tagline || "Platform Admin"}</p>
          </div>
        </div>
        <div className="px-2 py-2 space-y-0.5">
          {["Dashboard", "Businesses", "Subscriptions"].map((item, i) => (
            <div key={item} className="flex items-center gap-2 px-2 py-1.5 rounded-md" style={{ background: i === 0 ? s.primaryColor + "26" : "transparent" }}>
              <div className="h-2 w-2 rounded-sm shrink-0" style={{ background: i === 0 ? s.primaryColor || "#2563EB" : "rgba(255,255,255,0.25)" }} />
              <span className="text-[9px] font-semibold" style={{ color: i === 0 ? "white" : "rgba(255,255,255,0.55)" }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Color palette */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Brand Colors</p>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { label: "Primary",   color: s.primaryColor   },
            { label: "Secondary", color: s.secondaryColor },
            { label: "Accent",    color: s.accentColor    },
            { label: "Success",   color: s.successColor   },
            { label: "Warning",   color: s.warningColor   },
            { label: "Info",      color: s.infoColor      },
          ].map(({ label, color }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className="h-8 w-8 rounded-lg shadow-sm ring-1 ring-black/10" style={{ background: color || "#e5e7eb" }} title={color} />
              <span className="text-[9px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SalesDocumentPreview({ s }: { s: BrandSettings }) {
  const accent = s.salesAccentColor || s.primaryColor || "#2563EB"
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Document Preview</p>
      <div className="rounded-xl border border-border/40 overflow-hidden shadow-sm bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        {/* Accent bar */}
        <div className="h-1.5 w-full" style={{ background: accent }} />
        {/* Doc header */}
        <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="space-y-0.5">
            {s.salesLogoUrl
              ? <img src={s.salesLogoUrl} alt="Sales Logo" className="h-8 object-contain" />
              : <div className="h-7 w-20 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center"><ImageIcon className="h-3 w-3 text-zinc-400" /></div>}
            <p className="text-[9px] text-zinc-400 mt-1">{s.companyName || "Quantix Technology"}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold tracking-wider uppercase" style={{ color: accent }}>Quotation</p>
            <p className="text-[9px] text-zinc-400">QTX-2026-0001</p>
          </div>
        </div>
        <div className="px-4 py-3 space-y-1.5">
          <div className="flex gap-2">
            <div className="h-[6px] w-16 rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-[6px] w-24 rounded bg-zinc-100 dark:bg-zinc-800" />
          </div>
          <div className="h-[6px] w-32 rounded bg-zinc-100 dark:bg-zinc-800" />
        </div>
        {/* Footer */}
        <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <p className="text-[8px] text-zinc-400 truncate">{s.salesFooterText || s.companyWebsite || "quantixtechnology.in"}</p>
          <div className="h-1 w-8 rounded" style={{ background: accent + "40" }} />
        </div>
      </div>
    </div>
  )
}

function HrmsDocumentPreview({ s }: { s: BrandSettings }) {
  const accent = s.hrmsAccentColor || s.primaryColor || "#2563EB"
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Document Preview</p>
      <div className="rounded-xl border border-border/40 overflow-hidden shadow-sm bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        {/* Accent bar */}
        <div className="h-1.5 w-full" style={{ background: accent }} />
        {/* Header */}
        <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            {s.hrmsLogoUrl
              ? <img src={s.hrmsLogoUrl} alt="HRMS Logo" className="h-8 object-contain" />
              : <div className="h-7 w-20 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center"><ImageIcon className="h-3 w-3 text-zinc-400" /></div>}
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold tracking-wider uppercase" style={{ color: accent }}>Offer Letter</p>
            <p className="text-[9px] text-zinc-400">Quantix Technology</p>
          </div>
        </div>
        {/* Body stub */}
        <div className="px-4 py-3 space-y-1.5">
          <div className="h-[6px] w-28 rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-[6px] w-full rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-[6px] w-4/5 rounded bg-zinc-100 dark:bg-zinc-800" />
        </div>
        {/* Signatory */}
        <div className="px-4 pb-4 pt-1 border-t border-zinc-100 dark:border-zinc-800 mt-1">
          <p className="text-[8px] text-zinc-400 mb-1.5 uppercase tracking-wide">Authorized Signatory</p>
          {s.signatorySignUrl
            ? <img src={s.signatorySignUrl} alt="Signature" className="h-6 object-contain mb-1" />
            : <div className="h-4 w-16 border-b border-zinc-300 dark:border-zinc-600 mb-1" />}
          <p className="text-[9px] font-semibold text-zinc-700 dark:text-zinc-300">{s.signatoryName || "Authorized Signatory"}</p>
          <p className="text-[8px] text-zinc-400">{s.signatoryDesignation || "Designation"}</p>
        </div>
      </div>
    </div>
  )
}

function SidebarThemePreview({ s }: { s: BrandSettings }) {
  const bg      = s.sidebarBg           || "#04132E"
  const active  = s.sidebarActiveColor  || "#2563EB"
  const text    = s.sidebarTextColor    || "#FFFFFF"
  const heading = s.sidebarHeadingColor || "#38BDF8"

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Live Preview</p>
      <div className="rounded-xl overflow-hidden border border-border/40 shadow-sm" style={{ background: bg }}>
        {/* Brand area */}
        <div className="flex items-center justify-center border-b" style={{ borderColor: `${text}12`, height: 60, padding: "8px 10px" }}>
          {(s.sidebarLogoUrl || s.logoUrl)
            ? <img src={(s.sidebarLogoUrl || s.logoUrl)!} alt="Logo" style={{ width: "100%", height: "auto", objectFit: "contain", display: "block" }} />
            : <span className="text-[11px] font-bold tracking-wide uppercase" style={{ color: text }}>Quantix Core</span>
          }
        </div>
        {/* Nav */}
        <div className="px-2 py-2 space-y-0.5">
          <div className="px-2 py-1 text-[7.5px] font-bold uppercase tracking-widest" style={{ color: heading }}>
            Platform Control
          </div>
          {[
            { label: "Dashboard",     active: true  },
            { label: "Businesses",    active: false },
            { label: "Subscriptions", active: false },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 px-2 py-1.5 rounded-md" style={{
              background: item.active ? `${active}28` : "transparent",
            }}>
              <div className="h-1.5 w-1.5 rounded-sm shrink-0" style={{ background: item.active ? active : `${text}35` }} />
              <span className="text-[9px] font-semibold" style={{ color: item.active ? text : `${text}80` }}>
                {item.label}
              </span>
            </div>
          ))}
          <div className="px-2 py-1 mt-1.5 text-[7.5px] font-bold uppercase tracking-widest" style={{ color: heading }}>
            System
          </div>
          {["Brand Studio", "Settings"].map((item) => (
            <div key={item} className="flex items-center gap-2 px-2 py-1.5 rounded-md">
              <div className="h-1.5 w-1.5 rounded-sm shrink-0" style={{ background: `${text}35` }} />
              <span className="text-[9px] font-semibold" style={{ color: `${text}80` }}>{item}</span>
            </div>
          ))}
        </div>
        {/* User footer */}
        <div className="px-3 py-2 mt-1" style={{ borderTop: `1px solid ${text}12` }}>
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0" style={{ background: active }}>A</div>
            <div className="min-w-0">
              <p className="text-[9px] font-semibold truncate" style={{ color: text }}>Admin User</p>
              <p className="text-[7.5px] truncate" style={{ color: `${text}55` }}>admin@platform.in</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BrandStudioView() {
  const [settings, setSettings] = useState<BrandSettings>({ ...DEFAULTS })
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)

  const load = useCallback(async () => {
    try {
      const res  = await authFetch("/api/admin/platform-settings")
      const json = await res.json()
      if (json.success) {
        setSettings((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(json.data).filter(([, v]) => v !== undefined && v !== null || true)
          ) as Partial<BrandSettings>,
        }))
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const set = (field: string, value: unknown) =>
    setSettings((s) => ({ ...s, [field]: value }))

  const handleColor = (field: string, value: string) => set(field, value)

  const handleUploaded = (field: string, url: string) => set(field, url)
  const handleDeleted  = (field: string) => set(field, null)

  const handleSave = async (zone: string) => {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {}

      if (zone === "core" || zone === "all") {
        Object.assign(payload, {
          companyName: settings.companyName, tagline: settings.tagline,
          primaryColor: settings.primaryColor, secondaryColor: settings.secondaryColor,
          accentColor: settings.accentColor, successColor: settings.successColor,
          warningColor: settings.warningColor, infoColor: settings.infoColor,
        })
      }
      if (zone === "sales" || zone === "all") {
        Object.assign(payload, {
          salesAccentColor: settings.salesAccentColor,
          salesFooterText: settings.salesFooterText,
          companyAddress: settings.companyAddress, companyEmail: settings.companyEmail,
          companyPhone: settings.companyPhone, companyWebsite: settings.companyWebsite,
        })
      }
      if (zone === "hrms" || zone === "all") {
        Object.assign(payload, {
          hrmsAccentColor: settings.hrmsAccentColor,
          signatoryName: settings.signatoryName,
          signatoryDesignation: settings.signatoryDesignation,
        })
      }
      if (zone === "sidebar" || zone === "all") {
        Object.assign(payload, {
          sidebarBg:           settings.sidebarBg,
          sidebarActiveColor:  settings.sidebarActiveColor,
          sidebarTextColor:    settings.sidebarTextColor,
          sidebarHeadingColor: settings.sidebarHeadingColor,
        })
      }
      if (zone === "invoice" || zone === "all") {
        Object.assign(payload, {
          invoiceLegalName:       settings.invoiceLegalName,
          invoiceBusinessName:    settings.invoiceBusinessName,
          invoiceAddress:         settings.invoiceAddress,
          invoiceCity:            settings.invoiceCity,
          invoiceState:           settings.invoiceState,
          invoicePincode:         settings.invoicePincode,
          invoiceCountry:         settings.invoiceCountry,
          invoicePhone:           settings.invoicePhone,
          invoiceEmail:           settings.invoiceEmail,
          invoiceWebsite:         settings.invoiceWebsite,
          companyPan:             settings.companyPan,
          companyMsme:            settings.companyMsme,
          companyShopEst:         settings.companyShopEst,
          companyIec:             settings.companyIec,
          companyCin:             settings.companyCin,
          bankAccountName:        settings.bankAccountName,
          bankName:               settings.bankName,
          bankAccountNumber:      settings.bankAccountNumber,
          bankIfsc:               settings.bankIfsc,
          bankUpiId:              settings.bankUpiId,
          invoiceFooterNotes:     settings.invoiceFooterNotes,
          invoiceLegalDisclaimer: settings.invoiceLegalDisclaimer,
          invoiceDefaultNotes:    settings.invoiceDefaultNotes,
        })
      }

      const res  = await authFetch("/api/admin/platform-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? `Save failed (${res.status})`)
      toast.success("Brand settings saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally { setSaving(false) }
  }

  const txt = (field: keyof BrandSettings) => ({
    value: (settings[field] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(field, e.target.value),
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Palette className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Brand Studio</h1>
            <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">Quantix Internal</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Single source of truth for Core Platform, Sales Documents, and HRMS branding.
          </p>
        </div>
      </div>

      {/* Zones */}
      <Tabs defaultValue="core" className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl h-10">
          <TabsTrigger value="core"    className="gap-1.5 text-xs"><Monitor    className="h-3.5 w-3.5" />Core Platform</TabsTrigger>
          <TabsTrigger value="sales"   className="gap-1.5 text-xs"><FileText   className="h-3.5 w-3.5" />Sales Documents</TabsTrigger>
          <TabsTrigger value="hrms"    className="gap-1.5 text-xs"><Users      className="h-3.5 w-3.5" />HRMS</TabsTrigger>
          <TabsTrigger value="sidebar" className="gap-1.5 text-xs"><PanelLeft  className="h-3.5 w-3.5" />Sidebar Theme</TabsTrigger>
          <TabsTrigger value="invoice" className="gap-1.5 text-xs"><Receipt    className="h-3.5 w-3.5" />Invoice Settings</TabsTrigger>
        </TabsList>

        {/* ── ZONE 1: Core Platform ── */}
        <TabsContent value="core">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6 items-start">
            <div className="space-y-6">
              {/* Platform Identity */}
              <Card>
                <CardContent className="pt-5 pb-6 space-y-5">
                  <SectionHeader icon={<Monitor className="h-4 w-4" />} title="Platform Identity" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Platform Name</Label>
                      <Input placeholder="Quantix Technology" {...txt("companyName")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tagline</Label>
                      <Input placeholder="Powering Business Growth" {...txt("tagline")} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Brand Assets */}
              <Card>
                <CardContent className="pt-5 pb-6 space-y-5">
                  <SectionHeader icon={<ImageIcon className="h-4 w-4" />} title="Brand Assets" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <AssetUpload label="Primary Logo"   hint="Main logo, light bg"       field="logoUrl"        url={settings.logoUrl}        onUploaded={handleUploaded} onDeleted={handleDeleted} />
                    <AssetUpload label="White Logo"     hint="Logo on dark backgrounds"  field="darkLogoUrl"    url={settings.darkLogoUrl}    onUploaded={handleUploaded} onDeleted={handleDeleted} />
                    <AssetUpload label="Compact Logo"   hint="Icon / collapsed sidebar"  field="compactLogoUrl" url={settings.compactLogoUrl} onUploaded={handleUploaded} onDeleted={handleDeleted} />
                    <AssetUpload label="Favicon"        hint="32×32 PNG or ICO"          field="faviconUrl"     url={settings.faviconUrl}     onUploaded={handleUploaded} onDeleted={handleDeleted} />
                    <AssetUpload label="Watermark"      hint="Light, transparent PNG"    field="watermarkUrl"   url={settings.watermarkUrl}   onUploaded={handleUploaded} onDeleted={handleDeleted} />
                    <AssetUpload label="Email Logo"     hint="Used in email headers"     field="emailLogoUrl"   url={null}                    onUploaded={handleUploaded} onDeleted={handleDeleted} />
                  </div>
                </CardContent>
              </Card>

              {/* Login Screen Logo */}
              <Card>
                <CardContent className="pt-5 pb-6 space-y-5">
                  <div>
                    <SectionHeader icon={<ImageIcon className="h-4 w-4" />} title="Login Screen Logo" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Displayed only on the login page. Upload a logo optimized for the dark login background
                      (white or transparent PNG recommended). Falls back to the Primary Logo when not set.
                      Recommended size: 1200 × 1200 px.
                    </p>
                  </div>
                  <div className="max-w-xs">
                    <AssetUpload
                      label="Login Screen Logo"
                      hint="1200 × 1200 px · PNG transparent"
                      field="loginScreenLogoUrl"
                      url={settings.loginScreenLogoUrl}
                      onUploaded={handleUploaded}
                      onDeleted={handleDeleted}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Brand Colors */}
              <Card>
                <CardContent className="pt-5 pb-6 space-y-5">
                  <SectionHeader icon={<Palette className="h-4 w-4" />} title="Brand Colors" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                    <ColorSwatch label="Primary"   field="primaryColor"   value={settings.primaryColor}   onChange={handleColor} />
                    <ColorSwatch label="Secondary" field="secondaryColor" value={settings.secondaryColor} onChange={handleColor} />
                    <ColorSwatch label="Accent"    field="accentColor"    value={settings.accentColor}    onChange={handleColor} />
                    <ColorSwatch label="Success"   field="successColor"   value={settings.successColor}   onChange={handleColor} />
                    <ColorSwatch label="Warning"   field="warningColor"   value={settings.warningColor}   onChange={handleColor} />
                    <ColorSwatch label="Info"      field="infoColor"      value={settings.infoColor}      onChange={handleColor} />
                  </div>
                </CardContent>
              </Card>

              {/* Apply To */}
              <Card>
                <CardContent className="pt-5 pb-5">
                  <SectionHeader icon={<CheckCircle2 className="h-4 w-4" />} title="Applied To" />
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {["Sidebar", "Header", "Login Screen", "Loading Screen", "Dashboard", "Analytics", "Reports", "Notifications", "Internal Emails"].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={() => handleSave("core")} disabled={saving} className="gap-2 min-w-[120px]">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Zone 1
                </Button>
              </div>
            </div>

            {/* Sticky preview */}
            <div className="xl:sticky xl:top-6">
              <Card>
                <CardContent className="pt-5 pb-5">
                  <CorePlatformPreview s={settings} />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── ZONE 2: Sales Documents ── */}
        <TabsContent value="sales">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6 items-start">
            <div className="space-y-6">

              {/* Document Assets */}
              <Card>
                <CardContent className="pt-5 pb-6 space-y-5">
                  <SectionHeader icon={<ImageIcon className="h-4 w-4" />} title="Document Assets" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <AssetUpload label="Sales Logo"      hint="Main logo for documents"  field="salesLogoUrl"      url={settings.salesLogoUrl}      onUploaded={handleUploaded} onDeleted={handleDeleted} />
                    <AssetUpload label="White Sales Logo" hint="On dark doc backgrounds" field="darkLogoUrl"        url={settings.darkLogoUrl}        onUploaded={handleUploaded} onDeleted={handleDeleted} />
                    <AssetUpload label="Sales Watermark" hint="Faint background mark"    field="salesWatermarkUrl" url={settings.salesWatermarkUrl} onUploaded={handleUploaded} onDeleted={handleDeleted} />
                  </div>
                </CardContent>
              </Card>

              {/* Document Config */}
              <Card>
                <CardContent className="pt-5 pb-6 space-y-5">
                  <SectionHeader icon={<Palette className="h-4 w-4" />} title="Document Colors & Text" />
                  <div className="grid grid-cols-2 gap-5">
                    <ColorSwatch label="Document Accent Color" field="salesAccentColor" value={settings.salesAccentColor} onChange={handleColor} />
                    <div className="space-y-1.5">
                      <Label>Document Footer Text</Label>
                      <Input placeholder="quantixtechnology.in · GSTIN: 29AAACU..." {...txt("salesFooterText")} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Company Details */}
              <Card>
                <CardContent className="pt-5 pb-6 space-y-5">
                  <SectionHeader icon={<FileText className="h-4 w-4" />} title="Company Details" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-2">
                      <Label>Company Address</Label>
                      <Textarea placeholder="Bangalore, Karnataka, India — 560001" rows={2} {...txt("companyAddress")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input type="email" placeholder="billing@quantixtechnology.in" {...txt("companyEmail")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Phone</Label>
                      <Input type="tel" placeholder="+91 98xxx xxxxx" {...txt("companyPhone")} />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label>Website</Label>
                      <Input placeholder="https://quantixtechnology.in" {...txt("companyWebsite")} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Apply To */}
              <Card>
                <CardContent className="pt-5 pb-5">
                  <SectionHeader icon={<CheckCircle2 className="h-4 w-4" />} title="Applied To" />
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {["Quotations", "Proposals", "Subscription Invoices", "Add-On Invoices"].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={() => handleSave("sales")} disabled={saving} className="gap-2 min-w-[120px]">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Zone 2
                </Button>
              </div>
            </div>

            {/* Sticky preview */}
            <div className="xl:sticky xl:top-6">
              <Card>
                <CardContent className="pt-5 pb-5">
                  <SalesDocumentPreview s={settings} />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── ZONE 3: HRMS ── */}
        <TabsContent value="hrms">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6 items-start">
            <div className="space-y-6">

              {/* HRMS Assets */}
              <Card>
                <CardContent className="pt-5 pb-6 space-y-5">
                  <SectionHeader icon={<ImageIcon className="h-4 w-4" />} title="HRMS Assets" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <AssetUpload label="HRMS Logo"       hint="Main logo for HR docs"    field="hrmsLogoUrl"      url={settings.hrmsLogoUrl}      onUploaded={handleUploaded} onDeleted={handleDeleted} />
                    <AssetUpload label="White HRMS Logo" hint="On dark HR backgrounds"   field="darkLogoUrl"      url={settings.darkLogoUrl}      onUploaded={handleUploaded} onDeleted={handleDeleted} />
                    <AssetUpload label="HRMS Watermark"  hint="Faint background mark"    field="hrmsWatermarkUrl" url={settings.hrmsWatermarkUrl} onUploaded={handleUploaded} onDeleted={handleDeleted} />
                  </div>
                </CardContent>
              </Card>

              {/* HRMS Colors */}
              <Card>
                <CardContent className="pt-5 pb-6 space-y-5">
                  <SectionHeader icon={<Palette className="h-4 w-4" />} title="Document Colors" />
                  <div className="max-w-xs">
                    <ColorSwatch label="Document Accent Color" field="hrmsAccentColor" value={settings.hrmsAccentColor} onChange={handleColor} />
                  </div>
                </CardContent>
              </Card>

              {/* Authorized Signatory */}
              <Card>
                <CardContent className="pt-5 pb-6 space-y-5">
                  <div>
                    <SectionHeader icon={<Users className="h-4 w-4" />} title="Authorized Signatory" />
                    <p className="text-xs text-muted-foreground mt-1">Consumed automatically by all HRMS documents — no duplicate uploads per module.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Full Name</Label>
                      <Input placeholder="Kiran Sharma" {...txt("signatoryName")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Designation</Label>
                      <Input placeholder="Director — Human Resources" {...txt("signatoryDesignation")} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <AssetUpload label="Digital Signature"    hint="Transparent PNG"         field="signatorySignUrl"  url={settings.signatorySignUrl}  onUploaded={handleUploaded} onDeleted={handleDeleted} />
                    <AssetUpload label="Signature with Stamp" hint="Signature + company seal" field="signatoryStampUrl" url={settings.signatoryStampUrl} onUploaded={handleUploaded} onDeleted={handleDeleted} />
                  </div>
                </CardContent>
              </Card>

              {/* Apply To */}
              <Card>
                <CardContent className="pt-5 pb-5">
                  <SectionHeader icon={<CheckCircle2 className="h-4 w-4" />} title="Applied To" />
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {["Offer Letter", "Appointment Letter", "Promotion Letter", "Confirmation Letter", "Experience Letter", "Relieving Letter", "Payslip", "Commission Slip", "Employee ID Card", "HRMS Reports"].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={() => handleSave("hrms")} disabled={saving} className="gap-2 min-w-[120px]">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Zone 3
                </Button>
              </div>
            </div>

            {/* Sticky preview */}
            <div className="xl:sticky xl:top-6">
              <Card>
                <CardContent className="pt-5 pb-5">
                  <HrmsDocumentPreview s={settings} />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        {/* ── ZONE 4: Sidebar Theme ── */}
        <TabsContent value="sidebar">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6 items-start">
            <div className="space-y-6">

              {/* Sidebar Logo */}
              <Card>
                <CardContent className="pt-5 pb-6 space-y-5">
                  <div>
                    <SectionHeader icon={<ImageIcon className="h-4 w-4" />} title="Sidebar Logo" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Displayed only in the left navigation sidebar. Falls back to the Primary Logo when not set.
                      Recommended size: 2350 × 750 px, PNG with transparent background.
                    </p>
                  </div>
                  <div className="max-w-xs">
                    <AssetUpload
                      label="Sidebar Logo"
                      hint="2350 × 750 px · PNG transparent"
                      field="sidebarLogoUrl"
                      url={settings.sidebarLogoUrl}
                      onUploaded={handleUploaded}
                      onDeleted={handleDeleted}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Sidebar Colors */}
              <Card>
                <CardContent className="pt-5 pb-6 space-y-5">
                  <SectionHeader icon={<PanelLeft className="h-4 w-4" />} title="Sidebar Theme Colors" />
                  <p className="text-xs text-muted-foreground -mt-2">
                    These colors apply only to the left navigation sidebar. Documents, invoices, and proposals are unaffected.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-5">
                    <ColorSwatch label="Background"          field="sidebarBg"           value={settings.sidebarBg}           onChange={handleColor} />
                    <ColorSwatch label="Active Menu Color"   field="sidebarActiveColor"  value={settings.sidebarActiveColor}  onChange={handleColor} />
                    <ColorSwatch label="Text Color"          field="sidebarTextColor"    value={settings.sidebarTextColor}    onChange={handleColor} />
                    <ColorSwatch label="Section Heading"     field="sidebarHeadingColor" value={settings.sidebarHeadingColor} onChange={handleColor} />
                  </div>
                </CardContent>
              </Card>

              {/* Apply To */}
              <Card>
                <CardContent className="pt-5 pb-5">
                  <SectionHeader icon={<CheckCircle2 className="h-4 w-4" />} title="Applied To" />
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {["Left Navigation Sidebar", "Sidebar Branding Area", "Menu Items", "Menu Hover States", "Section Headings", "Collapsed Icon Rail"].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-border/40">
                    <p className="text-xs text-muted-foreground font-medium mb-2">Not affected:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {["Offer Letter", "Annexure", "Proposals", "Invoices", "HRMS Documents"].map((item) => (
                        <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground/60">
                          <div className="h-3.5 w-3.5 rounded-full border border-border shrink-0" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={() => handleSave("sidebar")} disabled={saving} className="gap-2 min-w-[120px]">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Sidebar Theme
                </Button>
              </div>
            </div>

            {/* Sticky preview */}
            <div className="xl:sticky xl:top-6">
              <Card>
                <CardContent className="pt-5 pb-5">
                  <SidebarThemePreview s={settings} />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── ZONE 5: Invoice Settings ── */}
        <TabsContent value="invoice">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6 items-start">
            <div className="space-y-6">

              {/* Invoice Logo */}
              <Card>
                <CardContent className="pt-5 pb-6 space-y-5">
                  <div>
                    <SectionHeader icon={<ImageIcon className="h-4 w-4" />} title="Invoice Logo" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Dedicated logo for Tax Invoices, Proforma Invoices, Payment Receipts, and Credit Notes.
                      Falls back to Sales Logo → Primary Logo when not set. Recommended: transparent PNG, 600 × 200 px.
                    </p>
                  </div>
                  <div className="max-w-xs">
                    <AssetUpload
                      label="Invoice Logo"
                      hint="600 × 200 px · PNG transparent"
                      field="invoiceLogoUrl"
                      url={settings.invoiceLogoUrl}
                      onUploaded={handleUploaded}
                      onDeleted={handleDeleted}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Company Information */}
              <Card>
                <CardContent className="pt-5 pb-6 space-y-5">
                  <SectionHeader icon={<Building2 className="h-4 w-4" />} title="Company Information" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Legal Company Name</Label>
                      <Input placeholder="Quantix Technology Private Limited" {...txt("invoiceLegalName")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Business / Trade Name</Label>
                      <Input placeholder="Quantix Technology" {...txt("invoiceBusinessName")} />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label>Address</Label>
                      <Input placeholder="123, Tech Park, Outer Ring Road" {...txt("invoiceAddress")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>City</Label>
                      <Input placeholder="Bengaluru" {...txt("invoiceCity")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>State</Label>
                      <Input placeholder="Karnataka" {...txt("invoiceState")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Pincode</Label>
                      <Input placeholder="560001" {...txt("invoicePincode")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Country</Label>
                      <Input placeholder="India" {...txt("invoiceCountry")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Phone</Label>
                      <Input type="tel" placeholder="+91 98xxx xxxxx" {...txt("invoicePhone")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Billing Email</Label>
                      <Input type="email" placeholder="billing@quantixtechnology.in" {...txt("invoiceEmail")} />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label>Website</Label>
                      <Input placeholder="https://quantixtechnology.in" {...txt("invoiceWebsite")} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tax & Registration */}
              <Card>
                <CardContent className="pt-5 pb-6 space-y-5">
                  <div>
                    <SectionHeader icon={<ShieldCheck className="h-4 w-4" />} title="Tax & Registration Numbers" />
                    <p className="text-xs text-muted-foreground mt-1">All fields are optional. Blank fields are hidden on invoices automatically.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-2 rounded-lg bg-muted/40 border border-border/50 px-3 py-2">
                      <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">GSTIN</span> is configured in Platform Settings → Billing. It is automatically shown on all invoices.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>PAN</Label>
                      <Input placeholder="AAACU0000A" {...txt("companyPan")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>MSME / Udyam Number</Label>
                      <Input placeholder="UDYAM-KA-00-0000000" {...txt("companyMsme")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Shop & Establishment No.</Label>
                      <Input placeholder="KA/BLR/0000000" {...txt("companyShopEst")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>IEC (Import Export Code)</Label>
                      <Input placeholder="AAACU0000" {...txt("companyIec")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>CIN (Company Identification No.)</Label>
                      <Input placeholder="U72900KA2020PTC000000" {...txt("companyCin")} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Banking Details */}
              <Card>
                <CardContent className="pt-5 pb-6 space-y-5">
                  <div>
                    <SectionHeader icon={<Landmark className="h-4 w-4" />} title="Banking Details" />
                    <p className="text-xs text-muted-foreground mt-1">Shown on unpaid invoices only (DRAFT, SENT, OVERDUE, PARTIALLY PAID). Hidden from paid invoices and receipts.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Account Name</Label>
                      <Input placeholder="Quantix Technology Private Limited" {...txt("bankAccountName")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Bank Name</Label>
                      <Input placeholder="HDFC Bank" {...txt("bankName")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Account Number</Label>
                      <Input placeholder="XXXX XXXX XXXX 0001" {...txt("bankAccountNumber")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>IFSC Code</Label>
                      <Input placeholder="HDFC0000001" {...txt("bankIfsc")} />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label>UPI ID</Label>
                      <Input placeholder="quantix@hdfcbank" {...txt("bankUpiId")} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Invoice Footer */}
              <Card>
                <CardContent className="pt-5 pb-6 space-y-5">
                  <SectionHeader icon={<StickyNote className="h-4 w-4" />} title="Invoice Footer & Notes" />
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Footer Notes <span className="text-xs text-muted-foreground font-normal">(SAC/HSN codes, payment terms)</span></Label>
                      <Textarea
                        placeholder="SAC Code: 998314 — Software as a Service. Payment due within 15 days of invoice date."
                        rows={2}
                        {...txt("invoiceFooterNotes")}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Legal Disclaimer</Label>
                      <Textarea
                        placeholder="This is a computer generated invoice and does not require a physical signature."
                        rows={2}
                        {...txt("invoiceLegalDisclaimer")}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Default Invoice Notes</Label>
                      <Textarea
                        placeholder="Thank you for your business. For billing queries contact billing@quantixtechnology.in"
                        rows={2}
                        {...txt("invoiceDefaultNotes")}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Apply To */}
              <Card>
                <CardContent className="pt-5 pb-5">
                  <SectionHeader icon={<CheckCircle2 className="h-4 w-4" />} title="Applied To" />
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {["Tax Invoice", "Proforma Invoice", "Payment Receipt", "Credit Note", "Account Statement", "Payment Reminder"].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={() => handleSave("invoice")} disabled={saving} className="gap-2 min-w-[140px]">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Invoice Settings
                </Button>
              </div>
            </div>

            {/* Sticky preview */}
            <div className="xl:sticky xl:top-6">
              <Card>
                <CardContent className="pt-5 pb-5">
                  <InvoiceDocumentPreview s={settings} />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

      </Tabs>
    </div>
  )
}

// ─── Invoice Document Preview ─────────────────────────────────────────────────

function InvoiceDocumentPreview({ s }: { s: BrandSettings }) {
  const logoSrc = s.invoiceLogoUrl ?? s.salesLogoUrl ?? s.logoUrl
  const name    = s.invoiceLegalName || s.invoiceBusinessName || "Quantix Technology"
  const addr    = [s.invoiceCity, s.invoiceState].filter(Boolean).join(", ")
  const regs    = [
    s.companyPan   && `PAN: ${s.companyPan}`,
    s.companyMsme  && `MSME: ${s.companyMsme}`,
  ].filter(Boolean)
  const hasBanking = s.bankAccountNumber || s.bankIfsc || s.bankUpiId

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Invoice Preview</p>
      <div className="rounded-xl border border-border/40 overflow-hidden shadow-sm bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-[9px]">
        {/* Violet header */}
        <div className="h-1.5 w-full" style={{ background: "linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%)" }} />
        {/* Letterhead */}
        <div className="flex items-start justify-between px-3 pt-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <div className="space-y-0.5">
            {logoSrc
              ? <img src={logoSrc} alt="Invoice Logo" className="h-6 object-contain mb-1" />
              : <div className="h-5 w-14 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-1"><ImageIcon className="h-2.5 w-2.5 text-zinc-400" /></div>}
            <p className="font-bold text-[9px] text-zinc-800 dark:text-zinc-100 leading-tight">{name}</p>
            {addr && <p className="text-[8px] text-zinc-400 leading-tight">{addr}</p>}
            {regs.map((r) => <p key={r} className="text-[7.5px] text-zinc-400 leading-tight">{r}</p>)}
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black tracking-wider uppercase text-violet-600">TAX INVOICE</p>
            <p className="text-[8px] text-zinc-400">INV/2026/0001</p>
            <div className="mt-1 inline-block px-1.5 py-0.5 rounded text-[7.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200">PAYMENT DUE</div>
          </div>
        </div>
        {/* Bill from/to */}
        <div className="grid grid-cols-2 gap-2 px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <p className="text-[7.5px] text-zinc-400 uppercase tracking-wide mb-0.5">Bill From</p>
            <p className="font-semibold text-[8px] leading-tight">{name}</p>
            {s.invoiceEmail && <p className="text-[7.5px] text-zinc-400">{s.invoiceEmail}</p>}
          </div>
          <div>
            <p className="text-[7.5px] text-zinc-400 uppercase tracking-wide mb-0.5">Bill To</p>
            <p className="font-semibold text-[8px] leading-tight">Customer Business</p>
            <p className="text-[7.5px] text-zinc-400">customer@example.com</p>
          </div>
        </div>
        {/* Line items */}
        <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 space-y-1">
          <div className="flex justify-between text-[7.5px] text-zinc-400 uppercase tracking-wide">
            <span>Description</span><span>Amount</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-700 dark:text-zinc-300">SaaS Platform — Monthly</span>
            <span className="font-medium">₹8,475</span>
          </div>
          <div className="flex justify-between text-[8px] text-zinc-400">
            <span>GST 18%</span><span>₹1,525</span>
          </div>
          <div className="flex justify-between font-bold border-t border-zinc-100 dark:border-zinc-800 pt-1">
            <span>Total</span><span className="text-violet-600">₹10,000</span>
          </div>
        </div>
        {/* Banking (only if configured) */}
        {hasBanking && (
          <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
            <p className="text-[7.5px] text-zinc-400 uppercase tracking-wide mb-1">Bank Transfer Details</p>
            {s.bankAccountNumber && <p className="text-[8px]">A/C: {s.bankAccountNumber}</p>}
            {s.bankIfsc           && <p className="text-[8px]">IFSC: {s.bankIfsc}</p>}
            {s.bankUpiId          && <p className="text-[8px]">UPI: {s.bankUpiId}</p>}
          </div>
        )}
        {/* Footer */}
        <div className="px-3 py-2">
          {s.invoiceFooterNotes && <p className="text-[7.5px] text-zinc-400 leading-snug">{s.invoiceFooterNotes.slice(0, 80)}{s.invoiceFooterNotes.length > 80 ? "…" : ""}</p>}
          {s.invoiceLegalDisclaimer && <p className="text-[7px] text-zinc-300 dark:text-zinc-600 mt-0.5 italic">{s.invoiceLegalDisclaimer.slice(0, 80)}</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <Separator className="flex-1" />
    </div>
  )
}
