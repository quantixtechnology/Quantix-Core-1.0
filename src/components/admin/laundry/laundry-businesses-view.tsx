"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Plus, Building2, ChevronLeft, Pencil, Save, X, Settings2, Globe, Shield, Activity, ExternalLink, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { useToast } from "@/hooks/use-toast"
import { LaundryBusinessCreate } from "./laundry-business-create"

type LaundryBusiness = {
  id: string
  businessCode: string
  businessName: string
  legalName: string | null
  ownerName: string
  mobile: string
  email: string | null
  gstNumber: string | null
  logo: string | null
  favicon: string | null
  address: string | null
  plan: string
  status: string
  createdAt: string
  updatedAt: string
  _count?: { stores: number }
  stores?: LaundryStore[]
}

type LaundryStore = {
  id: string
  storeCode: string
  laundryBusinessId: string
  storeName: string
  storeType: string
  contactPerson: string | null
  mobile: string | null
  email: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  serviceRadiusKm: number | null
  createdAt: string
  updatedAt: string
}

const statusColors: Record<string, string> = {
  ONBOARDING: "bg-amber-100 text-amber-800",
  ACTIVE: "bg-green-100 text-green-800",
  SUSPENDED: "bg-red-100 text-red-800",
}

function BusinessListView({ onSelect }: { onSelect: (id: string) => void }) {
  const [businesses, setBusinesses] = useState<LaundryBusiness[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [planFilter, setPlanFilter] = useState("")

  const fetchBusinesses = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (statusFilter) params.set("status", statusFilter)
      if (planFilter) params.set("plan", planFilter)
      const res = await fetch(`/api/laundry/businesses?${params}`)
      if (res.ok) setBusinesses(await res.json())
    } catch (err) {
      console.error("Failed to fetch laundry businesses:", err)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, planFilter])

  useEffect(() => { fetchBusinesses() }, [fetchBusinesses])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Laundry Businesses</h1>
            <p className="text-sm text-gray-500">Manage laundry business accounts</p>
          </div>
        </div>
        <Button onClick={() => onSelect("create")}>
          <Plus className="mr-2 h-4 w-4" /> Create Business
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search by name, code, owner, or mobile..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ONBOARDING">Onboarding</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={v => setPlanFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Plans" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="STANDARD">Standard</SelectItem>
            <SelectItem value="PRO">Pro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business ID</TableHead>
                <TableHead>Business Name</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Stores</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">Loading...</TableCell></TableRow>
              ) : businesses.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Building2 className="h-8 w-8" />
                    <p>No laundry businesses found</p>
                    <Button variant="outline" size="sm" onClick={() => onSelect("create")}>Create your first business</Button>
                  </div>
                </TableCell></TableRow>
              ) : businesses.map(b => (
                <TableRow key={b.id} className="cursor-pointer hover:bg-gray-50" onClick={() => onSelect(b.id)}>
                  <TableCell className="font-mono text-xs">{b.businessCode}</TableCell>
                  <TableCell className="font-medium">{b.businessName}</TableCell>
                  <TableCell>{b.ownerName}</TableCell>
                  <TableCell><Badge variant="outline" className={b.plan === "PRO" ? "border-purple-300 text-purple-700" : ""}>{b.plan}</Badge></TableCell>
                  <TableCell>{b._count?.stores ?? 0}</TableCell>
                  <TableCell><Badge className={statusColors[b.status] || "bg-gray-100 text-gray-800"}>{b.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); onSelect(b.id) }}>View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

interface ScalingLimits {
  storesAllowed: number; storesUsed: number;
  processingCentersAllowed: number; processingCentersUsed: number;
  storeCapacityKg: number; processingCapacityKg: number;
  employeesAllowed: number; employeesUsed: number;
  deliveryStaffAllowed: number; deliveryStaffUsed: number;
  ordersPerDay: number; ordersPerMonthLimit: number; storageLimitMB: number;
}

const PROVISIONING_ITEM_LABELS: Record<string, string> = {
  workspace: "Workspace",
  domain: "Domain",
  ssl: "SSL",
  pwa: "PWA",
  customerApp: "Customer App",
  deliveryApp: "Delivery App",
  adminApp: "Admin App",
  apkBuild: "APK Build",
  playStore: "Play Store",
  monitoring: "Monitoring",
  backup: "Backup",
}

const PROVISIONING_STATUS_COLORS: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700 border-green-200",
  IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200",
  PENDING: "bg-gray-100 text-gray-600 border-gray-200",
  FAILED: "bg-red-100 text-red-700 border-red-200",
}

