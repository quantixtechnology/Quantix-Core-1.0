"use client"

import { useState, useEffect, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Globe,
  Search,
  ExternalLink,
  Settings2,
  ShieldCheck,
  Shield,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Info,
  CheckCircle2,
  XCircle,
  Clock,
  Wifi,
  Server,
  Lock,
  PlayCircle,
  Zap,
} from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { toast } from "sonner"
import { resolveImageUrl } from "@/lib/image-url"

// ── Types ─────────────────────────────────────────────────────────────────

type WebsiteStatus = "active" | "draft" | "maintenance" | "suspended"

interface WebsiteRecord {
  id: string
  name: string
  slug: string
  businessType: string
  businessStatus: string
  isOnline: boolean
  logo: string | null
  primaryColor: string
  secondaryColor: string | null
  accentColor: string | null
  tagline: string | null
  contactPhone: string | null
  contactEmail: string | null
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  websiteStatus: WebsiteStatus
  websiteUrl: string | null
  subdomain: string | null
  sslStatus: string
  sslExpiryDate: string | null
  domainStatus: string | null
  domainConfiguredAt: string | null
  updatedAt: string
}

interface ValidationResult {
  slug:       string
  domain:     string
  dns:        { status: string; resolved: string[]; expected: string; pointsToVps: boolean }
  ssl:        { status: string; expiryDate: string | null; httpsReachable: boolean }
  tenant:     { status: string; businessId: string | null; businessName: string | null }
  storefront: { status: string; isOnline: boolean }
  deployment: { status: string; label: string; nextStep: string }
  checkedAt:  string
}

// ── Status config ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<WebsiteStatus, { label: string; cls: string }> = {
  active:      { label: "Active",      cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  draft:       { label: "Draft",       cls: "bg-gray-100   text-gray-600   border-gray-200"    },
  maintenance: { label: "Maintenance", cls: "bg-amber-50   text-amber-700  border-amber-200"   },
  suspended:   { label: "Suspended",   cls: "bg-red-50     text-red-700    border-red-200"      },
}

type SslConfig = { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }
const SSL_CONFIG: Record<string, SslConfig> = {
  active:  { label: "SSL Active",  cls: "text-emerald-600", Icon: ShieldCheck    },
  pending: { label: "SSL Pending", cls: "text-amber-500",   Icon: Shield         },
  expired: { label: "SSL Expired", cls: "text-red-500",     Icon: AlertTriangle  },
}

// 4-step deployment pipeline
const DEPLOY_STEPS: { key: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "dns",        label: "DNS",        icon: Wifi       },
  { key: "ssl",        label: "SSL",        icon: Lock       },
  { key: "storefront", label: "Storefront", icon: Server     },
  { key: "live",       label: "Live",       icon: PlayCircle },
]

function deployStepStatus(validation: ValidationResult | null, step: string): "done" | "active" | "pending" | "error" {
  if (!validation) return "pending"
  const { dns, ssl, storefront, deployment } = validation
  if (deployment.status === "ACTIVE") return "done"

  if (step === "dns") {
    if (dns.status === "active") return "done"
    if (dns.status === "error")  return "error"
    return "active"
  }
  if (step === "ssl") {
    if (dns.status !== "active") return "pending"
    if (ssl.httpsReachable || ssl.status === "active") return "done"
    return "active"
  }
  if (step === "storefront") {
    if (!ssl.httpsReachable && ssl.status !== "active") return "pending"
    if (storefront.isOnline) return "done"
    return "active"
  }
  if (step === "live") {
    if (deployment.status === "ACTIVE") return "done"
    return "pending"
  }
  return "pending"
}

function domainStatusBadge(domainStatus: string | null) {
  switch (domainStatus) {
    case "ACTIVE":          return { label: "Live",           cls: "bg-emerald-50 text-emerald-700 border-emerald-200" }
    case "SSL_PENDING":     return { label: "SSL Pending",    cls: "bg-amber-50   text-amber-700   border-amber-200"   }
    case "DNS_PROPAGATING": return { label: "DNS Propagating",cls: "bg-blue-50    text-blue-700    border-blue-200"    }
    case "PENDING_DNS":     return { label: "DNS Pending",    cls: "bg-gray-100   text-gray-600    border-gray-200"    }
    case "ERROR":           return { label: "Error",          cls: "bg-red-50     text-red-700     border-red-200"     }
    default:                return { label: "Not Deployed",   cls: "bg-gray-100   text-gray-500    border-gray-200"    }
  }
}

