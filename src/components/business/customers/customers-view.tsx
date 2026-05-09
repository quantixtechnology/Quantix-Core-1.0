"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  Star,
  Eye,
  X,
} from "lucide-react"
import { useAdminStore, DEMO_BUSINESSES } from "@/stores/admin-store"
import { getDemoCustomers, getDemoBusinessName } from "@/lib/demo-data"
import { showSuccess, showError } from "@/lib/toast-utils"
import { SkeletonTable } from "@/components/ui/loading-states"
import { PageHeader } from "@/components/admin/shared/page-header"
import { StatCard } from "@/components/admin/shared/stat-card"
import { EmptyState } from "@/components/ui/loading-states"

const BUSINESS_ID = "biz_1"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Tier = "PLATINUM" | "GOLD" | "SILVER" | "BRONZE"

interface CustomerAddress {
  id: string
  label: string
  line1: string
  line2: string
  city: string
  pincode: string
  isDefault: boolean
}

interface Customer {
  id: string
  name: string
  phone: string
  email: string
  totalOrders: number
  totalSpent: number
  loyaltyPoints: number
  tier: Tier
  lastOrder: string
  tags: string[]
  addresses: CustomerAddress[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatCurrency(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`
  return `₹${value.toLocaleString("en-IN")}`
}

function formatCurrencyFull(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function getTierColors(tier: Tier) {
  switch (tier) {
    case "PLATINUM":
      return {
        text: "text-purple-700",
        bg: "bg-purple-50",
        border: "border-purple-200",
        badge: "bg-purple-100 text-purple-700",
        avatar: "bg-purple-100 text-purple-700",
        dot: "bg-purple-500",
      }
    case "GOLD":
      return {
        text: "text-amber-700",
        bg: "bg-amber-50",
        border: "border-amber-200",
        badge: "bg-amber-100 text-amber-700",
        avatar: "bg-amber-100 text-amber-700",
        dot: "bg-amber-500",
      }
    case "SILVER":
      return {
        text: "text-slate-700",
        bg: "bg-slate-50",
        border: "border-slate-200",
        badge: "bg-slate-100 text-slate-700",
        avatar: "bg-slate-200 text-slate-700",
        dot: "bg-slate-400",
      }
    case "BRONZE":
      return {
        text: "text-orange-700",
        bg: "bg-orange-50",
        border: "border-orange-200",
        badge: "bg-orange-100 text-orange-700",
        avatar: "bg-orange-100 text-orange-700",
        dot: "bg-orange-500",
      }
  }
}

function getTierIcon(tier: Tier) {
  const colors = getTierColors(tier)
  return (
    <div className={`flex items-center gap-1.5 ${colors.text}`}>
      <Star className="h-3.5 w-3.5" />
      <span className="font-semibold text-xs">{tier}</span>
    </div>
  )
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function getOrderStatusColor(status: string) {
  switch (status) {
    case "DELIVERED":
      return "bg-emerald-100 text-emerald-700"
    case "PENDING":
      return "bg-yellow-100 text-yellow-700"
    case "CONFIRMED":
      return "bg-blue-100 text-blue-700"
    case "PREPARING":
      return "bg-purple-100 text-purple-700"
    case "OUT_FOR_DELIVERY":
      return "bg-cyan-100 text-cyan-700"
    case "CANCELLED":
      return "bg-red-100 text-red-700"
    default:
      return "bg-slate-100 text-slate-700"
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function CustomersView() {
  // Get demo business context
  const { demoBusinessId } = useAdminStore()
  const businessName = getDemoBusinessName(demoBusinessId)

  // Business-specific form placeholders
  const customerPlaceholders = useMemo(() => {
    switch (demoBusinessId) {
      case "standard_grocery":
        return { name: "e.g. Rajesh Kumar", address: "e.g. 42, MG Road, Bengaluru" }
      case "standard_laundry":
      case "pro_laundry":
        return { name: "e.g. Regular Customer", address: "e.g. Flat No, Society Name, Bengaluru" }
      case "pro_carwash":
        return { name: "e.g. Car Owner Name", address: "e.g. Villa/Apt, Layout, Bengaluru" }
      default:
        return { name: "e.g. Priya Sharma", address: "Street, Area, City, Pincode" }
    }
  }, [demoBusinessId])

  // ---- Demo customer data based on business context ----
  const demoCustomerList: Customer[] = useMemo(() => {
    return getDemoCustomers(demoBusinessId).map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      totalOrders: c.totalOrders,
      totalSpent: c.totalSpent,
      loyaltyPoints: c.loyaltyPoints,
      tier: c.tier,
      lastOrder: c.lastOrder,
      tags: c.tags || [],
      addresses: c.addresses.map((a) => ({
        id: a.id,
        label: a.label,
        line1: a.line1,
        line2: a.line2,
        city: a.city,
        pincode: a.pincode,
        isDefault: a.isDefault,
      })),
    }))
  }, [demoBusinessId])

  // Local state
  const [searchQuery, setSearchQuery] = useState("")
  const [tierFilter, setTierFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("newest")

  // Selected customer for detail sheet
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Add customer dialog
  const [addOpen, setAddOpen] = useState(false)
  const [formName, setFormName] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formAddress, setFormAddress] = useState("")

  // ---------------------------------------------------------------------------
  // Filtered & sorted customers
  // ---------------------------------------------------------------------------
  const filteredCustomers = useMemo(() => {
    let result = demoCustomerList.filter((c) => {
      const q = searchQuery.toLowerCase()
      const matchSearch =
        !searchQuery ||
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      const matchTier = tierFilter === "all" || c.tier === tierFilter
      return matchSearch && matchTier
    })

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "most_orders":
          return b.totalOrders - a.totalOrders
        case "highest_spend":
          return b.totalSpent - a.totalSpent
        case "newest":
        default:
          return new Date(b.lastOrder).getTime() - new Date(a.lastOrder).getTime()
      }
    })

    return result
  }, [demoCustomerList, searchQuery, tierFilter, sortBy])

  // ---------------------------------------------------------------------------
  // Summary stats
  // ---------------------------------------------------------------------------
  const totalCustomers = demoCustomerList.length
  const activeThisMonth = demoCustomerList.filter(
    (c) => {
      const d = new Date(c.lastOrder)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }
  ).length
  const totalSpentAll = demoCustomerList.reduce((s, c) => s + c.totalSpent, 0)
  const totalOrdersAll = demoCustomerList.reduce((s, c) => s + c.totalOrders, 0)
  const avgOrderValue = totalOrdersAll > 0 ? Math.round(totalSpentAll / totalOrdersAll) : 0
  const loyaltyMembers = demoCustomerList.filter(
    (c) => c.tier === "PLATINUM" || c.tier === "GOLD"
  ).length

  // ---------------------------------------------------------------------------
  // Orders for a customer
  // ---------------------------------------------------------------------------
  // No API orders in demo mode
  const getOrdersForCustomer = () => []

  // ---------------------------------------------------------------------------
  // Reset add form
  // ---------------------------------------------------------------------------
  const resetForm = () => {
    setFormName("")
    setFormPhone("")
    setFormEmail("")
    setFormAddress("")
  }

  // ---------------------------------------------------------------------------
  // Open detail sheet
  // ---------------------------------------------------------------------------
  const openDetail = (customer: Customer) => {
    setSelectedCustomer(customer)
    setDetailOpen(true)
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
        title="Customers"
        description={`Manage customer relationships, loyalty tiers, and order history for ${businessName}`}
        icon={Users}
        action={
          <Dialog
            open={addOpen}
            onOpenChange={(open) => {
              setAddOpen(open)
              if (!open) resetForm()
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
                <DialogDescription>
                  Create a new customer record in your database
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    placeholder={customerPlaceholders.name}
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      placeholder="+91 98765 43210"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      placeholder="name@email.com"
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    placeholder={customerPlaceholders.address}
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setAddOpen(false); resetForm() }}>
                  Cancel
                </Button>
                <Button onClick={() => setAddOpen(false)}>Add Customer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Business Context Banner */}
      {demoBusinessId !== "super_admin" && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{businessName}</span>
              <Badge variant="outline" className="text-[10px]">
                {demoBusinessId.includes("grocery") ? "Grocery" : demoBusinessId.includes("laundry") ? "Laundry" : demoBusinessId.includes("carwash") ? "Car Wash" : "Business"} Customers
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================================================================== */}
      {/* Summary Cards                                                      */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Customers"
          value={totalCustomers}
          change="Registered customers"
          changeType="neutral"
          icon={Users}
          iconColor="text-violet-600"
          iconBg="bg-violet-50"
        />
        <StatCard
          title="Active This Month"
          value={activeThisMonth}
          change={`${totalCustomers > 0 ? ((activeThisMonth / totalCustomers) * 100).toFixed(0) : 0}% of total`}
          changeType="positive"
          icon={ShoppingBag}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="Avg Order Value"
          value={formatCurrency(avgOrderValue)}
          change="Per order average"
          changeType="neutral"
          icon={Star}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <StatCard
          title="Loyalty Members"
          value={loyaltyMembers}
          change="Platinum & Gold tiers"
          changeType="positive"
          icon={Star}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
        />
          </div>

          {/* ================================================================== */}
          {/* Filter Bar                                                         */}
          {/* ================================================================== */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone or email..."
                className="pl-8 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {["all", "PLATINUM", "GOLD", "SILVER", "BRONZE"].map((tier) => (
                <Button
                  key={tier}
                  variant={tierFilter === tier ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setTierFilter(tier)}
                >
                  {tier === "all" ? "All" : tier.charAt(0) + tier.slice(1).toLowerCase()}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Sort:</span>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="newest">Newest</option>
                <option value="most_orders">Most Orders</option>
                <option value="highest_spend">Highest Spend</option>
              </select>
            </div>
            {(tierFilter !== "all" || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTierFilter("all")
                  setSearchQuery("")
                }}
              >
                <X className="h-3 w-3 mr-1" /> Clear
              </Button>
            )}
          </div>

          {/* ================================================================== */}
          {/* Customer Table or Empty State                                      */}
          {/* ================================================================== */}
          {filteredCustomers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No customers found"
              description="No customers match your current filters. Try adjusting your search or tier filter."
              action={{
                label: "Clear Filters",
                onClick: () => {
                  setSearchQuery("")
                  setTierFilter("all")
                },
              }}
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[250px]">Customer</TableHead>
                        <TableHead className="hidden md:table-cell">Phone</TableHead>
                        <TableHead className="hidden lg:table-cell">Email</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Total Spent</TableHead>
                        <TableHead className="text-center">Tier</TableHead>
                        <TableHead className="hidden sm:table-cell">Last Order</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomers.map((customer) => {
                        const tierColors = getTierColors(customer.tier)
                        return (
                          <TableRow
                            key={customer.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => openDetail(customer as Customer)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 shrink-0">
                                  <AvatarFallback
                                    className={`text-xs font-semibold ${tierColors.avatar}`}
                                  >
                                    {getInitials(customer.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{customer.name}</p>
                                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                    {customer.tags.slice(0, 2).map((tag) => (
                                      <Badge key={tag} variant="outline" className="text-[9px] px-1 py-0 h-4 border-muted-foreground/30 text-muted-foreground">
                                        {tag}
                                      </Badge>
                                    ))}
                                    {customer.tags.length > 2 && (
                                      <span className="text-[9px] text-muted-foreground">+{customer.tags.length - 2}</span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground md:hidden">
                                    {customer.phone}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {customer.phone}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                              {customer.email}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {customer.totalOrders}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {formatCurrency(customer.totalSpent)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                className={`text-[10px] font-semibold ${tierColors.badge}`}
                                variant="secondary"
                              >
                                {customer.tier}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                              {formatDate(customer.lastOrder)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openDetail(customer as Customer)
                                }}
                              >
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              </Button>
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
      {/* Customer Detail Sheet                                              */}
      {/* ================================================================== */}
      <Sheet
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setSelectedCustomer(null)
        }}
      >
        <SheetContent className="w-[540px] sm:max-w-[540px] p-0">
          {selectedCustomer && (() => {
            const customer = selectedCustomer
            const tierColors = getTierColors(customer.tier)
            const customerOrders = getOrdersForCustomer()
            const avgOrder = customer.totalOrders > 0
              ? Math.round(customer.totalSpent / customer.totalOrders)
              : 0

            return (
              <>
                <SheetHeader className="px-6 pt-6 pb-4 border-b">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14 shrink-0">
                      <AvatarFallback
                        className={`text-lg font-bold ${tierColors.avatar}`}
                      >
                        {getInitials(customer.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1.5 min-w-0">
                      <SheetTitle className="text-lg truncate">{customer.name}</SheetTitle>
                      <SheetDescription className="flex items-center gap-2 flex-wrap">
                        <Badge
                          className={`text-[10px] font-semibold gap-1 ${tierColors.badge}`}
                          variant="secondary"
                        >
                          <Star className="h-3 w-3" />
                          {customer.tier}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {customer.loyaltyPoints.toLocaleString()} points
                        </span>
                      </SheetDescription>
                      <div className="flex items-center gap-3 pt-1">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {customer.phone}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {customer.email}
                        </span>
                      </div>
                    </div>
                  </div>
                </SheetHeader>

                <ScrollArea className="h-[calc(100vh-160px)]">
                  <div className="space-y-6 p-6">
                    {/* Customer Tags */}
                    {customer.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {customer.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px] px-2 py-0.5">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 gap-3">
                      <Card className="shadow-none">
                        <CardContent className="p-3 text-center">
                          <ShoppingBag className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                          <p className="text-xl font-bold">{customer.totalOrders}</p>
                          <p className="text-[10px] text-muted-foreground">Total Orders</p>
                        </CardContent>
                      </Card>
                      <Card className="shadow-none">
                        <CardContent className="p-3 text-center">
                          <span className="block h-4 w-4 mx-auto mb-1 text-emerald-600 font-bold text-sm">₹</span>
                          <p className="text-xl font-bold">{formatCurrency(customer.totalSpent)}</p>
                          <p className="text-[10px] text-muted-foreground">Total Spent</p>
                        </CardContent>
                      </Card>
                      <Card className="shadow-none">
                        <CardContent className="p-3 text-center">
                          <span className="block h-4 w-4 mx-auto mb-1 text-amber-600 font-bold text-sm">₹</span>
                          <p className="text-xl font-bold">{formatCurrency(avgOrder)}</p>
                          <p className="text-[10px] text-muted-foreground">Avg Order</p>
                        </CardContent>
                      </Card>
                      <Card className="shadow-none">
                        <CardContent className="p-3 text-center">
                          <Star className={`h-4 w-4 mx-auto mb-1 ${tierColors.text}`} />
                          <p className="text-xl font-bold">{customer.loyaltyPoints.toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">Loyalty Points</p>
                        </CardContent>
                      </Card>
                    </div>

                    <Separator />

                    {/* Addresses */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Addresses
                      </h4>
                      {customer.addresses.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                          No addresses on file
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {customer.addresses.map((addr) => (
                            <div
                              key={addr.id}
                              className={`rounded-lg border p-3 flex items-start justify-between gap-2 ${addr.isDefault ? tierColors.border : ""}`}
                            >
                              <div className="flex items-start gap-3 min-w-0">
                                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-semibold">{addr.label}</p>
                                    {addr.isDefault && (
                                      <Badge className="text-[9px] px-1.5 py-0 h-4" variant="secondary">
                                        Default
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                    {addr.line1}, {addr.line2}, {addr.city} - {addr.pincode}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Order History */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Order History ({customerOrders.length})
                      </h4>
                      {customerOrders.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                                                  Order history will appear here
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {customerOrders.map((order) => (
                            <div
                              key={order.id}
                              className="rounded-lg border p-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{order.orderNumber}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {order.createdAt} &middot; {order.items.length} items
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-semibold">
                                    {formatCurrencyFull(order.total)}
                                  </p>
                                  <Badge
                                    className={`text-[9px] ${getOrderStatusColor(order.status)}`}
                                    variant="secondary"
                                  >
                                    {order.status.replace(/_/g, " ")}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Quick Actions */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Quick Actions
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          variant="outline"
                          className="gap-2 h-10 text-xs"
                          onClick={() => {
                            const phone = customer.phone.replace(/\s/g, "")
                            window.open(`https://wa.me/${phone.replace("+", "")}`, "_blank")
                          }}
                        >
                          <Phone className="h-3.5 w-3.5" />
                          WhatsApp
                        </Button>
                        <Button
                          variant="outline"
                          className="gap-2 h-10 text-xs"
                          onClick={() => {
                            window.open(`mailto:${customer.email}`, "_blank")
                          }}
                        >
                          <Mail className="h-3.5 w-3.5" />
                          Email
                        </Button>
                        <Button
                          variant="outline"
                          className="gap-2 h-10 text-xs"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Note
                        </Button>
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
