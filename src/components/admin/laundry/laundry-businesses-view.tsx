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
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAdminStore } from "@/stores/admin-store"
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

// ============================================================================
// Categories definition for the licensing feature matrix
// ============================================================================
interface LicenseCategory {
  id: string
  title: string
  icon: string
  features: { key: string; label: string; description: string }[]
}

const LICENSE_CATEGORIES: LicenseCategory[] = [
  {
    id: "infrastructure", title: "Infrastructure", icon: "Globe",
    features: [
      { key: "customerWebsite", label: "Customer Website", description: "Public-facing business website" },
      { key: "customerPWA", label: "Customer PWA", description: "Progressive Web App for customers" },
      { key: "androidCustomerApp", label: "Android Customer App", description: "Native Android app for customers" },
      { key: "deliveryApp", label: "Delivery App", description: "Dedicated delivery partner app" },
      { key: "adminApp", label: "Admin App", description: "Administrative mobile application" },
      { key: "customDomain", label: "Custom Domain", description: "Custom domain for the business" },
      { key: "ssl", label: "SSL", description: "SSL certificate provisioning" },
      { key: "cloudStorage", label: "Cloud Storage", description: "Cloud-based file and image storage" },
      { key: "automatedBackups", label: "Automated Backups", description: "Automated data backup scheduling" },
      { key: "pushNotifications", label: "Push Notifications", description: "Push notification delivery infrastructure" },
    ],
  },
  {
    id: "operational", title: "Operational Modules", icon: "Settings2",
    features: [
      { key: "transportModule", label: "Transport Module", description: "In-transit stages and tracking between locations" },
      { key: "barcodeModule", label: "Barcode Module", description: "Barcode tagging and scanning at processing" },
      { key: "homeDeliveryModule", label: "Home Delivery Module", description: "Delivery stages for customer home delivery" },
      { key: "ironingModule", label: "Ironing Module", description: "Ironing stage in the processing workflow" },
      { key: "pickupRequests", label: "Pickup Requests", description: "Customer pickup request scheduling" },
      { key: "deliveryManagement", label: "Delivery Management", description: "Delivery fleet and dispatch management" },
      { key: "routeManagement", label: "Route Management", description: "Optimized route planning for deliveries" },
      { key: "auditModule", label: "Audit Module", description: "Detailed order and process audit trails" },
    ],
  },
  {
    id: "workflow", title: "Workflow Modules", icon: "MapPin",
    features: [
      { key: "photoAudit", label: "Photo Audit", description: "Photo-based audit at order and processing entry" },
      { key: "qrOrderLabels", label: "QR Order Labels", description: "QR-coded labels on customer orders" },
      { key: "barcodeGarmentTracking", label: "Barcode Garment Tracking", description: "Individual garment tracking via barcode" },
      { key: "itemLevelTracking", label: "Item Level Tracking", description: "Track each item through the entire workflow" },
      { key: "processingChecklists", label: "Processing Checklists", description: "Checklist-driven processing workflow" },
      { key: "qualityControl", label: "Quality Control", description: "QC checkpoints throughout processing" },
      { key: "dispatchVerification", label: "Dispatch Verification", description: "Verified dispatch before shipping" },
      { key: "deliveryOTP", label: "Delivery OTP", description: "OTP-based delivery confirmation" },
    ],
  },
  {
    id: "payment", title: "Payment Modules", icon: "CreditCard",
    features: [
      { key: "cashCollection", label: "Cash Collection", description: "Cash payment collection at store or delivery" },
      { key: "upiPayments", label: "UPI Payments", description: "UPI-based digital payments" },
      { key: "razorpay", label: "Razorpay", description: "Razorpay payment gateway integration" },
      { key: "phonePe", label: "PhonePe", description: "PhonePe payment gateway integration" },
      { key: "advancePayment", label: "Advance Payment", description: "Pre-payment before service" },
      { key: "partialPayment", label: "Partial Payment", description: "Partial payment at order placement" },
      { key: "corporateBilling", label: "Corporate Billing", description: "Bulk billing for corporate accounts" },
      { key: "creditAccounts", label: "Credit Accounts", description: "Credit-based accounts for trusted customers" },
    ],
  },
  {
    id: "engagement", title: "Customer Engagement", icon: "Users",
    features: [
      { key: "membershipModule", label: "Membership Module", description: "Customer membership plans with recurring billing" },
      { key: "loyaltyModule", label: "Loyalty Module", description: "Points-based loyalty and reward system" },
      { key: "referralProgram", label: "Referral Program", description: "Customer referral and incentive program" },
      { key: "coupons", label: "Coupons", description: "Discount coupons and promotional offers" },
      { key: "walletSystem", label: "Wallet System", description: "Digital wallet for store credit and refunds" },
      { key: "giftCards", label: "Gift Cards", description: "Digital and physical gift card system" },
    ],
  },
  {
    id: "communication", title: "Communication Modules", icon: "Shield",
    features: [
      { key: "smsNotifications", label: "SMS Notifications", description: "SMS-based order updates and alerts" },
      { key: "whatsappNotifications", label: "WhatsApp Notifications", description: "WhatsApp messaging for order communication" },
      { key: "emailNotifications", label: "Email Notifications", description: "Email-based order confirmations and receipts" },
      { key: "pushNotificationsModule", label: "Push Notifications", description: "In-app push notification delivery" },
      { key: "marketingCampaigns", label: "Marketing Campaigns", description: "Bulk marketing and promotional campaigns" },
    ],
  },
  {
    id: "reporting", title: "Reporting Modules", icon: "BarChart3",
    features: [
      { key: "basicReports", label: "Basic Reports", description: "Standard daily and monthly business reports" },
      { key: "advancedReports", label: "Advanced Reports", description: "Custom report builder and detailed analytics" },
      { key: "storeAnalytics", label: "Store Analytics", description: "Per-store performance and metrics" },
      { key: "processingAnalytics", label: "Processing Analytics", description: "Processing center throughput and efficiency" },
      { key: "employeeAnalytics", label: "Employee Analytics", description: "Staff productivity and performance metrics" },
      { key: "revenueAnalytics", label: "Revenue Analytics", description: "Revenue tracking and financial dashboards" },
    ],
  },
  {
    id: "whiteLabel", title: "White Label Modules", icon: "Shield",
    features: [
      { key: "dedicatedApk", label: "Dedicated APK", description: "Standalone branded APK for the business" },
      { key: "customPackageName", label: "Custom Package Name", description: "Custom Android package identifier" },
      { key: "customSplashScreen", label: "Custom Splash Screen", description: "Branded splash screen on mobile apps" },
      { key: "customAppIcon", label: "Custom App Icon", description: "Custom app icon for branded apps" },
      { key: "playStorePublishing", label: "Play Store Publishing", description: "Publish branded app to Google Play Store" },
      { key: "customDomainWL", label: "Custom Domain", description: "White-labeled custom domain" },
    ],
  },
]

