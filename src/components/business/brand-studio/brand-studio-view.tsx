"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Palette, Save, RefreshCw, Smartphone, Eye, Layers, Type, Palette as ColorPalette, Layout, Square, Circle, Check } from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { PageHeader } from "@/components/admin/shared/page-header"
import { resolveImageUrl } from "@/lib/image-url"

interface BusinessBrandingData {
  primaryColor: string
  secondaryColor: string | null
  accentColor: string | null
  textColor: string | null
  backgroundColor: string | null
  logo: string | null
  favicon: string | null
  coverImage: string | null
  appIcon: string | null
  secondaryLogo: string | null
  watermarkLogo: string | null
  fontFamily: string | null
  headingStyle: string | null
  buttonStyle: string | null
  borderRadius: string
  darkMode: boolean
  customCss: string | null
  theme: string | null
  tagline: string | null
}

const PRESET_THEMES = [
  { value: "fresh-market", label: "Fresh Market", description: "Modern grocery layout" },
  { value: "modern-retail", label: "Modern Retail", description: "Clean, professional look" },
  { value: "blinkit-style", label: "Blinkit Style", description: "Quick commerce focused" },
  { value: "premium-store", label: "Premium Store", description: "Luxury shopping experience" },
  { value: "laundry-premium-dark", label: "Laundry Premium Dark", description: "Dark theme for laundry" },
  { value: "laundry-modern-light", label: "Laundry Modern Light", description: "Light theme for laundry" },
  { value: "laundry-luxury-gold", label: "Laundry Luxury Gold", description: "Premium gold theme" },
  { value: "laundry-express", label: "Laundry Express", description: "Fast service theme" },
  { value: "medical-blue", label: "Medical Blue", description: "Pharmacy clinical look" },
  { value: "clinical-white", label: "Clinical White", description: "Pharmacy clean design" },
  { value: "modern-pharmacy", label: "Modern Pharmacy", description: "Contemporary pharmacy" },
  { value: "restaurant-premium", label: "Restaurant Premium", description: "Fine dining theme" },
  { value: "dark-dining", label: "Dark Dining", description: "Night club restaurant" },
  { value: "cafe-modern", label: "Cafe Modern", description: "Casual cafe atmosphere" },
]

const defaultData: BusinessBrandingData = {
  primaryColor: "#10B981",
  secondaryColor: "",
  accentColor: "",
  textColor: "#1F2937",
  backgroundColor: "#FFFFFF",
  logo: "",
  favicon: "",
  coverImage: "",
  appIcon: "",
  secondaryLogo: "",
  watermarkLogo: "",
  fontFamily: "Inter",
  headingStyle: "modern",
  buttonStyle: "rounded",
  borderRadius: "8",
  darkMode: false,
  customCss: "",
  theme: "fresh-market",
  tagline: "",
}

