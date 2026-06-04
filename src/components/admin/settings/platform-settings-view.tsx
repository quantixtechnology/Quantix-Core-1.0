"use client"

import { useState, useEffect, useRef } from "react"
import { PageHeader } from "../shared/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Settings2, Building2, Palette, Receipt,
  Upload, X, RefreshCw, Save, CheckCircle2,
  Image as ImageIcon,
} from "lucide-react"
import { toast } from "sonner"
import { authFetch } from "@/lib/admin-fetch"
import { useAuthStore } from "@/stores/auth-store"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Settings {
  companyName:    string
  companyAddress: string
  companyEmail:   string
  companyPhone:   string
  companyWebsite: string
  companyGst:     string
  logoUrl:        string | null
  darkLogoUrl:    string | null
  faviconUrl:     string | null
  emailLogoUrl:   string | null
  primaryColor:   string
  secondaryColor: string
  accentColor:    string
  invoicePrefix:  string
  sacCode:        string
  gstRate:        number | string
  cgstRate:       number | string
  sgstRate:       number | string
}

const EMPTY: Settings = {
  companyName: "", companyAddress: "", companyEmail: "",
  companyPhone: "", companyWebsite: "", companyGst: "",
  logoUrl: null, darkLogoUrl: null, faviconUrl: null, emailLogoUrl: null,
  primaryColor: "#10B981", secondaryColor: "", accentColor: "",
  invoicePrefix: "QTX", sacCode: "998314",
  gstRate: 18, cgstRate: 9, sgstRate: 9,
}

type AssetField = "logoUrl" | "darkLogoUrl" | "faviconUrl" | "emailLogoUrl"

const ASSET_LABELS: Record<AssetField, { title: string; hint: string }> = {
  logoUrl:      { title: "Company Logo",  hint: "PNG, transparent background recommended" },
  darkLogoUrl:  { title: "Dark Logo",     hint: "Alternate version on dark backgrounds" },
  faviconUrl:   { title: "Favicon",       hint: "32×32 PNG or ICO" },
  emailLogoUrl: { title: "Email Logo",    hint: "Used in invoice email headers" },
}

// ── Logo upload card ──────────────────────────────────────────────────────────