const SCALING_FIELDS: { key: keyof ScalingLimits; label: string; description: string }[] = [
  { key: "storesAllowed", label: "Stores Allowed", description: "Maximum number of retail store locations" },
  { key: "processingCentersAllowed", label: "Processing Centers Allowed", description: "Maximum number of processing centers" },
  { key: "employeesAllowed", label: "Employees Allowed", description: "Maximum number of staff employees" },
  { key: "deliveryStaffAllowed", label: "Delivery Staff Allowed", description: "Maximum number of delivery personnel" },
  { key: "ordersPerMonthLimit", label: "Orders Per Month", description: "Monthly order processing capacity" },
  { key: "storageLimitMB", label: "Storage Limit (MB)", description: "Cloud storage allocation in megabytes" },
]

interface ScalingLimits {
  storesAllowed: number; storesUsed: number;
  processingCentersAllowed: number; processingCentersUsed: number;
  employeesAllowed: number; employeesUsed: number;
  deliveryStaffAllowed: number; deliveryStaffUsed: number;
  ordersPerMonthLimit: number; storageLimitMB: number;
}

const PROVISIONING_FIELDS: { key: string; label: string }[] = [
  { key: "workspaceCreated", label: "Workspace Created" },
  { key: "sslConfigured", label: "SSL Configured" },
  { key: "pwaGenerated", label: "PWA Generated" },
  { key: "androidApkGenerated", label: "Android APK Generated" },
  { key: "domainMapped", label: "Domain Mapped" },
  { key: "playStorePublished", label: "Play Store Published" },
  { key: "backupEnabled", label: "Backup Enabled" },
  { key: "monitoringEnabled", label: "Monitoring Enabled" },
]

