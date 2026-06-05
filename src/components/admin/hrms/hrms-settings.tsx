"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Building2, Save, Upload, Image as ImageIcon } from "lucide-react"
import { toast } from "sonner"

interface HrmsSettingsData {
  id?: string
  businessId: string
  companyName?: string
  logo?: string
  registeredAddress?: string
  hrContact?: string
  authorizedSignatory?: string
  signatureImage?: string
  pan?: string
  gstNumber?: string
}

export function HrmsSettingsView() {
  const [settings, setSettings] = useState<HrmsSettingsData>({ businessId: "" })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/admin/hrms/settings")
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data) setSettings(j.data)
        else setSettings({ businessId: "" })
      })
      .catch(() => setSettings({ businessId: "" }))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!settings.businessId.trim()) {
      toast.error("Business ID is required — enter your Quantix Business ID")
      return
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">HRMS Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure branding used on Offer Letters, Commission Slips, and Payslips.
            This logo is separate from the platform logo.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save Settings"}
        </Button>
      </div>

      {/* Organisation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" /> Organisation
          </CardTitle>
          <CardDescription>
            Business ID links HRMS data to your Quantix tenant. Find it in Businesses → detail panel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="businessId">Business ID <span className="text-destructive">*</span></Label>
              <Input id="businessId" placeholder="clxxx…" {...field("businessId")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="companyName">Company Name</Label>
              <Input id="companyName" placeholder="Quantix Technology Pvt. Ltd." {...field("companyName")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="registeredAddress">Registered Address</Label>
            <Textarea id="registeredAddress" rows={3} placeholder="Full registered address…" {...field("registeredAddress")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pan">PAN</Label>
              <Input id="pan" placeholder="AAACX0000X" {...field("pan")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gstNumber">GST Number</Label>
              <Input id="gstNumber" placeholder="27AAACX0000X1ZX" {...field("gstNumber")} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HR Contact & Signatory */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            HR Contact &amp; Signatory
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="hrContact">HR Contact (Name / Email / Phone)</Label>
            <Input id="hrContact" placeholder="hr@quantix.in · +91 98xxx xxxxx" {...field("hrContact")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="authorizedSignatory">Authorized Signatory</Label>
            <Input id="authorizedSignatory" placeholder="Full name and designation" {...field("authorizedSignatory")} />
          </div>
        </CardContent>
      </Card>

      {/* Logo & Signature */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="h-4 w-4" /> Logos &amp; Signature
          </CardTitle>
          <CardDescription>
            Paste hosted image URLs. Use the Media Manager or upload to your CDN first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="logo">HRMS Logo URL</Label>
            <div className="flex gap-2">
              <Input id="logo" placeholder="https://…/hrms-logo.png" {...field("logo")} />
              {settings.logo && (
                <img src={settings.logo} alt="HRMS logo" className="h-10 w-10 object-contain rounded border" />
              )}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Upload className="h-3 w-3" /> Used on Offer Letters, Commission Slips, Payslips, and Experience Letters only.
            </p>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="signatureImage">Signature Image URL</Label>
            <div className="flex gap-2">
              <Input id="signatureImage" placeholder="https://…/signature.png" {...field("signatureImage")} />
              {settings.signatureImage && (
                <img src={settings.signatureImage} alt="Signature" className="h-10 w-20 object-contain rounded border" />
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
