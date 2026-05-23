"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Users, Plus, Search, Phone, Mail, MapPin, ShoppingBag, Star,
  Eye, X, Edit2, Save, Trash2, MessageSquare, Clock, Shield,
  Activity, Package, CreditCard, User, FileText, RefreshCw,
} from "lucide-react"
import { useBusinessContext } from "@/hooks/use-business-context"
import { showSuccess, showError } from "@/lib/toast-utils"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { SkeletonTable } from "@/components/ui/loading-states"
import { PageHeader } from "@/components/admin/shared/page-header"
import { StatCard } from "@/components/admin/shared/stat-card"
import { EmptyState } from "@/components/ui/loading-states"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Tier = "PLATINUM" | "GOLD" | "SILVER" | "BRONZE"

interface CustomerAddress {
  id: string
  label?: string
  area?: string
  addressLine1: string
  addressLine2?: string
  landmark?: string
  city: string
  state: string
  pincode: string
  country: string
  latitude?: number
  longitude?: number
  gpsAccuracy?: number
  instructions?: string
  isDefault: boolean
}

interface CustomerNote {
  id: string
  content: string
  isPrivate: boolean
  createdAt: string
  user?: { id: string; name: string; avatar?: string }
}

interface CustomerOrder {
  id: string
  orderNumber: string
  status: string
  total: number
  createdAt: string
  items: unknown[]
}

interface Customer {
  id: string
  name: string
  phone?: string
  email?: string
  dateOfBirth?: string
  gender?: string
  gstNumber?: string
  loyaltyTier: string
  notes: string
  totalOrders: number
  totalSpent: number
  loyaltyPoints: number
  lastOrderAt?: string
  tags: string[]
  addresses: CustomerAddress[]
  isActive: boolean
  createdAt: string
  alternatePhone?: string
  referredBy?: string
  metadata?: Record<string, unknown>
  source?: string
  isGuest?: boolean
  verified?: boolean
  createdStoreId?: string
  preferredStoreId?: string
}

interface EditForm {
  name: string
  phone: string
  alternatePhone: string
  email: string
  dateOfBirth: string
  gender: string
  gstNumber: string
  loyaltyTier: string
  tags: string[]
  referredBy: string
  notes: string
}

interface AddressForm {
  label: string
  area: string
  addressLine1: string
  addressLine2: string
  landmark: string
  city: string
  state: string
  pincode: string
  country: string
  instructions: string
  isDefault: boolean
}

