"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "../shared/page-header"
import { StatusBadge, CurrencyBadge } from "../shared/status-badge"
import { EmptyState } from "../shared/empty-state"
import { businessTypeConfig } from "@/components/dashboard/data"
import type { BusinessType } from "@/components/dashboard/data"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Building2, Plus, Search, X, MapPin, Phone, Mail, IndianRupee,
  ShoppingCart, Users, Wifi, WifiOff, Puzzle, Store, CreditCard, RefreshCw, AlertTriangle,
  LogIn, Copy, Check, Hash, Globe, ImageIcon, Save, Palette, Trash2, Loader2, KeyRound, Eye, EyeOff,
  Upload, Edit, FileText, Shield, Package, PlusCircle, ChevronDown, ChevronUp,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AvatarImage } from "@/components/ui/avatar"
import { useAdminStore, BUSINESS_TYPE_WORKFLOWS, type PlanTier } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { MobileProvisionSection } from "./mobile-provision-section"
import { resolveImageUrl } from "@/lib/image-url"
import { getBusinessLifecycle, getStateLabel, type BusinessLifecycleState } from "@/lib/business-lifecycle"
import { PlayCircle, Rocket } from "lucide-react"

// ---- Plan data type — feature access only, no pricing ----
interface PlanApiData {
  id: string;
  tier: PlanTier;
  name: string;
}


// ---- API data types ----
interface BusinessApiData {
  id: string; businessCode: string | null; name: string; slug: string; businessType: string; status: string
  productCode: string | null; subscriptionPlanCode: string | null
  city: string | null; state: string | null; pincode: string | null; country: string | null; address: string | null
  contactEmail: string | null; contactPhone: string | null
  supportEmail: string | null; supportPhone: string | null
  gstNumber: string | null; panNumber: string | null; cinNumber: string | null; fssaiLicense: string | null
  favicon: string | null; secondaryColor: string | null; tagline: string | null; description: string | null
  isOnline: boolean; primaryColor: string; logo: string | null; createdAt: string; onboardedAt: string | null; activatedAt: string | null
  subscription: {
    id: string; status: string
    // New billing fields
    subscriptionAmount: number | null; discountAmount: number | null; finalAmount: number | null
    implementationAmount: number | null
    iosAppAmount: number | null; iosDiscountAmount: number | null; iosFinalAmount: number | null; iosSubscriptionCycle: string | null
    addOns: string
    // Legacy
    planPrice: number | null; customPrice: number | null; discountPercentage: number | null
    manualPriceOverride: boolean; overrideReason: string | null; notes: string | null
    billingCycle: string; billingCycleDay: number | null; currentPeriodStart: string; nextBillingDate: string
    plan: { name: string; tier: string } | null
  } | null
  domain: { domain: string; status: string } | null
  deployments: Array<{ id: string; type: string; status: string; version: string | null; healthStatus: string }>
  modules: Array<{ moduleKey: string; moduleName: string; status: string }>
  salesRep: string | null
  mainStore: { id: string; storeCode: string | null } | null
  storeCount: number; orderCount: number; customerCount: number; totalRevenue: number
  ownerLoginId: string | null; ownerInternalId: string | null
  ownerEmail: string | null; ownerName: string | null
  ownerPhone: string | null; ownerLastLogin: string | null; ownerIsActive: boolean | null
  activationChecklist: string; activationProgress: number; activationCompleted: boolean
}

// Filter options
const allStatuses = [
  { value: "ALL", label: "All Statuses" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "TRIAL", label: "Trial" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "EXPIRED", label: "Expired" },
  { value: "CHURNED", label: "Churned" },
]

const allTypes = [
  { value: "ALL", label: "All Types" },
  ...Object.entries(businessTypeConfig).map(([key, val]) => ({ value: key, label: val.label })),
]

const onlineFilterOptions = [
  { value: "ALL", label: "All" },
  { value: "ONLINE", label: "Online" },
  { value: "OFFLINE", label: "Offline" },
]

