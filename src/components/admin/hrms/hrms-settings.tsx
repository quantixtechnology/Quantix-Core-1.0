"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Building2, Save, Image as ImageIcon, Phone, UserCheck } from "lucide-react"
import { toast } from "sonner"

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
  logo?: string
}

export function HrmsSettingsView() {
  const [settings, setSettings] = useState<HrmsSettingsData>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/admin/hrms/settings")
      .then((r) => r.json())
      .then((j) => { if (j.success && j.data) setSettings(j.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/hrms/settings", {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    )
  }

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
            HRMS settings are used for Quantix internal employee documents including Offer Letters,
            Commission Slips, Payslips, Appointment Letters, Experience Letters and other HR records.
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
            Printed on all Quantix HR documents — Offer Letters, Commission Slips, Payslips and Experience Letters.
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
            <ImageIcon className="h-4 w-4" /> Logos &amp; Signature Image
          </CardTitle>
          <CardDescription>
            This HRMS logo is independent from the platform logo, invoice logo, and quote logo.
            It is used only on employee-facing HR documents.
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
            <p className="text-xs text-muted-foreground">
              Used on Offer Letters, Commission Slips, Payslips and Experience Letters only.
            </p>
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
            <p className="text-xs text-muted-foreground">
              Printed below the Authorized Signatory name on all HR documents.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
