"use client"

// Customers — live, database-backed listing with per-customer KPIs and actions
// (View / Edit / New Order). Reads GET /api/laundry/customers; edits via
// PUT /api/laundry/customers/[id]. Viewing opens the Customer 360 slide-over
// (right panel, ~80% desktop width) with lazy-loaded tab sections. No placeholders.

import { useEffect, useState, useCallback, useMemo } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { useToast } from "@/hooks/use-toast"
import { toast as sonnerToast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet"
import {
  Users, Search, Loader2, Eye, Pencil, Plus, ChevronLeft, ChevronRight, UserCheck, Repeat, Wallet, Phone, Mail,
  MapPin, Save, Trash2, AlertTriangle, RotateCcw, Truck, Calendar, CheckCircle2, Star, MessageSquare,
  CreditCard, Shirt, History, FileText, LayoutDashboard, ShoppingBag, ArrowUpDown, PhoneCall, MessageCircle, X, ExternalLink,
} from "lucide-react"
import { SearchableSelect } from "./pricing/searchable-select"
import { INDIAN_STATES, isValidPincode, formatAddressLines } from "@/lib/india"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { AcquisitionFields, useAcquisitionOptions, defaultSourceId } from "@/components/laundry/customers/acquisition-fields"
import { useLaundryPermissions } from "@/hooks/use-laundry-permissions"

interface Row {
  id: string; name: string; phone: string | null; email: string | null; customerCode: string | null
  loyaltyTier: string; walletBalance: number; totalOrders: number; totalSpent: number
  status: string; isActive: boolean; lastOrderAt: string | null
}
interface Addr { id: string; addressType?: string; label?: string | null; addressLine1: string; addressLine2: string | null; area: string | null; landmark: string | null; city: string; state: string; pincode: string; country: string; isDefault?: boolean; isPickupDefault?: boolean; isDeliveryDefault?: boolean }
interface CustStats { totalOrders: number; completed: number; cancelled: number; grossValue: number; collected: number; outstanding: number; subsidised?: number; avgOrderValue: number; lastOrderAt: string | null; activeOrders?: number; memberSince?: string | null; subscription?: { planName: string; status: string; remainingKg: number; remainingPieces: number; expiry: string } | null }
interface Detail extends Row {
  avatar?: string | null; addresses: Addr[]; fullAddress?: string; tags?: string[]; comm?: Record<string, boolean>
  alternateMobile?: string | null; company?: string | null; reference?: string | null; anniversary?: string | null
  gender?: string | null; dateOfBirth?: string | null; gstNumber?: string | null; notes?: string; stats?: CustStats
  // Acquisition — how the business won this customer. Distinct from the
  // long-standing `source` channel field on the Customer row.
  customerSourceId?: string | null; customerSourceName?: string | null; customerSourceActive?: boolean
  salesTeamOwnerId?: string | null; salesTeamOwnerName?: string | null
}
interface TL { at: string; type: string; title: string; detail?: string | null; amount?: number | null; ref?: string | null }
interface Note { id: string; type: string; title: string; body: string | null; actorName: string | null; createdAt: string }
interface OrderRow {
  id: string; orderNumber: string; status: string; paymentStatus: string
  grandTotal: number; amountPaid: number; balanceDue: number; createdAt: string; isExpress?: boolean
  itemCount?: number; store?: { storeName?: string; storeCode?: string } | null
  services?: { serviceName: string }[]
  feedback?: { rating: number; comment?: string | null } | null
}

type TabKey = "overview" | "orders" | "timeline" | "feedback" | "addresses" | "subscriptions" | "payments" | "garments" | "audit"

const PAGE = 10
const ORDERS_PAGE = 8
const inr = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`
const tierStyle = (t: string) => ({ GOLD: "border-amber-300 text-amber-700 bg-amber-50", PLATINUM: "border-violet-300 text-violet-700 bg-violet-50", SILVER: "border-slate-300 text-slate-600 bg-slate-50" }[(t || "").toUpperCase()] || "border-orange-300 text-orange-700 bg-orange-50")
const initials = (n: string) => n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
const fmtD = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—")
const fmtDT = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—")
const STATUS_STYLE: Record<string, string> = {
  PENDING_STORE_AUDIT: "border-amber-300 text-amber-700 bg-amber-50",
  UNDER_AUDIT: "border-orange-300 text-orange-700 bg-orange-50",
  PAYMENT_PENDING: "border-rose-300 text-rose-700 bg-rose-50",
  READY_FOR_PROCESSING: "border-violet-300 text-violet-700 bg-violet-50",
  PACKED: "border-indigo-300 text-indigo-700 bg-indigo-50",
  IN_TRANSIT_TO_PROCESSING: "border-sky-300 text-sky-700 bg-sky-50",
  PROCESSING: "border-blue-300 text-blue-700 bg-blue-50",
  QC_PENDING: "border-fuchsia-300 text-fuchsia-700 bg-fuchsia-50",
  RETURN_IN_TRANSIT: "border-teal-300 text-teal-700 bg-teal-50",
  READY_FOR_DELIVERY: "border-emerald-300 text-emerald-700 bg-emerald-50",
  DELIVERED: "border-green-300 text-green-700 bg-green-50",
  CANCELLED: "border-slate-300 text-slate-500 bg-slate-50",
  DRAFT: "border-slate-300 text-slate-500 bg-slate-50",
}
const PAY_STYLE: Record<string, string> = {
  PAID: "border-green-300 text-green-700 bg-green-50",
  PARTIAL: "border-amber-300 text-amber-700 bg-amber-50",
  UNPAID: "border-rose-300 text-rose-700 bg-rose-50",
  SUBSCRIPTION: "border-blue-300 text-blue-700 bg-blue-50",
}
const Stars = ({ n }: { n: number }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < n ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}
  </div>
)
function SortHead({ label, k, sort, onSort }: { label: string; k: string; sort: { key: string; dir: "asc" | "desc" }; onSort: (key: string) => void }) {
  return (
    <button type="button" onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:text-blue-700">
      {label}<ArrowUpDown className="h-3 w-3 text-slate-300" />
    </button>
  )
}

export function LaundryCustomersView() {
  const { currentBusinessId, user } = useAuthStore()
  const isSuperAdmin = user?.role === "QUANTIX_SUPER_ADMIN"
  const { can } = useLaundryPermissions()
  const canArchive = can("laundry.customers.delete") || isSuperAdmin
  const { setLaundryPage, setSelectedOrderId, laundryFocusCustomerId, setLaundryFocusCustomerId } = useAdminStore()
  const { toast } = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState({ totalCustomers: 0, activeCustomers: 0, activeMemberships: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [showArchived, setShowArchived] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [custSub, setCustSub] = useState<{ planName: string; status: string; remainingKg: number; remainingPieces: number; allowanceKg: number | null; allowancePieces: number | null; expiry: string; renewalDate: string; autoRenew: boolean } | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [membership, setMembership] = useState<any>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [savingEdit, setSavingEdit] = useState(false)
  const { sources, owners } = useAcquisitionOptions(currentBusinessId || "")
  const [timeline, setTimeline] = useState<TL[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [newNote, setNewNote] = useState("")
  const [tab, setTab] = useState<TabKey>("overview")
  const [dispatchStatus, setDispatchStatus] = useState<any[]>([])
  const [scheduling, setScheduling] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({ address: "", date: "", timeSlot: "", notes: "", assignNow: false, executiveId: "" })
  const [schedulingBusy, setSchedulingBusy] = useState(false)
  // Address CRUD
  const [editAddress, setEditAddress] = useState<Partial<Addr> | null>(null)
  const [savingAddress, setSavingAddress] = useState(false)
  const [addressAction, setAddressAction] = useState<string | null>(null)
  // Dispatch history
  const [dispatchHistory, setDispatchHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  // Merge duplicate
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeQuery, setMergeQuery] = useState("")
  const [mergeResults, setMergeResults] = useState<Row[]>([])
  const [merging, setMerging] = useState(false)
  // Customer 360 lazy tab data
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersPage, setOrdersPage] = useState(0)
  const [ordersSearch, setOrdersSearch] = useState("")
  const [ordersStatus, setOrdersStatus] = useState("")
  const [ordersSort, setOrdersSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "createdAt", dir: "desc" })
  const [ordersLoaded, setOrdersLoaded] = useState(false)
  const [feedback, setFeedback] = useState<any[]>([])
  const [feedbackLoaded, setFeedbackLoaded] = useState(false)
  const [garments, setGarments] = useState<{ totalOrders: number; totalItems: number; services: { name: string; count: number }[] } | null>(null)
  const [garmentsLoaded, setGarmentsLoaded] = useState(false)
  const [auditLoaded, setAuditLoaded] = useState(false)

  // Archive (soft delete). Orders, invoices, payments, subscription ledger and
  // audit are NEVER deleted — the customer is marked archived and hidden from
  // search / New Order / Customer App; history stays intact.
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState(false)

  const doDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/laundry/customers/${deleteTarget.id}?businessId=${currentBusinessId}`, { method: "DELETE", headers: getAuthHeaders() })
      const json = await res.json()
      if (!res.ok || !json.success) { toast({ title: "Archive failed", description: json.error, variant: "destructive" }); return }
      toast({ title: "Customer archived", description: `${deleteTarget.name} is archived. Their orders and history are kept.` })
      setDeleteTarget(null); load()
    } catch { toast({ title: "Archive failed", variant: "destructive" }) } finally { setDeleting(false) }
  }

  // Restore an archived/merged customer (status → ACTIVE also flips isActive).
  // Additive; the same record is reactivated (no duplicate is ever created).
  const restore = async (c: Row) => {
    setRestoringId(c.id)
    try {
      const res = await fetch(`/api/laundry/customers/${c.id}`, { method: "PUT", headers: { ...getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, status: "ACTIVE" }) })
      const json = await res.json()
      if (!res.ok || json.success === false) { toast({ title: "Restore failed", description: json.error, variant: "destructive" }); return }
      toast({ title: "Customer restored", description: `${c.name} is active again.` })
      load()
    } catch { toast({ title: "Restore failed", variant: "destructive" }) } finally { setRestoringId(null) }
  }

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ businessId: currentBusinessId, limit: String(PAGE), offset: String(page * PAGE) })
      if (search.trim()) params.set("q", search.trim())
      if (showArchived) params.set("includeArchived", "1")
      const json = await fetch(`/api/laundry/customers?${params}`).then((r) => r.json())
      setRows(json.success ? json.data : []); setTotal(json.total || 0)
      if (json.summary) setSummary(json.summary)
    } catch { setRows([]) } finally { setLoading(false) }
  }, [currentBusinessId, page, search, showArchived])
  useEffect(() => { load() }, [load])

  // ── Customer 360 lazy loaders (first activation of a tab only) ─────────────
  const loadOrders = useCallback(async (custId: string, page: number, status: string, searchText: string) => {
    if (!custId || !currentBusinessId) return
    setOrdersLoading(true)
    try {
      const params = new URLSearchParams({ businessId: currentBusinessId, customerId: custId, limit: String(ORDERS_PAGE), offset: String(page * ORDERS_PAGE) })
      if (status) params.set("status", status)
      if (searchText.trim()) params.set("search", searchText.trim())
      const j = await fetch(`/api/laundry/orders?${params}`).then((r) => r.json())
      if (j.success) { setOrders(j.data || []); setOrdersTotal(j.total || 0) }
    } catch { setOrders([]); setOrdersTotal(0) } finally { setOrdersLoading(false) }
  }, [currentBusinessId])

  const loadFeedback = useCallback(async () => {
    if (!detail || !currentBusinessId) return
    try {
      const j = await fetch(`/api/laundry/orders?businessId=${currentBusinessId}&customerId=${detail.id}&limit=100`).then((r) => r.json())
      const rows = (j.data || []).filter((o: OrderRow) => o.feedback?.rating).map((o: OrderRow) => ({ id: o.id, orderNumber: o.orderNumber, rating: o.feedback?.rating, comment: o.feedback?.comment || "", createdAt: o.createdAt }))
      setFeedback(rows)
    } catch { setFeedback([]) }
  }, [currentBusinessId, detail])

  const loadGarments = useCallback(async () => {
    if (!detail || !currentBusinessId) return
    try {
      const j = await fetch(`/api/laundry/orders?businessId=${currentBusinessId}&customerId=${detail.id}&limit=100`).then((r) => r.json())
      const rows = (j.data || []) as OrderRow[]
      const svc = new Map<string, number>()
      let totalItems = 0
      for (const o of rows) {
        totalItems += o.itemCount || 0
        for (const s of o.services || []) svc.set(s.serviceName, (svc.get(s.serviceName) || 0) + 1)
      }
      setGarments({ totalOrders: rows.length, totalItems, services: [...svc.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count) })
    } catch { setGarments(null) }
  }, [currentBusinessId, detail])

  const openTab = (t: TabKey) => {
    setTab(t)
    if ((t === "overview" || t === "orders") && !ordersLoaded && detail) { setOrdersLoaded(true); loadOrders(detail.id, 0, ordersStatus, ordersSearch) }
    if (t === "feedback" && !feedbackLoaded) { setFeedbackLoaded(true); loadFeedback() }
    if (t === "garments" && !garmentsLoaded) { setGarmentsLoaded(true); loadGarments() }
    if (t === "timeline") loadDispatchHistory()
    if (t === "audit" && !auditLoaded) setAuditLoaded(true)
  }

  const openCustomer = async (id: string, edit: boolean) => {
    setOpenId(id); setEditing(edit); setDetail(null); setCustSub(null); setMembership(null); setTimeline([]); setNotes([]); setTab("overview"); setLoadingDetail(true); setScheduling(false); setDispatchStatus([])
    // Reset lazy tab state for a fresh profile
    setOrders([]); setOrdersTotal(0); setOrdersPage(0); setOrdersSearch(""); setOrdersStatus(""); setOrdersLoaded(false)
    setFeedback([]); setFeedbackLoaded(false); setGarments(null); setGarmentsLoaded(false); setAuditLoaded(false)
    fetch(`/api/laundry/customers/${id}/membership?businessId=${currentBusinessId}`).then((r) => r.json())
      .then((j) => setMembership(j.success ? j.data : null)).catch(() => setMembership(null))
    // Active/GRACE subscription (Part 8) — detected, never assumed.
    fetch(`/api/laundry/subscriptions/active?businessId=${currentBusinessId}&customerId=${id}`).then((r) => r.json())
      .then((j) => setCustSub(j.success && j.data.length ? j.data[0] : null)).catch(() => setCustSub(null))
    fetch(`/api/laundry/customers/${id}/timeline?businessId=${currentBusinessId}`).then((r) => r.json()).then((j) => setTimeline(j.success ? j.data : [])).catch(() => {})
    fetch(`/api/laundry/customers/${id}/notes?businessId=${currentBusinessId}`).then((r) => r.json()).then((j) => setNotes(j.success ? j.data : [])).catch(() => {})
    fetch(`/api/laundry/dispatch/status?businessId=${currentBusinessId}&customerId=${id}`).then((r) => r.json()).then((j) => setDispatchStatus(j.success ? j.data : [])).catch(() => {})
    try {
      const json = await fetch(`/api/laundry/customers/${id}?businessId=${currentBusinessId}`).then((r) => r.json())
      if (json.success) {
        const d = json.data as Detail; setDetail(d)
        const a = d.addresses?.[0]
        setForm({ customerSourceId: d.customerSourceId || "", salesTeamOwnerId: d.salesTeamOwnerId || "", salesTeamOwnerName: d.salesTeamOwnerName || "", name: d.name, mobile: d.phone || "", email: d.email || "", alternateMobile: d.alternateMobile || "", company: d.company || "", gstNumber: d.gstNumber || "", gender: d.gender || "", reference: d.reference || "", tags: (d.tags || []).join(", "), status: d.status || "ACTIVE", addressLine1: a?.addressLine1 || "", addressLine2: a?.addressLine2 || "", area: a?.area || "", landmark: a?.landmark || "", city: a?.city || "", state: a?.state || "", pincode: a?.pincode || "" })
        // Overview is the default tab → warm the recent-orders list immediately.
        if (!edit) { setOrdersLoaded(true); loadOrders(id, 0, "", "") }
      }
    } catch { /* noop */ } finally { setLoadingDetail(false) }
  }
  const closeDialog = () => { setOpenId(null); setDetail(null); setEditing(false); setOrders([]); setOrdersLoaded(false); setFeedback([]); setFeedbackLoaded(false); setGarments(null); setGarmentsLoaded(false) }

  // Deep-link from the New Order "View Customer" quick action — open the focused
  // customer once, then clear the flag so it doesn't re-trigger.
  useEffect(() => {
    if (!laundryFocusCustomerId || !currentBusinessId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    openCustomer(laundryFocusCustomerId, false)
    setLaundryFocusCustomerId(null)
  }, [laundryFocusCustomerId, currentBusinessId])

  const addNote = async () => {
    if (!newNote.trim() || !detail) return
    try {
      const res = await fetch(`/api/laundry/customers/${detail.id}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, content: newNote.trim(), type: "NOTE", actorName: user?.name || "staff" }) })
      const j = await res.json()
      if (j.success) { setNotes((n) => [j.data, ...n]); setTimeline((t) => [{ at: j.data.createdAt, type: "NOTE", title: j.data.title, detail: j.data.body }, ...t]); setNewNote("") }
    } catch { toast({ title: "Failed to add note", variant: "destructive" }) }
  }
  const searchMerge = async (q: string) => {
    setMergeQuery(q)
    if (q.trim().length < 2) { setMergeResults([]); return }
    try { const j = await fetch(`/api/laundry/customers?businessId=${currentBusinessId}&q=${encodeURIComponent(q)}`).then((r) => r.json()); setMergeResults((j.data || []).filter((c: Row) => c.id !== detail?.id)) } catch { setMergeResults([]) }
  }
  const schedulePickup = async () => {
    if (!detail || !currentBusinessId) return
    setSchedulingBusy(true)
    try {
      const res = await fetch("/api/laundry/dispatch/pickup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: currentBusinessId, customerId: detail.id,
          pickupAddress: scheduleForm.address || detail.addresses?.[0]?.addressLine1 || null,
          pickupDate: scheduleForm.date || null,
          pickupTimeSlot: scheduleForm.timeSlot || null,
          notes: scheduleForm.notes || null,
          executiveId: scheduleForm.assignNow && scheduleForm.executiveId ? scheduleForm.executiveId : null,
        }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Failed")
      toast({ title: j.existing ? "Active pickup exists" : "Pickup scheduled", description: j.data?.orderNumber || "" })
      setScheduling(false)
      setScheduleForm({ address: "", date: "", timeSlot: "", notes: "", assignNow: false, executiveId: "" })
      const r = await fetch(`/api/laundry/dispatch/status?businessId=${currentBusinessId}&customerId=${detail.id}`).then((r) => r.json())
      if (r.success) setDispatchStatus(r.data)
    } catch (e) { toast({ title: "Schedule failed", description: e instanceof Error ? e.message : "", variant: "destructive" }) }
    finally { setSchedulingBusy(false) }
  }

  const sendInvite = async () => {
    if (!detail?.email) { toast({ title: "Email required", description: "Add an email address before sending an app invitation.", variant: "destructive" }); return }
    try {
      const res = await fetch(`/api/laundry/app/invite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, email: detail.email, name: detail.name, customerId: detail.id, source: "WALK_IN", actorName: user?.name || "staff" }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Failed to send")
      toast({ title: "Invitation sent", description: j.data?.sent ? `App invite emailed to ${detail.email}` : `Invite prepared for ${detail.email} (email delivery pending SMTP config)` })
    } catch (e) { toast({ title: "Invite failed", description: e instanceof Error ? e.message : "", variant: "destructive" }) }
  }
  const doMerge = async (duplicateId: string) => {
    if (!detail) return
    setMerging(true)
    try {
      const res = await fetch(`/api/laundry/customers/merge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, primaryId: detail.id, duplicateId, actorName: user?.name || "admin" }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Merge failed")
      toast({ title: "Customers merged", description: "Orders, subscriptions, addresses and history moved to this profile." })
      setMergeOpen(false); setMergeQuery(""); setMergeResults([]); load(); openCustomer(detail.id, false)
    } catch (e) { toast({ title: "Merge failed", description: e instanceof Error ? e.message : "", variant: "destructive" }) } finally { setMerging(false) }
  }

  // Address CRUD
  const openAddressForm = (a?: Addr) => {
    setEditAddress(a ? { ...a } : { addressType: "HOME", isDefault: false, isPickupDefault: false, isDeliveryDefault: false, addressLine1: "", addressLine2: "", area: "", landmark: "", city: "", state: "", pincode: "", country: "India" })
    setAddressAction(a ? "edit" : "add")
  }
  const closeAddressForm = () => { setEditAddress(null); setAddressAction(null) }
  const saveAddress = async () => {
    if (!editAddress || !detail) return
    if (!editAddress.addressLine1?.trim()) { toast({ title: "Address line 1 is required", variant: "destructive" }); return }
    const isNew = addressAction === "add"
    setSavingAddress(true)
    try {
      const url = isNew ? `/api/laundry/customers/${detail.id}/addresses` : `/api/laundry/customers/${detail.id}/addresses/${editAddress.id}`
      const method = isNew ? "POST" : "PUT"
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, ...editAddress }) })
      const j = await res.json()
      if (!res.ok || !j.success) { toast({ title: isNew ? "Add failed" : "Update failed", description: j.error, variant: "destructive" }); return }
      toast({ title: isNew ? "Address added" : "Address updated" })
      const r = await fetch(`/api/laundry/customers/${detail.id}?businessId=${currentBusinessId}`).then((r) => r.json())
      if (r.success) setDetail(r.data)
      closeAddressForm()
    } catch { toast({ title: "Address save failed", variant: "destructive" }) } finally { setSavingAddress(false) }
  }
  const deleteAddress = async (addrId: string) => {
    if (!detail) return
    try {
      const res = await fetch(`/api/laundry/customers/${detail.id}/addresses/${addrId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId }) })
      const j = await res.json()
      if (!res.ok || !j.success) { toast({ title: "Delete failed", description: j.error, variant: "destructive" }); return }
      toast({ title: "Address deleted" })
      const r = await fetch(`/api/laundry/customers/${detail.id}?businessId=${currentBusinessId}`).then((r) => r.json())
      if (r.success) setDetail(r.data)
    } catch { toast({ title: "Address delete failed", variant: "destructive" }) }
  }
  const setDefaultAddress = async (addrId: string, field: "isDefault" | "isPickupDefault" | "isDeliveryDefault") => {
    if (!detail) return
    try {
      const res = await fetch(`/api/laundry/customers/${detail.id}/addresses/${addrId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, [field]: true }) })
      const j = await res.json()
      if (!res.ok || !j.success) { toast({ title: "Set default failed", description: j.error, variant: "destructive" }); return }
      toast({ title: "Default updated" })
      const r = await fetch(`/api/laundry/customers/${detail.id}?businessId=${currentBusinessId}`).then((r) => r.json())
      if (r.success) setDetail(r.data)
    } catch { toast({ title: "Set default failed", variant: "destructive" }) }
  }
  const loadDispatchHistory = async () => {
    if (!detail || !currentBusinessId) return
    setLoadingHistory(true)
    try {
      const r = await fetch(`/api/laundry/dispatch/status?businessId=${currentBusinessId}&customerId=${detail.id}&scope=history`).then((r) => r.json())
      if (r.success) setDispatchHistory(r.data)
    } catch { /* silent */ } finally { setLoadingHistory(false) }
  }

  const saveEdit = async () => {
    if (!detail) return
    if (form.pincode && !isValidPincode(form.pincode)) { toast({ title: "Invalid PIN Code", variant: "destructive" }); return }
    setSavingEdit(true)
    try {
      const tags = (form.tags || "").split(",").map((t) => t.trim()).filter(Boolean)
      const res = await fetch(`/api/laundry/customers/${detail.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, ...form, tags }) })
      const json = await res.json()
      if (!res.ok || !json.success) { toast({ title: "Update failed", description: json.error, variant: "destructive" }); return }
      toast({ title: "Customer updated" }); closeDialog(); load()
    } catch { toast({ title: "Update failed", variant: "destructive" }) } finally { setSavingEdit(false) }
  }

  // ── Customer 360 lazy loaders (first activation of a tab only) ─────────────

  // Client-side sort of the currently loaded order page.
  const sortedOrders = useMemo(() => {
    if (!orders.length) return orders
    const arr = [...orders]
    const dir = ordersSort.dir === "asc" ? 1 : -1
    arr.sort((a, b) => {
      if (ordersSort.key === "orderNumber") return a.orderNumber.localeCompare(b.orderNumber) * dir
      if (ordersSort.key === "grandTotal") return (a.grandTotal - b.grandTotal) * dir
      if (ordersSort.key === "status") return a.status.localeCompare(b.status) * dir
      if (ordersSort.key === "paymentStatus") return a.paymentStatus.localeCompare(b.paymentStatus) * dir
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir
    })
    return arr
  }, [orders, ordersSort])
  const toggleSort = (key: string) => setOrdersSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }))

  const ordersPages = Math.max(1, Math.ceil(ordersTotal / ORDERS_PAGE))
  const payments = useMemo(() => timeline.filter((t) => t.type === "PAYMENT"), [timeline])
  const auditRows = useMemo(() => {
    const activities = (notes as Note[]).map((n) => ({ at: n.createdAt, type: n.type || "ACTIVITY", title: n.title || "Activity", who: n.actorName || "—", body: n.body || "" }))
    const events = timeline.filter((t) => t.type === "DISPATCH").map((t) => ({ at: t.at, type: "DISPATCH", title: t.title, who: t.detail?.split(" · ")[1] || "—", body: t.detail || "" }))
    return [...activities, ...events].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [notes, timeline])

  const pages = Math.max(1, Math.ceil(total / PAGE))

  // Business-wide counts from the API (not page-scoped) — pagination belongs in
  // the pagination controls below, not the summary cards.
  const KPIS = [
    { label: "Total Customers", value: summary.totalCustomers, icon: Users, color: "text-blue-600 bg-blue-50" },
    { label: "Active Customers", value: summary.activeCustomers, icon: UserCheck, color: "text-green-600 bg-green-50" },
    { label: "Customer Memberships", value: summary.activeMemberships, icon: Repeat, color: "text-violet-600 bg-violet-50" },
  ]

  const phoneDigits = (detail?.phone || "").replace(/\D/g, "")
  const waLink = phoneDigits ? `https://wa.me/${phoneDigits}` : null
  const telLink = phoneDigits ? `tel:${phoneDigits}` : null

  const stats = detail?.stats
  const memberSince = stats?.memberSince || null
  const headerKPIs = [
    { label: "Wallet", value: inr(detail?.walletBalance || 0), icon: Wallet },
    { label: "Lifetime", value: inr(detail?.totalSpent || 0), icon: CreditCard },
    { label: "Active Orders", value: stats?.activeOrders ?? 0, icon: Truck },
    { label: "Total Orders", value: stats?.totalOrders ?? detail?.totalOrders ?? 0, icon: ShoppingBag },
    { label: "Customer Since", value: fmtD(memberSince), icon: Calendar },
  ]

  const openOrder = (id: string) => { setSelectedOrderId(id); setLaundryPage("order-detail") }

  return (
    <div className="px-4 lg:px-6 py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><Users className="h-5 w-5 text-blue-600" /> Customers</h1>
          <p className="text-sm text-slate-500">Manage all your customers in one place</p>
        </div>
        <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setLaundryPage("new-order")}><Plus className="h-3.5 w-3.5" /> New Order</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {KPIS.map((k) => (
          <Card key={k.label} className="rounded-xl border-slate-200 shadow-sm"><CardContent className="p-4 flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${k.color}`}><k.icon className="h-5 w-5" /></div>
            <div><p className="text-2xl font-bold text-slate-800 leading-none tabular-nums">{k.value}</p><p className="text-[11px] text-slate-400 mt-1">{k.label}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="relative max-w-md flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input placeholder="Search by name, mobile, email or customer ID…" className="pl-9 h-9 bg-slate-50 border-slate-200" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} /></div>
            <label className="flex items-center gap-2 text-xs text-slate-500 shrink-0 cursor-pointer select-none"><input type="checkbox" checked={showArchived} onChange={(e) => { setShowArchived(e.target.checked); setPage(0) }} /> Show Archived</label>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16"><Users className="h-8 w-8 text-slate-300 mx-auto mb-2" /><p className="text-sm font-medium text-slate-600">{search ? "No customers match" : "No customers yet"}</p><p className="text-xs text-slate-400 mt-0.5">Add a customer from New Order.</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow className="text-[11px] uppercase tracking-wide">
                <TableHead className="w-[26%]">Customer</TableHead><TableHead className="w-[22%]">Contact</TableHead><TableHead>Membership</TableHead>
                <TableHead className="text-right">Wallet</TableHead>
                <TableHead className="text-right">Lifetime Value</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id} className={c.isActive ? "" : "opacity-60 bg-slate-50/50"}>
                    <TableCell><div className="flex items-center gap-2.5"><Avatar className="h-9 w-9"><AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">{initials(c.name)}</AvatarFallback></Avatar><div><p className="text-sm font-medium text-slate-800">{c.name}</p><p className="text-[11px] text-slate-400 font-mono">{c.customerCode || "—"}</p></div></div></TableCell>
                    <TableCell><p className="text-sm text-slate-600">{c.phone || "—"}</p><p className="text-[11px] text-slate-400">{c.email || ""}</p></TableCell>
                    <TableCell><Badge variant="outline" className={`text-[11px] ${tierStyle(c.loyaltyTier)}`}>{c.loyaltyTier || "Bronze"}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{inr(c.walletBalance)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{inr(c.totalSpent)}</TableCell>
                    <TableCell><Badge variant="outline" className={c.isActive ? "border-green-300 text-green-700 bg-green-50" : "border-amber-300 text-amber-600 bg-amber-50"}>{c.isActive ? "Active" : c.status === "MERGED" ? "Archived · Merged" : "Archived"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600" title="View" onClick={() => openCustomer(c.id, false)}><Eye className="h-4 w-4" /></Button>
                        {c.isActive ? (<>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600" title="Edit" onClick={() => openCustomer(c.id, true)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600" title="New Order" onClick={() => setLaundryPage("new-order")}><Plus className="h-4 w-4" /></Button>
                          {canArchive && <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-amber-600" title="Archive customer (keeps order history)" onClick={() => setDeleteTarget(c)}><Trash2 className="h-4 w-4" /></Button>}
                        </>) : (
                          canArchive && <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-600" title="Restore customer" disabled={restoringId === c.id} onClick={() => restore(c)}>{restoringId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {total > PAGE && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Showing {page * PAGE + 1}–{page * PAGE + rows.length} of {total}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="px-2 text-xs">Page {page + 1} / {pages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* ── Customer 360 slide-over (right, ~80% desktop width) ─────────────── */}
      <Sheet open={!!openId} onOpenChange={(o) => !o && closeDialog()}>
        <SheetContent side="right" className="w-full sm:w-[85%] lg:w-[80%] xl:w-[75%] sm:max-w-none max-w-[1400px] p-0 gap-0 overflow-y-auto">
          <SheetTitle className="sr-only">Customer 360</SheetTitle>
          <SheetDescription className="sr-only">Full customer profile, orders, timeline, feedback, addresses, subscriptions, payments, garments and audit log.</SheetDescription>
          {loadingDetail || !detail ? (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : editing ? (
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-800 flex items-center gap-2"><Pencil className="h-5 w-5 text-blue-600" /> Edit Customer</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                  <Button onClick={saveEdit} disabled={savingEdit} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">{savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</Button>
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-1"><Label className="text-xs">Name *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Mobile *</Label><Input value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">Alternate Mobile</Label><Input value={form.alternateMobile || ""} onChange={(e) => setForm((f) => ({ ...f, alternateMobile: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">Company</Label><Input value={form.company || ""} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">GST</Label><Input value={form.gstNumber || ""} onChange={(e) => setForm((f) => ({ ...f, gstNumber: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">Status</Label>
                    <select value={form.status || "ACTIVE"} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background">
                      {["ACTIVE", "INACTIVE", "BLOCKED"].map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                    </select>
                  </div>
                </div>
                {/* Acquisition — how this customer was won. Editable later,
                    because it is often learnt after the record is created. */}
                <AcquisitionFields
                  sources={sources}
                  owners={owners}
                  sourceId={form.customerSourceId || defaultSourceId(sources)}
                  ownerId={form.salesTeamOwnerId || ""}
                  onSourceChange={(id) => setForm((f) => ({ ...f, customerSourceId: id }))}
                  onOwnerChange={(id, name) => setForm((f) => ({ ...f, salesTeamOwnerId: id, salesTeamOwnerName: name }))}
                />
                <div className="space-y-1"><Label className="text-xs">Tags (comma separated)</Label><Input value={form.tags || ""} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="VIP, Corporate, Premium" /></div>
                <div className="space-y-1"><Label className="text-xs">Address Line 1</Label><Input value={form.addressLine1} onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Address Line 2</Label><Input value={form.addressLine2} onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Area</Label><Input value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">City</Label><Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">State</Label><SearchableSelect value={form.state} onChange={(v) => setForm((f) => ({ ...f, state: v }))} options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} placeholder="Select state" /></div>
                  <div className="space-y-1"><Label className="text-xs">PIN Code</Label><Input value={form.pincode} inputMode="numeric" maxLength={6} onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))} /></div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Sticky header */}
              <div className="sticky top-0 z-20 bg-white border-b border-slate-200">
                <div className="p-4 lg:p-5 pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-12 w-12"><AvatarImage src={detail.avatar || undefined} alt={detail.name} /><AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">{initials(detail.name)}</AvatarFallback></Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-slate-800 text-lg leading-tight truncate">{detail.name}</p>
                          <Badge variant="outline" className={detail.isActive ? "border-green-300 text-green-700 bg-green-50" : "border-amber-300 text-amber-600 bg-amber-50"}>{detail.isActive ? "Active" : detail.status === "MERGED" ? "Merged" : "Archived"}</Badge>
                          <Badge variant="outline" className={`text-[11px] ${tierStyle(detail.loyaltyTier)}`}>{detail.loyaltyTier || "Bronze"}</Badge>
                        </div>
                        <p className="font-mono text-[11px] text-slate-400 mt-0.5">{detail.customerCode || "—"}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-600">
                          {detail.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3 text-slate-400" /> {detail.phone}{detail.alternateMobile ? ` · ${detail.alternateMobile}` : ""}</span>}
                          {detail.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3 text-slate-400" /> {detail.email}</span>}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(detail.tags || []).map((t) => <Badge key={t} variant="outline" className="text-[10px] border-blue-200 text-blue-700 bg-blue-50">{t}</Badge>)}
                          {detail.status === "MERGED" && <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-500">Merged</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                        <Button size="sm" className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setLaundryPage("new-order")}><Plus className="h-3.5 w-3.5" /> New Order</Button>
                        {telLink && <a href={telLink}><Button size="sm" variant="outline" className="h-8 gap-1" title="Call"><PhoneCall className="h-3.5 w-3.5" /> Call</Button></a>}
                        {waLink && <a href={waLink} target="_blank" rel="noreferrer"><Button size="sm" variant="outline" className="h-8 gap-1" title="WhatsApp"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</Button></a>}
                        <SheetClose asChild><Button size="sm" variant="outline" className="h-8 w-8 p-0" title="Close"><X className="h-4 w-4" /></Button></SheetClose>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        {custSub && <span className="inline-flex items-center gap-1"><Repeat className="h-3 w-3 text-blue-500" /> {custSub.planName} · {custSub.status === "GRACE" ? "Grace" : "Active"}</span>}
                        {stats?.subscription?.planName && !custSub && <span className="inline-flex items-center gap-1"><Repeat className="h-3 w-3 text-blue-500" /> {stats.subscription.planName}</span>}
                      </div>
                    </div>
                  </div>
                  {/* KPI strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-3">
                    {headerKPIs.map((k) => (
                      <div key={k.label} className="rounded-lg border border-slate-200 px-2.5 py-1.5">
                        <p className="text-[10px] uppercase text-slate-400 flex items-center gap-1"><k.icon className="h-3 w-3" /> {k.label}</p>
                        <p className="text-sm font-bold text-slate-800 tabular-nums truncate">{k.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Sticky tabs */}
                <div className="flex gap-1 px-4 lg:px-5 pt-2 overflow-x-auto">
                  {([
                    { k: "overview", l: "Overview", icon: LayoutDashboard },
                    { k: "orders", l: "Orders", icon: ShoppingBag },
                    { k: "timeline", l: "Timeline", icon: History },
                    { k: "feedback", l: "Feedback", icon: Star },
                    { k: "addresses", l: "Addresses", icon: MapPin },
                    { k: "subscriptions", l: "Subscriptions", icon: Repeat },
                    { k: "payments", l: "Payments", icon: CreditCard },
                    { k: "garments", l: "Garments", icon: Shirt },
                    { k: "audit", l: "Audit Log", icon: FileText },
                  ] as { k: TabKey; l: string; icon: typeof Star }[]).map((t) => (
                    <button key={t.k} onClick={() => openTab(t.k)} className={`inline-flex items-center gap-1.5 px-2.5 h-9 text-xs font-medium capitalize whitespace-nowrap border-b-2 ${tab === t.k ? "border-blue-600 text-blue-700" : "border-transparent text-slate-400 hover:text-slate-600"}`}><t.icon className="h-3.5 w-3.5" /> {t.l}</button>
                  ))}
                </div>
              </div>

              {/* Scrollable tab body */}
              <div className="p-4 lg:p-5 space-y-3 text-sm">
                {tab === "overview" && <div className="space-y-3">
                  {/* Statistics */}
                  {stats && (
                    <div className="grid grid-cols-3 gap-2">
                      {[{ l: "Orders", v: stats.totalOrders }, { l: "Completed", v: stats.completed }, { l: "Cancelled", v: stats.cancelled }, { l: "Revenue", v: inr(stats.grossValue) }, { l: "Outstanding", v: inr(stats.outstanding), c: stats.outstanding > 0 ? "text-rose-600" : "" }, { l: "Avg Order", v: inr(stats.avgOrderValue) }].map((s) => (
                        <div key={s.l} className="rounded-lg border border-slate-200 px-2 py-1.5"><p className="text-[10px] uppercase text-slate-400">{s.l}</p><p className={`text-sm font-bold ${s.c || "text-slate-800"}`}>{s.v}</p></div>
                      ))}
                    </div>
                  )}

                  {/* Dispatch Actions */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-blue-800 flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> Dispatch</p>
                      {!scheduling && <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 border-blue-200 text-blue-700" onClick={() => { const def = detail.addresses?.find((a: Addr) => a.isPickupDefault) || detail.addresses?.[0]; setScheduleForm((f) => ({ ...f, address: def ? `${def.addressLine1}, ${def.area ? def.area + ", " : ""}${def.city}` : "" })); setScheduling(true) }}><Plus className="h-3 w-3" /> Schedule Pickup</Button>}
                    </div>
                    {scheduling && (
                      <div className="space-y-2 bg-white rounded border border-blue-200 p-2">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] text-slate-500">Pickup Address</label>
                            {detail.addresses.length > 0 && (
                              <select className="text-[10px] border border-slate-200 rounded px-1 h-5 max-w-[140px]" value="" onChange={(e) => { if (!e.target.value) return; const a = detail.addresses.find((ad: Addr) => ad.id === e.target.value); if (a) setScheduleForm((f) => ({ ...f, address: `${a.addressLine1}, ${a.area ? a.area + ", " : ""}${a.city}` })) }}>
                                <option value="">Change address…</option>
                                {detail.addresses.map((a: Addr) => <option key={a.id} value={a.id}>{a.label || a.addressType || "HOME"} — {a.addressLine1}, {a.city}</option>)}
                              </select>
                            )}
                          </div>
                          <input value={scheduleForm.address} onChange={(e) => setScheduleForm((f) => ({ ...f, address: e.target.value }))} className="w-full h-7 text-xs rounded border border-slate-200 px-2" placeholder="Type or select an address above" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1"><label className="text-[10px] text-slate-500">Date</label><input type="date" value={scheduleForm.date} onChange={(e) => setScheduleForm((f) => ({ ...f, date: e.target.value }))} className="w-full h-7 text-xs rounded border border-slate-200 px-2" /></div>
                          <div className="space-y-1"><label className="text-[10px] text-slate-500">Time Slot</label><input value={scheduleForm.timeSlot} onChange={(e) => setScheduleForm((f) => ({ ...f, timeSlot: e.target.value }))} className="w-full h-7 text-xs rounded border border-slate-200 px-2" placeholder="e.g. 10:00–12:00" /></div>
                        </div>
                        <div className="space-y-1"><label className="text-[10px] text-slate-500">Notes</label><input value={scheduleForm.notes} onChange={(e) => setScheduleForm((f) => ({ ...f, notes: e.target.value }))} className="w-full h-7 text-xs rounded border border-slate-200 px-2" placeholder="Optional" /></div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 text-[10px] text-slate-600 cursor-pointer"><input type="checkbox" checked={scheduleForm.assignNow} onChange={(e) => setScheduleForm((f) => ({ ...f, assignNow: e.target.checked }))} /> Assign Now</label>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 text-[10px] gap-1 bg-blue-600 hover:bg-blue-700 text-white flex-1" disabled={schedulingBusy} onClick={schedulePickup}>
                            {schedulingBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Schedule
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setScheduling(false)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                    {dispatchStatus.length > 0 && (
                      <div className="space-y-1">
                        {dispatchStatus.filter((d: any) => d.pickup.required && d.pickup.status !== "COMPLETED").map((d: any) => (
                          <div key={d.orderId} className="flex items-center justify-between text-[10px] bg-white rounded border border-blue-100 px-2 py-1">
                            <button type="button" className="font-mono text-blue-700 hover:underline text-left" onClick={() => openOrder(d.orderId)}>{d.orderNumber}</button>
                            <span className="flex items-center gap-1 text-slate-600">{d.pickup.executiveName || "Unassigned"} · {d.pickup.status}</span>
                          </div>
                        ))}
                        {dispatchStatus.filter((d: any) => d.delivery.required && d.delivery.status !== "COMPLETED").map((d: any) => (
                          <div key={d.orderId} className="flex items-center justify-between text-[10px] bg-white rounded border border-violet-100 px-2 py-1">
                            <button type="button" className="font-mono text-violet-700 hover:underline text-left" onClick={() => openOrder(d.orderId)}>{d.orderNumber}</button>
                            <span className="flex items-center gap-1 text-slate-600">{d.delivery.executiveName || "Unassigned"} · {d.delivery.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Contact + communication */}
                  <div className="grid grid-cols-2 gap-3">
                    <div><p className="text-xs text-slate-400 flex items-center gap-1"><Phone className="h-3 w-3" /> Mobile</p><p className="text-slate-700">{detail.phone || "—"}{detail.alternateMobile ? ` · ${detail.alternateMobile}` : ""}</p></div>
                    <div><p className="text-xs text-slate-400 flex items-center gap-1"><Mail className="h-3 w-3" /> Email</p><p className="text-slate-700">{detail.email || "—"}</p></div>
                    <div><p className="text-xs text-slate-400">Company</p><p className="text-slate-700">{detail.company || "—"}</p></div>
                    <div><p className="text-xs text-slate-400">GST</p><p className="text-slate-700">{detail.gstNumber || "—"}</p></div>
                    <div><p className="text-xs text-slate-400 flex items-center gap-1"><Wallet className="h-3 w-3" /> Wallet</p><p className="text-slate-700">{inr(detail.walletBalance)}</p></div>
                    <div><p className="text-xs text-slate-400">Reference</p><p className="text-slate-700">{detail.reference || "—"}</p></div>
                  </div>
                  {/* Acquisition — how this customer was won. Kept as its own
                      block rather than mixed into contact details, because it
                      is what the source and salesperson reports read. */}
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Acquisition</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-400">Source</p>
                        <p className="text-slate-700">
                          {detail.customerSourceName || "Direct"}
                          {detail.customerSourceActive === false && <span className="ml-1 text-[10px] text-slate-400">(inactive)</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Sales Team Owner</p>
                        <p className="text-slate-700">{detail.salesTeamOwnerName || "—"}</p>
                      </div>
                    </div>
                  </div>

                  <div><p className="text-xs text-slate-400">Communication</p><div className="flex flex-wrap gap-1 mt-0.5">{["sms", "whatsapp", "email", "push", "marketing"].map((k) => <Badge key={k} variant="outline" className={`text-[10px] capitalize ${detail.comm?.[k] ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-400"}`}>{k}</Badge>)}</div></div>
                  <Button size="sm" variant="outline" className="w-full gap-1.5 border-blue-200 text-blue-700" disabled={!detail.email} onClick={sendInvite}><Mail className="h-3.5 w-3.5" /> Send App Registration Invitation</Button>

                  {/* Current subscription */}
                  {custSub && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                      <div className="flex items-center justify-between"><p className="text-sm font-semibold text-blue-800 flex items-center gap-1.5"><Repeat className="h-4 w-4" /> {custSub.planName}</p><Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700 bg-blue-50">{custSub.status === "GRACE" ? "In Grace" : "Active"}</Badge></div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {(custSub.allowanceKg ?? 0) > 0 && <span className="rounded bg-white border border-blue-200 text-blue-700 px-2 py-0.5">{custSub.remainingKg} / {custSub.allowanceKg} KG left</span>}
                        {(custSub.allowancePieces ?? 0) > 0 && <span className="rounded bg-white border border-violet-200 text-violet-700 px-2 py-0.5">{custSub.remainingPieces} / {custSub.allowancePieces} pieces left</span>}
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">Expires {fmtD(custSub.expiry)} · {custSub.autoRenew ? "Auto-renews" : "Manual renewal"}</p>
                    </div>
                  )}
                  {detail.notes && <div><p className="text-xs text-slate-400">Profile note</p><p className="text-slate-600 text-xs">{detail.notes}</p></div>}

                  {/* Recent orders */}
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"><ShoppingBag className="h-3.5 w-3.5 text-blue-600" /> Recent Orders</p>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-blue-600" onClick={() => openTab("orders")}>View all <ExternalLink className="h-3 w-3" /></Button>
                    </div>
                    {ordersLoading ? <div className="flex items-center justify-center py-6 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /></div> : sortedOrders.length === 0 ? <p className="text-slate-400 text-xs py-4 text-center">No orders yet.</p> : (
                      <Table>
                        <TableHeader><TableRow className="text-[10px] uppercase tracking-wide text-slate-400"><TableHead>Order</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Payment</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {sortedOrders.slice(0, 5).map((o) => (
                            <TableRow key={o.id} className="cursor-pointer" onClick={() => openOrder(o.id)}>
                              <TableCell><button type="button" className="font-mono text-blue-700 hover:underline text-left">{o.orderNumber}</button><p className="text-[10px] text-slate-400">{fmtD(o.createdAt)}</p></TableCell>
                              <TableCell className="text-right tabular-nums font-medium">{inr(o.grandTotal)}</TableCell>
                              <TableCell><Badge variant="outline" className={`text-[9px] ${PAY_STYLE[o.paymentStatus] || "border-slate-200 text-slate-500"}`}>{o.paymentStatus}</Badge></TableCell>
                              <TableCell><Badge variant="outline" className={`text-[9px] ${STATUS_STYLE[o.status] || "border-slate-200 text-slate-500"}`}>{o.status.replace(/_/g, " ")}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5 text-blue-600" /> Internal Notes</p>
                    <div className="flex gap-2"><Input value={newNote} onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} placeholder="Add an internal note…" className="text-xs h-8" /><Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 text-white" onClick={addNote} disabled={!newNote.trim()}>Add</Button></div>
                    <p className="text-[10px] text-slate-400">Internal only — never shown to customers.</p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {notes.length === 0 ? <p className="text-slate-400 text-xs py-1 text-center">No notes.</p> : notes.map((n) => (
                        <div key={n.id} className="rounded border border-slate-100 bg-slate-50 p-2"><div className="flex items-center justify-between"><Badge variant="outline" className="text-[9px] capitalize border-slate-200 text-slate-500">{n.type.toLowerCase()}</Badge><span className="text-[10px] text-slate-400">{n.actorName || "staff"} · {fmtD(n.createdAt)}</span></div><p className="text-xs text-slate-600 mt-1">{n.body}</p></div>
                      ))}
                    </div>
                  </div>
                </div>}

                {tab === "orders" && <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[180px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" /><Input placeholder="Search order number…" className="pl-8 h-8 text-xs" value={ordersSearch} onChange={(e) => { setOrdersSearch(e.target.value); setOrdersPage(0); loadOrders(detail.id, 0, ordersStatus, e.target.value) }} /></div>
                    <select value={ordersStatus} onChange={(e) => { setOrdersStatus(e.target.value); setOrdersPage(0); loadOrders(detail.id, 0, e.target.value, ordersSearch) }} className="h-8 text-xs rounded-md border border-input px-2 bg-background">
                      <option value="">All statuses</option>
                      {Object.keys(STATUS_STYLE).map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                  {ordersLoading ? <div className="flex items-center justify-center py-10 text-slate-400 gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading orders…</div> : sortedOrders.length === 0 ? <p className="text-slate-400 text-xs py-8 text-center">No orders match.</p> : (
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                      <Table>
                        <TableHeader><TableRow className="text-[10px] uppercase tracking-wide text-slate-400">
                          <TableHead><SortHead label="Order" k="orderNumber" sort={ordersSort} onSort={toggleSort} /></TableHead><TableHead><SortHead label="Date" k="createdAt" sort={ordersSort} onSort={toggleSort} /></TableHead><TableHead>Store</TableHead><TableHead className="text-right"><SortHead label="Total" k="grandTotal" sort={ordersSort} onSort={toggleSort} /></TableHead>
                          <TableHead><SortHead label="Payment" k="paymentStatus" sort={ordersSort} onSort={toggleSort} /></TableHead><TableHead><SortHead label="Status" k="status" sort={ordersSort} onSort={toggleSort} /></TableHead><TableHead className="text-right">Action</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {sortedOrders.map((o) => (
                            <TableRow key={o.id}>
                              <TableCell><button type="button" className="font-mono text-blue-700 hover:underline text-left" onClick={() => openOrder(o.id)}>{o.orderNumber}</button></TableCell>
                              <TableCell className="text-xs text-slate-500">{fmtD(o.createdAt)}</TableCell>
                              <TableCell className="text-xs text-slate-500">{o.store?.storeName || "—"}</TableCell>
                              <TableCell className="text-right tabular-nums font-medium">{inr(o.grandTotal)}</TableCell>
                              <TableCell><Badge variant="outline" className={`text-[9px] ${PAY_STYLE[o.paymentStatus] || "border-slate-200 text-slate-500"}`}>{o.paymentStatus}</Badge></TableCell>
                              <TableCell><Badge variant="outline" className={`text-[9px] ${STATUS_STYLE[o.status] || "border-slate-200 text-slate-500"}`}>{o.status.replace(/_/g, " ")}</Badge></TableCell>
                              <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-blue-600" title="Open order" onClick={() => openOrder(o.id)}><Eye className="h-3.5 w-3.5" /></Button></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {ordersTotal > ORDERS_PAGE && (
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{ordersTotal} order{ordersTotal !== 1 ? "s" : ""}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" disabled={ordersPage === 0} onClick={() => { setOrdersPage((p) => p - 1); loadOrders(detail.id, ordersPage - 1, ordersStatus, ordersSearch) }}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                        <span className="px-2">Page {ordersPage + 1} / {ordersPages}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" disabled={ordersPage + 1 >= ordersPages} onClick={() => { setOrdersPage((p) => p + 1); loadOrders(detail.id, ordersPage + 1, ordersStatus, ordersSearch) }}><ChevronRight className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  )}
                </div>}

                {tab === "timeline" && <div className="space-y-3">
                  <div className="space-y-1.5">
                    {timeline.length === 0 ? <p className="text-slate-400 text-xs py-3 text-center">No activity yet.</p> : timeline.map((t, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs border-l-2 border-slate-200 pl-2 py-0.5">
                        <Badge variant="outline" className="text-[9px] shrink-0 border-slate-200 text-slate-500 capitalize">{t.type.toLowerCase()}</Badge>
                        <div className="min-w-0 flex-1"><p className="text-slate-700 truncate">{t.title}{t.detail ? ` · ${t.detail}` : ""}</p><p className="text-[10px] text-slate-400">{fmtDT(t.at)}</p></div>
                        {t.amount != null && <span className="text-slate-500 shrink-0">{inr(t.amount)}</span>}
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-slate-200 p-2">
                    <p className="text-xs font-semibold text-slate-700 mb-2">Dispatch History</p>
                    {loadingHistory ? <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div> : dispatchHistory.length === 0 ? <p className="text-slate-400 text-xs py-2 text-center">No dispatch history found. Run backfill if historical records are missing.</p> : dispatchHistory.map((d: any) => (
                      <div key={d.orderId} className="rounded-lg border border-slate-100 p-2 text-xs mb-1.5">
                        <div className="flex items-center justify-between mb-1">
                          <button type="button" className="font-mono text-blue-700 font-medium hover:underline text-left" onClick={() => openOrder(d.orderId)}>{d.orderNumber}</button>
                          <span className="text-[10px] text-slate-400">{d.createdAt ? fmtD(d.createdAt) : "—"}</span>
                        </div>
                        <div className="flex gap-3 text-[10px] text-slate-600">
                          {d.pickup?.required && <span className="flex items-center gap-0.5"><Truck className="h-3 w-3 text-blue-500" /> Pickup: {d.pickup.status} {d.pickup.executiveName ? `· ${d.pickup.executiveName}` : ""}</span>}
                          {d.delivery?.required && <span className="flex items-center gap-0.5"><Truck className="h-3 w-3 text-violet-500" /> Delivery: {d.delivery.status} {d.delivery.executiveName ? `· ${d.delivery.executiveName}` : ""}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>}

                {tab === "feedback" && <div className="space-y-3">
                  {(() => {
                    const n = feedback.length
                    const avg = n ? feedback.reduce((s: number, r: any) => s + r.rating, 0) / n : 0
                    const dist = [5, 4, 3, 2, 1].map((star) => ({ star, count: feedback.filter((r: any) => r.rating === star).length }))
                    return (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-lg border border-slate-200 px-3 py-2 col-span-1"><p className="text-[10px] uppercase text-slate-400">Avg Rating</p><p className="text-xl font-bold text-slate-800">{n ? avg.toFixed(1) : "—"}</p><Stars n={n ? Math.round(avg) : 0} /></div>
                          <div className="rounded-lg border border-slate-200 px-3 py-2 col-span-2"><p className="text-[10px] uppercase text-slate-400 mb-1">Distribution</p>{dist.map((d) => (
                            <div key={d.star} className="flex items-center gap-2 text-[10px] text-slate-500"><span className="w-8 shrink-0 flex items-center gap-1"><Star className="h-3 w-3 text-amber-400" /> {d.star}</span><div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-amber-400" style={{ width: n ? `${(d.count / n) * 100}%` : "0%" }} /></div><span className="w-6 text-right tabular-nums">{d.count}</span></div>
                          ))}</div>
                        </div>
                        <p className="text-xs text-slate-400">{n} feedback{n !== 1 ? "s" : ""} from delivered orders.</p>
                        {n === 0 ? <p className="text-slate-400 text-xs py-6 text-center">No feedback yet.</p> : feedback.map((r: any) => (
                          <div key={r.id} className="rounded-lg border border-slate-200 p-3">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-blue-700 text-xs">{r.orderNumber}</span>
                              <Stars n={r.rating} />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">{fmtD(r.createdAt)}</p>
                            {r.comment && <p className="text-xs text-slate-600 mt-1.5">{r.comment}</p>}
                          </div>
                        ))}
                      </>
                    )
                  })()}
                </div>}

                {tab === "addresses" && <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{detail.addresses.length} address{detail.addresses.length !== 1 ? "es" : ""}</span>
                    <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 border-blue-200 text-blue-700" onClick={() => openAddressForm()}><Plus className="h-3 w-3" /> Add Address</Button>
                  </div>
                  {detail.addresses.length === 0 && !editAddress ? <p className="text-slate-400 text-xs py-3 text-center">No addresses saved. Click "Add Address" to create one.</p> : null}
                  {editAddress && addressAction ? (
                    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-2">
                      <p className="text-xs font-semibold text-blue-800">{addressAction === "add" ? "New Address" : "Edit Address"}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-0.5 col-span-2"><Label className="text-[10px]">Address Line 1 *</Label><Input className="h-7 text-xs" value={editAddress.addressLine1 || ""} onChange={(e) => setEditAddress((f) => f ? { ...f, addressLine1: e.target.value } : f)} /></div>
                        <div className="space-y-0.5"><Label className="text-[10px]">Address Line 2</Label><Input className="h-7 text-xs" value={editAddress.addressLine2 || ""} onChange={(e) => setEditAddress((f) => f ? { ...f, addressLine2: e.target.value } : f)} /></div>
                        <div className="space-y-0.5"><Label className="text-[10px]">Area</Label><Input className="h-7 text-xs" value={editAddress.area || ""} onChange={(e) => setEditAddress((f) => f ? { ...f, area: e.target.value } : f)} /></div>
                        <div className="space-y-0.5"><Label className="text-[10px]">Landmark</Label><Input className="h-7 text-xs" value={editAddress.landmark || ""} onChange={(e) => setEditAddress((f) => f ? { ...f, landmark: e.target.value } : f)} /></div>
                        <div className="space-y-0.5"><Label className="text-[10px]">City</Label><Input className="h-7 text-xs" value={editAddress.city || ""} onChange={(e) => setEditAddress((f) => f ? { ...f, city: e.target.value } : f)} /></div>
                        <div className="space-y-0.5"><Label className="text-[10px]">State</Label><SearchableSelect className="h-7 text-xs" value={editAddress.state || ""} onChange={(v) => setEditAddress((f) => f ? { ...f, state: v } : f)} options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} placeholder="State" /></div>
                        <div className="space-y-0.5"><Label className="text-[10px]">PIN Code</Label><Input className="h-7 text-xs" value={editAddress.pincode || ""} inputMode="numeric" maxLength={6} onChange={(e) => setEditAddress((f) => f ? { ...f, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) } : f)} /></div>
                        <div className="space-y-0.5"><Label className="text-[10px]">Label</Label><Input className="h-7 text-xs" value={editAddress.label || ""} onChange={(e) => setEditAddress((f) => f ? { ...f, label: e.target.value } : f)} placeholder="e.g. Home, Office" /></div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <label className="flex items-center gap-1 text-[10px] cursor-pointer"><input type="checkbox" checked={editAddress.isPickupDefault || false} onChange={(e) => setEditAddress((f) => f ? { ...f, isPickupDefault: e.target.checked } : f)} /> Default for Pickup</label>
                        <label className="flex items-center gap-1 text-[10px] cursor-pointer"><input type="checkbox" checked={editAddress.isDeliveryDefault || false} onChange={(e) => setEditAddress((f) => f ? { ...f, isDeliveryDefault: e.target.checked } : f)} /> Default for Delivery</label>
                        <label className="flex items-center gap-1 text-[10px] cursor-pointer"><input type="checkbox" checked={editAddress.isDefault || false} onChange={(e) => setEditAddress((f) => f ? { ...f, isDefault: e.target.checked } : f)} /> General Default</label>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-[10px] gap-1 bg-blue-600 hover:bg-blue-700 text-white flex-1" disabled={savingAddress} onClick={saveAddress}>
                          {savingAddress ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} {addressAction === "add" ? "Add Address" : "Save Changes"}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={closeAddressForm}>Cancel</Button>
                      </div>
                    </div>
                  ) : null}
                  {detail.addresses.map((a: Addr) => (
                    <div key={a.id} className="rounded-lg border border-slate-200 p-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs font-medium text-slate-700">{a.label || a.addressType || "HOME"}</span>
                        {a.isDefault && <Badge variant="outline" className="text-[9px] border-emerald-300 text-emerald-700 bg-emerald-50">Default</Badge>}
                        {a.isPickupDefault && <Badge variant="outline" className="text-[9px] border-blue-300 text-blue-700 bg-blue-50">Pickup</Badge>}
                        {a.isDeliveryDefault && <Badge variant="outline" className="text-[9px] border-violet-300 text-violet-700 bg-violet-50">Delivery</Badge>}
                        <div className="ml-auto flex gap-1">
                          <button className="text-[10px] text-slate-400 hover:text-blue-600" onClick={() => openAddressForm(a)}><Pencil className="h-3 w-3" /></button>
                          <button className="text-[10px] text-slate-400 hover:text-red-600" onClick={() => { if (confirm("Delete this address?")) deleteAddress(a.id) }}><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </div>
                      <p className="text-slate-600 text-xs whitespace-pre-line leading-snug">{formatAddressLines(a).join("\n")}</p>
                      <div className="flex gap-1.5 mt-1">
                        {!a.isPickupDefault && <button className="text-[9px] text-blue-500 hover:underline" onClick={() => setDefaultAddress(a.id, "isPickupDefault")}>Set pickup default</button>}
                        {!a.isDeliveryDefault && <button className="text-[9px] text-violet-500 hover:underline" onClick={() => setDefaultAddress(a.id, "isDeliveryDefault")}>Set delivery default</button>}
                      </div>
                    </div>
                  ))}
                </div>}

                {tab === "subscriptions" && <MembershipTab m={membership} businessId={currentBusinessId || ""} onCollected={() => { if (openId && currentBusinessId) fetch(`/api/laundry/customers/${openId}/membership?businessId=${currentBusinessId}`).then((r) => r.json()).then((j) => setMembership(j.success ? j.data : null)).catch(() => {}) }} />}

                {tab === "payments" && <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {[{ l: "Wallet", v: inr(detail.walletBalance) }, { l: "Collected", v: inr(stats?.collected || 0) }, { l: "Outstanding", v: inr(stats?.outstanding || 0), c: (stats?.outstanding || 0) > 0 ? "text-rose-600" : "" }, { l: "Subscription Covered", v: inr(stats?.subsidised || 0) }].map((s) => (
                      <div key={s.l} className="rounded-lg border border-slate-200 px-3 py-2"><p className="text-[10px] uppercase text-slate-400">{s.l}</p><p className={`text-base font-bold tabular-nums ${s.c || "text-slate-800"}`}>{s.v}</p></div>
                    ))}
                  </div>
                  {payments.length === 0 ? <p className="text-slate-400 text-xs py-4 text-center">No payments recorded yet.</p> : (
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                      <Table>
                        <TableHeader><TableRow className="text-[10px] uppercase tracking-wide text-slate-400"><TableHead>Date</TableHead><TableHead>Order</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {payments.map((p, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs text-slate-500">{fmtDT(p.at)}</TableCell>
                              <TableCell>{p.detail && p.ref ? <button type="button" className="font-mono text-blue-700 hover:underline text-left text-xs" onClick={() => openOrder(p.ref as string)}>{p.detail}</button> : <span className="text-xs text-slate-500">{p.detail || "—"}</span>}</TableCell>
                              <TableCell className="text-xs text-slate-600 capitalize">{(p.title || "Payment").replace("Payment · ", "")}</TableCell>
                              <TableCell className="text-right tabular-nums font-medium">{inr(p.amount || 0)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>}

                {tab === "garments" && <div className="space-y-3">
                  {garments === null ? <div className="flex items-center justify-center py-10 text-slate-400 gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading garments…</div> : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-slate-200 px-3 py-2"><p className="text-[10px] uppercase text-slate-400">Orders</p><p className="text-base font-bold text-slate-800">{garments.totalOrders}</p></div>
                        <div className="rounded-lg border border-slate-200 px-3 py-2"><p className="text-[10px] uppercase text-slate-400">Garments</p><p className="text-base font-bold text-slate-800">{garments.totalItems}</p></div>
                      </div>
                      {garments.services.length === 0 ? <p className="text-slate-400 text-xs py-4 text-center">No service history yet.</p> : (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-slate-700">Favourite Services</p>
                          {garments.services.map((s) => (
                            <div key={s.name} className="flex items-center gap-2 text-xs text-slate-600"><span className="flex-1 truncate">{s.name}</span><div className="h-1.5 w-28 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (s.count / (garments.services[0].count || 1)) * 100)}%` }} /></div><span className="w-6 text-right tabular-nums text-slate-400">{s.count}</span></div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>}

                {tab === "audit" && <div className="space-y-1.5">
                  {auditRows.length === 0 ? <p className="text-slate-400 text-xs py-4 text-center">No audit activity yet.</p> : auditRows.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs border-l-2 border-slate-200 pl-2 py-0.5">
                      <Badge variant="outline" className="text-[9px] shrink-0 border-slate-200 text-slate-500 capitalize">{a.type.toLowerCase()}</Badge>
                      <div className="min-w-0 flex-1"><p className="text-slate-700 truncate">{a.title}{a.body ? ` · ${a.body}` : ""}</p><p className="text-[10px] text-slate-400">By {a.who} · {fmtDT(a.at)}</p></div>
                    </div>
                  ))}
                </div>}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Merge duplicate customers (Part 10) */}
      <Dialog open={mergeOpen} onOpenChange={(o) => { if (!o) { setMergeOpen(false); setMergeQuery(""); setMergeResults([]) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-blue-600" /> Merge Duplicate Into {detail?.name}</DialogTitle>
            <DialogDescription>Search the duplicate customer. Its orders, subscriptions, payments, addresses and history move to <span className="font-medium text-slate-700">{detail?.name}</span>; the duplicate is retired. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <Input value={mergeQuery} onChange={(e) => searchMerge(e.target.value)} placeholder="Search by name, mobile or code…" autoFocus />
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {mergeResults.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2">
                <div className="min-w-0"><p className="text-sm font-medium text-slate-800 truncate">{c.name}</p><p className="text-[11px] text-slate-400">{c.phone} {c.customerCode ? `· ${c.customerCode}` : ""} · {c.totalOrders} orders</p></div>
                <Button size="sm" variant="outline" className="h-8 shrink-0" disabled={merging} onClick={() => doMerge(c.id)}>{merging ? <Loader2 className="h-4 w-4 animate-spin" /> : "Merge in"}</Button>
              </div>
            ))}
            {mergeQuery.trim().length >= 2 && mergeResults.length === 0 && <p className="text-xs text-slate-400 text-center py-3">No other customers found.</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive (soft delete) confirmation — orders & history are preserved */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700"><AlertTriangle className="h-5 w-5" /> Archive Customer?</DialogTitle>
            <DialogDescription className="text-slate-600">
              <span className="font-semibold text-slate-800">{deleteTarget?.name}</span> will be archived and hidden from search, New Order and the Customer App. <span className="font-semibold text-slate-700">Their orders, invoices, payments, subscription history and audit are kept.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button className="gap-1 bg-amber-600 hover:bg-amber-700 text-white" disabled={deleting} onClick={doDelete}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Archive Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Membership Hub — the customer's full laundry subscription at a glance.
const mFmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—")
const M_STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Active", cls: "border-emerald-300 text-emerald-700 bg-emerald-50" },
  GRACE: { label: "In Grace", cls: "border-amber-300 text-amber-700 bg-amber-50" },
  PENDING_PAYMENT: { label: "Pending Payment", cls: "border-amber-300 text-amber-700 bg-amber-50" },
  EXPIRED: { label: "Expired", cls: "border-rose-300 text-rose-700 bg-rose-50" },
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MembershipTab({ m, businessId, onCollected }: { m: any; businessId: string; onCollected: () => void }) {
  const [collecting, setCollecting] = useState<string | null>(null)
  const collect = async (method: string) => {
    if (!m?.pendingPurchaseId) return
    setCollecting(method)
    try {
      const res = await fetch("/api/laundry/subscriptions/collect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, purchaseId: m.pendingPurchaseId, amount: m.outstandingDue, method }) })
      const j = await res.json()
      if (!res.ok || !j.success) { sonnerToast.error(j.error || "Collection failed"); return }
      sonnerToast.success(j.activated ? `Payment received — membership ${j.membershipId} activated` : "Payment recorded")
      onCollected()
    } catch { sonnerToast.error("Collection failed") } finally { setCollecting(null) }
  }
  if (!m || !m.hasMembership) return (
    <div className="py-10 text-center text-sm text-slate-400"><Repeat className="h-6 w-6 mx-auto mb-2 text-slate-300" />No laundry subscription for this customer.</div>
  )
  const st = M_STATUS[m.status] || M_STATUS.EXPIRED
  const Bar = ({ label, used, total, tone }: { label: string; used: number; total: number; tone: string }) => {
    const pct = total > 0 ? Math.min(100, Math.round(((total - used) / total) * 100)) : 0
    return (
      <div className="rounded-lg border border-slate-100 p-2.5">
        <div className="flex items-center justify-between text-xs"><span className="text-slate-500">{label}</span><span className="font-semibold text-slate-800">{Math.max(0, total - used)} / {total}</span></div>
        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full ${tone}`} style={{ width: `${pct}%` }} /></div>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><Repeat className="h-4 w-4 text-blue-600" /> {m.planName || "Subscription"}</p>
            <p className="mt-0.5 font-mono text-xs text-slate-500">{m.membershipId || "—"}</p>
          </div>
          <Badge variant="outline" className={`text-[10px] ${st.cls}`}>{st.label}</Badge>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-2 text-xs">
          <div><p className="text-[10px] text-slate-400">Start</p><p className="font-medium text-slate-700">{mFmt(m.startDate)}</p></div>
          <div><p className="text-[10px] text-slate-400">Valid Until</p><p className="font-medium text-slate-700">{mFmt(m.endDate)}</p></div>
          <div><p className="text-[10px] text-slate-400">Renewal</p><p className="font-medium text-slate-700">{mFmt(m.renewalDate)}</p></div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {m.garments?.total > 0 && <Bar label="Garments remaining" used={m.garments.used} total={m.garments.total} tone="bg-blue-500" />}
        {m.kg && m.kg.total > 0 && <Bar label="KG remaining" used={m.kg.used} total={m.kg.total} tone="bg-violet-500" />}
        {m.orders?.max != null && <Bar label="Orders remaining (this cycle)" used={m.orders.used} total={m.orders.max} tone="bg-emerald-500" />}
      </div>
      {m.outstandingDue > 0 && m.pendingPurchaseId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-700">Outstanding due — collect to activate</span>
            <span className="text-sm font-bold text-amber-800">{inr(m.outstandingDue)}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {["CASH", "UPI", "CARD"].map((mt) => (
              <Button key={mt} size="sm" disabled={!!collecting} onClick={() => collect(mt)} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                {collecting === mt ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : mt === "CASH" ? "Collect Cash" : mt === "UPI" ? "Collect UPI" : "Collect Card"}
              </Button>
            ))}
          </div>
          <button disabled className="w-full h-8 rounded-md border border-slate-200 bg-slate-50 text-xs font-medium text-slate-400 cursor-not-allowed">Pay Online (Razorpay) · Coming Soon</button>
        </div>
      )}
    </div>
  )
}
