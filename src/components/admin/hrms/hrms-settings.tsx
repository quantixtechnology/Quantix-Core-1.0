"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Building2, Save, Image as ImageIcon, Phone, UserCheck, Palette } from "lucide-react"
import { toast } from "sonner"
import { authFetch } from "@/lib/admin-fetch"

interface HrmsSettingsData {
  id?: string
  companyName?: string
  registeredAddress?: string
  pan?: string
  gstNumber?: string
  cin?: string
  website?: string
  hrContactName?: string
  hrContactEmail?: string
  hrContactMobile?: string
  authorizedSignatory?: string
  authorizedSignatoryDesignation?: string
  signatureImage?: string
  stampImage?: string
  logo?: string
  primaryColor?: string
  secondaryColor?: string
}

function ColorField({ label, hint, value, onChange }: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#2563EB'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 rounded border cursor-pointer p-0.5 shrink-0"
          style={{ background: 'transparent' }}
        />
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#2563EB"
          className="font-mono w-32"
          maxLength={7}
        />
        <div
          className="h-9 w-9 rounded-md border shrink-0"
          style={{ background: value || '#2563EB' }}
        />
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}

const PRESET_COLORS = [
  { name: 'Royal Blue',  value: '#1E40AF' },
  { name: 'Emerald',     value: '#16A34A' },
  { name: 'Violet',      value: '#7C3AED' },
  { name: 'Gold',        value: '#B45309' },
  { name: 'Crimson',     value: '#DC2626' },
  { name: 'Slate',       value: '#334155' },
]