function SubscriptionBillingCard({ subscription }: { subscription: LaundrySubscriptionData | null }) {
  if (!subscription) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">No subscription record found.</CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            <span className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> 1. Subscription &amp; Billing</span>
          </CardTitle>
          <Badge className={subscription.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
            {subscription.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">Read-only. Subscription details are managed via the billing system.</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-gray-500">Plan Name</label>
            <p className="font-semibold text-lg">{subscription.plan}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">Plan Type</label>
            <p className="font-medium">{subscription.billingCycle === "MONTHLY" ? "Monthly" : subscription.billingCycle === "QUARTERLY" ? "Quarterly" : "Yearly"}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">Start Date</label>
            <p className="font-medium">{new Date(subscription.startDate || "").toLocaleDateString()}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">Renewal Date</label>
            <p className="font-medium">{new Date(subscription.renewalDate || "").toLocaleDateString()}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">Trial Expiry</label>
            <p className="font-medium">{subscription.trialExpiry ? new Date(subscription.trialExpiry).toLocaleDateString() : "—"}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">Last Payment</label>
            <p className="font-medium">{subscription.lastPaymentDate ? new Date(subscription.lastPaymentDate).toLocaleDateString() : "—"}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">Next Invoice</label>
            <p className="font-medium">{subscription.nextInvoiceDate ? new Date(subscription.nextInvoiceDate).toLocaleDateString() : "—"}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">Billing Cycle</label>
            <p className="font-medium capitalize">{subscription.billingCycle?.toLowerCase() || "—"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ProvisioningItemsCard({ items }: { items: { item: string; status: string; notes?: string | null }[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          <span className="flex items-center gap-2"><Activity className="h-4 w-4" /> 2. Platform Provisioning</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Per-item deployment status for Quantix operations team. Read-only.</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map(pi => (
            <div key={pi.item} className={`rounded-lg border p-3 ${PROVISIONING_STATUS_COLORS[pi.status] || "bg-gray-100"}`}>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${pi.status === "COMPLETED" ? "bg-green-500" : pi.status === "IN_PROGRESS" ? "bg-blue-500" : pi.status === "FAILED" ? "bg-red-500" : "bg-gray-400"}`} />
                <p className="text-xs font-medium">{PROVISIONING_ITEM_LABELS[pi.item] || pi.item}</p>
              </div>
              <p className="text-[10px] mt-1 font-medium">{pi.status.replace("_", " ")}</p>
              {pi.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{pi.notes}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}


function BrandingConfigCard({ config, onUpdate, onStatusUpdate, saving }: {
  config: BrandingConfigData | null
  onUpdate: (key: string, value: boolean) => void
  onStatusUpdate: (value: string) => void
  saving: boolean
}) {
  const BRANDING_FIELDS: { key: string; label: string; desc: string }[] = [
    { key: "logoUploaded", label: "Logo", desc: "Business logo uploaded" },
    { key: "faviconUploaded", label: "Favicon", desc: "Browser favicon uploaded" },
    { key: "brandColorsConfigured", label: "Brand Colors", desc: "Brand color scheme configured" },
    { key: "dedicatedApk", label: "Dedicated APK", desc: "Standalone branded APK generated" },
    { key: "customPackageName", label: "Custom Package Name", desc: "Custom Android package identifier" },
    { key: "customSplashScreen", label: "Custom Splash Screen", desc: "Branded splash screen on apps" },
    { key: "customAppIcon", label: "Custom App Icon", desc: "Custom app icon for branded apps" },
    { key: "playStorePublished", label: "Play Store Publishing", desc: "App published to Google Play Store" },
    { key: "customDomain", label: "Custom Domain", desc: "White-labeled custom domain" },
  ]
  const BRANDING_STATUSES = ["PENDING", "IN_PROGRESS", "APPROVED", "PUBLISHED"]
  const BRANDING_STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-700",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    APPROVED: "bg-green-100 text-green-700",
    PUBLISHED: "bg-purple-100 text-purple-700",
  }
  const currentStatus = config?.status || "PENDING"
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            <span className="flex items-center gap-2"><Globe className="h-4 w-4" /> 6. Branding &amp; White Label</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {BRANDING_STATUSES.map(s => (
              <button
                key={s}
                onClick={() => onStatusUpdate(s)}
                disabled={saving}
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-all ${
                  currentStatus === s
                    ? BRANDING_STATUS_COLORS[s] + " ring-1 ring-offset-1"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Quantix-controlled. Business owner cannot modify these settings.</p>
      </CardHeader>
      <CardContent className="space-y-1">
        {BRANDING_FIELDS.map(f => {
          const enabled = !!(config as Record<string, boolean | undefined>)?.[f.key]
          return (
            <div key={f.key} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/20 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{f.label}</span>
                  {enabled ? (
                    <Badge className="bg-green-100 text-green-700 text-[10px] h-4 px-1.5 shrink-0">Done</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground shrink-0">Not Set</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
              </div>
              <Switch checked={enabled} onCheckedChange={(v) => onUpdate(f.key, v)} disabled={saving} className="shrink-0 ml-3" />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ── Optional Product Features (per-tenant entitlements) ─────────────────────
// CRM is an optional Laundry OS capability. Backed by LaundryBusinessFeature
// (featureKey + enabled) and enforced server-side by every CRM API.
function ProductFeaturesCard({ businessId }: { businessId: string }) {
  const PRODUCT_FEATURES: { key: string; label: string; desc: string }[] = [
    { key: "CRM", label: "CRM", desc: "Sales CRM inside Laundry OS: Leads → Opportunities → configurable Sales Stages → Won/Lost. Shows a CRM section in the tenant's workspace sidebar." },
  ]
  const [features, setFeatures] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetch(`/api/laundry/businesses/${businessId}/features`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { featureKey: string; enabled: boolean }[]) => {
        const map: Record<string, boolean> = {}
        for (const row of rows) map[row.featureKey] = row.enabled
        setFeatures(map)
      })
      .catch(() => {})
  }, [businessId])

  const toggle = async (key: string, enabled: boolean) => {
    setSaving(true)
    try {
      const actor = useAuthStore.getState().user
      const res = await fetch(`/api/laundry/businesses/${businessId}/features`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features: [{ featureKey: key, enabled }], actorId: actor?.id, actorName: actor?.name }),
      })
      if (!res.ok) throw new Error()
      setFeatures((f) => ({ ...f, [key]: enabled }))
      toast({ title: "Updated", description: `${key} ${enabled ? "enabled" : "disabled"} for this business` })
    } catch {
      toast({ title: "Error", description: "Failed to update feature", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          <span className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Product Features</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Optional Laundry OS capabilities for this tenant. Quantix-controlled and enforced server-side.</p>
      </CardHeader>
      <CardContent className="space-y-1">
        {PRODUCT_FEATURES.map(f => {
          const enabled = !!features[f.key]
          return (
            <div key={f.key} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/20 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{f.label}</span>
                  {enabled ? (
                    <Badge className="bg-green-100 text-green-700 text-[10px] h-4 px-1.5 shrink-0">Enabled</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground shrink-0">Disabled</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
              </div>
              <Switch checked={enabled} onCheckedChange={(v) => toggle(f.key, v)} disabled={saving} className="shrink-0 ml-3" />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function PlatformProvisioningCard({ config, onUpdate, saving }: {
  config: PlatformProvisioningData | null
  onUpdate: (key: string, value: boolean) => void
  saving: boolean
}) {
  const PLATFORM_FIELDS: { key: string; label: string; desc: string }[] = [
    { key: "customerWebsite", label: "Customer Website", desc: "Public-facing business website" },
    { key: "customerPWA", label: "Customer PWA", desc: "Progressive Web App for customers" },
    { key: "androidCustomerApp", label: "Android Customer App", desc: "Native Android app for customers" },
    { key: "deliveryApp", label: "Delivery App", desc: "Dedicated delivery partner app" },
    { key: "adminApp", label: "Admin App", desc: "Administrative mobile application" },
    { key: "ssl", label: "SSL", desc: "SSL certificate provisioning" },
    { key: "cloudStorage", label: "Cloud Storage", desc: "Cloud-based file and image storage" },
    { key: "automatedBackups", label: "Automated Backups", desc: "Automated data backup scheduling" },
    { key: "pushNotifications", label: "Push Notifications", desc: "Push notification delivery infrastructure" },
  ]
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          <span className="flex items-center gap-2"><Globe className="h-4 w-4" /> 2. Platform Provisioning</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Quantix-controlled. Enable or disable platform features for this business.</p>
      </CardHeader>
      <CardContent className="space-y-1">
        {PLATFORM_FIELDS.map(f => {
          const enabled = !!(config as Record<string, boolean | undefined>)?.[f.key]
          return (
            <div key={f.key} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/20 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{f.label}</span>
                  {enabled ? (
                    <Badge className="bg-green-100 text-green-700 text-[10px] h-4 px-1.5 shrink-0">Provisioned</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground shrink-0">Not Provisioned</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
              </div>
              <Switch checked={enabled} onCheckedChange={(v) => onUpdate(f.key, v)} disabled={saving} className="shrink-0 ml-3" />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function OperationalConfigCard({ config, onUpdate, saving }: {
  config: OperationalConfigData | null
  onUpdate: (key: string, value: boolean) => void
  saving: boolean
}) {
  const OPERATIONAL_FIELDS: { key: string; label: string; desc: string }[] = [
    { key: "transportEnabled", label: "Transport Module", desc: "In-transit stages between locations. If disabled, workflow skips transport steps." },
    { key: "barcodeEnabled", label: "Barcode Module", desc: "Barcode tagging at processing. Controls all barcode/QR/item-level tracking." },
    { key: "homeDeliveryEnabled", label: "Home Delivery", desc: "Customer home delivery stages. Controls delivery OTP and route management." },
    { key: "ironingEnabled", label: "Ironing Module", desc: "Ironing stage in the processing workflow." },
  ]
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          <span className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> 5. Operational Configuration</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Toggle operational modules. These directly alter workflow behavior.</p>
      </CardHeader>
      <CardContent className="space-y-1">
        {OPERATIONAL_FIELDS.map(f => {
          const enabled = !!(config as Record<string, boolean | undefined>)?.[f.key]
          return (
            <div key={f.key} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/20 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{f.label}</span>
                  {enabled ? (
                    <Badge className="bg-green-100 text-green-700 text-[10px] h-4 px-1.5 shrink-0">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground shrink-0">Disabled</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
              </div>
              <Switch checked={enabled} onCheckedChange={(v) => onUpdate(f.key, v)} disabled={saving} className="shrink-0 ml-3" />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function WorkflowQualityCard({ config, onUpdate, saving }: {
  config: WorkflowQualityData | null
  onUpdate: (key: string, value: boolean) => void
  saving: boolean
}) {
  const WF_QUALITY_FIELDS: { key: string; label: string; desc: string }[] = [
    { key: "photoAudit", label: "Photo Audit", desc: "Photo-based audit at order entry and processing. Critical for dispute handling." },
    { key: "auditModule", label: "Audit Module", desc: "Detailed order and process audit trails for compliance." },
  ]
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          <span className="flex items-center gap-2"><Shield className="h-4 w-4" /> 4. Workflow &amp; Quality Controls</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Quantix-controlled. Quality and audit features for business operations.</p>
      </CardHeader>
      <CardContent className="space-y-1">
        {WF_QUALITY_FIELDS.map(f => {
          const enabled = !!(config as Record<string, boolean | undefined>)?.[f.key]
          return (
            <div key={f.key} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/20 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{f.label}</span>
                  {enabled ? (
                    <Badge className="bg-green-100 text-green-700 text-[10px] h-4 px-1.5 shrink-0">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground shrink-0">Disabled</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
              </div>
              <Switch checked={enabled} onCheckedChange={(v) => onUpdate(f.key, v)} disabled={saving} className="shrink-0 ml-3" />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function CapacityControlsCard({ limits, onUpdate, saving }: {
  limits: ScalingLimits | null
  onUpdate: (key: string, value: number) => void
  saving: boolean
}) {
  const CAPACITY_FIELDS: { key: keyof ScalingLimits; label: string; desc: string }[] = [
    { key: "storesAllowed", label: "Stores", desc: "Maximum retail store locations" },
    { key: "processingCentersAllowed", label: "Processing Centers", desc: "Maximum processing centers" },
    { key: "employeesAllowed", label: "Employees", desc: "Maximum staff employees" },
    { key: "deliveryStaffAllowed", label: "Delivery Staff", desc: "Maximum delivery personnel" },
    { key: "ordersPerMonthLimit", label: "Orders / Month", desc: "Monthly order processing capacity" },
    { key: "storageLimitMB", label: "Storage (MB)", desc: "Cloud storage allocation in megabytes" },
  ]
  if (!limits) return null
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          <span className="flex items-center gap-2"><Activity className="h-4 w-4" /> 6. Capacity Controls</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Numeric capacity limits — these control maximum throughput.</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CAPACITY_FIELDS.map(f => {
            const allowed = (limits[f.key] ?? 0) as number
            const usedKey = f.key.toString().includes("Allowed") ? (f.key.toString().replace("Allowed", "Used") as keyof ScalingLimits) : null
            const used = usedKey ? ((limits[usedKey] ?? 0) as number) : null
            const usagePercent = used !== null && allowed > 0 ? Math.round((used / allowed) * 100) : null
            return (
              <div key={f.key.toString()} className="rounded-lg border p-4">
                <label className="text-xs text-muted-foreground">{f.label}</label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    min={0}
                    value={allowed}
                    onChange={e => onUpdate(f.key.toString(), parseInt(e.target.value) || 0)}
                    disabled={saving}
                    className="h-8 w-24 text-sm"
                  />
                  {used !== null && <span className="text-xs text-muted-foreground">Used: {used}</span>}
                  {usagePercent !== null && (
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${usagePercent > 90 ? "bg-red-500" : usagePercent > 70 ? "bg-amber-500" : "bg-green-500"}`}
                        style={{ width: `${Math.min(usagePercent, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{f.desc}</p>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function AuditLogCard({ logs }: { logs: AuditLogEntry[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          <span className="flex items-center gap-2"><Activity className="h-4 w-4" /> 8. Audit Log</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Every licensing change made by Quantix is logged here.</p>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No audit records yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Date &amp; Time</TableHead>
                  <TableHead className="text-[10px]">Actor</TableHead>
                  <TableHead className="text-[10px]">Section</TableHead>
                  <TableHead className="text-[10px]">Field</TableHead>
                  <TableHead className="text-[10px]">Old Value</TableHead>
                  <TableHead className="text-[10px]">New Value</TableHead>
                  <TableHead className="text-[10px]">IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-[10px] font-mono">{new Date(log.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-[10px]">{log.actorName || "—"}</TableCell>
                    <TableCell className="text-[10px]">{log.section}</TableCell>
                    <TableCell className="text-[10px] font-mono">{log.field}</TableCell>
                    <TableCell className="text-[10px] max-w-[120px] truncate">{log.oldValue || "—"}</TableCell>
                    <TableCell className="text-[10px] max-w-[120px] truncate">{log.newValue || "—"}</TableCell>
                    <TableCell className="text-[10px] font-mono">{log.ipAddress || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function LicenseHealthCard({ licensing }: {
  licensing: {
    subscription: LaundrySubscriptionData | null
    provisioning: { item: string; status: string }[]
    scalingLimit: ScalingLimits | null
    brandingConfig: BrandingConfigData | null
    auditLogs: AuditLogEntry[]
    operationalConfig: OperationalConfigData | null
    platformProvisioning: PlatformProvisioningData | null
    workflowQuality: WorkflowQualityData | null
  }
}) {
  const subscription = licensing.subscription
  const totalProvisioning = licensing.platformProvisioning
    ? Object.entries(licensing.platformProvisioning).filter(([k]) => k !== "id" && k !== "businessId" && k !== "createdAt" && k !== "updatedAt").length
    : 0
  const completedProvisioning = licensing.platformProvisioning
    ? Object.entries(licensing.platformProvisioning).filter(([k, v]) => k !== "id" && k !== "businessId" && k !== "createdAt" && k !== "updatedAt" && v).length
    : 0

  const totalDeployment = licensing.provisioning.length
  const completedDeployment = licensing.provisioning.filter(p => p.status === "COMPLETED").length

  const storesUsed = licensing.scalingLimit?.storesUsed ?? 0
  const storesAllowed = licensing.scalingLimit?.storesAllowed ?? 1
  const employeesUsed = licensing.scalingLimit?.employeesUsed ?? 0
  const employeesAllowed = licensing.scalingLimit?.employeesAllowed ?? 1
  const ordersUsed = 0 // Would come from order count query
  const ordersAllowed = licensing.scalingLimit?.ordersPerMonthLimit ?? 500

  const lastLog = licensing.auditLogs?.[0]

  return (
    <Card className="border-sky-200 bg-gradient-to-br from-sky-50 to-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Activity className="h-4 w-4 text-sky-600" /> License Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="rounded-lg border bg-white p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Plan</p>
            <p className="text-lg font-bold">{subscription?.plan || "—"}</p>
            <p className="text-[10px] text-muted-foreground">Status: {subscription?.status || "—"}</p>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Provisioning</p>
            <p className="text-lg font-bold">{completedProvisioning}/{totalProvisioning}</p>
            <p className="text-[10px] text-muted-foreground">Platform features</p>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Branding</p>
            <p className="text-lg font-bold">{licensing.brandingConfig?.status || "PENDING"}</p>
            <p className="text-[10px] text-muted-foreground">{licensing.brandingConfig?.status === "PUBLISHED" ? "Published" : licensing.brandingConfig?.status === "APPROVED" ? "Approved" : licensing.brandingConfig?.status === "IN_PROGRESS" ? "In Progress" : "Pending"}</p>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Deployment</p>
            <p className="text-lg font-bold">{completedDeployment}/{totalDeployment}</p>
            <p className="text-[10px] text-muted-foreground">Infrastructure</p>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Capacity Usage</p>
            <div className="space-y-1 mt-1">
              <div className="flex items-center gap-1 text-[10px]">
                <span className="w-12 text-muted-foreground">Stores</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${(storesUsed / storesAllowed) > 0.9 ? "bg-red-500" : (storesUsed / storesAllowed) > 0.7 ? "bg-amber-500" : "bg-green-500"}`}
                    style={{ width: `${Math.min((storesUsed / storesAllowed) * 100, 100)}%` }} />
                </div>
                <span className="w-14 text-right text-muted-foreground">{storesUsed}/{storesAllowed}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px]">
                <span className="w-12 text-muted-foreground">Staff</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${(employeesUsed / employeesAllowed) > 0.9 ? "bg-red-500" : (employeesUsed / employeesAllowed) > 0.7 ? "bg-amber-500" : "bg-green-500"}`}
                    style={{ width: `${Math.min((employeesUsed / employeesAllowed) * 100, 100)}%` }} />
                </div>
                <span className="w-14 text-right text-muted-foreground">{employeesUsed}/{employeesAllowed}</span>
              </div>
            </div>
          </div>
        </div>
        {lastLog && (
          <p className="text-[10px] text-muted-foreground mt-3 pt-2 border-t">
            Last modified: {new Date(lastLog.createdAt).toLocaleString()} &middot; {lastLog.section} &middot; {lastLog.actorName || "Quantix Admin"}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Licensing data types
// ============================================================================

interface LaundrySubscriptionData {
  id?: string; businessId?: string; plan?: string; templatePreset?: string;
  billingCycle?: string; status?: string; startDate?: string; renewalDate?: string;
  trialExpiry?: string; lastPaymentDate?: string; nextInvoiceDate?: string;
  workspaceType?: string; businessCategory?: string;
}

interface PlatformProvisioningData {
  customerWebsite?: boolean; customerPWA?: boolean; androidCustomerApp?: boolean;
  deliveryApp?: boolean; adminApp?: boolean; ssl?: boolean;
  cloudStorage?: boolean; automatedBackups?: boolean; pushNotifications?: boolean;
}

interface WorkflowQualityData {
  photoAudit?: boolean; auditModule?: boolean;
}

interface BrandingConfigData {
  logoUploaded?: boolean; faviconUploaded?: boolean; brandColorsConfigured?: boolean;
  dedicatedApk?: boolean; customPackageName?: boolean; customSplashScreen?: boolean;
  customAppIcon?: boolean; playStorePublished?: boolean; customDomain?: boolean;
  status?: string;
}

interface AuditLogEntry {
  id: string; businessId: string; actorId?: string | null; actorName?: string | null;
  section: string; field: string; oldValue?: string | null; newValue?: string | null;
  ipAddress?: string | null; createdAt: string;
}

interface OperationalConfigData {
  transportEnabled?: boolean; barcodeEnabled?: boolean; homeDeliveryEnabled?: boolean;
  ironingEnabled?: boolean;
}

function BusinessProfile({ businessId, onBack }: { businessId: string; onBack: () => void }) {
  const [business, setBusiness] = useState<LaundryBusiness | null>(null)
  const [licensing, setLicensing] = useState<{
    subscription: LaundrySubscriptionData | null
    provisioning: { item: string; status: string; notes?: string | null }[]
    operationalConfig: OperationalConfigData | null
    workflowQuality: WorkflowQualityData | null
    scalingLimit: ScalingLimits | null
    brandingConfig: BrandingConfigData | null
    platformProvisioning: PlatformProvisioningData | null
    auditLogs: AuditLogEntry[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const { toast } = useToast()

  const [editForm, setEditForm] = useState({
    businessName: "", legalName: "", ownerName: "", mobile: "", email: "",
    gstNumber: "", address: "", plan: "", status: "",
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [bizRes, licRes] = await Promise.all([
        fetch(`/api/laundry/businesses/${businessId}`),
        fetch(`/api/laundry/businesses/${businessId}/licensing`),
      ])
      if (bizRes.ok) {
        const d = await bizRes.json()
        setBusiness(d)
        setEditForm({
          businessName: d.businessName, legalName: d.legalName || "", ownerName: d.ownerName,
          mobile: d.mobile, email: d.email || "", gstNumber: d.gstNumber || "",
          address: d.address || "", plan: d.plan, status: d.status,
        })
      }
      if (licRes.ok) setLicensing(await licRes.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [businessId])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSaveOverview = async () => {
    try {
      const res = await fetch(`/api/laundry/businesses/${businessId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        toast({ title: "Saved", description: "Business details updated" })
        setEditing(false)
        fetchData()
      } else {
        toast({ title: "Error", description: "Failed to update", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" })
    }
  }

  const handleLicensingUpdate = async (section: string, data: Record<string, unknown>) => {
    if (!licensing) return
    setSaving(true)
    try {
      const res = await fetch(`/api/laundry/businesses/${businessId}/licensing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [section]: data }),
      })
      if (res.ok) {
        const updated = await res.json()
        setLicensing(updated)
        toast({ title: "Updated", description: "Licensing updated" })
      } else {
        toast({ title: "Error", description: "Failed to update", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleOperationalToggle = (key: string, value: boolean) =>
    handleLicensingUpdate("operationalConfig", { [key]: value })

  const handleWorkflowQualityToggle = (key: string, value: boolean) =>
    handleLicensingUpdate("workflowQuality", { [key]: value })

  const handleBrandingToggle = (key: string, value: boolean) =>
    handleLicensingUpdate("brandingConfig", { [key]: value })

  const handleBrandingStatus = (value: string) =>
    handleLicensingUpdate("brandingConfig", { status: value })

  const handlePlatformProvisioningToggle = (key: string, value: boolean) =>
    handleLicensingUpdate("platformProvisioning", { [key]: value })

  const handleScalingUpdate = (key: string, value: number) =>
    handleLicensingUpdate("scalingLimit", { [key]: value })

  const launchLaundryOS = async () => {
    setSaving(true)
    try {
      const role = useAuthStore.getState().currentRole
      const isPlatformAdmin = role === "QUANTIX_SUPER_ADMIN" || role === "PLATFORM_ADMIN"

      if (isPlatformAdmin) {
        console.log("[launchLaundryOS] Platform admin — creating support session")
        const res = await fetch("/api/laundry/support-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ laundryBusinessId: businessId }),
        })

        if (!res.ok) {
          const err = await res.json()
          toast({ title: "Error", description: err.error || "Failed to launch Laundry OS", variant: "destructive" })
          return
        }

        const data = await res.json()
        console.log("[launchLaundryOS] Support session created:", data)

        useAdminStore.getState().setSupportMode({
          platformAdminId: data.supportSession.platformAdminId,
          platformAdminName: data.supportSession.platformAdminName,
          platformAdminRole: data.supportSession.platformAdminRole,
          laundryBusinessId: data.supportSession.laundryBusinessId,
          laundryBusinessName: data.supportSession.laundryBusinessName,
        })

        window.location.href = "/"
      } else {
        console.log("[launchLaundryOS] Laundry user — opening own workspace")
        window.location.href = "/"
      }
    } catch (err) {
      console.error("[launchLaundryOS] Exception:", err)
      toast({ title: "Error", description: "Failed to launch Laundry OS", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="py-8 text-center text-gray-400">Loading...</div>
  if (!business) return <div className="py-8 text-center text-gray-400">Business not found</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ChevronLeft className="h-5 w-5" /></Button>
          {business.logo ? (
            <img src={business.logo} alt="" className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
              <Building2 className="h-5 w-5" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{business.businessName}</h1>
            <p className="text-sm text-gray-500 font-mono">{business.businessCode}</p>
          </div>
          <Badge className={statusColors[business.status] || ""}>{business.status}</Badge>
          <Badge variant="outline" className={business.plan === "PRO" ? "border-purple-300 text-purple-700" : ""}>{business.plan}</Badge>
        </div>
        <Button onClick={launchLaundryOS} className="gap-1.5">
          <ExternalLink className="h-4 w-4" /> Launch Laundry OS
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview" className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="licensing" className="flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Licensing</TabsTrigger>
          <TabsTrigger value="technical" className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Technical</TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">Business Information</h3>
                {editing ? (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5 mr-1" /> Cancel</Button>
                    <Button size="sm" onClick={handleSaveOverview}><Save className="h-3.5 w-3.5 mr-1" /> Save</Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                )}
              </div>
              {editing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Business Name</Label>
                    <Input value={editForm.businessName} onChange={e => setEditForm(p => ({ ...p, businessName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Legal Name</Label>
                    <Input value={editForm.legalName} onChange={e => setEditForm(p => ({ ...p, legalName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Owner Name</Label>
                    <Input value={editForm.ownerName} onChange={e => setEditForm(p => ({ ...p, ownerName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Mobile</Label>
                    <Input value={editForm.mobile} onChange={e => setEditForm(p => ({ ...p, mobile: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <Input value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">GST Number</Label>
                    <Input value={editForm.gstNumber} onChange={e => setEditForm(p => ({ ...p, gstNumber: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Plan</Label>
                    <Select value={editForm.plan} onValueChange={v => setEditForm(p => ({ ...p, plan: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STANDARD">Standard</SelectItem>
                        <SelectItem value="PRO">Pro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={editForm.status} onValueChange={v => setEditForm(p => ({ ...p, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ONBOARDING">Onboarding</SelectItem>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="SUSPENDED">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Address</Label>
                    <Textarea value={editForm.address} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="text-xs text-gray-500">Business Name</label><p className="font-medium">{business.businessName}</p></div>
                  <div><label className="text-xs text-gray-500">Legal Name</label><p className="font-medium">{business.legalName || "—"}</p></div>
                  <div><label className="text-xs text-gray-500">Owner Name</label><p className="font-medium">{business.ownerName}</p></div>
                  <div><label className="text-xs text-gray-500">Mobile</label><p className="font-medium">{business.mobile}</p></div>
                  <div><label className="text-xs text-gray-500">Email</label><p className="font-medium">{business.email || "—"}</p></div>
                  <div><label className="text-xs text-gray-500">GST Number</label><p className="font-medium">{business.gstNumber || "—"}</p></div>
                  <div><label className="text-xs text-gray-500">Address</label><p className="font-medium">{business.address || "—"}</p></div>
                  <div><label className="text-xs text-gray-500">Plan</label><p className="font-medium">{business.plan}</p></div>
                  <div><label className="text-xs text-gray-500">Created</label><p className="font-medium">{new Date(business.createdAt).toLocaleDateString()}</p></div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Subscription Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-500">Plan</label>
                  <p className="font-medium">{business.plan}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Status</label>
                  <p className="font-medium capitalize">{business.status.toLowerCase()}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Registered</label>
                  <p className="font-medium">{new Date(business.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Branding Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-500">Logo</label>
                  <p className="font-medium">{business.logo ? "Uploaded" : "Not set"}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Favicon</label>
                  <p className="font-medium">{business.favicon ? "Uploaded" : "Not set"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="licensing" className="mt-4">
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Business Provisioning &amp; Capability Control Center. Only Quantix can modify these settings.
            </p>

            {!licensing ? (
              <div className="py-8 text-center text-gray-400">Loading licensing data...</div>
            ) : (
              <>
                <LicenseHealthCard licensing={licensing} />

                <SubscriptionBillingCard subscription={licensing.subscription} />

                <ProductFeaturesCard businessId={businessId} />

                <PlatformProvisioningCard
                  config={licensing.platformProvisioning}
                  onUpdate={handlePlatformProvisioningToggle}
                  saving={saving}
                />

                <OperationalConfigCard
                  config={licensing.operationalConfig}
                  onUpdate={handleOperationalToggle}
                  saving={saving}
                />

                <WorkflowQualityCard
                  config={licensing.workflowQuality}
                  onUpdate={handleWorkflowQualityToggle}
                  saving={saving}
                />

                <CapacityControlsCard
                  limits={licensing.scalingLimit}
                  onUpdate={handleScalingUpdate}
                  saving={saving}
                />

                <BrandingConfigCard
                  config={licensing.brandingConfig}
                  onUpdate={handleBrandingToggle}
                  onStatusUpdate={handleBrandingStatus}
                  saving={saving}
                />

                <ProvisioningItemsCard items={licensing.provisioning} />

                <AuditLogCard logs={licensing.auditLogs} />
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="technical" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Technical</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500">Domain</label>
                  <p className="font-medium">—</p>
                  <p className="text-[10px] text-muted-foreground">Configure via Business Settings</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">APK Build</label>
                  <p className="font-medium">—</p>
                  <p className="text-[10px] text-muted-foreground">Generate from Mobile Provisioning</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">PWA</label>
                  <p className="font-medium">Active</p>
                  <p className="text-[10px] text-muted-foreground">Progressive Web App enabled by default</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">SSL</label>
                  <p className="font-medium">Active</p>
                  <p className="text-[10px] text-muted-foreground">Auto-managed via platform</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="mt-4">
            <CardContent className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Build & Storage</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-500">Build Version</label>
                  <p className="font-medium">1.0.0</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Storage Usage</label>
                  <p className="font-medium">—</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Workspace</label>
                  <Button variant="outline" size="sm" className="mt-1" onClick={launchLaundryOS}>
                    <ExternalLink className="h-3 w-3 mr-1" /> Open
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Activity Logs</h3>
              <p className="text-sm text-muted-foreground">Audit logs will be available in a future update.</p>
            </CardContent>
          </Card>
          <Card className="mt-4">
            <CardContent className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Login Logs</h3>
              <p className="text-sm text-muted-foreground">Login history will be available in a future update.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function LaundryBusinessesView() {
  const { setActivePage } = useAdminStore()
  const [view, setView] = useState<"list" | "create" | "profile">("list")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const handleSelect = (idOrAction: string) => {
    if (idOrAction === "create") {
      setView("create")
    } else {
      setSelectedId(idOrAction)
      setView("profile")
    }
  }

  if (view === "create") {
    return <LaundryBusinessCreate onComplete={() => { setView("list"); setSelectedId(null) }} onCancel={() => setView("list")} />
  }

  if (view === "profile" && selectedId) {
    return <BusinessProfile businessId={selectedId} onBack={() => { setView("list"); setSelectedId(null) }} />
  }

  return <BusinessListView onSelect={handleSelect} />
}