function formatCurrency(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`
  return `₹${value.toLocaleString("en-IN")}`
}

// Tailwind classes for the lifecycle badge, by state (schema-aligned engine).
const LIFECYCLE_BADGE_CLASS: Record<BusinessLifecycleState, string> = {
  draft: "border-gray-300 text-gray-600 bg-gray-50",
  needs_plan: "border-amber-300 text-amber-700 bg-amber-50",
  ready_to_provision: "border-blue-300 text-blue-700 bg-blue-50",
  active: "border-emerald-300 text-emerald-700 bg-emerald-50",
}

const STATUS_ITEMS: { key: string; label: string }[] = [
  { key: "subscription", label: "Subscription Active" },
  { key: "domain", label: "Domain Configured" },
  { key: "ssl", label: "SSL Active" },
  { key: "online", label: "Online Enabled" },
]

const READINESS_ITEMS: { key: string; label: string }[] = [
  { key: "storeSettings", label: "Store Settings Configured" },
  { key: "category", label: "Categories Created" },
  { key: "product", label: "Products Added" },
  { key: "adminUser", label: "Admin User Created" },
  { key: "logo", label: "Logo Uploaded" },
  { key: "paymentGateway", label: "Payment Gateway Configured" },
  { key: "deliveryConfig", label: "Delivery Configuration" },
]

export function BusinessesView() {
  const router = useRouter()
  const { searchQuery, setCurrentBusiness, setActivePage, setResumeBusinessId, setManageBusinessId } = useAdminStore()

  // Open the full-page Business Management wizard (replaces the old drawer).
  const openManage = (biz: BusinessApiData) => {
    setManageBusinessId(biz.id)
    setActivePage("manage-business")
  }
  const { permissions } = useAuthStore()
  const canCreate = permissions.includes("businesses:create" as never)
  const canEdit = permissions.includes("businesses:edit" as never)
  const canImpersonate = permissions.includes("businesses:impersonate" as never)
  const [businesses, setBusinesses] = useState<BusinessApiData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [typeFilter, setTypeFilter] = useState<string>("ALL")
  const [onlineFilter, setOnlineFilter] = useState<string>("ALL")
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessApiData | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [drawerTab, setDrawerTab] = useState("overview")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Module toggle state (super admin)
  const [togglingModule, setTogglingModule] = useState<string | null>(null)

  // Owner password reset state
  const [resettingPassword, setResettingPassword] = useState(false)
  const [newOwnerPassword, setNewOwnerPassword] = useState<string | null>(null)
  const [copiedPassword, setCopiedPassword] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Edit Login ID state
  const [editingLoginId, setEditingLoginId] = useState(false)
  const [newLoginIdValue, setNewLoginIdValue] = useState("")
  const [savingLoginId, setSavingLoginId] = useState(false)

  // Activation checklist state
  const [checklistItems, setChecklistItems] = useState<Record<string, boolean>>({})
  const [checklistLoading, setChecklistLoading] = useState(false)

  // Branding & domain edit state (inline editor)
  const [brandingOpen, setBrandingOpen] = useState(false)
  const [editLogo, setEditLogo] = useState("")
  const [editDomain, setEditDomain] = useState("")
  const [editSubdomain, setEditSubdomain] = useState("")
  const [editPrimaryColor, setEditPrimaryColor] = useState("")
  const [savingBranding, setSavingBranding] = useState(false)
  const [uploadingInlineLogo, setUploadingInlineLogo] = useState(false)

  // Comprehensive Edit Panel state
  const [editPanelOpen, setEditPanelOpen] = useState(false)
  const [editPanelTab, setEditPanelTab] = useState("info")
  const [epName, setEpName] = useState("")
  const [epOwnerName, setEpOwnerName] = useState("")
  const [epSlug, setEpSlug] = useState("")
  const [epType, setEpType] = useState("")
  const [epDescription, setEpDescription] = useState("")
  const [epTagline, setEpTagline] = useState("")
  const [epPhone, setEpPhone] = useState("")
  const [epEmail, setEpEmail] = useState("")
  const [epSupportPhone, setEpSupportPhone] = useState("")
  const [epSupportEmail, setEpSupportEmail] = useState("")
  const [epAddress, setEpAddress] = useState("")
  const [epCity, setEpCity] = useState("")
  const [epState, setEpState] = useState("")
  const [epPincode, setEpPincode] = useState("")
  const [epCountry, setEpCountry] = useState("India")
  const [epGST, setEpGST] = useState("")
  const [epPAN, setEpPAN] = useState("")
  const [epCIN, setEpCIN] = useState("")
  const [epFSSAI, setEpFSSAI] = useState("")
  const [epLogo, setEpLogo] = useState("")
  const [epFavicon, setEpFavicon] = useState("")
  const [epPrimaryColor, setEpPrimaryColor] = useState("")
  const [epSecondaryColor, setEpSecondaryColor] = useState("")
  const [epDomain, setEpDomain] = useState("")
  const [epSubdomain, setEpSubdomain] = useState("")
  const [uploadingEpLogo, setUploadingEpLogo] = useState(false)
  const [uploadingEpFavicon, setUploadingEpFavicon] = useState(false)
  const [savingPanel, setSavingPanel] = useState(false)

  // Order stage config state
  const [stageLabels, setStageLabels] = useState<{ status: string; label: string; order: number }[]>([])
  const [stageSaving, setStageSaving] = useState(false)
  const [stageEditing, setStageEditing] = useState(false)

  const copyBusinessId = (slug: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(slug)
    setCopiedId(slug)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Resume the onboarding wizard for an incomplete business. The wizard loads
  // the business and jumps to the correct step via the lifecycle engine.
  const handleResumeOnboarding = (biz: BusinessApiData) => {
    setResumeBusinessId(biz.id)
    setActivePage("create-business")
  }

  // Edit a business from a list row. openEditPanel does not set the selected
  // business (handleSaveEditPanel relies on it), so set it here too.
  const handleEditBusiness = (biz: BusinessApiData) => {
    setSelectedBusiness(biz)
    openEditPanel(biz)
  }

  // Tracks the business whose provisioning is currently in flight (row shows
  // a disabled "Provisioning…" button while true).
  const [provisioningId, setProvisioningId] = useState<string | null>(null)
  // Provisioning password dialog (Super Admin sets the initial owner password).
  const [provisionTarget, setProvisionTarget] = useState<BusinessApiData | null>(null)
  const [ownerPw, setOwnerPw] = useState("")
  const [ownerPwConfirm, setOwnerPwConfirm] = useState("")
  const [ownerPwError, setOwnerPwError] = useState<string | null>(null)

  // Provision a business directly from the list. Reuses the existing
  // POST /api/admin/businesses/provision endpoint (same one the wizard uses).
  const handleProvisionBusiness = async (biz: BusinessApiData, ownerPassword?: string, confirmPassword?: string) => {
    setProvisioningId(biz.id)
    try {
      const res = await fetch("/api/admin/businesses/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ businessId: biz.id, ownerPassword, confirmPassword }),
      })
      const json = await res.json()
      if (!res.ok || json.success === false) {
        throw new Error(json.error || json.message || "Provisioning failed")
      }
      // Surface a generated temp password only when the admin didn't set one.
      const temp = json.data?.ownerTempPassword
      toast.success(temp ? `${biz.name} provisioned. Temp owner password: ${temp}` : `Provisioning started for ${biz.name}`)
      fetchBusinesses()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Provisioning failed")
    } finally {
      setProvisioningId(null)
    }
  }

  const handleOpenWorkspace = async (biz: BusinessApiData) => {
    if (!biz.id) {
      toast.error("Business ID not found")
      return
    }

    try {
      // Admin API is Bearer-only; without the auth headers this returned 401
      // and the guard below misreported it as "Business has no product assigned".
      const response = await fetch(`/api/admin/businesses/${biz.id}`, { headers: getAuthHeaders() })
      const result = await response.json()

      if (!result.success || !result.data?.productCode) {
        toast.error("Business has no product assigned")
        return
      }

      const productCode = result.data.productCode
      const runtimeResponse = await fetch(`/api/admin/products/runtime/${encodeURIComponent(productCode)}`)
      const runtimeResult = await runtimeResponse.json()

      if (!runtimeResult.success || !runtimeResult.data?.runtime?.workspaceUrl) {
        toast.error("Cannot determine workspace URL")
        return
      }

      // Runtime Registry stores workspaceUrl without a scheme (e.g.
      // "commerce.quantixtechnology.in"). window.open treats a scheme-less value
      // as a relative path under the admin host, so normalise to https:// here —
      // matching how every other consumer (workspaces-view) builds the link.
      const baseUrl: string = runtimeResult.data.runtime.workspaceUrl
      const normalizedBase = /^https?:\/\//i.test(baseUrl) ? baseUrl : `https://${baseUrl}`
      const workspaceUrl = `${normalizedBase}/${biz.id}`
      window.open(workspaceUrl, '_blank')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to open workspace")
    }
  }

  const fetchBusinesses = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/businesses?limit=100", {
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error("Failed to fetch businesses")
      const json = await res.json()
      if (json.success) setBusinesses(json.data)
      else throw new Error(json.error || "Failed to load businesses")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load businesses")
      toast.error(err instanceof Error ? err.message : "Failed to load businesses")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBusinesses()
  }, [])

  // Fetch order stage config when a business is selected
  useEffect(() => {
    if (!selectedBusiness) return
    const id = selectedBusiness.id
    fetch(`/api/core/businesses/${id}/order-stages`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(j => { if (j.success) setStageLabels(j.data.stages) })
      .catch(() => {/* non-critical */})
  }, [selectedBusiness])

  // Fetch activation checklist when detail sheet opens
  useEffect(() => {
    if (!detailOpen || !selectedBusiness) {
      setChecklistItems({})
      return
    }
    setChecklistLoading(true)
    fetch(`/api/core/businesses/${selectedBusiness.id}`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(j => {
        if (j.success && j.data) {
          try {
            const parsed = typeof j.data.activationChecklist === "string"
              ? JSON.parse(j.data.activationChecklist)
              : (j.data.activationChecklist || {})
            setChecklistItems(parsed)
          } catch { setChecklistItems({}) }
        }
      })
      .catch(() => {})
      .finally(() => setChecklistLoading(false))
  }, [detailOpen, selectedBusiness])

  const filteredBusinesses = useMemo(() => {
    return businesses.filter((biz) => {
      const matchSearch = !searchQuery ||
        biz.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        biz.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (biz.city || "").toLowerCase().includes(searchQuery.toLowerCase())
      const matchStatus = statusFilter === "ALL" || biz.status === statusFilter
      const matchType = typeFilter === "ALL" || biz.businessType === typeFilter
      const matchOnline = onlineFilter === "ALL" ||
        (onlineFilter === "ONLINE" && biz.isOnline) ||
        (onlineFilter === "OFFLINE" && !biz.isOnline)
      return matchSearch && matchStatus && matchType && matchOnline
    })
  }, [businesses, searchQuery, statusFilter, typeFilter, onlineFilter])

  const openBrandingEditor = (biz: BusinessApiData) => {
    setEditLogo(biz.logo ?? "")
    setEditDomain(biz.domain?.domain ?? "")
    setEditSubdomain("")
    setEditPrimaryColor(biz.primaryColor ?? "#10B981")
    setBrandingOpen(true)
  }

  const handleToggleModule = async (biz: BusinessApiData, moduleKey: string, currentStatus: string) => {
    setTogglingModule(moduleKey)
    const newStatus = currentStatus === "ENABLED" ? "DISABLED" : "ENABLED"
    try {
      await fetch(`/api/core/businesses/${biz.id}/modules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ moduleKey, status: newStatus }),
      })
      await fetchBusinesses()
    } finally {
      setTogglingModule(null)
    }
  }

  const handleResetPassword = async (biz: BusinessApiData) => {
    setResettingPassword(true)
    setNewOwnerPassword(null)
    setCopiedPassword(false)
    try {
      const res = await fetch(`/api/admin/businesses/${biz.id}/reset-password`, {
        method: "POST",
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (json.success) {
        setNewOwnerPassword(json.data.newPassword)
        toast.success("Password reset — share it securely with the owner")
      } else {
        toast.error(json.error || "Failed to reset password")
      }
    } catch {
      toast.error("Failed to reset password")
    } finally {
      setResettingPassword(false)
    }
  }

  const handleSaveLoginId = async (biz: BusinessApiData) => {
    if (!newLoginIdValue.trim()) {
      toast.error("Login ID cannot be empty")
      return
    }
    if (!biz.ownerInternalId) {
      toast.error("Owner account not found")
      return
    }
    setSavingLoginId(true)
    try {
      const res = await fetch(`/api/admin/businesses/${biz.id}/update-login-id`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ userId: biz.ownerInternalId, newLoginId: newLoginIdValue.trim(), userType: "owner" }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Login ID updated successfully")
        setEditingLoginId(false)
        setNewLoginIdValue("")
        fetchBusinesses()
      } else {
        toast.error(json.error || "Failed to update Login ID")
      }
    } catch {
      toast.error("Failed to update Login ID")
    } finally {
      setSavingLoginId(false)
    }
  }

  const handleSaveBranding = async (biz: BusinessApiData) => {
    setSavingBranding(true)
    try {
      const body: Record<string, unknown> = {
        logo: editLogo || null,
        primaryColor: editPrimaryColor,
      }
      if (editDomain) {
        body.domain = editDomain
        body.subdomain = editSubdomain || undefined
      }
      const res = await fetch(`/api/core/businesses/${biz.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to save")
      toast.success("Branding & domain saved")
      setBrandingOpen(false)
      fetchBusinesses()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSavingBranding(false)
    }
  }

  const handleToggleChecklistItem = async (item: string) => {
    if (!selectedBusiness) return
    const current = checklistItems[item] ?? false
    setChecklistItems(prev => ({ ...prev, [item]: !current }))
    try {
      const res = await fetch(`/api/core/businesses/${selectedBusiness.id}/activation-checklist`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ item, value: !current }),
      })
      const json = await res.json()
      if (!json.success) {
        setChecklistItems(prev => ({ ...prev, [item]: current }))
        toast.error(json.error || "Failed to update")
      } else {
        fetchBusinesses()
      }
    } catch {
      setChecklistItems(prev => ({ ...prev, [item]: current }))
      toast.error("Network error")
    }
  }

  // Upload a business logo or favicon.
  // IMPORTANT: Do NOT set Content-Type — the browser sets the multipart boundary automatically.
  // Only pass Authorization + x-business-id headers.
  const uploadBusinessAsset = async (
    file: File,
    businessId: string,
    field: "logo" | "favicon"
  ): Promise<string | null> => {
    const allHeaders = getAuthHeaders()
    const headers: Record<string, string> = {}
    if (allHeaders["Authorization"]) headers["Authorization"] = allHeaders["Authorization"]
    if (allHeaders["x-business-id"]) headers["x-business-id"] = allHeaders["x-business-id"]
    // Never set Content-Type — let browser set multipart/form-data with boundary

    const fd = new FormData()
    fd.append("file", file)
    fd.append("businessId", businessId)
    fd.append("field", field)

    let res: Response
    try {
      res = await fetch("/api/business/logo/upload", { method: "POST", headers, body: fd })
    } catch (networkErr) {
      toast.error(`Network error: ${networkErr instanceof Error ? networkErr.message : "Could not reach server"}`)
      return null
    }

    // 413 = proxy (nginx/Caddy) rejected the body before it reached the API
    if (res.status === 413) {
      toast.error("File too large — the server proxy rejected it. Run: nginx -T | grep client_max_body_size and add client_max_body_size 20m; to the server{} block, then reload nginx.")
      return null
    }

    let json: { success: boolean; url?: string; error?: string; warning?: string }
    try {
      json = await res.json()
    } catch {
      toast.error(`Server error (HTTP ${res.status}) — check PM2 logs: pm2 logs --lines 50`)
      return null
    }

    if (json.success) {
      if (json.warning) toast.warning(json.warning)
      return json.url as string
    }
    toast.error(json.error || `Upload failed (HTTP ${res.status})`)
    return null
  }

  const openEditPanel = (biz: BusinessApiData) => {
    setEpName(biz.name)
    setEpOwnerName(biz.ownerName ?? "")
    setEpSlug(biz.slug)
    setEpType(biz.businessType)
    setEpDescription(biz.description ?? "")
    setEpTagline(biz.tagline ?? "")
    setEpPhone(biz.contactPhone ?? "")
    setEpEmail(biz.contactEmail ?? "")
    setEpSupportPhone(biz.supportPhone ?? "")
    setEpSupportEmail(biz.supportEmail ?? "")
    setEpAddress(biz.address ?? "")
    setEpCity(biz.city ?? "")
    setEpState(biz.state ?? "")
    setEpPincode(biz.pincode ?? "")
    setEpCountry(biz.country ?? "India")
    setEpGST(biz.gstNumber ?? "")
    setEpPAN(biz.panNumber ?? "")
    setEpCIN(biz.cinNumber ?? "")
    setEpFSSAI(biz.fssaiLicense ?? "")
    setEpLogo(biz.logo ?? "")
    setEpFavicon(biz.favicon ?? "")
    setEpPrimaryColor(biz.primaryColor ?? "#10B981")
    setEpSecondaryColor(biz.secondaryColor ?? "")
    setEpDomain(biz.domain?.domain ?? "")
    setEpSubdomain("")
    setEditPanelTab("info")
    setEditPanelOpen(true)
  }

  const handleSaveEditPanel = async () => {
    if (!selectedBusiness) return
    setSavingPanel(true)
    try {
      const body: Record<string, unknown> = {
        name: epName,
        ownerName: epOwnerName || null,
        slug: epSlug,
        businessType: epType,
        description: epDescription || null,
        tagline: epTagline || null,
        contactPhone: epPhone || null,
        contactEmail: epEmail || null,
        supportPhone: epSupportPhone || null,
        supportEmail: epSupportEmail || null,
        address: epAddress || null,
        city: epCity || null,
        state: epState || null,
        pincode: epPincode || null,
        country: epCountry.trim() || "India", // country is non-nullable (default India)
        gstNumber: epGST || null,
        panNumber: epPAN || null,
        cinNumber: epCIN || null,
        fssaiLicense: epFSSAI || null,
        logo: epLogo || null,
        favicon: epFavicon || null,
        primaryColor: epPrimaryColor || "#10B981",
        secondaryColor: epSecondaryColor || null,
      }
      if (epDomain) {
        body.domain = epDomain
        if (epSubdomain) body.subdomain = epSubdomain
      }
      const res = await fetch(`/api/core/businesses/${selectedBusiness.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to save")
      toast.success("Business information saved")
      setEditPanelOpen(false)
      fetchBusinesses()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSavingPanel(false)
    }
  }


  const handleToggleOnline = async (biz: BusinessApiData) => {
    try {
      const res = await fetch(`/api/core/businesses/${biz.id}/toggle-online`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ isOnline: !biz.isOnline }),
      })
      if (res.ok) {
        toast.success(`${biz.name} is now ${!biz.isOnline ? "online" : "offline"}`)
        fetchBusinesses()
      } else {
        const json = await res.json()
        toast.error(json.error || "Failed to toggle online status")
      }
    } catch {
      toast.error("Failed to toggle online status")
    }
  }

  const handleSaveStages = async () => {
    if (!selectedBusiness) return
    setStageSaving(true)
    try {
      const res = await fetch(`/api/core/businesses/${selectedBusiness.id}/order-stages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ stages: stageLabels }),
      })
      const json = await res.json()
      if (json.success) { toast.success('Order stages saved'); setStageEditing(false) }
      else toast.error(json.error || 'Failed to save stages')
    } catch { toast.error('Failed to save stages') }
    finally { setStageSaving(false) }
  }

  const handleResetStages = async () => {
    if (!selectedBusiness) return
    setStageSaving(true)
    try {
      await fetch(`/api/core/businesses/${selectedBusiness.id}/order-stages`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      // Reload defaults
      const res = await fetch(`/api/core/businesses/${selectedBusiness.id}/order-stages`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) { setStageLabels(json.data.stages); setStageEditing(false); toast.success('Reset to defaults') }
    } catch { toast.error('Failed to reset') }
    finally { setStageSaving(false) }
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Business Management" description="Manage all platform businesses, subscriptions, and configurations" icon={Building2} />
        <Card><CardContent className="p-6"><Skeleton className="h-[400px] w-full" /></CardContent></Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Business Management" description="Manage all platform businesses, subscriptions, and configurations" icon={Building2} />
        <Card><CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchBusinesses} className="gap-2"><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
        </CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Management"
        description="Manage all platform businesses, subscriptions, and configurations"
        icon={Building2}
        action={canCreate ? (
          <Button className="gap-2" onClick={() => {
            const { setActivePage, setResumeBusinessId } = useAdminStore.getState()
            setResumeBusinessId(null) // fresh create — clear any resume target
            setActivePage("create-business")
          }}><Plus className="h-4 w-4" /> Create Business</Button>
        ) : undefined}
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search businesses..." className="pl-8 h-9" value={searchQuery} readOnly />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>{allStatuses.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}</SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Business Type" /></SelectTrigger>
          <SelectContent>{allTypes.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}</SelectContent>
        </Select>
        <Select value={onlineFilter} onValueChange={setOnlineFilter}>
          <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Online" /></SelectTrigger>
          <SelectContent>{onlineFilterOptions.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
        </Select>
        {(statusFilter !== "ALL" || typeFilter !== "ALL" || onlineFilter !== "ALL") && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("ALL"); setTypeFilter("ALL"); setOnlineFilter("ALL") }}>
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Business Table */}
      {filteredBusinesses.length === 0 ? (
        <EmptyState icon={Building2} title="No businesses found" description="Try adjusting your filters or create a new business" action={{ label: "Create Business", onClick: () => setCreateOpen(true) }} />
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
                    const typeConf = businessTypeConfig[biz.businessType as BusinessType]
                    const sub = biz.subscription
                    // Lifecycle state from the schema-aligned engine (Phase 2).
                    const lc = getBusinessLifecycle(biz)
                    const isProvisioning = provisioningId === biz.id
                    return (
                      <TableRow key={biz.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openManage(biz)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="text-xs font-semibold" style={{ backgroundColor: typeConf ? `${typeConf.color}18` : undefined, color: typeConf?.color }}>
                                {biz.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-sm">{biz.name}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-medium" style={{ borderColor: typeConf?.color, color: typeConf?.color }}>
                                  {typeConf?.label || biz.businessType}
                                </Badge>
                                {biz.city && <span className="text-xs text-muted-foreground flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{biz.city}</span>}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => copyBusinessId(biz.slug, e)}
                                className="flex items-center gap-1 mt-0.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors group"
                              >
                                <Hash className="h-2.5 w-2.5" />
                                {biz.slug}
                                {copiedId === biz.slug
                                  ? <Check className="h-2.5 w-2.5 text-emerald-600" />
                                  : <Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
                              </button>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <StatusBadge status={biz.status} />
                            <Badge variant="outline" className={`text-[10px] h-4 px-1.5 font-medium ${LIFECYCLE_BADGE_CLASS[lc.state]}`}>
                              {getStateLabel(lc.state)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{sub?.plan?.name || sub?.plan?.tier || "No Plan"}</span>
                            {sub?.customPrice && (
                              <span className="text-[10px] text-orange-600 font-medium">Custom: ₹{sub.customPrice.toLocaleString("en-IN")}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(biz.totalRevenue)}</TableCell>
                        <TableCell className="text-right text-sm">{biz.orderCount.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right text-sm">{biz.customerCount.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-center">
                          <div onClick={(e) => e.stopPropagation()}>
                            <Switch checked={biz.isOnline} onCheckedChange={() => handleToggleOnline(biz)} className="data-[state=checked]:bg-emerald-500" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            {isProvisioning ? (
                              <Button size="sm" variant="outline" disabled className="h-7 text-xs gap-1">
                                <Loader2 className="size-3 animate-spin" /> Provisioning…
                              </Button>
                            ) : lc.state === "ready_to_provision" ? (
                              <>
                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleResumeOnboarding(biz)}>
                                  <Check className="size-3" /> Review
                                </Button>
                                {canCreate && (
                                  <Button size="sm" className="h-7 text-xs gap-1 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => openManage(biz)}>
                                    <Rocket className="size-3" /> Provision
                                  </Button>
                                )}
                              </>
                            ) : lc.state === "active" ? (
                              <>
                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleOpenWorkspace(biz)}>
                                  <Globe className="size-3" /> Open Workspace
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openManage(biz)}>Open</Button>
                                {canEdit && (
                                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => openManage(biz)}>
                                    <Edit className="size-3" /> Edit
                                  </Button>
                                )}
                              </>
                            ) : (
                              /* draft / needs_plan */
                              <>
                                {canEdit && (
                                  <Button size="sm" className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleResumeOnboarding(biz)}>
                                    <PlayCircle className="size-3" /> Resume Setup
                                  </Button>
                                )}
                                {canEdit && (
                                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => openManage(biz)}>
                                    <Edit className="size-3" /> Edit
                                  </Button>
                                )}
                              </>
                            )}
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


    </div>
  )
}
