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
// Feature toggle key labels for the licensing matrix
// ============================================================================
const FEATURE_LICENSES: { key: string; label: string; description: string; category: string }[] = [
  { key: "transportEnabled",           label: "Transport Module",         description: "In-transit stages between store and processing",          category: "Core" },
  { key: "barcodeTaggingEnabled",      label: "Barcode Module",          description: "Barcode tagging and scanning at processing",             category: "Core" },
  { key: "ironingEnabled",             label: "Ironing Module",          description: "Ironing stage in the processing workflow",                category: "Core" },
  { key: "homeDeliveryEnabled",        label: "Home Delivery Module",    description: "Delivery stages for customer home delivery",              category: "Core" },
  { key: "photoAuditEnabled",          label: "Photo Audit",            description: "Photo-based audit at order and processing entry",         category: "Features" },
  { key: "preServicePayment",          label: "Pre-Service Payment",     description: "Require payment before service",                          category: "Features" },
  { key: "postServicePayment",         label: "Post-Service Payment",    description: "Payment collection after service completion",             category: "Features" },
  { key: "qrOrderLabels",              label: "QR Order Labels",         description: "QR-coded labels on customer orders",                      category: "Features" },
  { key: "barcodeGarmentTracking",     label: "Barcode Garment Tracking", description: "Individual garment tracking via barcode",                category: "Features" },
  { key: "multiStoreEnabled",          label: "Multi Store",             description: "Multiple store locations under one business",            category: "Scaling" },
  { key: "multiProcessingEnabled",     label: "Multi Processing Center", description: "Multiple processing centers for distributed operations",  category: "Scaling" },
  { key: "employeeManagementEnabled",  label: "Employee Management",     description: "Staff role and shift management",                         category: "Scaling" },
  { key: "membershipEnabled",          label: "Membership Module",       description: "Customer membership plans",                               category: "Growth" },
  { key: "loyaltyEnabled",             label: "Loyalty Module",          description: "Points-based loyalty and rewards",                        category: "Growth" },
  { key: "whatsappIntegrationEnabled", label: "WhatsApp Integration",    description: "WhatsApp messaging for orders and notifications",         category: "Integrations" },
  { key: "smsIntegrationEnabled",      label: "SMS Integration",         description: "SMS messaging for order updates and alerts",              category: "Integrations" },
  { key: "advancedReportsEnabled",     label: "Advanced Reports",        description: "Detailed analytics and custom report builder",            category: "Growth" },
]

function FeatureLicensingTab({ business, onToggle, saving }: {
  business: { id: string } & Record<string, boolean | string | null | number | undefined>
  onToggle: (key: string, value: boolean) => void
  saving: boolean
}) {
  const categories = [...new Set(FEATURE_LICENSES.map(f => f.category))]

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Toggle feature licensing for this business. These settings control which modules are available to the business owner.
        Business owners cannot modify these settings.
      </p>
      {categories.map(cat => (
        <Card key={cat}>
          <CardContent className="p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{cat}</h4>
            <div className="space-y-2">
              {FEATURE_LICENSES.filter(f => f.category === cat).map(f => {
                const enabled = !!(business as Record<string, boolean | string | null | undefined>)[f.key]
                return (
                  <div key={f.key} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{f.label}</span>
                        {enabled ? (
                          <Badge className="bg-green-100 text-green-700 text-[10px] h-4 px-1.5">Licensed</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">Not Licensed</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(v) => onToggle(f.key, v)}
                      disabled={saving}
                    />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function BusinessProfile({ businessId, onBack }: { businessId: string; onBack: () => void }) {
  const [business, setBusiness] = useState<LaundryBusiness | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const { toast } = useToast()

  const [editForm, setEditForm] = useState({
    businessName: "", legalName: "", ownerName: "", mobile: "", email: "",
    gstNumber: "", address: "", plan: "", status: "",
  })

  const fetchBusiness = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/laundry/businesses/${businessId}`)
      if (res.ok) {
        const d = await res.json()
        setBusiness(d)
        setEditForm({
          businessName: d.businessName, legalName: d.legalName || "", ownerName: d.ownerName,
          mobile: d.mobile, email: d.email || "", gstNumber: d.gstNumber || "",
          address: d.address || "", plan: d.plan, status: d.status,
        })
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [businessId])

  useEffect(() => { fetchBusiness() }, [fetchBusiness])

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
        fetchBusiness()
      } else {
        toast({ title: "Error", description: "Failed to update", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" })
    }
  }

  const handleFeatureToggle = async (key: string, value: boolean) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/laundry/businesses/${businessId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      })
      if (res.ok) {
        fetchBusiness()
        toast({ title: "Updated", description: `${key} ${value ? "enabled" : "disabled"}` })
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
          <FeatureLicensingTab business={business} onToggle={handleFeatureToggle} saving={saving} />
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