interface TimelineEvent {
  id: string
  type: "order" | "note" | "joined" | "refund"
  label: string
  detail: string
  date: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PREDEFINED_TAGS = ["VIP", "Frequent Buyer", "Wholesale", "COD Risk", "Premium"]

const BUSINESS_PERMISSIONS = [
  { id: "customer.read",   label: "View Customers",     description: "Can view customer list and details",  icon: Eye },
  { id: "customer.write",  label: "Edit Customers",      description: "Can create and update customer records", icon: Edit2 },
  { id: "customer.delete", label: "Delete Customers",    description: "Can deactivate customer accounts",   icon: Trash2 },
  { id: "order.read",      label: "View Orders",         description: "Can view customer orders",           icon: ShoppingBag },
  { id: "order.refund",    label: "Refund Orders",       description: "Can process order refunds",          icon: RefreshCw },
  { id: "customer.export", label: "Export Customer Data",description: "Can export customer list to CSV",    icon: FileText },
]

const BLANK_ADDRESS_FORM: AddressForm = {
  label: "", area: "", addressLine1: "", addressLine2: "", landmark: "",
  city: "", state: "", pincode: "", country: "India", instructions: "", isDefault: false,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatCurrency(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000)   return `₹${(value / 1000).toFixed(1)}K`
  return `₹${value.toLocaleString("en-IN")}`
}

function formatCurrencyFull(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
}

function getTierColors(tier: string) {
  switch (tier as Tier) {
    case "PLATINUM":
      return { text: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200", badge: "bg-purple-100 text-purple-700", avatar: "bg-purple-100 text-purple-700" }
    case "GOLD":
      return { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-700", avatar: "bg-amber-100 text-amber-700" }
    case "SILVER":
      return { text: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200", badge: "bg-slate-100 text-slate-700", avatar: "bg-slate-200 text-slate-700" }
    default:
      return { text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", badge: "bg-orange-100 text-orange-700", avatar: "bg-orange-100 text-orange-700" }
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function getOrderStatusColor(status: string): string {
  const map: Record<string, string> = {
    DELIVERED:        "bg-emerald-100 text-emerald-700",
    PENDING:          "bg-yellow-100 text-yellow-700",
    CONFIRMED:        "bg-blue-100 text-blue-700",
    PREPARING:        "bg-purple-100 text-purple-700",
    OUT_FOR_DELIVERY: "bg-cyan-100 text-cyan-700",
    CANCELLED:        "bg-red-100 text-red-700",
    REFUNDED:         "bg-rose-100 text-rose-700",
  }
  return map[status] || "bg-slate-100 text-slate-700"
}

function parseMeta(raw: unknown): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === "object" && raw !== null) return raw as Record<string, unknown>
  try { return JSON.parse(String(raw)) } catch { return {} }
}

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw
  try { const t = JSON.parse(String(raw || "[]")); return Array.isArray(t) ? t : [] } catch { return [] }
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
      {children}
    </p>
  )
}

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] text-muted-foreground w-24 shrink-0 pt-0.5">{label}</span>
      <span className="text-xs font-medium break-all">{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function CustomersView() {
  const { businessId, businessName, isLoading: contextLoading } = useBusinessContext()
  const queryClient = useQueryClient()

  // ── Detail sheet state (must be before queries that reference it) ──────────
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [detailOpen,   setDetailOpen]   = useState(false)
  const [activeTab,    setActiveTab]    = useState("overview")
  const [isEditing,    setIsEditing]    = useState(false)

  // ── Edit form ───────────────────────────────────────────────────────────────
  const [editForm, setEditForm] = useState<EditForm>({
    name: "", phone: "", alternatePhone: "", email: "", dateOfBirth: "",
    gender: "", gstNumber: "", loyaltyTier: "BRONZE", tags: [], referredBy: "", notes: "",
  })

  // ── Notes ───────────────────────────────────────────────────────────────────
  const [noteContent, setNoteContent] = useState("")
  const [notePrivate, setNotePrivate] = useState(false)

  // ── Address dialog ──────────────────────────────────────────────────────────
  const [addAddressOpen, setAddAddressOpen] = useState(false)
  const [addressForm,    setAddressForm]    = useState<AddressForm>(BLANK_ADDRESS_FORM)

  // ── Add customer dialog ─────────────────────────────────────────────────────
  const [addOpen,          setAddOpen]          = useState(false)
  const [formName,         setFormName]         = useState("")
  const [formPhone,        setFormPhone]        = useState("")
  const [formEmail,        setFormEmail]        = useState("")
  const [formDateOfBirth,  setFormDateOfBirth]  = useState("")
  const [formGender,       setFormGender]       = useState("")
  const [formLoyaltyTier,  setFormLoyaltyTier]  = useState("BRONZE")
  const [formNotes,        setFormNotes]        = useState("")

  // ── Permissions dialog ──────────────────────────────────────────────────────
  const [permOpen,   setPermOpen]   = useState(false)
  const [permConfig, setPermConfig] = useState<Record<string, boolean>>({
    "customer.read": true, "customer.write": true, "customer.delete": false,
    "order.read":    true, "order.refund":   false, "customer.export": false,
  })

  // ── Filter / sort ───────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("")
  const [tierFilter,  setTierFilter]  = useState<string>("all")
  const [sortBy,      setSortBy]      = useState<string>("newest")

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: customersResponse, isLoading: customersLoading } = useQuery({
    queryKey: ["customers", businessId],
    queryFn: async () => {
      if (!businessId) return { data: [], pagination: { total: 0 } }
      console.log("[CustomersView] Fetching customers for businessId:", businessId)
      const res  = await fetch(`/api/core/businesses/${encodeURIComponent(businessId)}/customers?limit=200`, {
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      console.log("[CustomersView] Customers response:", data.success, "count:", data.data?.length)
      if (!data.success) throw new Error(data.error || "Failed to fetch customers")
      return data
    },
    enabled: !!businessId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  })

  const { data: ordersData } = useQuery<CustomerOrder[]>({
    queryKey: ["customer-orders", businessId, selectedCustomer?.id],
    queryFn: async () => {
      if (!businessId || !selectedCustomer?.id) return []
      const res  = await fetch(`/api/core/orders?businessId=${encodeURIComponent(businessId)}&customerId=${encodeURIComponent(selectedCustomer.id)}&limit=50`)
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        return data.data.map((o: Record<string, unknown>) => ({
          id:          String(o.id || ""),
          orderNumber: String(o.orderNumber || ""),
          status:      String(o.status || "PENDING"),
          total:       Number(o.totalAmount || 0),
          createdAt:   String(o.createdAt || ""),
          items:       Array.isArray(o.items) ? o.items : [],
        }))
      }
      return []
    },
    enabled: !!businessId && !!selectedCustomer?.id,
  })

  const { data: notesData } = useQuery<CustomerNote[]>({
    queryKey: ["customer-notes", businessId, selectedCustomer?.id],
    queryFn: async () => {
      if (!businessId || !selectedCustomer?.id) return []
      const res  = await fetch(
        `/api/core/businesses/${encodeURIComponent(businessId)}/customers/${encodeURIComponent(selectedCustomer.id)}/notes`,
        { headers: getAuthHeaders() }
      )
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        return data.data.map((n: Record<string, unknown>) => {
          const u = n.user as Record<string, unknown> | undefined
          return {
            id:        String(n.id || ""),
            content:   String(n.content || ""),
            isPrivate: Boolean(n.isPrivate),
            createdAt: String(n.createdAt || ""),
            user:      u ? { id: String(u.id || ""), name: String(u.name || "Staff") } : undefined,
          }
        })
      }
      return []
    },
    enabled: !!businessId && !!selectedCustomer?.id,
  })

  // ── Mutations ───────────────────────────────────────────────────────────────

  const createCustomerMutation = useMutation({
    mutationFn: async (d: { name: string; email?: string; phone?: string; dateOfBirth?: string; gender?: string; loyaltyTier?: string; notes?: string }) => {
      if (!businessId) throw new Error("No business context")
      console.log("[CustomersView] Submitting customer:", d)
      console.log("[CustomersView] Business:", businessId)
      const res  = await fetch(`/api/core/businesses/${encodeURIComponent(businessId)}/customers`, {
        method: "POST", headers: getAuthHeaders(), body: JSON.stringify(d),
      })
      const data = await res.json()
      console.log("[CustomersView] Create response:", data)
      if (!data.success) throw new Error(data.error || "Failed to create customer")
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", businessId] })
      showSuccess("Customer added successfully")
    },
    onError: (e) => showError(e instanceof Error ? e.message : "Unable to create customer. Check logs."),
  })

  const updateCustomerMutation = useMutation({
    mutationFn: async ({ customerId, data }: { customerId: string; data: Record<string, unknown> }) => {
      if (!businessId) throw new Error("No business context")
      const res  = await fetch(`/api/core/businesses/${encodeURIComponent(businessId)}/customers/${encodeURIComponent(customerId)}`, {
        method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error || "Failed to update customer")
      return result
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["customers", businessId] })
      queryClient.invalidateQueries({ queryKey: ["customer-orders", businessId, vars.customerId] })
      showSuccess("Customer updated")
      setIsEditing(false)
    },
    onError: (e) => showError(e instanceof Error ? e.message : "Failed to update customer"),
  })

  const addNoteMutation = useMutation({
    mutationFn: async ({ customerId, content, isPrivate }: { customerId: string; content: string; isPrivate?: boolean }) => {
      if (!businessId) throw new Error("No business context")
      const res  = await fetch(`/api/core/businesses/${encodeURIComponent(businessId)}/customers/${encodeURIComponent(customerId)}/notes`, {
        method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ content, isPrivate }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "Failed to add note")
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-notes", businessId, selectedCustomer?.id] })
      setNoteContent("")
      showSuccess("Note added")
    },
    onError: (e) => showError(e instanceof Error ? e.message : "Failed to add note"),
  })

  const addAddressMutation = useMutation({
    mutationFn: async ({ customerId, address }: { customerId: string; address: AddressForm }) => {
      if (!businessId) throw new Error("No business context")
      const res  = await fetch(`/api/core/businesses/${encodeURIComponent(businessId)}/customers/${encodeURIComponent(customerId)}/addresses`, {
        method: "POST", headers: getAuthHeaders(), body: JSON.stringify(address),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "Failed to add address")
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", businessId] })
      setAddressForm(BLANK_ADDRESS_FORM)
      setAddAddressOpen(false)
      showSuccess("Address added")
    },
    onError: (e) => showError(e instanceof Error ? e.message : "Failed to add address"),
  })

  const deleteAddressMutation = useMutation({
    mutationFn: async ({ customerId, addressId }: { customerId: string; addressId: string }) => {
      if (!businessId) throw new Error("No business context")
      const res  = await fetch(`/api/core/businesses/${encodeURIComponent(businessId)}/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addressId)}`, {
        method: "DELETE", headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "Failed to delete address")
      return data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["customers", businessId] }); showSuccess("Address removed") },
    onError:   (e) => showError(e instanceof Error ? e.message : "Failed to remove address"),
  })

  const setDefaultAddressMutation = useMutation({
    mutationFn: async ({ customerId, addressId }: { customerId: string; addressId: string }) => {
      if (!businessId) throw new Error("No business context")
      const res = await fetch(`/api/core/businesses/${encodeURIComponent(businessId)}/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addressId)}`, {
        method: "PUT", headers: getAuthHeaders(), body: JSON.stringify({ isDefault: true }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "Failed to set default")
      return data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["customers", businessId] }); showSuccess("Default address updated") },
    onError:   (e) => showError(e instanceof Error ? e.message : "Failed to set default address"),
  })

  // ── Parsed customer list ────────────────────────────────────────────────────
  const customerList: Customer[] = useMemo(() => {
    const raw = customersResponse?.data
    if (!Array.isArray(raw)) return []
    return raw.map((c: Record<string, unknown>) => {
      const meta = parseMeta(c.metadata)
      return {
        id:           String(c.id || ""),
        name:         String(c.name || "Unknown"),
        phone:        c.phone        ? String(c.phone) : undefined,
        email:        c.email        ? String(c.email) : undefined,
        dateOfBirth:  c.dateOfBirth  ? String(c.dateOfBirth) : undefined,
        gender:       c.gender       ? String(c.gender) : undefined,
        gstNumber:    c.gstNumber    ? String(c.gstNumber) : undefined,
        loyaltyTier:  String(c.loyaltyTier || "BRONZE"),
        notes:        String(c.notes || ""),
        totalOrders:  Number(c.totalOrders || (c._count as Record<string, number>)?.orders || 0),
        totalSpent:   Number(c.totalSpent || 0),
        loyaltyPoints:Number(c.loyaltyPoints || 0),
        lastOrderAt:  c.lastOrderAt  ? String(c.lastOrderAt) : undefined,
        tags:         parseTags(c.tags),
        addresses:    Array.isArray(c.addresses) ? (c.addresses as Record<string, unknown>[]).map((a) => ({
          id:           String(a.id || ""),
          label:        a.label        ? String(a.label) : undefined,
          area:         a.area         ? String(a.area) : undefined,
          addressLine1: String(a.addressLine1 || ""),
          addressLine2: a.addressLine2 ? String(a.addressLine2) : undefined,
          landmark:     a.landmark     ? String(a.landmark) : undefined,
          city:         String(a.city || ""),
          state:        String(a.state || ""),
          pincode:      String(a.pincode || ""),
          country:      String(a.country || "India"),
          latitude:     typeof a.latitude  === 'number' ? a.latitude  : undefined,
          longitude:    typeof a.longitude === 'number' ? a.longitude : undefined,
          gpsAccuracy:  typeof a.gpsAccuracy === 'number' ? a.gpsAccuracy : undefined,
          instructions: a.instructions ? String(a.instructions) : undefined,
          isDefault:    Boolean(a.isDefault || false),
        })) : [],
        isActive:      Boolean(c.isActive !== false),
        createdAt:     String(c.createdAt || ""),
        alternatePhone:meta.alternatePhone ? String(meta.alternatePhone) : undefined,
        referredBy:    meta.referredBy     ? String(meta.referredBy)     : undefined,
        metadata:      meta,
      }
    })
  }, [customersResponse])

  // ── Filtered & sorted ───────────────────────────────────────────────────────
  const filteredCustomers = useMemo(() => {
    let result = customerList.filter((c) => {
      const q           = searchQuery.toLowerCase()
      const matchSearch = !searchQuery || c.name.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q)
      const matchTier   = tierFilter === "all" || c.loyaltyTier === tierFilter
      return matchSearch && matchTier
    })
    result = [...result].sort((a, b) => {
      if (sortBy === "most_orders")   return b.totalOrders - a.totalOrders
      if (sortBy === "highest_spend") return b.totalSpent  - a.totalSpent
      return new Date(b.lastOrderAt || b.createdAt).getTime() - new Date(a.lastOrderAt || a.createdAt).getTime()
    })
    return result
  }, [customerList, searchQuery, tierFilter, sortBy])

