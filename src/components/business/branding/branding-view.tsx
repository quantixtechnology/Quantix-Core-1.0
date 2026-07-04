"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Palette, Save, RefreshCw, Smartphone } from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { PageHeader } from "@/components/admin/shared/page-header"
import { LaundryImageUpload } from "@/components/laundry/views/pricing/laundry-image-upload"
import { type PwaAppearance, PWA_APPEARANCE_DEFAULTS } from "@/lib/pwa-appearance"

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

  // PWA Appearance state
  const [pwaData, setPwaData] = useState<PwaAppearance>({ ...PWA_APPEARANCE_DEFAULTS })
  const [pwaSaving, setPwaSaving] = useState(false)
  const [pwaSaved,  setPwaSaved]  = useState(false)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const [brandingRes, pwaRes] = await Promise.all([
        fetch(`/api/core/businesses/${businessId}/branding`, {
          headers: { "x-business-id": businessId },
        }),
        fetch(`/api/core/businesses/${businessId}/pwa-appearance`, {
          headers: { "x-business-id": businessId },
        }),
      ])
      const brandingJson = await brandingRes.json()
      if (brandingJson.success && brandingJson.data) {
        const b = brandingJson.data
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
      const pwaJson = await pwaRes.json()
      if (pwaJson.success && pwaJson.data) {
        setPwaData({ ...PWA_APPEARANCE_DEFAULTS, ...pwaJson.data })
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

  const handleSavePwa = async () => {
    setPwaSaving(true)
    try {
      const res = await fetch(`/api/core/businesses/${businessId}/pwa-appearance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-business-id": businessId },
        body: JSON.stringify(pwaData),
      })
      if (res.ok) { setPwaSaved(true); setTimeout(() => setPwaSaved(false), 2000) }
    } finally {
      setPwaSaving(false)
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

        {/* Assets — upload controls (admins never type a storage URL) */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Brand Assets</CardTitle>
            <CardDescription className="text-xs">Upload your logo, favicon and icons — shown across your website and app.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Business Logo</Label>
              <LaundryImageUpload value={data.logo} businessId={businessId} folder="logos" objectFit="contain"
                allowed={["image/png", "image/jpeg", "image/webp", "image/svg+xml"]}
                helper="PNG, JPEG or WebP. Transparent PNG recommended."
                formatMsg="Unsupported format. Use PNG, JPEG, WebP or SVG."
                onChange={url => setData(d => ({ ...d, logo: url ?? "" }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Favicon</Label>
              <LaundryImageUpload value={data.favicon} businessId={businessId} folder="favicons" objectFit="contain" aspect="aspect-square"
                allowed={["image/png", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"]}
                helper="PNG, ICO or WebP. Square image recommended."
                formatMsg="Unsupported format. Use PNG, ICO or WebP."
                onChange={url => setData(d => ({ ...d, favicon: url ?? "" }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">App Icon</Label>
              <LaundryImageUpload value={data.appIcon} businessId={businessId} folder="app-icons" objectFit="contain" aspect="aspect-square"
                allowed={["image/png", "image/webp"]}
                helper="PNG or WebP. Square, 512×512 recommended."
                formatMsg="Unsupported format. Use PNG or WebP."
                onChange={url => setData(d => ({ ...d, appIcon: url ?? "" }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cover Image</Label>
              <LaundryImageUpload value={data.coverImage} businessId={businessId} folder="covers"
                helper="JPEG, PNG or WebP. Wide 16:9 banner."
                onChange={url => setData(d => ({ ...d, coverImage: url ?? "" }))} />
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

      {/* ── PWA Appearance ─────────────────────────────────────────────────── */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <div>
                <CardTitle className="text-sm">PWA Appearance</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Applied only to the installed PWA / Customer App. Does not affect the desktop website or mobile browser.
                </CardDescription>
              </div>
            </div>
            <Button size="sm" onClick={handleSavePwa} disabled={pwaSaving} className="gap-1.5 shrink-0">
              {pwaSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {pwaSaved ? "Saved!" : "Save"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 sm:grid-cols-3">
            {/* Header Theme */}
            <div className="space-y-1.5">
              <Label className="text-xs">Header Theme</Label>
              <Select
                value={pwaData.headerTheme}
                onValueChange={v => setPwaData(d => ({ ...d, headerTheme: v as PwaAppearance["headerTheme"] }))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="white">White (Default)</SelectItem>
                  <SelectItem value="brandTint">Brand Tint</SelectItem>
                  <SelectItem value="brandColor">Brand Color</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {pwaData.headerTheme === "white"      && "Pure white app bar."}
                {pwaData.headerTheme === "brandTint"  && "Soft brand color wash (5–6% opacity)."}
                {pwaData.headerTheme === "brandColor" && "Full brand color background with white text."}
              </p>
            </div>

            {/* Category Style */}
            <div className="space-y-1.5">
              <Label className="text-xs">Category Style</Label>
              <Select
                value={pwaData.categoryStyle}
                onValueChange={v => setPwaData(d => ({ ...d, categoryStyle: v as PwaAppearance["categoryStyle"] }))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rounded">Rounded</SelectItem>
                  <SelectItem value="circle">Circle</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {pwaData.categoryStyle === "rounded" && "Modern rounded-square category tiles."}
                {pwaData.categoryStyle === "circle"  && "Traditional circular category icons."}
              </p>
            </div>

            {/* Product Card Style */}
            <div className="space-y-1.5">
              <Label className="text-xs">Product Card Style</Label>
              <Select
                value={pwaData.productCardStyle}
                onValueChange={v => setPwaData(d => ({ ...d, productCardStyle: v as PwaAppearance["productCardStyle"] }))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="modern">Modern (Recommended)</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {pwaData.productCardStyle === "modern"   && "Larger image, outlined ADD button, modern spacing."}
                {pwaData.productCardStyle === "standard" && "Classic product card layout."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
