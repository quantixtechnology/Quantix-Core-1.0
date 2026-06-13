"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import {
  Truck, Plus, Search, Phone, Mail, Star, Package, IndianRupee,
  Pencil, Trash2, RefreshCw, Wifi, WifiOff, Clock, Car, Shield,
  Smartphone, ChevronDown, ChevronUp, User, KeyRound, Eye, EyeOff,
  Store as StoreIcon, Copy, MessageCircle, Check, Stethoscope,
  CheckCircle2, XCircle, AlertTriangle, Loader2, UserPlus, RotateCcw, Link2, Mail as MailIcon,
} from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { setBusinessContext } from "@/lib/api-client"
import { openWhatsApp } from "@/lib/delivery-actions"
import { showSuccess, showError } from "@/lib/toast-utils"
import { Skeleton } from "@/components/ui/skeleton"

// ─── Types ────────────────────────────────────────────────────────────────────

type PartnerType = "INTERNAL" | "EXTERNAL"
type PartnerAvailability = "ONLINE" | "OFFLINE" | "BUSY"

interface StoreOption {
  id: string
  name: string
  code: string | null   // human-readable Store ID (storeCode, e.g. STR-BUS-202605-0001-001)
}

// Build the "STORE ID | Name" label used across the dropdown, list and details.
function storeLabel(code: string | null | undefined, name: string | null | undefined): string {
  const n = name || "Store"
  return code ? `${code} | ${n}` : n
}

interface DeliveryPartner {
  id: string
  businessId: string
  userId: string | null
  storeId: string | null
  store?: { id: string; name: string; storeCode?: string | null; code?: string | null } | null
  name: string
  phone: string
  email: string | null
  avatar: string | null
  vehicleType: string | null
  vehicleNumber: string | null
  licenseNumber: string | null
  isOnline: boolean
  isActive: boolean
  availability: PartnerAvailability
  partnerType: PartnerType
  partnerCode: string | null
  appEnabled: boolean
  notes: string | null
  rating: number
  totalDeliveries: number
  totalEarnings: number
  createdAt: string
  updatedAt: string
}

interface PartnerFormData {
  name: string
  phone: string
  email: string
  password: string
  storeId: string
  vehicleType: string
  vehicleNumber: string
  licenseNumber: string
  partnerType: PartnerType
  availability: PartnerAvailability
  appEnabled: boolean
  notes: string
  bankAccount: string
}

const EMPTY_FORM: PartnerFormData = {
  name: "",
  phone: "",
  email: "",
  password: "",
  storeId: "",
  vehicleType: "",
  vehicleNumber: "",
  licenseNumber: "",
  partnerType: "INTERNAL",
  availability: "OFFLINE",
  appEnabled: false,
  notes: "",
  bankAccount: "",
}

// Credentials surfaced once after a partner is created / app-enabled, so the
// admin can share them with the partner before the temp password disappears.
interface CredentialResult {
  name: string
  email: string
  phone: string
  tempPassword: string
}