function AssetCard({
  field, currentUrl, onUploaded, onDeleted, canEdit,
}: {
  field: AssetField
  currentUrl: string | null
  onUploaded: (url: string) => void
  onDeleted: () => void
  canEdit: boolean
}) {
  const [uploading, setUploading] = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { title, hint } = ASSET_LABELS[field]

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
      if (!json.success) throw new Error(json.error ?? "Upload failed")
      onUploaded(json.url)
      toast.success(`${title} uploaded`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
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
      if (!json.success) throw new Error(json.error ?? "Delete failed")
      onDeleted()
      toast.success(`${title} removed`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
      </div>

      {currentUrl ? (
        <div className="relative rounded-lg border bg-muted/30 flex items-center justify-center h-24 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUrl}
            alt={title}
            className="max-h-full max-w-full object-contain p-2"
            style={{ imageRendering: "auto" }}
          />
          {canEdit && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="absolute top-1 right-1 rounded-full bg-destructive/90 text-white p-0.5 hover:bg-destructive transition-colors"
              title="Remove"
            >
              {deleting
                ? <RefreshCw className="h-3 w-3 animate-spin" />
                : <X className="h-3 w-3" />}
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center h-24 text-muted-foreground">
          <ImageIcon className="h-6 w-6 mb-1 opacity-40" />
          <span className="text-[11px]">No image uploaded</span>
        </div>
      )}

      {canEdit && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
            className="hidden"
            onChange={handleFile}
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading
              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              : <Upload className="h-3.5 w-3.5" />}
            {currentUrl ? "Replace" : "Upload"}
          </Button>
        </>
      )}
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function PlatformSettingsView() {
  const { permissions } = useAuthStore()
  const canEdit = (permissions as string[]).includes("settings:edit")

  const [settings, setSettings] = useState<Settings>(EMPTY)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState<string | null>(null) // tab name being saved

  useEffect(() => {
    authFetch("/api/admin/platform-settings")
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          const d = json.data
          setSettings({
            companyName:    d.companyName    ?? "",
            companyAddress: d.companyAddress ?? "",
            companyEmail:   d.companyEmail   ?? "",
            companyPhone:   d.companyPhone   ?? "",
            companyWebsite: d.companyWebsite ?? "",
            companyGst:     d.companyGst     ?? "",
            logoUrl:        d.logoUrl        ?? null,
            darkLogoUrl:    d.darkLogoUrl    ?? null,
            faviconUrl:     d.faviconUrl     ?? null,
            emailLogoUrl:   d.emailLogoUrl   ?? null,
            primaryColor:   d.primaryColor   ?? "#10B981",
            secondaryColor: d.secondaryColor ?? "",
            accentColor:    d.accentColor    ?? "",
            invoicePrefix:  d.invoicePrefix  ?? "QTX",
            sacCode:        d.sacCode        ?? "998314",
            gstRate:        d.gstRate  ?? 18,
            cgstRate:       d.cgstRate ?? 9,
            sgstRate:       d.sgstRate ?? 9,
          })
        }
      })
      .catch(() => toast.error("Failed to load platform settings"))
      .finally(() => setLoading(false))
  }, [])

  const field = (key: keyof Settings) => ({
    value: String(settings[key] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setSettings(prev => ({ ...prev, [key]: e.target.value })),
    disabled: !canEdit || loading,
  })

  const save = async (tab: string, payload: Partial<Settings>) => {
    setSaving(tab)
    try {
      const res  = await authFetch("/api/admin/platform-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? "Save failed")
      toast.success("Settings saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(null)
    }
  }

  const SaveButton = ({ tab, payload }: { tab: string; payload: Partial<Settings> }) => (
    <div className="flex justify-end pt-2">
      <Button
        className="gap-2 text-xs"
        onClick={() => save(tab, payload)}
        disabled={!canEdit || loading || saving === tab}
      >
        {saving === tab
          ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          : <Save className="h-3.5 w-3.5" />}
        Save Changes
      </Button>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Platform Settings"
        description="Configure company details, branding assets, and billing defaults for all platform documents"
        icon={Settings2}
      />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mt-6 flex-1 min-h-0">
          <Tabs defaultValue="company" className="flex flex-col h-full gap-4">
            <TabsList className="w-full flex flex-nowrap gap-1 h-auto p-1 bg-muted/50 shrink-0">
              <TabsTrigger value="company"  className="gap-2 text-xs sm:text-sm flex-1">
                <Building2 className="h-3.5 w-3.5" /> Company Details
              </TabsTrigger>
              <TabsTrigger value="branding" className="gap-2 text-xs sm:text-sm flex-1">
                <Palette className="h-3.5 w-3.5" /> Branding
              </TabsTrigger>
              <TabsTrigger value="billing"  className="gap-2 text-xs sm:text-sm flex-1">
                <Receipt className="h-3.5 w-3.5" /> Billing Settings
              </TabsTrigger>
            </TabsList>

            {/* ── Company Details ─────────────────────────────────────── */}
            <TabsContent value="company" className="mt-0 flex-1 overflow-auto">
              <div className="rounded-xl border bg-card p-6 space-y-5 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Company Name</Label>
                    <Input {...field("companyName")} placeholder="Quantix Technology" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">GST Number</Label>
                    <Input {...field("companyGst")} placeholder="27AAAAA0000A1Z5" className="h-8 text-sm font-mono" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Company Address</Label>
                  <Input {...field("companyAddress")} placeholder="Bangalore, Karnataka, India" className="h-8 text-sm" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Email</Label>
                    <Input {...field("companyEmail")} type="email" placeholder="billing@quantixtechnology.in" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Phone</Label>
                    <Input {...field("companyPhone")} placeholder="+91 98765 43210" className="h-8 text-sm" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Website</Label>
                  <Input {...field("companyWebsite")} placeholder="https://quantixtechnology.in" className="h-8 text-sm" />
                </div>

                <SaveButton tab="company" payload={{
                  companyName: settings.companyName,
                  companyAddress: settings.companyAddress,
                  companyEmail: settings.companyEmail,
                  companyPhone: settings.companyPhone,
                  companyWebsite: settings.companyWebsite,
                  companyGst: settings.companyGst,
                }} />
              </div>
            </TabsContent>

            {/* ── Branding ────────────────────────────────────────────── */}
            <TabsContent value="branding" className="mt-0 flex-1 overflow-auto">
              <div className="space-y-6 max-w-3xl">

                {/* Logo grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {(["logoUrl", "darkLogoUrl", "faviconUrl", "emailLogoUrl"] as AssetField[]).map(f => (
                    <AssetCard
                      key={f}
                      field={f}
                      currentUrl={settings[f] as string | null}
                      canEdit={canEdit}
                      onUploaded={url => setSettings(prev => ({ ...prev, [f]: url }))}
                      onDeleted={() => setSettings(prev => ({ ...prev, [f]: null }))}
                    />
                  ))}
                </div>

                {/* Current logo preview strip */}
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Live Preview</p>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="rounded-xl px-4 py-2 bg-[#081028] flex items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/api/assets/logo" alt="Sidebar" style={{ height: 30 }} className="object-contain" />
                    </div>
                    <div className="rounded-xl px-4 py-2 bg-white border flex items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/api/assets/logo" alt="Light bg" style={{ height: 30 }} className="object-contain" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">Upload a new logo to see changes immediately (1 min cache)</p>
                  </div>
                </div>

                {/* Brand colors */}
                <div className="rounded-xl border bg-card p-5 space-y-4">
                  <p className="text-sm font-semibold">Brand Colors</p>
                  <div className="grid grid-cols-3 gap-4">
                    {(["primaryColor", "secondaryColor", "accentColor"] as const).map(k => (
                      <div key={k} className="space-y-1.5">
                        <Label className="text-xs font-semibold capitalize">{k.replace("Color", " Color")}</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={settings[k] || "#10B981"}
                            onChange={e => setSettings(prev => ({ ...prev, [k]: e.target.value }))}
                            disabled={!canEdit}
                            className="h-8 w-8 rounded border cursor-pointer p-0.5"
                          />
                          <Input
                            {...field(k)}
                            placeholder="#10B981"
                            className="h-8 text-xs font-mono flex-1"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <SaveButton tab="colors" payload={{
                    primaryColor: settings.primaryColor,
                    secondaryColor: settings.secondaryColor,
                    accentColor: settings.accentColor,
                  }} />
                </div>

                {!canEdit && (
                  <p className="text-xs text-muted-foreground">You have view-only access to branding settings.</p>
                )}
              </div>
            </TabsContent>

            {/* ── Billing Settings ────────────────────────────────────── */}
            <TabsContent value="billing" className="mt-0 flex-1 overflow-auto">
              <div className="rounded-xl border bg-card p-6 space-y-5 max-w-xl">

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Invoice Prefix</Label>
                    <Input {...field("invoicePrefix")} placeholder="QTX" className="h-8 text-sm font-mono" />
                    <p className="text-[10px] text-muted-foreground">Generates: QTX/2026-27/0001</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">SAC Code</Label>
                    <Input {...field("sacCode")} placeholder="998314" className="h-8 text-sm font-mono" />
                    <p className="text-[10px] text-muted-foreground">HSN/SAC for IT services</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-xs font-semibold">GST Configuration</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { k: "gstRate",  label: "GST Rate (%)",  hint: "Total" },
                      { k: "cgstRate", label: "CGST Rate (%)", hint: "Intra-state" },
                      { k: "sgstRate", label: "SGST Rate (%)", hint: "Intra-state" },
                    ] as { k: keyof Settings; label: string; hint: string }[]).map(({ k, label, hint }) => (
                      <div key={k} className="space-y-1.5">
                        <Label className="text-xs font-semibold">{label}</Label>
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          max="28"
                          {...field(k)}
                          className="h-8 text-sm"
                        />
                        <p className="text-[10px] text-muted-foreground">{hint}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    GST rate changes apply to new invoices only. Existing billing records are unaffected.
                  </p>
                </div>

                <SaveButton tab="billing" payload={{
                  invoicePrefix: settings.invoicePrefix,
                  sacCode: settings.sacCode,
                  gstRate:  Number(settings.gstRate),
                  cgstRate: Number(settings.cgstRate),
                  sgstRate: Number(settings.sgstRate),
                }} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}