const STOREFRONT_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "quantixtechnology.in"

// ── Main component ────────────────────────────────────────────────────────

export function DomainsView() {
  const [sites, setSites] = useState<WebsiteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selected, setSelected] = useState<WebsiteRecord | null>(null)
  const [saving, setSaving] = useState(false)

  // Edit form
  const [editLogo, setEditLogo] = useState("")
  const [editPrimary, setEditPrimary] = useState("")
  const [editSecondary, setEditSecondary] = useState("")
  const [editAccent, setEditAccent] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editAddress, setEditAddress] = useState("")
  const [editCity, setEditCity] = useState("")
  const [editState, setEditState] = useState("")
  const [editPincode, setEditPincode] = useState("")
  const [editStatus, setEditStatus] = useState<string>("draft")
  const [editCustomDomain, setEditCustomDomain] = useState("")

  // Validation dialog
  const [validating, setValidating] = useState<string | null>(null)      // slug being validated
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [validationDialogOpen, setValidationDialogOpen] = useState(false)

  // ── Data fetching ────────────────────────────────────────────────────

  const fetchSites = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/websites", { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) setSites(json.data)
      else toast.error(json.error || "Failed to load websites")
    } catch {
      toast.error("Failed to load websites")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSites() }, [])

  // ── Derived data ─────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return sites.filter((s) => {
      if (statusFilter !== "all" && s.websiteStatus !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          s.name.toLowerCase().includes(q) ||
          (s.websiteUrl ?? "").toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [sites, search, statusFilter])

  const stats = useMemo(() => ({
    total:       sites.length,
    active:      sites.filter((s) => s.websiteStatus === "active").length,
    draft:       sites.filter((s) => s.websiteStatus === "draft").length,
    maintenance: sites.filter((s) => s.websiteStatus === "maintenance").length,
  }), [sites])

  // ── Sheet helpers ─────────────────────────────────────────────────────

  const openSheet = (site: WebsiteRecord) => {
    setSelected(site)
    setEditLogo(site.logo ?? "")
    setEditPrimary(site.primaryColor)
    setEditSecondary(site.secondaryColor ?? "")
    setEditAccent(site.accentColor ?? "")
    setEditPhone(site.contactPhone ?? "")
    setEditEmail(site.contactEmail ?? "")
    setEditAddress(site.address ?? "")
    setEditCity(site.city ?? "")
    setEditState(site.state ?? "")
    setEditPincode(site.pincode ?? "")
    setEditStatus(site.websiteStatus)
    const autoUrl = `${site.slug}.${STOREFRONT_BASE}`
    setEditCustomDomain(site.websiteUrl && site.websiteUrl !== autoUrl ? site.websiteUrl : "")
    setSheetOpen(true)
  }

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/websites/${selected.id}`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          logo:           editLogo    || null,
          primaryColor:   editPrimary || undefined,
          secondaryColor: editSecondary || null,
          accentColor:    editAccent  || null,
          contactPhone:   editPhone   || null,
          contactEmail:   editEmail   || null,
          address:        editAddress || null,
          city:           editCity    || null,
          state:          editState   || null,
          pincode:        editPincode || null,
          websiteStatus:  editStatus,
          customDomain:   editCustomDomain || null,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Website settings saved")
        setSheetOpen(false)
        fetchSites()
      } else {
        toast.error(json.error || "Failed to save")
      }
    } catch {
      toast.error("Failed to save website settings")
    } finally {
      setSaving(false)
    }
  }

  // ── Validation ─────────────────────────────────────────────────────────

  const validateSite = async (slug: string) => {
    setValidating(slug)
    setValidationResult(null)
    setValidationDialogOpen(true)
    try {
      const res  = await fetch(`/api/website/status?slug=${encodeURIComponent(slug)}`, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) {
        setValidationResult(json.data as ValidationResult)
        // Refresh list to pick up updated domain status
        fetchSites()
      } else {
        toast.error(json.error || "Validation failed")
        setValidationDialogOpen(false)
      }
    } catch {
      toast.error("Validation request failed")
      setValidationDialogOpen(false)
    } finally {
      setValidating(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Website Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage storefront branding, URLs, and website status — one website per business
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSites} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Sites",  value: stats.total,       color: "text-gray-800"    },
          { label: "Active",       value: stats.active,      color: "text-emerald-600" },
          { label: "Draft",        value: stats.draft,       color: "text-gray-500"    },
          { label: "Maintenance",  value: stats.maintenance, color: "text-amber-600"   },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="Search businesses or URLs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-38 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Architecture note */}
      <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-gray-200 px-4 py-3">
        <Info className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="font-medium text-gray-700">One website per business.</span>{" "}
          Each business gets <span className="font-mono text-gray-600">{"{slug}"}.{STOREFRONT_BASE}</span>.
          Use <strong>Validate</strong> to run a real-time DNS → SSL → Storefront health check.
          DNS must point to the VPS before SSL can be provisioned.
        </p>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Globe className="h-10 w-10 text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-500">No websites found</p>
            <p className="text-xs text-gray-400 mt-1">Websites are automatically created with each business.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Business</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Website URL</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 hidden md:table-cell">Deployment</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 hidden md:table-cell">SSL</th>
                  <th className="px-4 py-2.5 w-32" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((site, i) => {
                  const sc      = STATUS_CONFIG[site.websiteStatus] ?? STATUS_CONFIG.draft
                  const sslKey  = site.sslStatus in SSL_CONFIG ? site.sslStatus : "pending"
                  const ssl     = SSL_CONFIG[sslKey]
                  const SslIcon = ssl.Icon
                  const depBadge = domainStatusBadge(site.domainStatus)

                  return (
                    <tr
                      key={site.id}
                      className={`hover:bg-gray-50/50 transition-colors ${i < filtered.length - 1 ? "border-b border-gray-50" : ""}`}
                    >
                      {/* Business */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
                            style={{ backgroundColor: site.primaryColor || "#10B981" }}
                          >
                            {site.logo ? (
                              <img src={resolveImageUrl(site.logo)} alt="" className="h-full w-full object-contain" />
                            ) : (
                              <span className="text-white font-bold text-[11px]">{site.name.slice(0, 2).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">{site.name}</p>
                            <p className="text-[11px] text-gray-400 truncate">{site.businessType.replace(/_/g, " ")}</p>
                          </div>
                        </div>
                      </td>

                      {/* URL */}
                      <td className="px-4 py-3">
                        {site.websiteUrl || site.slug ? (
                          <div className="flex items-center gap-1.5">
                            <Globe className="h-3 w-3 text-gray-300 shrink-0" />
                            <span className="text-xs text-gray-700 font-mono truncate max-w-[200px]">
                              {site.websiteUrl ?? `${site.slug}.${STOREFRONT_BASE}`}
                            </span>
                            <a
                              href={`https://${site.websiteUrl ?? `${site.slug}.${STOREFRONT_BASE}`}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-300 hover:text-blue-500 transition-colors shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Website Status */}
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[10px] font-semibold ${sc.cls}`}>
                          {sc.label}
                        </Badge>
                      </td>

                      {/* Deployment Status */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Badge variant="outline" className={`text-[10px] font-semibold ${depBadge.cls}`}>
                          {depBadge.label}
                        </Badge>
                      </td>

                      {/* SSL */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className={`flex items-center gap-1 text-[11px] font-medium ${ssl.cls}`}>
                          <SslIcon className="h-3 w-3 shrink-0" />
                          <span>{ssl.label}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-gray-500 hover:text-gray-900"
                            onClick={() => validateSite(site.slug)}
                            disabled={validating === site.slug}
                          >
                            {validating === site.slug
                              ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              : <Zap className="h-3 w-3 mr-1 text-amber-500" />
                            }
                            Validate
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-gray-500 hover:text-gray-900"
                            onClick={() => openSheet(site)}
                          >
                            <Settings2 className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
            <SheetTitle className="text-base font-bold">{selected?.name}</SheetTitle>
            <SheetDescription className="text-xs text-gray-400">
              {selected?.websiteUrl ?? `${selected?.slug}.${STOREFRONT_BASE}`}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="px-6 py-5 space-y-6">

              {/* Website Status */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Website Status</p>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active — publicly visible to customers</SelectItem>
                    <SelectItem value="draft">Draft — not visible, under configuration</SelectItem>
                    <SelectItem value="maintenance">Maintenance — temporarily offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* URL & Domain */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Website URL</p>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Auto-generated URL</Label>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                    <Globe className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="text-xs font-mono text-gray-600">{selected?.slug}.{STOREFRONT_BASE}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Custom Domain <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <Input
                    placeholder="e.g. freshmart.in"
                    value={editCustomDomain}
                    onChange={(e) => setEditCustomDomain(e.target.value)}
                    className="h-9 text-sm font-mono"
                  />
                  <p className="text-[10px] text-gray-400">Leave blank to use the auto-generated URL. DNS must point to the VPS.</p>
                </div>
              </div>

              <Separator />

              {/* Branding */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Branding</p>
                <div className="space-y-1">
                  <Label className="text-xs">Business Logo URL</Label>
                  <Input placeholder="https://cdn.example.com/logo.png" value={editLogo} onChange={(e) => setEditLogo(e.target.value)} className="h-9 text-sm" />
                </div>
                {[
                  { label: "Primary Color",   val: editPrimary,   set: setEditPrimary,   ph: "#10B981" },
                  { label: "Secondary Color", val: editSecondary, set: setEditSecondary, ph: "#ffffff" },
                  { label: "Accent Color",    val: editAccent,    set: setEditAccent,    ph: "#3B82F6" },
                ].map(({ label, val, set, ph }) => (
                  <div key={label} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <div className="flex gap-2">
                      <input type="color" value={val || ph} onChange={(e) => set(e.target.value)} className="h-9 w-10 rounded border border-gray-200 cursor-pointer p-0.5 shrink-0" />
                      <Input value={val} onChange={(e) => set(e.target.value)} placeholder={ph} className="h-9 text-sm font-mono" />
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Contact Info */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Contact Information</p>
                <div className="space-y-1">
                  <Label className="text-xs">Business Phone</Label>
                  <Input placeholder="+91 98765 43210" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Business Email</Label>
                  <Input type="email" placeholder="contact@business.in" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Address</Label>
                  <Input placeholder="Full business address" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">City</Label>
                    <Input placeholder="Mumbai" value={editCity} onChange={(e) => setEditCity(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">State</Label>
                    <Input placeholder="Maharashtra" value={editState} onChange={(e) => setEditState(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Pincode</Label>
                    <Input placeholder="400001" value={editPincode} onChange={(e) => setEditPincode(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Domain & SSL info */}
              {selected && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Domain & SSL</p>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 flex items-center justify-between">
                      <span className="text-xs text-gray-600">Deployment Status</span>
                      {(() => {
                        const b = domainStatusBadge(selected.domainStatus)
                        return <Badge variant="outline" className={`text-[10px] ${b.cls}`}>{b.label}</Badge>
                      })()}
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 flex items-center justify-between">
                      <span className="text-xs text-gray-600">SSL Status</span>
                      {(() => {
                        const key = selected.sslStatus in SSL_CONFIG ? selected.sslStatus : "pending"
                        const cfg = SSL_CONFIG[key]
                        const Icon = cfg.Icon
                        return (
                          <div className={`flex items-center gap-1 text-xs font-semibold ${cfg.cls}`}>
                            <Icon className="h-3.5 w-3.5" />{cfg.label}
                          </div>
                        )
                      })()}
                    </div>
                    {selected.sslExpiryDate && (
                      <p className="text-[10px] text-gray-400">
                        Expires: {new Date(selected.sslExpiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs gap-1.5"
                      onClick={() => validateSite(selected.slug)}
                      disabled={validating === selected.slug}
                    >
                      {validating === selected.slug
                        ? <><Loader2 className="h-3 w-3 animate-spin" />Validating…</>
                        : <><Zap className="h-3 w-3 text-amber-500" />Run Deployment Check</>
                      }
                    </Button>
                  </div>
                </>
              )}

            </div>
          </ScrollArea>

          <div className="px-6 py-4 border-t border-gray-100 flex gap-2 shrink-0">
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>Cancel</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Validation Dialog ──────────────────────────────────────────────── */}
      <Dialog open={validationDialogOpen} onOpenChange={(o) => { setValidationDialogOpen(o); if (!o) setValidationResult(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-amber-500" />
              Deployment Validation
            </DialogTitle>
            <DialogDescription className="text-xs">
              {validationResult ? (
                <span className="font-mono">{validationResult.domain}</span>
              ) : "Running checks…"}
            </DialogDescription>
          </DialogHeader>

          {(!validationResult && validating) && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
              <p className="text-sm text-gray-400">Checking DNS, SSL, and storefront…</p>
            </div>
          )}

          {validationResult && (
            <div className="space-y-4">
              {/* 4-step pipeline */}
              <div className="flex items-center gap-0">
                {DEPLOY_STEPS.map((step, idx) => {
                  const stepStatus = deployStepStatus(validationResult, step.key)
                  const Icon = step.icon
                  const colors = {
                    done:    "bg-emerald-500 text-white border-emerald-500",
                    active:  "bg-amber-400 text-white border-amber-400",
                    pending: "bg-gray-100 text-gray-400 border-gray-200",
                    error:   "bg-red-500 text-white border-red-500",
                  }
                  return (
                    <div key={step.key} className="flex items-center flex-1 min-w-0">
                      <div className="flex flex-col items-center flex-1">
                        <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center shrink-0 ${colors[stepStatus]}`}>
                          {stepStatus === "done"  && <CheckCircle2 className="h-4 w-4" />}
                          {stepStatus === "error" && <XCircle      className="h-4 w-4" />}
                          {stepStatus === "active"  && <Clock className="h-3.5 w-3.5" />}
                          {stepStatus === "pending" && <Icon className="h-3.5 w-3.5" />}
                        </div>
                        <p className={`text-[9px] font-semibold mt-1 ${stepStatus === "done" ? "text-emerald-600" : stepStatus === "error" ? "text-red-500" : stepStatus === "active" ? "text-amber-600" : "text-gray-400"}`}>
                          {step.label}
                        </p>
                      </div>
                      {idx < DEPLOY_STEPS.length - 1 && (
                        <div className={`h-0.5 flex-1 -mt-5 mx-1 ${stepStatus === "done" ? "bg-emerald-400" : "bg-gray-200"}`} />
                      )}
                    </div>
                  )
                })}
              </div>

              <Separator />

              {/* Detail rows */}
              {[
                {
                  icon: Wifi,
                  label: "DNS",
                  ok: validationResult.dns.status === "active",
                  detail: validationResult.dns.status === "active"
                    ? `Resolves → ${validationResult.dns.resolved.join(", ")}${validationResult.dns.pointsToVps ? " ✓ VPS" : " ⚠ wrong IP"}`
                    : `NXDOMAIN — add wildcard A record for *.${STOREFRONT_BASE}`,
                },
                {
                  icon: Lock,
                  label: "SSL",
                  ok: validationResult.ssl.httpsReachable || validationResult.ssl.status === "active",
                  detail: validationResult.ssl.httpsReachable
                    ? `HTTPS reachable${validationResult.ssl.expiryDate ? ` · expires ${new Date(validationResult.ssl.expiryDate).toLocaleDateString("en-IN")}` : ""}`
                    : "SSL not active — run certbot after DNS is working",
                },
                {
                  icon: Server,
                  label: "Tenant",
                  ok: validationResult.tenant.status !== "not_found",
                  detail: validationResult.tenant.status === "not_found"
                    ? `Slug "${validationResult.slug}" not found in database`
                    : `${validationResult.tenant.businessName} · ${validationResult.tenant.status}`,
                },
                {
                  icon: PlayCircle,
                  label: "Storefront",
                  ok: validationResult.storefront.isOnline,
                  detail: validationResult.storefront.isOnline
                    ? "Online and serving customers"
                    : "Website status is not Active — set to Active in settings",
                },
              ].map(({ icon: Icon, label, ok, detail }) => (
                <div key={label} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 border ${ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                  <div className={`mt-0.5 shrink-0 ${ok ? "text-emerald-600" : "text-red-500"}`}>
                    {ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold ${ok ? "text-emerald-800" : "text-red-800"}`}>{label}</p>
                    <p className={`text-[11px] mt-0.5 leading-snug ${ok ? "text-emerald-700" : "text-red-700"}`}>{detail}</p>
                  </div>
                </div>
              ))}

              {/* Next step */}
              {validationResult.deployment.nextStep && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Next Step</p>
                  <p className="text-xs text-amber-800 font-mono leading-relaxed">{validationResult.deployment.nextStep}</p>
                </div>
              )}

              {validationResult.deployment.status === "ACTIVE" && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <p className="text-xs text-emerald-800 font-semibold">
                    Fully deployed — <span className="font-mono">{validationResult.domain}</span> is live
                  </p>
                </div>
              )}

              <p className="text-[10px] text-gray-400 text-right">
                Checked at {new Date(validationResult.checkedAt).toLocaleTimeString("en-IN")}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}