// Shape returned by the admin-only login diagnostic endpoint.
interface Diagnosis {
  partner: {
    partnerId: string; partnerName: string; businessId: string; businessName: string | null
    storeId: string | null; storeName: string | null; storeCode: string | null
    appEnabled: boolean; isActive: boolean; email: string | null; phone: string; userId: string | null
  }
  user: {
    userId: string; email: string; role: string | null; isActive: boolean
    passwordHashExists: boolean; mustChangePassword: boolean; lastLogin: string | null
    businesses: { businessId: string; slug: string; name: string; role: string; storeId: string | null; status: string }[]
  } | null
  tests: {
    userExists: boolean; passwordHashExists: boolean; roleIsDeliveryStaff: boolean
    businessMatch: boolean; storeAssignmentExists: boolean
  }
  failReason: string | null
  canLogin: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function availabilityBadge(a: PartnerAvailability) {
  if (a === "ONLINE")  return <Badge className="bg-emerald-100 text-emerald-700 border-0"><Wifi className="h-3 w-3 mr-1" />Online</Badge>
  if (a === "BUSY")    return <Badge className="bg-amber-100 text-amber-700 border-0"><Clock className="h-3 w-3 mr-1" />Busy</Badge>
  return <Badge className="bg-gray-100 text-gray-500 border-0"><WifiOff className="h-3 w-3 mr-1" />Offline</Badge>
}

function partnerTypeBadge(t: PartnerType) {
  if (t === "INTERNAL") return <Badge variant="outline" className="text-blue-600 border-blue-200"><Shield className="h-3 w-3 mr-1" />Internal</Badge>
  return <Badge variant="outline" className="text-purple-600 border-purple-200"><User className="h-3 w-3 mr-1" />External</Badge>
}

// Key/value row used inside the diagnostic dialog.
function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground shrink-0">{k}</span>
      <span className={`text-right break-all ${mono ? "font-mono text-[11px]" : ""}`}>{v}</span>
    </div>
  )
}