export function BusinessBrandStudioView() {
  const { currentBusinessId } = useAdminStore()
  const { currentBusinessId: authBizId } = useAuthStore()
  const businessId = currentBusinessId || authBizId || ""

  const [data, setData] = useState<BusinessBrandingData>({ ...defaultData })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/business/${businessId}/brand-studio`, {
        headers: { "x-business-id": businessId },
      })
      const json = await res.json()
      if (json.success && json.data) {
        const b = json.data
        setData({
          primaryColor:   b.primaryColor   ?? defaultData.primaryColor,
          secondaryColor: b.secondaryColor ?? "",
          accentColor:    b.accentColor    ?? "",
          textColor:      b.textColor      ?? "",
          backgroundColor: b.backgroundColor ?? "",
          logo:           b.logo           ?? "",
          favicon:        b.favicon        ?? "",
          coverImage:     b.coverImage     ?? "",
          appIcon:        b.appIcon        ?? "",
          secondaryLogo:  b.secondaryLogo  ?? "",
          watermarkLogo:  b.watermarkLogo  ?? "",
          fontFamily:     b.fontFamily     ?? "",
          headingStyle:   b.headingStyle   ?? "",
          buttonStyle:    b.buttonStyle    ?? "",
          borderRadius:   b.borderRadius   ?? "8",
          darkMode:       b.darkMode       ?? false,
          customCss:      b.customCss      ?? "",
          theme:          b.theme          ?? "",
          tagline:        b.tagline        ?? "",
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
        textColor:      data.textColor      || null,
        backgroundColor: data.backgroundColor || null,
        logo:           data.logo           || null,
        favicon:        data.favicon        || null,
        coverImage:     data.coverImage     || null,
        appIcon:        data.appIcon        || null,
        secondaryLogo:  data.secondaryLogo  || null,
        watermarkLogo:  data.watermarkLogo  || null,
        fontFamily:     data.fontFamily     || null,
        headingStyle:   data.headingStyle   || null,
        buttonStyle:    data.buttonStyle    || null,
        customCss:      data.customCss      || null,
        theme:          data.theme          || null,
        tagline:        data.tagline        || null,
      }
      const res = await fetch(`/api/business/${businessId}/brand-studio`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-business-id": businessId },
        body: JSON.stringify(payload),
      })
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, key: keyof BusinessBrandingData, type = "text", placeholder = "") => (
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

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Brand Studio"
        description="Customize your tenant's website, customer app, and overall branding"
        icon={Palette}
        action={
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Save className="h-4 w-4" />}
            {saved ? "Saved!" : "Save Changes"}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Theme Selector */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Theme Library</CardTitle>
            <CardDescription className="text-xs">Choose a pre-built theme for your business</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Select Theme</Label>
              <Select
                value={data.theme || ""}
                onValueChange={v => setData(d => ({ ...d, theme: v }))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select a theme..." />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_THEMES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center gap-2">
                        <Palette className="h-3 w-3" />
                        <span>{t.label}</span>
                        <span className="text-xs text-muted-foreground">({t.description})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Themes affect the overall layout, colors, and styling of your customer-facing website and app.
              </p>
            </div>

            {/* Theme Preview */}
            <div className="border rounded-lg p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded bg-white shadow-sm flex items-center justify-center">
                      {data.logo ? (
                        <img src={resolveImageUrl(data.logo)} alt="logo" className="h-6 w-6 object-contain" />
                      ) : (
                        <div className="h-6 w-6 rounded bg-emerald-600" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-medium">{data.tagline || "Business Name"}</div>
                      <div className="text-[10px] text-muted-foreground">Premium Services</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <div className="h-3 w-3 rounded-full bg-emerald-600" />
                    <div className="h-3 w-3 rounded-full bg-gray-300" />
                    <div className="h-3 w-3 rounded-full bg-gray-300" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium">Services</div>
                  <div className="grid grid-cols-2 gap-1">
                    <div className="h-6 rounded bg-white border border-gray-200 flex items-center justify-center">
                      <span className="text-[10px] text-gray-600">Wash & Fold</span>
                    </div>
                    <div className="h-6 rounded bg-white border border-gray-200 flex items-center justify-center">
                      <span className="text-[10px] text-gray-600">Dry Clean</span>
                    </div>
                    <div className="h-6 rounded bg-white border border-gray-200 flex items-center justify-center">
                      <span className="text-[10px] text-gray-600">Iron Only</span>
                    </div>
                    <div className="h-6 rounded bg-white border border-gray-200 flex items-center justify-center">
                      <span className="text-[10px] text-gray-600">Express</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium">Pricing</div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-16 rounded bg-emerald-600" />
                    <span className="text-[10px] text-gray-500">Starting from</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-muted-foreground">Schedule Pickup</div>
                    <div className="h-6 w-16 rounded bg-emerald-600 text-white text-[10px] flex items-center justify-center">
                      Book Now
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Brand Colors */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Brand Colors</CardTitle>
            <CardDescription className="text-xs">Primary, secondary, accent, text, and background colors</CardDescription>
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
            <div className="flex items-center gap-4">
              {field("Text Color", "textColor", "color")}
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">Text Hex</Label>
                <Input value={data.textColor ?? ""} onChange={e => setData(d => ({ ...d, textColor: e.target.value }))} placeholder="#1F2937" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              {field("Background Color", "backgroundColor", "color")}
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">Background Hex</Label>
                <Input value={data.backgroundColor ?? ""} onChange={e => setData(d => ({ ...d, backgroundColor: e.target.value }))} placeholder="#FFFFFF" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Brand Assets */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Brand Assets</CardTitle>
            <CardDescription className="text-xs">Upload logos, icons, and watermarks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {field("Logo URL", "logo", "url", "https://...")}
            {field("Secondary Logo URL", "secondaryLogo", "url", "https://...")}
            {field("Watermark Logo URL", "watermarkLogo", "url", "https://...")}
            {field("Favicon URL", "favicon", "url", "https://...")}
            {field("Cover Image URL", "coverImage", "url", "https://...")}
            {field("App Icon URL", "appIcon", "url", "https://...")}
            <div className="flex items-center gap-3 pt-1">
              {data.logo && <img src={resolveImageUrl(data.logo)} alt="logo" className="h-10 w-10 object-contain rounded border" />}
              {data.secondaryLogo && <img src={resolveImageUrl(data.secondaryLogo)} alt="secondary logo" className="h-10 w-10 object-contain rounded border" />}
              {data.watermarkLogo && <img src={resolveImageUrl(data.watermarkLogo)} alt="watermark logo" className="h-10 w-10 object-contain rounded border" />}
              {data.appIcon && <img src={resolveImageUrl(data.appIcon)} alt="app icon" className="h-10 w-10 object-contain rounded border" />}
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
            <div className="space-y-1.5">
              <Label className="text-xs">Heading Style</Label>
              <Select
                value={data.headingStyle || ""}
                onValueChange={v => setData(d => ({ ...d, headingStyle: v }))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select heading style..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="modern">Modern</SelectItem>
                  <SelectItem value="classic">Classic</SelectItem>
                  <SelectItem value="elegant">Elegant</SelectItem>
                  <SelectItem value="minimal">Minimal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Button Style</Label>
              <Select
                value={data.buttonStyle || ""}
                onValueChange={v => setData(d => ({ ...d, buttonStyle: v }))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select button style..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rounded">Rounded</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="pill">Pill</SelectItem>
                </SelectContent>
              </Select>
            </div>
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

        {/* Business Info */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Business Information</CardTitle>
            <CardDescription className="text-xs">Basic business details for branding</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {field("Business Tagline", "tagline", "text", "e.g. Your trusted laundry partner")}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Reload
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Save className="h-4 w-4" />}
            {saved ? "Saved!" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  )
}