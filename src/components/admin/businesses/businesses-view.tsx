"use client"

import { useState, useMemo } from "react"
import { PageHeader } from "../shared/page-header"
import { StatusBadge, CurrencyBadge } from "../shared/status-badge"
import { EmptyState } from "../shared/empty-state"
import { businesses, clientSubscriptions, businessTypeConfig } from "@/components/dashboard/data"
import type { BusinessType, BusinessStatus, SubscriptionStatus } from "@/components/dashboard/data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import {
  Building2,
  Plus,
  Search,
  X,
  MapPin,
  Phone,
  Mail,
  IndianRupee,
  ShoppingCart,
  Users,
  Wifi,
  WifiOff,
  MoreHorizontal,
  Power,
  PowerOff,
  Puzzle,
  KeyRound,
  Ban,
  Store,
  CreditCard,
  CheckCircle2,
  LayoutGrid,
  ArrowUpRight,
  FileText,
  Globe,
} from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"

// ---------------------------------------------------------------------------
// Mock modules per business type
// ---------------------------------------------------------------------------
const mockModules: Record<BusinessType, string[]> = {
  GROCERY: ["POS", "Delivery", "Inventory", "Customer App", "Loyalty"],
  FOOD_DELIVERY: ["POS", "Delivery", "Menu Management", "Customer App", "Loyalty"],
  LAUNDRY: ["Pickup & Delivery", "Order Tracking", "Customer App", "Pricing Engine"],
  CAR_WASH: ["Subscription Plans", "Booking", "Customer App", "Payments"],
  PHARMACY: ["POS", "Delivery", "Inventory", "Prescription Upload", "Customer App"],
  HOME_SERVICES: ["Booking", "Service Catalog", "Customer App", "Payments", "Reviews"],
  ECOMMERCE: ["POS", "Delivery", "Inventory", "Customer App", "Discounts"],
  COSMETICS: ["POS", "Delivery", "Customer App", "Loyalty", "Reviews"],
  MEAT_DELIVERY: ["POS", "Delivery", "Inventory", "Customer App", "Subscription"],
  FURNITURE: ["Catalog", "Delivery", "Customer App", "EMI Payments", "Reviews"],
  DIRECTORY: ["Listings", "Reviews", "Customer App", "Payments", "SEO"],
}

// Mock store counts per business
const mockStoreCounts: Record<string, number> = {
  biz_1: 3,
  biz_2: 2,
  biz_3: 1,
  biz_4: 2,
  biz_5: 1,
  biz_6: 4,
  biz_7: 2,
  biz_8: 1,
  biz_9: 1,
  biz_10: 1,
  biz_11: 2,
}

// Mock email based on slug
const getMockEmail = (slug: string) => `admin@${slug}.in`

// Mock addresses
const mockAddresses: Record<string, string> = {
  biz_1: "42 Marine Drive, Colaba, Mumbai 400001",
  biz_2: "15 Connaught Place, New Delhi 110001",
  biz_3: "88 MG Road, Indiranagar, Bangalore 560038",
  biz_4: "27 Jubilee Hills, Hyderabad 500033",
  biz_5: "9 Anna Nagar, Chennai 600040",
  biz_6: "5 Koregaon Park, Pune 411001",
  biz_7: "18 MI Road, Jaipur 302001",
  biz_8: "33 Park Street, Kolkata 700016",
  biz_9: "12 Hazratganj, Lucknow 226001",
  biz_10: "7 CG Road, Ahmedabad 380006",
  biz_11: "21 MG Road, Indore 452001",
}

// Mock GST numbers
const mockGST: Record<string, string> = {
  biz_1: "27AABCF1234A1Z5",
  biz_2: "07AABCS5678B1Z3",
  biz_3: "29AABCQ9012C1Z1",
  biz_4: "36AABCS3456D1Z9",
  biz_5: "33AABCM7890E1Z7",
  biz_6: "27AABCH2345F1Z5",
  biz_7: "08AABCS6789G1Z3",
  biz_8: "19AABCG0123H1Z1",
  biz_9: "09AABCF4567I1Z9",
  biz_10: "24AABCW8901J1Z7",
  biz_11: "23AABCD2345K1Z5",
}