// Repair action button with an inline busy spinner.
function RepairBtn({ icon: Icon, label, busy, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; busy?: boolean; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" className="justify-start gap-2 h-9 text-xs" onClick={onClick} disabled={busy}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {label}
    </Button>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DeliveryPartnersView() {
  const { currentBusinessId } = useAdminStore()
  const { currentBusinessId: authBizId, currentRole } = useAuthStore()
  const businessId = currentBusinessId || authBizId || ""

  // The diagnostic tool is admin-only (Business Owners, Super/Platform Admins).
  const canDiagnose = ["CLIENT_OWNER", "STORE_MANAGER", "QUANTIX_SUPER_ADMIN", "PLATFORM_ADMIN", "QUANTIX_SALES_TEAM"].includes(currentRole || "")

  const [partners, setPartners] = useState<DeliveryPartner[]>([])
  const [stores, setStores] = useState<StoreOption[]>([])
  // Start as false — only show spinner when we actually have a businessId to query
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [filterAvailability, setFilterAvailability] = useState<string>("all")
  const [filterType, setFilterType] = useState<string>("all")

  // Sheet / dialog state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingPartner, setEditingPartner] = useState<DeliveryPartner | null>(null)
  const [formData, setFormData] = useState<PartnerFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<DeliveryPartner | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Reset password dialog
  const [resetTarget, setResetTarget] = useState<DeliveryPartner | null>(null)
  const [resetPassword, setResetPassword] = useState("")
  const [showResetPw, setShowResetPw] = useState(false)
  const [resetting, setResetting] = useState(false)

  // Credential reveal dialog (shown once after temp password is issued)
  const [credential, setCredential] = useState<CredentialResult | null>(null)
  const [credCopied, setCredCopied] = useState(false)

  // Login diagnostic dialog
  const [diagTarget, setDiagTarget] = useState<DeliveryPartner | null>(null)
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null)
  const [diagLoading, setDiagLoading] = useState(false)
  const [diagBusy, setDiagBusy] = useState<string | null>(null)
  const [diagTempPassword, setDiagTempPassword] = useState<string | null>(null)

  // Keep localStorage in sync so getAuthHeaders() sends the correct x-business-id header.
  // This is critical when a platform admin manages a business via the admin panel —
  // setCurrentBusiness() updates Zustand but not localStorage.
  useEffect(() => {
    if (businessId) setBusinessContext(businessId)
  }, [businessId])

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchPartners = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      // Always pass businessId as query param — required for platform admins
      const params = new URLSearchParams({ businessId })
      if (filterAvailability !== "all") params.set("isOnline", filterAvailability === "ONLINE" ? "true" : "false")
      const res = await fetch(`/api/core/delivery/partners?${params}`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) setPartners(json.data || [])
      else showError(json.error || "Failed to load delivery partners")
    } catch {
      showError("Failed to load delivery partners")
    } finally {
      setLoading(false)
    }
  }, [businessId, filterAvailability])

  useEffect(() => { fetchPartners() }, [fetchPartners])

  // Stores for the mandatory "Assigned Store" dropdown
  const fetchStores = useCallback(async () => {
    if (!businessId) return
    try {
      const res = await fetch(`/api/core/stores?businessId=${businessId}`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) {
        setStores((json.data || []).map((s: { id: string; name: string; storeCode?: string | null; code?: string | null }) => ({
          id: s.id,
          name: s.name,
          // Prefer the formatted storeCode (STR-BUS-…); fall back to legacy `code`.
          code: s.storeCode || s.code || null,
        })))
      }
    } catch {
      // non-fatal — the dropdown will show empty and block save with a clear error
    }
  }, [businessId])

  useEffect(() => { fetchStores() }, [fetchStores])

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filtered = partners.filter((p) => {
    if (search) {
      const q = search.toLowerCase()
      if (!p.name.toLowerCase().includes(q) && !p.phone.includes(q) && !(p.email || "").toLowerCase().includes(q) && !(p.partnerCode || "").toLowerCase().includes(q)) return false
    }
    if (filterAvailability !== "all" && p.availability !== filterAvailability) return false
    if (filterType !== "all" && p.partnerType !== filterType) return false
    return true
  })

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalOnline = partners.filter((p) => p.availability === "ONLINE").length
  const totalBusy   = partners.filter((p) => p.availability === "BUSY").length
  const totalActive = partners.filter((p) => p.isActive).length

  // ── Form helpers ───────────────────────────────────────────────────────────

  function openCreate() {
    setEditingPartner(null)
    setFormData(EMPTY_FORM)
    setShowPassword(false)
    setSheetOpen(true)
  }

  function openEdit(p: DeliveryPartner) {
    setEditingPartner(p)
    setFormData({
      name: p.name,
      phone: p.phone,
      email: p.email || "",
      password: "",
      storeId: p.storeId || "",
      vehicleType: p.vehicleType || "",
      vehicleNumber: p.vehicleNumber || "",
      licenseNumber: p.licenseNumber || "",
      partnerType: p.partnerType,
      availability: p.availability,
      appEnabled: p.appEnabled,
      notes: p.notes || "",
      bankAccount: "",
    })
    setShowPassword(false)
    setSheetOpen(true)
  }

  function set(field: keyof PartnerFormData, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!formData.name.trim()) { showError("Name is required"); return }
    if (!formData.phone.trim()) { showError("Phone is required"); return }
    if (!formData.storeId) { showError("Assigned store is required"); return }
    if (formData.appEnabled && !formData.email.trim()) {
      showError("Email is required when App Access is enabled"); return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        ...formData,
        businessId,
        isOnline: formData.availability === "ONLINE",
      }
      // Only send password on create, or when explicitly updating
      if (editingPartner && !formData.password) {
        delete payload.password
      }

      let res: Response
      if (editingPartner) {
        res = await fetch(`/api/core/delivery/partners/${editingPartner.id}`, {
          method: "PUT",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch("/api/core/delivery/partners", {
          method: "POST",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }
      const json = await res.json()
      if (!json.success) { showError(json.error || "Failed to save"); return }
      showSuccess(editingPartner ? "Partner updated" : "Partner created")
      setSheetOpen(false)
      // A temp password is returned ONCE when app access was enabled without an
      // admin-typed password — reveal it so the admin can share the credentials.
      if (json.data?.tempPassword) {
        setCredCopied(false)
        setCredential({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          tempPassword: json.data.tempPassword,
        })
      } else if (!editingPartner && json.data?.appEnabled && json.data?.email) {
        showSuccess(`App login: ${json.data.email}`)
      }
      fetchPartners()
    } catch {
      showError("Failed to save partner")
    } finally {
      setSaving(false)
    }
  }

  // Compose a ready-to-send onboarding message for WhatsApp / clipboard.
  function credentialMessage(c: CredentialResult): string {
    return [
      `Hi ${c.name}, your delivery app login is ready.`,
      ``,
      `Email: ${c.email}`,
      `Temporary password: ${c.tempPassword}`,
      ``,
      `Open the delivery app and sign in. You'll be asked to set a new password on first login.`,
    ].join("\n")
  }

  async function copyCredentials(c: CredentialResult) {
    try {
      await navigator.clipboard.writeText(credentialMessage(c))
      setCredCopied(true)
      showSuccess("Credentials copied")
      setTimeout(() => setCredCopied(false), 2000)
    } catch {
      showError("Could not copy — copy the details manually")
    }
  }

  // ── Login diagnostics ────────────────────────────────────────────────────────

  async function openDiagnose(p: DeliveryPartner) {
    setDiagTarget(p)
    setDiagnosis(null)
    setDiagTempPassword(null)
    setDiagLoading(true)
    try {
      const res = await fetch(`/api/core/delivery/partners/${p.id}/diagnose`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (!json.success) { showError(json.error || "Diagnosis failed"); return }
      setDiagnosis(json.data)
    } catch {
      showError("Diagnosis failed")
    } finally {
      setDiagLoading(false)
    }
  }

  async function runRepair(action: string) {
    if (!diagTarget) return
    setDiagBusy(action)
    try {
      const res = await fetch(`/api/core/delivery/partners/${diagTarget.id}/diagnose`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (!json.success) { showError(json.error || "Repair failed"); return }
      if (json.data) setDiagnosis(json.data)
      if (json.tempPassword) setDiagTempPassword(json.tempPassword)
      showSuccess(json.message || "Done")
      fetchPartners()
    } catch {
      showError("Repair failed")
    } finally {
      setDiagBusy(null)
    }
  }

  async function copyDiagnosisCredentials() {
    if (!diagnosis) return
    const email = diagnosis.partner.email || ""
    const pw = diagTempPassword || "(use Reset Password to generate a new one)"
    try {
      await navigator.clipboard.writeText(`Email: ${email}\nPassword: ${pw}`)
      showSuccess("Login credentials copied")
    } catch {
      showError("Could not copy")
    }
  }

  async function toggleAvailability(p: DeliveryPartner) {
    const next: PartnerAvailability = p.availability === "ONLINE" ? "OFFLINE" : "ONLINE"
    try {
      const endpoint = next === "ONLINE"
        ? `/api/core/delivery/partners/${p.id}/online`
        : `/api/core/delivery/partners/${p.id}/offline`
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (!json.success) { showError(json.error || "Failed to update"); return }
      setPartners((prev) => prev.map((x) => x.id === p.id ? { ...x, availability: next, isOnline: next === "ONLINE" } : x))
    } catch {
      showError("Failed to update availability")
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/core/delivery/partners/${deleteTarget.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (!json.success) { showError(json.error || "Failed to delete"); return }
      showSuccess("Partner removed")
      setDeleteTarget(null)
      fetchPartners()
    } catch {
      showError("Failed to delete partner")
    } finally {
      setDeleting(false)
    }
  }

  async function handleResetPassword() {
    if (!resetTarget || !resetPassword.trim()) return
    if (resetPassword.length < 6) { showError("Password must be at least 6 characters"); return }
    setResetting(true)
    try {
      const res = await fetch("/api/core/delivery/auth/reset-password", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId: resetTarget.id, newPassword: resetPassword }),
      })
      const json = await res.json()
      if (!json.success) { showError(json.error || "Failed to reset password"); return }
      showSuccess("Password reset successfully")
      setResetTarget(null)
      setResetPassword("")
      fetchPartners()
    } catch {
      showError("Failed to reset password")
    } finally {
      setResetting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Delivery Partners</h1>
          <p className="text-sm text-muted-foreground">Manage your delivery workforce, track availability and performance.</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Partner
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100"><Truck className="h-4 w-4 text-blue-600" /></div>
            <div><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold">{partners.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100"><Wifi className="h-4 w-4 text-emerald-600" /></div>
            <div><p className="text-xs text-muted-foreground">Online</p><p className="text-lg font-bold">{totalOnline}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100"><Clock className="h-4 w-4 text-amber-600" /></div>
            <div><p className="text-xs text-muted-foreground">Busy</p><p className="text-lg font-bold">{totalBusy}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100"><Shield className="h-4 w-4 text-purple-600" /></div>
            <div><p className="text-xs text-muted-foreground">Active</p><p className="text-lg font-bold">{totalActive}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, phone, code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterAvailability} onValueChange={setFilterAvailability}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Availability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ONLINE">Online</SelectItem>
            <SelectItem value="BUSY">Busy</SelectItem>
            <SelectItem value="OFFLINE">Offline</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="INTERNAL">Internal</SelectItem>
            <SelectItem value="EXTERNAL">External</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchPartners}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Partner List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Truck className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {partners.length === 0 ? "No delivery partners yet. Add your first partner." : "No partners match your filters."}
            </p>
            {partners.length === 0 && (
              <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Partner</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Header row */}
                <div className="flex items-center gap-4 p-4">
                  {/* Avatar */}
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm">
                    {p.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{p.name}</p>
                      {p.partnerCode && (
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{p.partnerCode}</span>
                      )}
                      {availabilityBadge(p.availability)}
                      {partnerTypeBadge(p.partnerType)}
                      {p.appEnabled && (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                          <Smartphone className="h-3 w-3 mr-1" />App
                        </Badge>
                      )}
                      {!p.isActive && <Badge variant="outline" className="text-red-500 border-red-200">Inactive</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</span>
                      {p.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</span>}
                      {p.store?.name && (
                        <span className="flex items-center gap-1">
                          <StoreIcon className="h-3 w-3" />
                          {storeLabel(p.store.storeCode || p.store.code, p.store.name)}
                        </span>
                      )}
                      {p.vehicleType && <span className="flex items-center gap-1"><Car className="h-3 w-3" />{p.vehicleType}</span>}
                    </div>
                  </div>

                  {/* Quick metrics */}
                  <div className="hidden sm:flex items-center gap-5 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Deliveries</p>
                      <p className="text-sm font-semibold">{p.totalDeliveries}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Earned</p>
                      <p className="text-sm font-semibold">₹{p.totalEarnings.toLocaleString("en-IN")}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Rating</p>
                      <p className="text-sm font-semibold flex items-center gap-0.5"><Star className="h-3 w-3 text-amber-500" />{p.rating.toFixed(1)}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleAvailability(p)}
                      className={p.availability === "ONLINE" ? "border-emerald-300 text-emerald-700" : ""}
                    >
                      {p.availability === "ONLINE" ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
                    </Button>
                    {canDiagnose && (
                      <Button variant="outline" size="sm" onClick={() => openDiagnose(p)} title="Diagnose Login" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                        <Stethoscope className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => { setResetTarget(p); setResetPassword(""); setShowResetPw(false) }}>
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleteTarget(p)} className="text-red-500 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                    >
                      {expandedId === p.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Expanded detail */}
                {expandedId === p.id && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Vehicle Number</p>
                        <p className="font-medium">{p.vehicleNumber || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">License</p>
                        <p className="font-medium">{p.licenseNumber || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">App Access</p>
                        <p className="font-medium">{p.appEnabled ? "Enabled" : "Disabled"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Assigned Store</p>
                        {p.store?.name ? (
                          <p className="font-medium">
                            {(p.store.storeCode || p.store.code) && (
                              <span className="font-mono text-xs text-muted-foreground mr-1">{p.store.storeCode || p.store.code} |</span>
                            )}
                            {p.store.name}
                          </p>
                        ) : (
                          <p className="font-medium text-muted-foreground">—</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Joined</p>
                        <p className="font-medium">{new Date(p.createdAt).toLocaleDateString("en-IN")}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">User ID</p>
                        <p className="font-mono text-xs">{p.userId || <span className="text-muted-foreground">No account linked</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Login Email</p>
                        <p className="text-xs">{p.email || <span className="text-muted-foreground">—</span>}</p>
                      </div>
                      {p.notes && (
                        <div className="col-span-2 md:col-span-4">
                          <p className="text-xs text-muted-foreground mb-0.5">Notes</p>
                          <p className="text-sm">{p.notes}</p>
                        </div>
                      )}
                      <div className="col-span-2 md:col-span-4 flex items-center gap-4 pt-1 border-t">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Package className="h-3 w-3" />{p.totalDeliveries} deliveries
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <IndianRupee className="h-3 w-3" />₹{p.totalEarnings.toLocaleString("en-IN")} earned
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Star className="h-3 w-3 text-amber-500" />{p.rating.toFixed(1)} rating
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle>{editingPartner ? "Edit Partner" : "Add Delivery Partner"}</SheetTitle>
            <SheetDescription>
              {editingPartner ? `Editing ${editingPartner.name}` : "Fill in the details to add a new delivery partner."}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-180px)]">
            <div className="space-y-4 pr-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Full Name <span className="text-red-500">*</span></Label>
                  <Input value={formData.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Rahul Sharma" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone <span className="text-red-500">*</span></Label>
                  <Input value={formData.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email {formData.appEnabled && <span className="text-red-500">*</span>}</Label>
                  <Input value={formData.email} onChange={(e) => set("email", e.target.value)} placeholder="rahul@example.com" type="email" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Assigned Store <span className="text-red-500">*</span></Label>
                  <Select value={formData.storeId} onValueChange={(v) => set("storeId", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={stores.length ? "Select a store…" : "No stores available"} />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.code
                            ? <span className="flex items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{s.code}</span><span>|</span><span>{s.name}</span></span>
                            : s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The partner only sees orders &amp; deliveries for this store.
                  </p>
                </div>
              </div>

              {/* App password — optional. Blank + App Access on = a temporary
                  password is generated and shown once for you to share. */}
              <div className="space-y-1.5">
                <Label>
                  {editingPartner ? "New Password (leave blank to keep current)" : "App Password (optional)"}
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => set("password", e.target.value)}
                    placeholder={editingPartner ? "Leave blank to keep current" : "Leave blank to auto-generate"}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {!editingPartner && formData.appEnabled && (
                  <p className="text-xs text-muted-foreground">
                    Leave blank to generate a temporary password — the partner sets their own on first login.
                  </p>
                )}
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Vehicle Type</Label>
                  <Select value={formData.vehicleType} onValueChange={(v) => set("vehicleType", v)}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BIKE">Bike</SelectItem>
                      <SelectItem value="SCOOTER">Scooter</SelectItem>
                      <SelectItem value="CAR">Car</SelectItem>
                      <SelectItem value="VAN">Van</SelectItem>
                      <SelectItem value="CYCLE">Cycle</SelectItem>
                      <SelectItem value="FOOT">On Foot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Vehicle Number</Label>
                  <Input value={formData.vehicleNumber} onChange={(e) => set("vehicleNumber", e.target.value)} placeholder="MH 12 AB 1234" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>License Number</Label>
                  <Input value={formData.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} placeholder="DL number" />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Partner Type</Label>
                  <Select value={formData.partnerType} onValueChange={(v) => set("partnerType", v as PartnerType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INTERNAL">Internal (Staff)</SelectItem>
                      <SelectItem value="EXTERNAL">External (Freelance)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Initial Availability</Label>
                  <Select value={formData.availability} onValueChange={(v) => set("availability", v as PartnerAvailability)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ONLINE">Online</SelectItem>
                      <SelectItem value="OFFLINE">Offline</SelectItem>
                      <SelectItem value="BUSY">Busy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Bank Account (for payouts)</Label>
                  <Input value={formData.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} placeholder="Account number" />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch
                    checked={formData.appEnabled}
                    onCheckedChange={(v) => set("appEnabled", v)}
                    id="app-enabled"
                  />
                  <Label htmlFor="app-enabled" className="cursor-pointer">
                    <span className="font-medium">App Access</span>
                    <p className="text-xs text-muted-foreground font-normal">Allow delivery app login</p>
                  </Label>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={formData.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any additional notes…" rows={3} />
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  {saving ? "Saving…" : editingPartner ? "Save Changes" : "Add Partner"}
                </Button>
                <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Login Diagnostic — admin-only */}
      <Dialog open={!!diagTarget} onOpenChange={(o) => { if (!o) { setDiagTarget(null); setDiagnosis(null); setDiagTempPassword(null) } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-indigo-600" />
              Diagnose Login — {diagTarget?.name}
            </DialogTitle>
            <DialogDescription>Live trace of this delivery partner&apos;s authentication.</DialogDescription>
          </DialogHeader>

          {diagLoading || !diagnosis ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Running diagnostic…
            </div>
          ) : (
            <div className="space-y-4">
              {/* OUTPUT — exact reason */}
              <div className={`rounded-xl border p-3 ${diagnosis.canLogin ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Result</p>
                {diagnosis.failReason ? (
                  <p className={`text-sm font-medium ${diagnosis.failReason.startsWith("⚠️") ? "text-amber-700" : "text-red-700"}`}>{diagnosis.failReason}</p>
                ) : (
                  <p className="text-sm font-medium text-emerald-700">✅ Login should succeed</p>
                )}
              </div>

              {/* AUTH TEST */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Auth Test</p>
                <div className="space-y-1.5">
                  {([
                    ["User Exists", diagnosis.tests.userExists],
                    ["Password Hash Exists", diagnosis.tests.passwordHashExists],
                    ["Role = DELIVERY_STAFF", diagnosis.tests.roleIsDeliveryStaff],
                    ["Business Match", diagnosis.tests.businessMatch],
                    ["Store Assignment Exists", diagnosis.tests.storeAssignmentExists],
                  ] as [string, boolean][]).map(([label, pass]) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span>{label}</span>
                      {pass
                        ? <span className="flex items-center gap-1 text-emerald-600 font-medium"><CheckCircle2 className="h-4 w-4" />Pass</span>
                        : <span className="flex items-center gap-1 text-red-600 font-medium"><XCircle className="h-4 w-4" />Fail</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* DELIVERY PARTNER */}
              <div className="rounded-lg border p-3 text-xs space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Delivery Partner</p>
                <Row k="Partner ID" v={diagnosis.partner.partnerId} mono />
                <Row k="Business" v={`${diagnosis.partner.businessName ?? ""} (${diagnosis.partner.businessId})`} />
                <Row k="Store" v={diagnosis.partner.storeName ? `${diagnosis.partner.storeCode || ""} ${diagnosis.partner.storeName}` : "— none —"} />
                <Row k="App Access" v={diagnosis.partner.appEnabled ? "Enabled" : "Disabled"} />
                <Row k="Active" v={diagnosis.partner.isActive ? "Yes" : "No"} />
                <Row k="Email" v={diagnosis.partner.email || "— none —"} />
                <Row k="Linked userId" v={diagnosis.partner.userId || "— none —"} mono />
              </div>

              {/* LINKED USER */}
              <div className="rounded-lg border p-3 text-xs space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Linked User</p>
                {diagnosis.user ? (
                  <>
                    <Row k="User ID" v={diagnosis.user.userId} mono />
                    <Row k="Email" v={diagnosis.user.email} />
                    <Row k="Role" v={diagnosis.user.role || "— none —"} />
                    <Row k="Active" v={diagnosis.user.isActive ? "Yes" : "No"} />
                    <Row k="Password Hash" v={diagnosis.user.passwordHashExists ? "Yes" : "No"} />
                    <Row k="Must Change Password" v={diagnosis.user.mustChangePassword ? "Yes" : "No"} />
                    <Row k="Last Login" v={diagnosis.user.lastLogin ? new Date(diagnosis.user.lastLogin).toLocaleString("en-IN") : "Never"} />
                    {diagnosis.user.businesses.length > 1 && (
                      <Row k="Businesses" v={diagnosis.user.businesses.map(b => `${b.slug}:${b.role}`).join(", ")} />
                    )}
                  </>
                ) : (
                  <p className="text-red-600 font-medium">No user linked to this partner.</p>
                )}
              </div>

              {/* Temp password (if just generated) */}
              {diagTempPassword && (
                <div className="rounded-xl border bg-teal-50 border-teal-200 p-3 text-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700 mb-1">New Temporary Password</p>
                  <p className="font-mono font-semibold tracking-wide text-teal-900">{diagTempPassword}</p>
                  <p className="text-[11px] text-teal-600 mt-1">Share with the partner — they set their own on first login.</p>
                </div>
              )}

              {/* REPAIR ACTIONS */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Repair Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  {!diagnosis.tests.userExists ? (
                    <RepairBtn icon={UserPlus} label="Create Missing User" busy={diagBusy === "create-user"} onClick={() => runRepair("create-user")} />
                  ) : (
                    <RepairBtn icon={Link2} label="Re-link / Fix Role" busy={diagBusy === "link-user"} onClick={() => runRepair("link-user")} />
                  )}
                  <RepairBtn icon={KeyRound} label="Reset Password" busy={diagBusy === "reset-password"} onClick={() => runRepair("reset-password")} />
                  <RepairBtn icon={RotateCcw} label="Regenerate Credentials" busy={diagBusy === "regenerate"} onClick={() => runRepair("regenerate")} />
                  <RepairBtn icon={AlertTriangle} label="Force Password Reset" busy={diagBusy === "force-reset"} onClick={() => runRepair("force-reset")} />
                  <RepairBtn icon={MailIcon} label="Send Setup Email" busy={diagBusy === "send-setup-email"} onClick={() => runRepair("send-setup-email")} />
                  <RepairBtn icon={Copy} label="Copy Login Credentials" onClick={copyDiagnosisCredentials} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => openDiagnose(diagTarget!)} disabled={diagLoading || !diagTarget}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Re-run
            </Button>
            <Button onClick={() => { setDiagTarget(null); setDiagnosis(null); setDiagTempPassword(null) }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials reveal — shown once after a temp password is issued */}
      <Dialog open={!!credential} onOpenChange={(o) => !o && setCredential(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-teal-600" />Share Login Credentials</DialogTitle>
            <DialogDescription>
              This temporary password is shown <strong>only once</strong>. Share it with{" "}
              <strong>{credential?.name}</strong> now — they&apos;ll set their own password on first login.
            </DialogDescription>
          </DialogHeader>
          {credential && (
            <div className="space-y-3 py-1">
              <div className="rounded-xl border bg-muted/40 p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium break-all">{credential.email}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Temporary password</span>
                  <span className="font-mono font-semibold tracking-wide">{credential.tempPassword}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="gap-2" onClick={() => copyCredentials(credential)}>
                  {credCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  {credCopied ? "Copied" : "Copy"}
                </Button>
                <Button
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => openWhatsApp(credential.phone, credentialMessage(credential))}
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCredential(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for <strong>{resetTarget?.name}</strong>.
              {resetTarget && !resetTarget.email && (
                <span className="block mt-1 text-amber-600 text-xs">
                  This partner has no email set. Add an email first to enable app login.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showResetPw ? "text" : "password"}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showResetPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={resetting || !resetPassword.trim()}>
              {resetting ? "Resetting…" : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Delivery Partner</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Removing…" : "Remove Partner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