  // ── Summary stats ───────────────────────────────────────────────────────────
  const totalCustomers  = customerList.length
  const now             = new Date()
  const activeThisMonth = customerList.filter((c) => {
    const d = new Date(c.lastOrderAt || c.createdAt)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const totalSpentAll   = customerList.reduce((s, c) => s + c.totalSpent,  0)
  const totalOrdersAll  = customerList.reduce((s, c) => s + c.totalOrders, 0)
  const avgOrderValue   = totalOrdersAll > 0 ? Math.round(totalSpentAll / totalOrdersAll) : 0
  const loyaltyMembers  = customerList.filter((c) => c.loyaltyTier === "PLATINUM" || c.loyaltyTier === "GOLD").length

  // ── Activity timeline ───────────────────────────────────────────────────────
  const activityTimeline = useMemo((): TimelineEvent[] => {
    const events: TimelineEvent[] = []
    if (selectedCustomer) {
      events.push({
        id: "joined", type: "joined",
        label: "Customer Joined",
        detail: `Registered as ${selectedCustomer.loyaltyTier.toLowerCase()} member`,
        date: selectedCustomer.createdAt,
        icon: User, color: "text-blue-600",
      })
    }
    ;(ordersData || []).forEach((o) => {
      const isRefund = o.status === "REFUNDED"
      events.push({
        id: o.id, type: isRefund ? "refund" : "order",
        label: isRefund ? `Refund — ${o.orderNumber}` : `Order ${o.orderNumber}`,
        detail: `${o.status.replace(/_/g, " ")} · ${formatCurrencyFull(o.total)}`,
        date: o.createdAt,
        icon: isRefund ? RefreshCw : ShoppingBag,
        color: o.status === "DELIVERED" ? "text-emerald-600" : o.status === "CANCELLED" || isRefund ? "text-red-600" : "text-blue-600",
      })
    })
    ;(notesData || []).forEach((n) => {
      events.push({
        id: n.id, type: "note",
        label: "Note Added",
        detail: n.content.slice(0, 70) + (n.content.length > 70 ? "…" : ""),
        date: n.createdAt,
        icon: MessageSquare, color: "text-violet-600",
      })
    })
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [selectedCustomer, ordersData, notesData])

  // ── Open detail sheet ───────────────────────────────────────────────────────
  const openDetail = (customer: Customer) => {
    setSelectedCustomer(customer)
    setDetailOpen(true)
    setActiveTab("overview")
    setIsEditing(false)
    setNoteContent("")
  }

  // ── Start editing ───────────────────────────────────────────────────────────
  const startEditing = (customer: Customer) => {
    setEditForm({
      name:          customer.name,
      phone:         customer.phone          || "",
      alternatePhone:customer.alternatePhone || "",
      email:         customer.email          || "",
      dateOfBirth:   customer.dateOfBirth    ? customer.dateOfBirth.split("T")[0] : "",
      gender:        customer.gender         || "",
      gstNumber:     customer.gstNumber      || "",
      loyaltyTier:   customer.loyaltyTier,
      tags:          [...customer.tags],
      referredBy:    customer.referredBy     || "",
      notes:         customer.notes          || "",
    })
    setIsEditing(true)
    setActiveTab("details")
  }

  // ── Save edits ──────────────────────────────────────────────────────────────
  const saveEdit = async () => {
    if (!selectedCustomer) return
    const existingMeta = selectedCustomer.metadata || {}
    await updateCustomerMutation.mutateAsync({
      customerId: selectedCustomer.id,
      data: {
        name:        editForm.name,
        phone:       editForm.phone       || undefined,
        email:       editForm.email       || undefined,
        dateOfBirth: editForm.dateOfBirth || undefined,
        gender:      editForm.gender      || undefined,
        gstNumber:   editForm.gstNumber   || undefined,
        loyaltyTier: editForm.loyaltyTier,
        tags:        editForm.tags,
        notes:       editForm.notes,
        metadata: {
          ...existingMeta,
          alternatePhone: editForm.alternatePhone || undefined,
          referredBy:     editForm.referredBy     || undefined,
        },
      },
    })
    setSelectedCustomer((prev) => prev ? {
      ...prev,
      name:           editForm.name,
      phone:          editForm.phone          || undefined,
      email:          editForm.email          || undefined,
      dateOfBirth:    editForm.dateOfBirth    || undefined,
      gender:         editForm.gender         || undefined,
      gstNumber:      editForm.gstNumber      || undefined,
      loyaltyTier:    editForm.loyaltyTier,
      tags:           editForm.tags,
      notes:          editForm.notes,
      alternatePhone: editForm.alternatePhone || undefined,
      referredBy:     editForm.referredBy     || undefined,
    } : null)
  }

  const toggleTag = (tag: string) =>
    setEditForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }))