function LicensingSubscriptionCard({ subscription }: { subscription: LaundrySubscription | null }) {
  if (!subscription) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">No subscription record found.</CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Subscription</h3>
          <Badge className={subscription.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
            {subscription.status}
          </Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-gray-500">Plan</label>
            <p className="font-semibold text-lg">{subscription.plan}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">Billing Cycle</label>
            <p className="font-medium capitalize">{subscription.billingCycle.toLowerCase()}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">Start Date</label>
            <p className="font-medium">{new Date(subscription.startDate).toLocaleDateString()}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">Renewal Date</label>
            <p className="font-medium">{new Date(subscription.renewalDate).toLocaleDateString()}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">Workspace Type</label>
            <p className="font-medium">{subscription.workspaceType}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">Category</label>
            <p className="font-medium">{subscription.businessCategory}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function FeatureCategoryCard({ category, license, onToggle, saving }: {
  category: LicenseCategory
  license: Record<string, boolean>
  onToggle: (key: string, value: boolean) => void
  saving: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {category.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {category.features.map(f => {
          const enabled = !!license[f.key]
          return (
            <div key={f.key} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/20 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{f.label}</span>
                  {enabled ? (
                    <Badge className="bg-green-100 text-green-700 text-[10px] h-4 px-1.5 shrink-0">Licensed</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground shrink-0">Not Licensed</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
              </div>
              <Switch checked={enabled} onCheckedChange={(v) => onToggle(f.key, v)} disabled={saving} className="shrink-0 ml-3" />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function ScalingLimitsCard({ limits, onUpdate, saving }: {
  limits: ScalingLimits
  onUpdate: (key: string, value: number) => void
  saving: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Scaling Limits</CardTitle>
        <p className="text-xs text-muted-foreground">Set numeric usage limits for this business. These are NOT toggles — they control maximum capacity.</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SCALING_FIELDS.map(f => {
            const allowed = limits[f.key] ?? 0
            const usedKey = f.key.replace("Allowed", "Used") as keyof ScalingLimits
            const used = (limits[usedKey] ?? 0) as number
            const usagePercent = allowed > 0 ? Math.round((used / allowed) * 100) : 0
            return (
              <div key={f.key} className="rounded-lg border p-4">
                <label className="text-xs text-muted-foreground">{f.label}</label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    min={0}
                    value={allowed}
                    onChange={e => onUpdate(f.key, parseInt(e.target.value) || 0)}
                    disabled={saving}
                    className="h-8 w-24 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">Used: {used}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${usagePercent > 90 ? "bg-red-500" : usagePercent > 70 ? "bg-amber-500" : "bg-green-500"}`}
                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{f.description}</p>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function ProvisioningStatusCard({ provisioning }: { provisioning: Record<string, boolean> }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Provisioning Status</CardTitle>
        <p className="text-xs text-muted-foreground">Internal status for Quantix operations team. Read-only.</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PROVISIONING_FIELDS.map(f => {
            const done = !!provisioning[f.key]
            return (
              <div key={f.key} className={`flex items-center gap-2 rounded-lg border p-3 ${done ? "bg-green-50 border-green-200" : "bg-muted/30"}`}>
                <div className={`h-2 w-2 rounded-full ${done ? "bg-green-500" : "bg-gray-300"}`} />
                <div>
                  <p className="text-xs font-medium">{f.label}</p>
                  <p className="text-[10px] text-muted-foreground">{done ? "Completed" : "Pending"}</p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Licensing data types
// ============================================================================
interface LaundrySubscriptionData {
  id?: string; businessId?: string; plan?: string; billingCycle?: string;
  status?: string; startDate?: string; renewalDate?: string;
  workspaceType?: string; businessCategory?: string;
}

interface ProvisioningMap {
  workspaceCreated?: boolean; sslConfigured?: boolean; pwaGenerated?: boolean;
  androidApkGenerated?: boolean; domainMapped?: boolean; playStorePublished?: boolean;
  backupEnabled?: boolean; monitoringEnabled?: boolean;
}

function BusinessProfile({ businessId, onBack }: { businessId: string; onBack: () => void }) {
  const [business, setBusiness] = useState<LaundryBusiness | null>(null)
  const [licensing, setLicensing] = useState<{
    subscription: LaundrySubscriptionData | null
    license: Record<string, boolean>
    scalingLimit: ScalingLimits
    provisioningStatus: ProvisioningMap
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

  const handleFeatureToggle = async (key: string, value: boolean) => {
    if (!licensing) return
    setSaving(true)
    try {
      const res = await fetch(`/api/laundry/businesses/${businessId}/licensing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license: { [key]: value } }),
      })
      if (res.ok) {
        const updated = await res.json()
        setLicensing(updated)
        toast({ title: "Updated", description: `Feature ${value ? "enabled" : "disabled"}` })
      } else {
        toast({ title: "Error", description: "Failed to update", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleScalingUpdate = async (key: string, value: number) => {
    if (!licensing) return
    setSaving(true)
    try {
      const res = await fetch(`/api/laundry/businesses/${businessId}/licensing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scalingLimit: { [key]: value } }),
      })
      if (res.ok) {
        const updated = await res.json()
        setLicensing(updated)
        toast({ title: "Updated", description: "Scaling limit updated" })
      } else {
        toast({ title: "Error", description: "Failed to update", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const openWorkspace = async () => {
    const res = await fetch(`/api/laundry/businesses/${businessId}`)
    if (!res.ok) return
    const biz = await res.json()
    if (biz.platformBusinessId) {
      window.location.href = `/api/auth/impersonate?businessId=${biz.platformBusinessId}`
    } else {
      toast({ title: "Error", description: "No platform business linked", variant: "destructive" })
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
        <Button onClick={openWorkspace} className="gap-1.5">
          <ExternalLink className="h-4 w-4" /> Open Laundry Workspace
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
              Configure licensing for this business. These settings control which features, modules, and capacity limits
              are available to the business owner. Only Quantix can modify these settings.
            </p>

            {!licensing ? (
              <div className="py-8 text-center text-gray-400">Loading licensing data...</div>
            ) : (
              <>
                <LicensingSubscriptionCard subscription={licensing.subscription} />

                {LICENSE_CATEGORIES.map(cat => (
                  <FeatureCategoryCard
                    key={cat.id}
                    category={cat}
                    license={licensing.license}
                    onToggle={handleFeatureToggle}
                    saving={saving}
                  />
                ))}

                <ScalingLimitsCard
                  limits={licensing.scalingLimit}
                  onUpdate={handleScalingUpdate}
                  saving={saving}
                />

                <ProvisioningStatusCard provisioning={licensing.provisioningStatus} />
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
                  <Button variant="outline" size="sm" className="mt-1" onClick={openWorkspace}>
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