// ---------------------------------------------------------------------------
// Statuses for filters
// ---------------------------------------------------------------------------
const allStatuses: { value: string; label: string }[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "CHURNED", label: "Churned" },
]

const allTypes: { value: string; label: string }[] = [
  { value: "ALL", label: "All Types" },
  ...Object.entries(businessTypeConfig).map(([key, val]) => ({
    value: key,
    label: val.label,
  })),
]

const onlineFilterOptions: { value: string; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ONLINE", label: "Online" },
  { value: "OFFLINE", label: "Offline" },
]

// ---------------------------------------------------------------------------
// Helper: format currency
// ---------------------------------------------------------------------------
function formatCurrency(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`
  return `₹${value.toLocaleString("en-IN")}`
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function BusinessesView() {
  const { searchQuery } = useAdminStore()

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [typeFilter, setTypeFilter] = useState<string>("ALL")
  const [onlineFilter, setOnlineFilter] = useState<string>("ALL")

  // Selected business for detail sheet
  const [selectedBusiness, setSelectedBusiness] = useState<(typeof businesses)[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [customPricing, setCustomPricing] = useState(false)

  // Form state
  const [formName, setFormName] = useState("")
  const [formSlug, setFormSlug] = useState("")
  const [formType, setFormType] = useState<string>("")
  const [formPlan, setFormPlan] = useState<string>("")
  const [formCity, setFormCity] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formAddress, setFormAddress] = useState("")
  const [formGST, setFormGST] = useState("")
  const [formCustomAmount, setFormCustomAmount] = useState("")
  const [formCustomReason, setFormCustomReason] = useState("")

  // ---------------------------------------------------------------------------
  // Filtered businesses
  // ---------------------------------------------------------------------------
  const filteredBusinesses = useMemo(() => {
    return businesses.filter((biz) => {
      const matchSearch =
        !searchQuery ||
        biz.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        biz.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        biz.city.toLowerCase().includes(searchQuery.toLowerCase())

      const matchStatus = statusFilter === "ALL" || biz.status === statusFilter
      const matchType = typeFilter === "ALL" || biz.type === typeFilter
      const matchOnline =
        onlineFilter === "ALL" ||
        (onlineFilter === "ONLINE" && biz.isOnline) ||
        (onlineFilter === "OFFLINE" && !biz.isOnline)

      return matchSearch && matchStatus && matchType && matchOnline
    })
  }, [searchQuery, statusFilter, typeFilter, onlineFilter])

  // ---------------------------------------------------------------------------
  // Get subscription for a business
  // ---------------------------------------------------------------------------
  const getSubscription = (businessId: string) =>
    clientSubscriptions.find((s) => s.businessId === businessId)

  // ---------------------------------------------------------------------------
  // Reset form
  // ---------------------------------------------------------------------------
  const resetForm = () => {
    setFormName("")
    setFormSlug("")
    setFormType("")
    setFormPlan("")
    setFormCity("")
    setFormPhone("")
    setFormEmail("")
    setFormAddress("")
    setFormGST("")
    setCustomPricing(false)
    setFormCustomAmount("")
    setFormCustomReason("")
  }

  // ---------------------------------------------------------------------------
  // Auto-generate slug from name
  // ---------------------------------------------------------------------------
  const handleNameChange = (value: string) => {
    setFormName(value)
    setFormSlug(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "")
        .replace(/-+/g, "")
        .slice(0, 20)
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* ================================================================== */}
      {/* Page Header                                                        */}
      {/* ================================================================== */}
      <PageHeader
        title="Business Management"
        description="Manage all platform businesses, subscriptions, and configurations"
        icon={Building2}
        action={
          <Dialog
            open={createOpen}
            onOpenChange={(open) => {
              setCreateOpen(open)
              if (!open) resetForm()
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Business
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Business</DialogTitle>
                <DialogDescription>
                  Onboard a new business onto the Quantix platform
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Row 1: Name + Slug */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Business Name</Label>
                    <Input
                      placeholder="e.g. FreshMart Grocers"
                      value={formName}
                      onChange={(e) => handleNameChange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input
                      placeholder="Auto-generated"
                      value={formSlug}
                      onChange={(e) => setFormSlug(e.target.value)}
                    />
                  </div>
                </div>

                {/* Row 2: Type + Plan */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Business Type</Label>
                    <Select value={formType} onValueChange={setFormType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(businessTypeConfig).map(([key, val]) => (
                          <SelectItem key={key} value={key}>
                            {val.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <Select value={formPlan} onValueChange={setFormPlan}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select plan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="plan_monthly">
                          Monthly — ₹4,999/mo
                        </SelectItem>
                        <SelectItem value="plan_yearly">
                          Yearly — ₹49,999/yr
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 3: City + Phone */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      placeholder="e.g. Mumbai"
                      value={formCity}
                      onChange={(e) => setFormCity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      placeholder="+91 98765 43210"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                    />
                  </div>
                </div>

                {/* Row 4: Email + Address */}
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    placeholder="admin@business.in"
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Address</Label>
                  <Textarea
                    placeholder="Full business address"
                    rows={2}
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                  />
                </div>

                {/* GST */}
                <div className="space-y-2">
                  <Label>GST Number</Label>
                  <Input
                    placeholder="e.g. 27AABCF1234A1Z5"
                    value={formGST}
                    onChange={(e) => setFormGST(e.target.value)}
                  />
                </div>

                {/* Custom Pricing Toggle */}
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Custom Pricing</Label>
                    <p className="text-xs text-muted-foreground">
                      Override default plan pricing for this business
                    </p>
                  </div>
                  <Switch checked={customPricing} onCheckedChange={setCustomPricing} />
                </div>

                {customPricing && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Custom Amount (₹)</Label>
                      <Input
                        placeholder="e.g. 3999"
                        type="number"
                        value={formCustomAmount}
                        onChange={(e) => setFormCustomAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Reason</Label>
                      <Input
                        placeholder="e.g. Promotional discount"
                        value={formCustomReason}
                        onChange={(e) => setFormCustomReason(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCreateOpen(false)
                    resetForm()
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={() => setCreateOpen(false)}>Create Business</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* ================================================================== */}
      {/* Filter Bar                                                         */}
      {/* ================================================================== */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search businesses..."
            className="pl-8 h-9"
            value={searchQuery}
            readOnly
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {allStatuses.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Business Type" />
          </SelectTrigger>
          <SelectContent>
            {allTypes.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={onlineFilter} onValueChange={setOnlineFilter}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="Online" />
          </SelectTrigger>
          <SelectContent>
            {onlineFilterOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(statusFilter !== "ALL" ||
          typeFilter !== "ALL" ||
          onlineFilter !== "ALL") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("ALL")
              setTypeFilter("ALL")
              setOnlineFilter("ALL")
            }}
          >
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* ================================================================== */}
      {/* Business Table or Empty State                                       */}
      {/* ================================================================== */}
      {filteredBusinesses.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No businesses found"
          description="Try adjusting your filters or create a new business to get started"
          action={{
            label: "Create Business",
            onClick: () => setCreateOpen(true),
          }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Customers</TableHead>
                    <TableHead className="text-center">Online</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBusinesses.map((biz) => {
                    const typeConf = businessTypeConfig[biz.type]
                    const sub = getSubscription(biz.id)
                    return (
                      <TableRow
                        key={biz.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedBusiness(biz)
                          setDetailOpen(true)
                        }}
                      >
                        {/* Business Name with type badge & city */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback
                                className="text-xs font-semibold"
                                style={{
                                  backgroundColor: typeConf
                                    ? `${typeConf.color}18`
                                    : undefined,
                                  color: typeConf?.color,
                                }}
                              >
                                {biz.name
                                  .split(" ")
                                  .map((w) => w[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-sm">{biz.name}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] h-4 px-1.5 font-medium"
                                  style={{
                                    borderColor: typeConf?.color,
                                    color: typeConf?.color,
                                  }}
                                >
                                  {typeConf?.label || biz.type}
                                </Badge>
                                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                  <MapPin className="h-2.5 w-2.5" />
                                  {biz.city}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <StatusBadge status={biz.status} />
                        </TableCell>

                        {/* Plan */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{biz.plan}</span>
                            {biz.customPrice && (
                              <span className="text-[10px] text-orange-600 font-medium">
                                Custom: ₹{biz.customPrice.toLocaleString("en-IN")}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Revenue */}
                        <TableCell className="text-right font-medium">
                          {formatCurrency(biz.monthlyRevenue)}
                        </TableCell>

                        {/* Orders */}
                        <TableCell className="text-right text-sm">
                          {biz.totalOrders.toLocaleString("en-IN")}
                        </TableCell>

                        {/* Customers */}
                        <TableCell className="text-right text-sm">
                          {biz.activeCustomers.toLocaleString("en-IN")}
                        </TableCell>

                        {/* Online Toggle */}
                        <TableCell className="text-center">
                          <div onClick={(e) => e.stopPropagation()}>
                            <Switch
                              checked={biz.isOnline}
                              className="data-[state=checked]:bg-emerald-500"
                            />
                          </div>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => {
                                setSelectedBusiness(biz)
                                setDetailOpen(true)
                              }}
                            >
                              View
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================================================================== */}
      {/* Business Detail Sheet                                               */}
      {/* ================================================================== */}
      <Sheet
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setSelectedBusiness(null)
        }}
      >
        <SheetContent className="w-[520px] sm:max-w-[520px] p-0">
          {selectedBusiness && (() => {
            const biz = selectedBusiness
            const typeConf = businessTypeConfig[biz.type]
            const sub = getSubscription(biz.id)
            const modules = mockModules[biz.type] || ["POS", "Delivery"]
            const storeCount = mockStoreCounts[biz.id] || 1
            const email = getMockEmail(biz.slug)
            const address = mockAddresses[biz.id] || `${biz.city}, India`
            const gst = mockGST[biz.id] || "—"

            return (
              <>
                <SheetHeader className="px-6 pt-6 pb-4 border-b">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11">
                      <AvatarFallback
                        className="text-sm font-semibold"
                        style={{
                          backgroundColor: typeConf ? `${typeConf.color}18` : undefined,
                          color: typeConf?.color,
                        }}
                      >
                        {biz.name
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <SheetTitle className="text-lg">{biz.name}</SheetTitle>
                      <SheetDescription className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] h-5 px-1.5 font-medium"
                          style={{
                            borderColor: typeConf?.color,
                            color: typeConf?.color,
                          }}
                        >
                          {typeConf?.label}
                        </Badge>
                        <StatusBadge status={biz.status} />
                        {biz.isOnline ? (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                            <Wifi className="h-3 w-3" /> Online
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                            <WifiOff className="h-3 w-3" /> Offline
                          </span>
                        )}
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <ScrollArea className="h-[calc(100vh-120px)]">
                  <div className="space-y-6 p-6">
                    {/* -------------------------------------------------------- */}
                    {/* Business Overview                                         */}
                    {/* -------------------------------------------------------- */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Business Overview
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border p-3 flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[10px] text-muted-foreground">City</p>
                            <p className="text-sm font-medium">{biz.city}</p>
                          </div>
                        </div>
                        <div className="rounded-lg border p-3 flex items-start gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[10px] text-muted-foreground">Phone</p>
                            <p className="text-sm font-medium">{biz.contactPhone}</p>
                          </div>
                        </div>
                        <div className="rounded-lg border p-3 flex items-start gap-2 col-span-2">
                          <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[10px] text-muted-foreground">Email</p>
                            <p className="text-sm font-medium">{email}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* -------------------------------------------------------- */}
                    {/* Stats Cards                                               */}
                    {/* -------------------------------------------------------- */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Performance
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        <Card className="shadow-none">
                          <CardContent className="p-3 text-center">
                            <IndianRupee className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
                            <p className="text-lg font-bold">
                              {formatCurrency(biz.monthlyRevenue)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">Revenue</p>
                          </CardContent>
                        </Card>
                        <Card className="shadow-none">
                          <CardContent className="p-3 text-center">
                            <ShoppingCart className="h-4 w-4 text-sky-600 mx-auto mb-1" />
                            <p className="text-lg font-bold">
                              {biz.totalOrders.toLocaleString("en-IN")}
                            </p>
                            <p className="text-[10px] text-muted-foreground">Orders</p>
                          </CardContent>
                        </Card>
                        <Card className="shadow-none">
                          <CardContent className="p-3 text-center">
                            <Users className="h-4 w-4 text-violet-600 mx-auto mb-1" />
                            <p className="text-lg font-bold">
                              {biz.activeCustomers.toLocaleString("en-IN")}
                            </p>
                            <p className="text-[10px] text-muted-foreground">Customers</p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    <Separator />

                    {/* -------------------------------------------------------- */}
                    {/* Active Modules                                            */}
                    {/* -------------------------------------------------------- */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Active Modules
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {modules.map((mod) => (
                          <Badge
                            key={mod}
                            variant="secondary"
                            className="text-xs gap-1.5 py-1 px-2.5 bg-muted/80"
                          >
                            <Puzzle className="h-3 w-3 text-muted-foreground" />
                            {mod}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* -------------------------------------------------------- */}
                    {/* Store Count                                               */}
                    {/* -------------------------------------------------------- */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Store Configuration
                      </h4>
                      <div className="flex items-center gap-3 rounded-lg border p-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
                          <Store className="h-4.5 w-4.5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {storeCount} {storeCount === 1 ? "Store" : "Stores"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Across {biz.city}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* -------------------------------------------------------- */}
                    {/* Subscription Status                                       */}
                    {/* -------------------------------------------------------- */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Subscription
                      </h4>
                      {sub ? (
                        <div className="rounded-lg border p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{sub.plan} Plan</span>
                            </div>
                            <StatusBadge status={sub.status} />
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-[10px] text-muted-foreground">Billing</p>
                              <p className="font-medium">
                                {sub.billingCycle === "MONTHLY" ? "Monthly" : "Yearly"}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Price</p>
                              {sub.customPrice ? (
                                <CurrencyBadge
                                  amount={sub.customPrice}
                                  override
                                  original={sub.planPrice}
                                />
                              ) : (
                                <p className="font-medium">
                                  ₹{sub.planPrice.toLocaleString("en-IN")}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Next Billing</p>
                              <p className="font-medium">
                                {new Date(sub.nextBilling).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </p>
                            </div>
                            {sub.discountPercentage && (
                              <div>
                                <p className="text-[10px] text-muted-foreground">Discount</p>
                                <p className="font-medium text-orange-600">
                                  {sub.discountPercentage}% off
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed p-4 text-center">
                          <p className="text-sm text-muted-foreground">No active subscription</p>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* -------------------------------------------------------- */}
                    {/* Address & GST                                             */}
                    {/* -------------------------------------------------------- */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Business Details
                      </h4>
                      <div className="space-y-2">
                        <div className="rounded-lg border p-3">
                          <p className="text-[10px] text-muted-foreground">Address</p>
                          <p className="text-sm font-medium">{address}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-[10px] text-muted-foreground">GST Number</p>
                          <p className="text-sm font-medium font-mono">{gst}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* -------------------------------------------------------- */}
                    {/* Quick Actions                                             */}
                    {/* -------------------------------------------------------- */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Quick Actions
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {biz.status === "ACTIVE" ? (
                          <Button variant="outline" size="sm" className="gap-2 h-9">
                            <PowerOff className="h-3.5 w-3.5" />
                            Deactivate
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="gap-2 h-9">
                            <Power className="h-3.5 w-3.5" />
                            Activate
                          </Button>
                        )}

                        <Button variant="outline" size="sm" className="gap-2 h-9">
                          <Puzzle className="h-3.5 w-3.5" />
                          Modules
                        </Button>

                        <Button variant="outline" size="sm" className="gap-2 h-9">
                          <KeyRound className="h-3.5 w-3.5" />
                          Reset Creds
                        </Button>

                        {biz.status !== "SUSPENDED" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 h-9 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Suspend
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="gap-2 h-9">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Unsuspend
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>
    </div>
  )
}