export function HrmsSettingsView() {
  const [settings, setSettings] = useState<HrmsSettingsData>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    authFetch("/api/admin/hrms/settings")
      .then((r) => r.json())
      .then((j) => { if (j.success && j.data) setSettings(j.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await authFetch("/api/admin/hrms/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setSettings(json.data)
      toast.success("HRMS settings saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof HrmsSettingsData) => ({
    value: (settings[key] as string) || "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setSettings((s) => ({ ...s, [key]: e.target.value })),
  })

  const setColor = (key: 'primaryColor' | 'secondaryColor') => (v: string) =>
    setSettings((s) => ({ ...s, [key]: v }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    )
  }

  const accent = settings.primaryColor || '#2563EB'
  const secondary = settings.secondaryColor || '#64748B'

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">HRMS Settings</h1>
            <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
              Quantix Internal
            </span>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
            HRMS settings are used for Quantix internal HR documents including Offer Letters,
            Commission Slips, Payslips, Appointment Letters and Experience Letters.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 shrink-0">
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save Settings"}
        </Button>
      </div>

      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" /> Company Information
          </CardTitle>
          <CardDescription>
            Printed on all Quantix HR documents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input id="companyName" placeholder="Quantix Technology Pvt. Ltd." {...field("companyName")} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="registeredAddress">Registered Address</Label>
              <Textarea id="registeredAddress" rows={3} placeholder="Full registered address…" {...field("registeredAddress")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pan">PAN Number</Label>
              <Input id="pan" placeholder="AAACX0000X" {...field("pan")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gstNumber">GST Number</Label>
              <Input id="gstNumber" placeholder="27AAACX0000X1ZX" {...field("gstNumber")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cin">CIN Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input id="cin" placeholder="U72900MH2020PTC000000" {...field("cin")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="website">Company Website</Label>
              <Input id="website" placeholder="https://quantix.in" {...field("website")} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HRMS Branding Colors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" /> HRMS Document Branding
          </CardTitle>
          <CardDescription>
            Colors applied to Offer Letters, Commission Slips, Payslips, and all HRMS documents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <ColorField
              label="Primary Color"
              hint="Header band, section titles, accent bar"
              value={settings.primaryColor || ''}
              onChange={setColor('primaryColor')}
            />
            <ColorField
              label="Secondary Color"
              hint="Sub-headings, dividers, metadata"
              value={settings.secondaryColor || ''}
              onChange={setColor('secondaryColor')}
            />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Quick presets</p>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  title={c.name}
                  onClick={() => setSettings((s) => ({ ...s, primaryColor: c.value }))}
                  className="h-7 w-7 rounded-full border-2 transition-all hover:scale-110"
                  style={{
                    background: c.value,
                    borderColor: settings.primaryColor === c.value ? '#000' : 'transparent',
                    outline: settings.primaryColor === c.value ? `2px solid ${c.value}` : 'none',
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Live preview */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Live preview</p>
            <div className="rounded-lg overflow-hidden border shadow-sm" style={{ fontFamily: 'Arial, sans-serif', fontSize: 11 }}>
              <div style={{ height: 4, background: accent }} />
              <div className="p-3 border-b flex items-center gap-2">
                <div style={{ width: 28, height: 28, borderRadius: 6, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 13 }}>Q</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{settings.companyName || 'QUANTIX TECHNOLOGY'}</div>
                  <div style={{ fontSize: 8, color: '#6b7280' }}>Official HR Document</div>
                </div>
              </div>
              <div style={{ padding: '6px 12px', background: accent }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>OFFER LETTER</span>
              </div>
              <div className="p-3 space-y-1.5">
                <div style={{ fontWeight: 700, fontSize: 10, color: secondary, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: `1.5px solid ${accent}20`, paddingBottom: 3 }}>APPOINTMENT DETAILS</div>
                <div style={{ fontSize: 9.5, color: '#374151' }}>Designation: <strong>Business Development Manager</strong></div>
                <div style={{ fontSize: 9.5, color: '#374151' }}>Department: <strong>Sales</strong></div>
              </div>
              <div style={{ padding: '6px 12px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: 8, color: '#9ca3af', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, color: '#64748b' }}>{settings.companyName || 'Quantix Technology'}</span>
                <span>CONFIDENTIAL</span>
              </div>
              <div style={{ height: 3, background: accent }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HR Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="h-4 w-4" /> HR Contact
          </CardTitle>
          <CardDescription>Printed on HR documents and used for employee queries.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="hrContactName">HR Contact Name</Label>
              <Input id="hrContactName" placeholder="Priya Sharma" {...field("hrContactName")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hrContactEmail">HR Email</Label>
              <Input id="hrContactEmail" type="email" placeholder="hr@quantix.in" {...field("hrContactEmail")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hrContactMobile">HR Mobile</Label>
              <Input id="hrContactMobile" type="tel" placeholder="+91 98xxx xxxxx" {...field("hrContactMobile")} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authorized Signatory */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-4 w-4" /> Authorized Signatory
          </CardTitle>
          <CardDescription>Name and designation printed below the signature on all HR documents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="authorizedSignatory">Full Name</Label>
              <Input id="authorizedSignatory" placeholder="Mukhtar Khan" {...field("authorizedSignatory")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="authorizedSignatoryDesignation">Designation</Label>
              <Input id="authorizedSignatoryDesignation" placeholder="Director / CEO" {...field("authorizedSignatoryDesignation")} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logos & Signature */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="h-4 w-4" /> Logo, Signature &amp; Stamp
          </CardTitle>
          <CardDescription>
            Used only on HRMS documents — independent from platform logo, invoice logo, and quote logo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="logo">HRMS Logo URL</Label>
            <div className="flex gap-2">
              <Input id="logo" placeholder="https://…/hrms-logo.png" {...field("logo")} />
              {settings.logo && (
                <img src={settings.logo} alt="HRMS logo" className="h-10 w-10 object-contain rounded border shrink-0" />
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="signatureImage">Signature Image URL</Label>
            <div className="flex gap-2">
              <Input id="signatureImage" placeholder="https://…/signature.png" {...field("signatureImage")} />
              {settings.signatureImage && (
                <img src={settings.signatureImage} alt="Signature" className="h-10 w-24 object-contain rounded border shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">Printed below the signatory name on all HR documents.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stampImage">Company Stamp URL</Label>
            <div className="flex gap-2">
              <Input id="stampImage" placeholder="https://…/stamp.png" {...field("stampImage")} />
              {settings.stampImage && (
                <img src={settings.stampImage} alt="Stamp" className="h-10 w-10 object-contain rounded border shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">Appears alongside the signature for official documents.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