  const resetAddForm = () => {
    setFormName(""); setFormPhone(""); setFormEmail(""); setFormDateOfBirth("")
    setFormGender(""); setFormLoyaltyTier("BRONZE"); setFormNotes("")
  }

  // ── Loading / error guards ──────────────────────────────────────────────────
  if (contextLoading) {
    return (
      <Card className="border border-muted-200 bg-muted/10">
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-6 w-1/3" />
          <SkeletonTable />
        </CardContent>
      </Card>
    )
  }

  if (!businessId) {
    return (
      <Card className="border border-rose-200 bg-rose-50">
        <CardContent className="p-6 text-sm text-rose-700">
          Unable to resolve business context. Please refresh or select a business.
        </CardContent>
      </Card>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <PageHeader
        title="Customers"
        description={`CRM & customer master for ${businessName || "your business"}`}
        icon={Users}
        action={
          <div className="flex gap-2">
            {/* Permissions button */}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPermOpen(true)}>
              <Shield className="h-3.5 w-3.5" />
              Permissions
            </Button>
            {/* Add Customer dialog */}
            <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetAddForm() }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add New Customer</DialogTitle>
                  <DialogDescription>Create a new customer record in your database</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Full Name *</Label>
                    <Input className="h-9" placeholder="e.g. Priya Sharma" value={formName} onChange={(e) => setFormName(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Phone</Label>
                      <Input className="h-9" placeholder="+91 98765 43210" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email</Label>
                      <Input className="h-9" type="email" placeholder="name@email.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Date of Birth</Label>
                      <Input className="h-9" type="date" value={formDateOfBirth} onChange={(e) => setFormDateOfBirth(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Gender</Label>
                      <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={formGender} onChange={(e) => setFormGender(e.target.value)}>
                        <option value="">Select</option>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Loyalty Tier</Label>
                      <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={formLoyaltyTier} onChange={(e) => setFormLoyaltyTier(e.target.value)}>
                        <option value="BRONZE">Bronze</option>
                        <option value="SILVER">Silver</option>
                        <option value="GOLD">Gold</option>
                        <option value="PLATINUM">Platinum</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Initial Notes</Label>
                      <Input className="h-9" placeholder="Notes…" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={() => { setAddOpen(false); resetAddForm() }}>Cancel</Button>
                  <Button size="sm" disabled={!formName || createCustomerMutation.isPending} onClick={async () => {
                    if (!formName) return
                    await createCustomerMutation.mutateAsync({
                      name: formName, phone: formPhone || undefined, email: formEmail || undefined,
                      dateOfBirth: formDateOfBirth || undefined, gender: formGender || undefined,
                      loyaltyTier: formLoyaltyTier || undefined, notes: formNotes || undefined,
                    })
                    setAddOpen(false); resetAddForm()
                  }}>
                    {createCustomerMutation.isPending ? "Adding…" : "Add Customer"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Customers"  value={totalCustomers}             change="Registered customers" changeType="neutral"  icon={Users}       iconColor="text-violet-600" iconBg="bg-violet-50" />
        <StatCard title="Active This Month" value={activeThisMonth}           change={`${totalCustomers > 0 ? ((activeThisMonth / totalCustomers) * 100).toFixed(0) : 0}% of total`} changeType="positive" icon={ShoppingBag} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard title="Avg Order Value"  value={formatCurrency(avgOrderValue)} change="Per order average" changeType="neutral"  icon={Star}        iconColor="text-amber-600"  iconBg="bg-amber-50" />
        <StatCard title="Loyalty Members"  value={loyaltyMembers}             change="Platinum & Gold"      changeType="positive" icon={Star}        iconColor="text-purple-600" iconBg="bg-purple-50" />
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 text-xs" placeholder="Search name, phone, email…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          {searchQuery && (
            <button className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground" onClick={() => setSearchQuery("")}>
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {["all", "PLATINUM", "GOLD", "SILVER", "BRONZE"].map((t) => (
            <Button key={t} variant={tierFilter === t ? "default" : "outline"} size="sm" className="h-7 text-[11px] px-2" onClick={() => setTierFilter(t)}>
              {t === "all" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[11px] text-muted-foreground">Sort:</span>
          <select className="h-7 rounded border border-input bg-background px-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="newest">Newest</option>
            <option value="most_orders">Most Orders</option>
            <option value="highest_spend">Highest Spend</option>
          </select>
        </div>
        {(tierFilter !== "all" || searchQuery) && (
          <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => { setTierFilter("all"); setSearchQuery("") }}>
            <X className="h-3 w-3 mr-1" />Clear
          </Button>
        )}
      </div>

      {/* ── Customer table ────────────────────────────────────────────────────── */}
      {customersLoading ? (
        <Card><CardContent className="p-6"><SkeletonTable /></CardContent></Card>
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers found"
          description="Adjust filters or add a new customer."
          action={{ label: "Clear Filters", onClick: () => { setSearchQuery(""); setTierFilter("all") } }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px]">Customer</TableHead>
                    <TableHead className="hidden md:table-cell">Phone</TableHead>
                    <TableHead className="hidden lg:table-cell">Email</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Spent</TableHead>
                    <TableHead className="text-center">Tier</TableHead>
                    <TableHead className="hidden sm:table-cell">Last Order</TableHead>
                    <TableHead className="text-center w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => {
                    const tc = getTierColors(customer.loyaltyTier)
                    return (
                      <TableRow key={customer.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(customer)}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarFallback className={`text-[11px] font-semibold ${tc.avatar}`}>{getInitials(customer.name)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{customer.name}</p>
                              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                {customer.isGuest && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-orange-300 text-orange-600">Guest</Badge>
                                )}
                                {!customer.isGuest && customer.verified && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-green-300 text-green-600">Verified</Badge>
                                )}
                                {customer.source === "STORE_FRONT" && !customer.isGuest && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-blue-300 text-blue-600">Storefront</Badge>
                                )}
                                {customer.tags.slice(0, 1).map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-[9px] px-1 py-0 h-4 border-muted-foreground/30 text-muted-foreground">{tag}</Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{customer.phone || "—"}</TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{customer.email || "—"}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{customer.totalOrders}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatCurrency(customer.totalSpent)}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={`text-[9px] font-semibold ${tc.badge}`} variant="secondary">{customer.loyaltyTier}</Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                          {formatDate(customer.lastOrderAt || customer.createdAt)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); openDetail(customer) }}>
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
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
        onOpenChange={(o) => {
          setDetailOpen(o)
          if (!o) { setSelectedCustomer(null); setIsEditing(false) }
        }}
      >
        <SheetContent className="w-full sm:w-[640px] sm:max-w-[640px] p-0 flex flex-col gap-0">
          {selectedCustomer && (() => {
            const customer  = selectedCustomer
            const tc        = getTierColors(customer.loyaltyTier)
            const avgOrder  = customer.totalOrders > 0 ? Math.round(customer.totalSpent / customer.totalOrders) : 0
            const orders    = ordersData || []
            const notes     = notesData  || []

            return (
              <>
                {/* ── Sheet Header ─────────────────────────────────────────── */}
                <SheetHeader className="px-4 pt-4 pb-3 border-b shrink-0">
                  {/* Required for a11y */}
                  <SheetDescription className="sr-only">{customer.name} — customer details and management</SheetDescription>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarFallback className={`text-base font-bold ${tc.avatar}`}>{getInitials(customer.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <SheetTitle className="text-base">{customer.name}</SheetTitle>
                        {!customer.isActive && <Badge variant="secondary" className="text-[9px]">Inactive</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge className={`text-[9px] font-semibold gap-1 ${tc.badge}`} variant="secondary">
                          <Star className="h-2.5 w-2.5" />{customer.loyaltyTier}
                        </Badge>
                        {customer.isGuest && (
                          <Badge variant="outline" className="text-[9px] border-orange-300 text-orange-600">Guest</Badge>
                        )}
                        {!customer.isGuest && customer.verified && (
                          <Badge variant="outline" className="text-[9px] border-green-300 text-green-600">Verified</Badge>
                        )}
                        {customer.source && customer.source !== "MANUAL" && (
                          <Badge variant="outline" className="text-[9px] border-blue-300 text-blue-500">{customer.source === "STORE_FRONT" ? "Storefront" : customer.source}</Badge>
                        )}
                        <span className="text-[11px] text-muted-foreground">{customer.loyaltyPoints.toLocaleString()} pts</span>
                        {customer.phone && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Phone className="h-2.5 w-2.5" />{customer.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Edit / Save / Cancel */}
                    <div className="flex gap-1.5 shrink-0">
                      {!isEditing ? (
                        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => startEditing(customer)}>
                          <Edit2 className="h-3 w-3" />Edit
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setIsEditing(false)}>Cancel</Button>
                          <Button size="sm" className="h-7 gap-1.5 text-xs" disabled={updateCustomerMutation.isPending} onClick={saveEdit}>
                            <Save className="h-3 w-3" />{updateCustomerMutation.isPending ? "Saving…" : "Save"}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </SheetHeader>

                {/* ── Tabs ────────────────────────────────────────────────── */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
                  <div className="px-4 pt-3 shrink-0">
                    <TabsList className="grid grid-cols-6 h-8 w-full">
                      <TabsTrigger value="overview"   className="text-[10px] px-1">Overview</TabsTrigger>
                      <TabsTrigger value="details"    className="text-[10px] px-1">Details</TabsTrigger>
                      <TabsTrigger value="addresses"  className="text-[10px] px-1">Address</TabsTrigger>
                      <TabsTrigger value="orders"     className="text-[10px] px-1">Orders</TabsTrigger>
                      <TabsTrigger value="notes"      className="text-[10px] px-1">Notes</TabsTrigger>
                      <TabsTrigger value="activity"   className="text-[10px] px-1">Activity</TabsTrigger>
                    </TabsList>
                  </div>

                  <ScrollArea className="flex-1 min-h-0">
                    <div className="px-4 pb-6 pt-4">

                      {/* ──────────────────────────────────────────────────── */}
                      {/* OVERVIEW TAB                                        */}
                      {/* ──────────────────────────────────────────────────── */}
                      <TabsContent value="overview" className="mt-0 space-y-5">
                        {/* Stats grid */}
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { icon: ShoppingBag, value: customer.totalOrders,              label: "Orders" },
                            { icon: CreditCard,  value: formatCurrency(customer.totalSpent), label: "Spent" },
                            { icon: Package,     value: formatCurrency(avgOrder),            label: "Avg Order" },
                            { icon: Star,        value: customer.loyaltyPoints.toLocaleString(), label: "Points" },
                          ].map(({ icon: Icon, value, label }) => (
                            <Card key={label} className="shadow-none">
                              <CardContent className="p-2.5 text-center">
                                <Icon className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
                                <p className="text-sm font-bold leading-tight">{value}</p>
                                <p className="text-[9px] text-muted-foreground">{label}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>

                        {/* Tags */}
                        {customer.tags.length > 0 && (
                          <div>
                            <SectionLabel>Tags</SectionLabel>
                            <div className="flex flex-wrap gap-1.5">
                              {customer.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-[10px] px-2 py-0.5">{tag}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Summary info */}
                        <div>
                          <SectionLabel>Contact &amp; Profile</SectionLabel>
                          <div className="space-y-1.5">
                            <FieldRow label="Phone"       value={customer.phone} />
                            <FieldRow label="Alt Phone"   value={customer.alternatePhone} />
                            <FieldRow label="Email"       value={customer.email} />
                            <FieldRow label="Gender"      value={customer.gender} />
                            <FieldRow label="DOB"         value={customer.dateOfBirth ? formatDate(customer.dateOfBirth) : undefined} />
                            <FieldRow label="GST No."     value={customer.gstNumber} />
                            <FieldRow label="Referred By" value={customer.referredBy} />
                            <FieldRow label="Since"       value={formatDate(customer.createdAt)} />
                          </div>
                        </div>

                        {/* Notes preview */}
                        {customer.notes && (
                          <div>
                            <SectionLabel>Notes</SectionLabel>
                            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5 leading-relaxed">{customer.notes}</p>
                          </div>
                        )}

                        {/* Quick actions */}
                        <div>
                          <SectionLabel>Quick Actions</SectionLabel>
                          <div className="grid grid-cols-3 gap-2">
                            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8"
                              onClick={() => customer.phone && window.open(`https://wa.me/${customer.phone.replace(/[\s+]/g, "")}`, "_blank")}>
                              <Phone className="h-3 w-3" />WhatsApp
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8"
                              onClick={() => customer.email && window.open(`mailto:${customer.email}`, "_blank")}>
                              <Mail className="h-3 w-3" />Email
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => setActiveTab("notes")}>
                              <MessageSquare className="h-3 w-3" />Add Note
                            </Button>
                          </div>
                        </div>
                      </TabsContent>

                      {/* ──────────────────────────────────────────────────── */}
                      {/* DETAILS TAB                                         */}
                      {/* ──────────────────────────────────────────────────── */}
                      <TabsContent value="details" className="mt-0 space-y-5">
                        {isEditing ? (
                          <>
                            {/* ── Basic Details ── */}
                            <div>
                              <SectionLabel>Basic Details</SectionLabel>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2 space-y-1">
                                  <Label className="text-[11px]">Full Name *</Label>
                                  <Input className="h-8 text-sm" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[11px]">Phone</Label>
                                  <Input className="h-8 text-sm" placeholder="+91 98765 43210" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[11px]">Alternate Phone</Label>
                                  <Input className="h-8 text-sm" placeholder="Alternate number" value={editForm.alternatePhone} onChange={(e) => setEditForm((f) => ({ ...f, alternatePhone: e.target.value }))} />
                                </div>
                                <div className="col-span-2 space-y-1">
                                  <Label className="text-[11px]">Email</Label>
                                  <Input className="h-8 text-sm" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[11px]">Date of Birth</Label>
                                  <Input className="h-8 text-sm" type="date" value={editForm.dateOfBirth} onChange={(e) => setEditForm((f) => ({ ...f, dateOfBirth: e.target.value }))} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[11px]">Gender</Label>
                                  <select className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={editForm.gender} onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}>
                                    <option value="">Select</option>
                                    <option value="MALE">Male</option>
                                    <option value="FEMALE">Female</option>
                                    <option value="OTHER">Other</option>
                                  </select>
                                </div>
                              </div>
                            </div>

                            <Separator />

                            {/* ── Customer Relationship ── */}
                            <div>
                              <SectionLabel>Customer Relationship</SectionLabel>
                              <div className="space-y-3">
                                <div className="space-y-1">
                                  <Label className="text-[11px]">Loyalty Tier</Label>
                                  <select className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" value={editForm.loyaltyTier} onChange={(e) => setEditForm((f) => ({ ...f, loyaltyTier: e.target.value }))}>
                                    <option value="BRONZE">Bronze</option>
                                    <option value="SILVER">Silver</option>
                                    <option value="GOLD">Gold</option>
                                    <option value="PLATINUM">Platinum</option>
                                  </select>
                                </div>

                                <div className="space-y-1.5">
                                  <Label className="text-[11px]">Tags</Label>
                                  <div className="flex flex-wrap gap-1.5">
                                    {PREDEFINED_TAGS.map((tag) => (
                                      <button
                                        key={tag} type="button" onClick={() => toggleTag(tag)}
                                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors ${
                                          editForm.tags.includes(tag)
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-background text-muted-foreground border-border hover:border-primary/50"
                                        }`}
                                      >
                                        {tag}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <Label className="text-[11px]">Referred By</Label>
                                  <Input className="h-8 text-sm" placeholder="Name or referral source" value={editForm.referredBy} onChange={(e) => setEditForm((f) => ({ ...f, referredBy: e.target.value }))} />
                                </div>

                                <div className="space-y-1">
                                  <Label className="text-[11px]">GST Number (optional)</Label>
                                  <Input className="h-8 text-sm" placeholder="22AAAAA0000A1Z5" value={editForm.gstNumber} onChange={(e) => setEditForm((f) => ({ ...f, gstNumber: e.target.value }))} />
                                </div>

                                <div className="space-y-1">
                                  <Label className="text-[11px]">Customer Notes</Label>
                                  <Textarea className="text-sm min-h-[72px] resize-none" placeholder="Internal notes about this customer…" value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setIsEditing(false)}>Cancel</Button>
                              <Button size="sm" className="h-8 gap-1.5 text-xs" disabled={updateCustomerMutation.isPending || !editForm.name} onClick={saveEdit}>
                                <Save className="h-3 w-3" />{updateCustomerMutation.isPending ? "Saving…" : "Save Changes"}
                              </Button>
                            </div>
                          </>
                        ) : (
                          // ── View mode ──
                          <div className="space-y-5">
                            <div>
                              <SectionLabel>Basic Details</SectionLabel>
                              <div className="space-y-1.5">
                                <FieldRow label="Full Name"    value={customer.name} />
                                <FieldRow label="Phone"        value={customer.phone} />
                                <FieldRow label="Alt Phone"    value={customer.alternatePhone} />
                                <FieldRow label="Email"        value={customer.email} />
                                <FieldRow label="Gender"       value={customer.gender} />
                                <FieldRow label="Date of Birth" value={customer.dateOfBirth ? formatDate(customer.dateOfBirth) : undefined} />
                              </div>
                            </div>
                            <Separator />
                            <div>
                              <SectionLabel>Customer Relationship</SectionLabel>
                              <div className="space-y-1.5">
                                <FieldRow label="Loyalty Tier" value={customer.loyaltyTier} />
                                <FieldRow label="Points"       value={customer.loyaltyPoints.toLocaleString()} />
                                <FieldRow label="Referred By"  value={customer.referredBy} />
                                <FieldRow label="GST No."      value={customer.gstNumber} />
                                <FieldRow label="Notes"        value={customer.notes || undefined} />
                              </div>
                              {customer.tags.length > 0 && (
                                <div className="flex items-start gap-2 mt-1.5">
                                  <span className="text-[10px] text-muted-foreground w-24 shrink-0 pt-1">Tags</span>
                                  <div className="flex flex-wrap gap-1">
                                    {customer.tags.map((t) => <Badge key={t} variant="secondary" className="text-[9px]">{t}</Badge>)}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="pt-1">
                              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => startEditing(customer)}>
                                <Edit2 className="h-3 w-3" />Edit Customer
                              </Button>
                            </div>
                          </div>
                        )}
                      </TabsContent>

                      {/* ──────────────────────────────────────────────────── */}
                      {/* ADDRESSES TAB                                       */}
                      {/* ──────────────────────────────────────────────────── */}
                      <TabsContent value="addresses" className="mt-0 space-y-4">
                        <div className="flex items-center justify-between">
                          <SectionLabel>Saved Addresses ({customer.addresses.length})</SectionLabel>
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setAddAddressOpen(true)}>
                            <Plus className="h-3 w-3" />Add Address
                          </Button>
                        </div>

                        {customer.addresses.length === 0 ? (
                          <div className="rounded-lg border border-dashed p-8 text-center">
                            <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                            <p className="text-xs text-muted-foreground">No addresses saved yet</p>
                            <Button size="sm" variant="outline" className="mt-3 text-xs h-7 gap-1" onClick={() => setAddAddressOpen(true)}>
                              <Plus className="h-3 w-3" />Add First Address
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {customer.addresses.map((addr) => (
                              <div key={addr.id} className={`rounded-lg border p-3 ${addr.isDefault ? `${tc.border} ${tc.bg}` : ""}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2 min-w-0">
                                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                        <span className="text-xs font-medium">{addr.label || (addr.isDefault ? "Default" : "Saved Address")}</span>
                                        {addr.isDefault && <Badge className="text-[9px] px-1.5 py-0 h-4" variant="secondary">Default</Badge>}
                                        {addr.latitude != null && addr.longitude != null && (
                                          <Badge className="text-[9px] px-1.5 py-0 h-4 bg-green-50 text-green-700 border-green-200" variant="outline">GPS</Badge>
                                        )}
                                      </div>
                                      {addr.area && <p className="text-[11px] text-muted-foreground">{addr.area}</p>}
                                      <p className="text-[11px] text-muted-foreground leading-snug">
                                        {addr.addressLine1}
                                        {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}
                                        {addr.landmark    ? `, Near ${addr.landmark}` : ""}
                                      </p>
                                      <p className="text-[11px] text-muted-foreground">
                                        {addr.city}, {addr.state} — {addr.pincode}
                                      </p>
                                      {addr.instructions && (
                                        <p className="text-[10px] text-amber-600 mt-0.5 italic">{addr.instructions}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-0.5 shrink-0">
                                    {!addr.isDefault && (
                                      <Button
                                        variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-emerald-600"
                                        title="Set as default"
                                        disabled={setDefaultAddressMutation.isPending}
                                        onClick={() => setDefaultAddressMutation.mutate({ customerId: customer.id, addressId: addr.id })}
                                      >
                                        <Star className="h-3 w-3" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                      disabled={deleteAddressMutation.isPending}
                                      onClick={() => deleteAddressMutation.mutate({ customerId: customer.id, addressId: addr.id })}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Address dialog */}
                        <Dialog open={addAddressOpen} onOpenChange={(o) => { setAddAddressOpen(o); if (!o) setAddressForm(BLANK_ADDRESS_FORM) }}>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle className="text-base">Add Address</DialogTitle>
                              <DialogDescription className="text-xs">Save a delivery address for this customer</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-2.5 py-1">
                              <div className="grid grid-cols-2 gap-2.5">
                                <div className="space-y-1">
                                  <Label className="text-[11px]">Label (Home / Office)</Label>
                                  <Input className="h-8 text-sm" placeholder="Home" value={addressForm.label} onChange={(e) => setAddressForm((f) => ({ ...f, label: e.target.value }))} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[11px]">Area / Locality</Label>
                                  <Input className="h-8 text-sm" placeholder="Area" value={addressForm.area} onChange={(e) => setAddressForm((f) => ({ ...f, area: e.target.value }))} />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px]">Address Line *</Label>
                                <Input className="h-8 text-sm" placeholder="House no., Street name" value={addressForm.addressLine1} onChange={(e) => setAddressForm((f) => ({ ...f, addressLine1: e.target.value }))} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px]">Landmark</Label>
                                <Input className="h-8 text-sm" placeholder="Near landmark" value={addressForm.landmark} onChange={(e) => setAddressForm((f) => ({ ...f, landmark: e.target.value }))} />
                              </div>
                              <div className="grid grid-cols-3 gap-2.5">
                                <div className="space-y-1">
                                  <Label className="text-[11px]">City *</Label>
                                  <Input className="h-8 text-sm" value={addressForm.city} onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[11px]">State *</Label>
                                  <Input className="h-8 text-sm" value={addressForm.state} onChange={(e) => setAddressForm((f) => ({ ...f, state: e.target.value }))} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[11px]">Pincode *</Label>
                                  <Input className="h-8 text-sm" maxLength={6} value={addressForm.pincode} onChange={(e) => setAddressForm((f) => ({ ...f, pincode: e.target.value }))} />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px]">Delivery Instructions</Label>
                                <Input className="h-8 text-sm" placeholder="e.g. Leave at gate, call before delivery" value={addressForm.instructions} onChange={(e) => setAddressForm((f) => ({ ...f, instructions: e.target.value }))} />
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <input
                                  type="checkbox" id="addrDefault" className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                                  checked={addressForm.isDefault}
                                  onChange={(e) => setAddressForm((f) => ({ ...f, isDefault: e.target.checked }))}
                                />
                                <Label htmlFor="addrDefault" className="text-[11px] cursor-pointer">Set as default address</Label>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" size="sm" onClick={() => { setAddAddressOpen(false); setAddressForm(BLANK_ADDRESS_FORM) }}>Cancel</Button>
                              <Button size="sm"
                                disabled={!addressForm.addressLine1 || !addressForm.city || !addressForm.state || !addressForm.pincode || addAddressMutation.isPending}
                                onClick={() => addAddressMutation.mutate({ customerId: customer.id, address: addressForm })}>
                                {addAddressMutation.isPending ? "Saving…" : "Save Address"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TabsContent>

                      {/* ──────────────────────────────────────────────────── */}
                      {/* ORDERS TAB                                          */}
                      {/* ──────────────────────────────────────────────────── */}
                      <TabsContent value="orders" className="mt-0 space-y-3">
                        <SectionLabel>Order History ({orders.length})</SectionLabel>
                        {orders.length === 0 ? (
                          <div className="rounded-lg border border-dashed p-8 text-center">
                            <ShoppingBag className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                            <p className="text-xs text-muted-foreground">No orders placed yet</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {orders.map((order) => (
                              <div key={order.id} className="rounded-lg border p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium">{order.orderNumber || "Order"}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      {formatDate(order.createdAt)} · {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-sm font-semibold">{formatCurrencyFull(order.total)}</p>
                                    <Badge className={`text-[9px] mt-0.5 ${getOrderStatusColor(order.status)}`} variant="secondary">
                                      {order.status.replace(/_/g, " ")}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>

                      {/* ──────────────────────────────────────────────────── */}
                      {/* NOTES TAB                                           */}
                      {/* ──────────────────────────────────────────────────── */}
                      <TabsContent value="notes" className="mt-0 space-y-4">
                        {/* Add note form */}
                        <div>
                          <SectionLabel>Add Note</SectionLabel>
                          <div className="space-y-2">
                            <Textarea
                              className="text-sm min-h-[72px] resize-none"
                              placeholder="Write a note about this customer…"
                              value={noteContent}
                              onChange={(e) => setNoteContent(e.target.value)}
                            />
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox" id="notePriv" className="h-3.5 w-3.5 rounded border-input accent-primary cursor-pointer"
                                  checked={notePrivate} onChange={(e) => setNotePrivate(e.target.checked)}
                                />
                                <Label htmlFor="notePriv" className="text-[11px] cursor-pointer text-muted-foreground">Private note</Label>
                              </div>
                              <Button size="sm" className="h-7 text-xs"
                                disabled={!noteContent.trim() || addNoteMutation.isPending}
                                onClick={() => addNoteMutation.mutate({ customerId: customer.id, content: noteContent, isPrivate: notePrivate })}>
                                {addNoteMutation.isPending ? "Saving…" : "Add Note"}
                              </Button>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Notes list */}
                        <div>
                          <SectionLabel>Notes History ({notes.length})</SectionLabel>
                          {notes.length === 0 ? (
                            <div className="rounded-lg border border-dashed p-6 text-center">
                              <MessageSquare className="h-7 w-7 mx-auto mb-1.5 text-muted-foreground/30" />
                              <p className="text-xs text-muted-foreground">No notes added yet</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {notes.map((note) => (
                                <div key={note.id} className={`rounded-lg border p-3 ${note.isPrivate ? "border-amber-200 bg-amber-50/60" : ""}`}>
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-xs leading-relaxed flex-1">{note.content}</p>
                                    {note.isPrivate && <Badge variant="outline" className="text-[9px] shrink-0 border-amber-300 text-amber-700">Private</Badge>}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                                    <span className="text-[10px] text-muted-foreground">{note.user?.name || "Staff"}</span>
                                    <span className="text-[10px] text-muted-foreground">·</span>
                                    <span className="text-[10px] text-muted-foreground">{formatDateTime(note.createdAt)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TabsContent>

                      {/* ──────────────────────────────────────────────────── */}
                      {/* ACTIVITY TAB                                        */}
                      {/* ──────────────────────────────────────────────────── */}
                      <TabsContent value="activity" className="mt-0 space-y-3">
                        <SectionLabel>Activity Timeline ({activityTimeline.length} events)</SectionLabel>
                        {activityTimeline.length === 0 ? (
                          <div className="rounded-lg border border-dashed p-8 text-center">
                            <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                            <p className="text-xs text-muted-foreground">No activity recorded yet</p>
                          </div>
                        ) : (
                          <div className="relative pl-1">
                            <div className="absolute left-[18px] top-3 bottom-3 w-px bg-border" />
                            <div className="space-y-3">
                              {activityTimeline.map((ev) => (
                                <div key={ev.id} className="flex gap-3 items-start">
                                  <div className={`flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full border bg-background z-10 ${ev.color}`}>
                                    <ev.icon className="h-3.5 w-3.5" />
                                  </div>
                                  <div className="min-w-0 flex-1 pb-1">
                                    <p className="text-xs font-medium leading-tight">{ev.label}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 break-words">{ev.detail}</p>
                                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{formatDateTime(ev.date)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </TabsContent>

                    </div>
                  </ScrollArea>
                </Tabs>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>

      {/* ================================================================== */}
      {/* Permission Control Dialog                                          */}
      {/* ================================================================== */}
      <Dialog open={permOpen} onOpenChange={setPermOpen}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              Customer Module Permissions
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure what each Business User ID can do with customer data. These settings apply when creating team accounts in Settings → Team Management.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            {BUSINESS_PERMISSIONS.map((perm) => (
              <div key={perm.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <perm.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{perm.label}</p>
                    <p className="text-[10px] text-muted-foreground">{perm.description}</p>
                  </div>
                </div>
                {/* Toggle switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={permConfig[perm.id]}
                  onClick={() => setPermConfig((c) => ({ ...c, [perm.id]: !c[perm.id] }))}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${permConfig[perm.id] ? "bg-primary" : "bg-input"}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg transition duration-200 ${permConfig[perm.id] ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-[10px] text-muted-foreground">
            <strong className="font-medium">Note:</strong> Permissions are enforced by the RBAC system. Changes here serve as the default template for new Business User IDs. Existing users must be updated individually in Settings → Team Management.
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPermOpen(false)}>Close</Button>
            <Button size="sm" onClick={() => { showSuccess("Permission template saved"); setPermOpen(false) }}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
