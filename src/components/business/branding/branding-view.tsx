"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader2, Palette, Save, RefreshCw } from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { PageHeader } from "@/components/admin/shared/page-header"
import { resolveImageUrl } from "@/lib/image-url"

interface BrandingData {
  primaryColor: string
  secondaryColor: string | null
  accentColor: string | null
  logo: string | null
  favicon: string | null
  coverImage: string | null
  appIcon: string | null
  fontFamily: string | null
  borderRadius: string
  darkMode: boolean
  customCss: string | null
}

const defaults: BrandingData = {
  primaryColor: "#10B981", secondaryColor: "", accentColor: "", logo: "",
  favicon: "", coverImage: "", appIcon: "", fontFamily: "", borderRadius: "8",
  darkMode: false, customCss: "",
}

export function BrandingView() {
  const { currentBusinessId } = useAdminStore()
  const { currentBusinessId: authBizId } = useAuthStore()
  const businessId = currentBusinessId || authBizId || ""

  const [data, setData] = useState<BrandingData>({ ...defaults })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/core/businesses/${businessId}/branding`, {
        headers: { "x-business-id": businessId },
      })
      const json = await res.json()
      if (json.success && json.data) {
        const b = json.data
        setData({
          primaryColor:   b.primaryColor   ?? defaults.primaryColor,
          secondaryColor: b.secondaryColor ?? "",
          accentColor:    b.accentColor    ?? "",
          logo:           b.logo           ?? "",
          favicon:        b.favicon        ?? "",
          coverImage:     b.coverImage     ?? "",
          appIcon:        b.appIcon        ?? "",
          fontFamily:     b.fontFamily     ?? "",
          borderRadius:   b.borderRadius   ?? "8",
          darkMode:       b.darkMode       ?? false,
          customCss:      b.customCss      ?? "",
        })
      }
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        ...data,
        secondaryColor: data.secondaryColor || null,
        accentColor:    data.accentColor    || null,
        logo:           data.logo           || null,
        favicon:        data.favicon        || null,
        coverImage:     data.coverImage     || null,
        appIcon:        data.appIcon        || null,
        fontFamily:     data.fontFamily     || null,
        customCss:      data.customCss      || null,
      }
      const res = await fetch(`/api/core/businesses/${businessId}/branding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-business-id": businessId },
        body: JSON.stringify(payload),
      })
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, key: keyof BrandingData, type = "text", placeholder = "") => (
    <div className="space-y-1.5" key={key}>
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        placeholder={placeholder}
        value={String(data[key] ?? "")}
        onChange={e => setData(d => ({ ...d, [key]: e.target.value }))}
        className={type === "color" ? "h-9 w-20 cursor-pointer p-1" : ""}
      />
    </div>
  )

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branding"
        description="Customize colors, logos, and appearance"
        icon={Palette}
        action={
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saved ? "Saved!" : "Save Changes"}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Colors */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Brand Colors</CardTitle>
            <CardDescription className="text-xs">Used across Customer App, Website, and Admin interfaces</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              {field("Primary Color", "primaryColor", "color")}
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">Primary Hex</Label>
                <Input value={data.primaryColor} onChange={e => setData(d => ({ ...d, primaryColor: e.target.value }))} placeholder="#10B981" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              {field("Secondary Color", "secondaryColor", "color")}
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">Secondary Hex</Label>
                <Input value={data.secondaryColor ?? ""} onChange={e => setData(d => ({ ...d, secondaryColor: e.target.value }))} placeholder="#6B7280" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              {field("Accent Color", "accentColor", "color")}
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">Accent Hex</Label>
                <Input value={data.accentColor ?? ""} onChange={e => setData(d => ({ ...d, accentColor: e.target.value }))} placeholder="#F59E0B" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assets */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Brand Assets</CardTitle>
            <CardDescription className="text-xs">Image URLs for logos and icons</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {field("Logo URL", "logo", "url", "https://...")}
            {field("Favicon URL", "favicon", "url", "https://...")}
            {field("Cover Image URL", "coverImage", "url", "https://...")}
            {field("App Icon URL", "appIcon", "url", "https://...")}
            <div className="flex items-center gap-3 pt-1">
              {data.logo && <img src={resolveImageUrl(data.logo)} alt="logo" className="h-10 w-10 object-contain rounded border" />}
              {data.appIcon && <img src={resolveImageUrl(data.appIcon)} alt="icon" className="h-10 w-10 object-contain rounded border" />}
            </div>
          </CardContent>
        </Card>

        {/* Typography & Layout */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Typography & Layout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {field("Font Family", "fontFamily", "text", "e.g. Inter, Poppins")}
            {field("Border Radius (px)", "borderRadius", "text", "8")}
            <div className="flex items-center justify-between pt-1">
              <div>
                <Label className="text-sm">Dark Mode Default</Label>
                <p className="text-xs text-muted-foreground">Enable dark mode by default for customer app</p>
              </div>
              <Switch checked={data.darkMode} onCheckedChange={v => setData(d => ({ ...d, darkMode: v }))} />
            </div>
          </CardContent>
        </Card>

        {/* Custom CSS */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Custom CSS</CardTitle>
            <CardDescription className="text-xs">Advanced style overrides for the customer web app</CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              className="w-full h-32 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder=":root { --brand-color: #10B981; }"
              value={data.customCss ?? ""}
              onChange={e => setData(d => ({ ...d, customCss: e.target.value }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Reload
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saved ? "Saved!" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  )
}
