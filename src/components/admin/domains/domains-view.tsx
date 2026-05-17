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
} from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { toast } from "sonner"

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

const STOREFRONT_BASE = "quantixshop.in"

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
    // Custom domain: anything that isn't the auto-generated subdomain
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
          logo:          editLogo    || null,
          primaryColor:  editPrimary || undefined,
          secondaryColor: editSecondary || null,
          accentColor:   editAccent  || null,
          contactPhone:  editPhone   || null,
          contactEmail:  editEmail   || null,
          address:       editAddress || null,
          city:          editCity    || null,
          state:         editState   || null,
          pincode:       editPincode || null,
          websiteStatus: editStatus,
          customDomain:  editCustomDomain || null,
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
          { label: "Total Sites",  value: stats.total,       color: "text-gray-800"   },
          { label: "Active",       value: stats.active,      color: "text-emerald-600" },
          { label: "Draft",        value: stats.draft,       color: "text-gray-500"   },
          { label: "Maintenance",  value: stats.maintenance, color: "text-amber-600"  },
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
          Websites are powered by a single shared storefront engine with dynamic tenant rendering.
          Each business gets a subdomain on <span className="font-mono text-gray-600">{STOREFRONT_BASE}</span> and optionally a custom domain in the future.
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
            <p className="text-xs text-gray-400 mt-1">
              Websites are automatically created with each business.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Business</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Website URL</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 hidden md:table-cell">SSL</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 hidden lg:table-cell">Updated</th>
                  <th className="px-4 py-2.5 w-20" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((site, i) => {
                  const sc = STATUS_CONFIG[site.websiteStatus] ?? STATUS_CONFIG.draft
                  const sslKey = site.sslStatus in SSL_CONFIG ? site.sslStatus : "pending"
                  const ssl = SSL_CONFIG[sslKey]
                  const SslIcon = ssl.Icon
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
                              <img
                                src={site.logo}
                                alt=""
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <span className="text-white font-bold text-[11px]">
                                {site.name.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">{site.name}</p>
                            <p className="text-[11px] text-gray-400 truncate">
                              {site.businessType.replace(/_/g, " ")}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* URL */}
                      <td className="px-4 py-3">
                        {site.websiteUrl ? (
                          <div className="flex items-center gap-1.5">
                            <Globe className="h-3 w-3 text-gray-300 shrink-0" />
                            <span className="text-xs text-gray-700 font-mono truncate max-w-[220px]">
                              {site.websiteUrl}
                            </span>
                            <a
                              href={`https://${site.websiteUrl}`}
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

                      {/* Status */}
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[10px] font-semibold ${sc.cls}`}>
                          {sc.label}
                        </Badge>
                      </td>

                      {/* SSL */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className={`flex items-center gap-1 text-[11px] font-medium ${ssl.cls}`}>
                          <SslIcon className="h-3 w-3 shrink-0" />
                          <span>{ssl.label}</span>
                        </div>
                      </td>

                      {/* Updated */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-gray-400">
                          {new Date(site.updatedAt).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-gray-500 hover:text-gray-900"
                          onClick={() => openSheet(site)}
                        >
                          <Settings2 className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
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
                    <span className="text-xs font-mono text-gray-600">
                      {selected?.slug}.{STOREFRONT_BASE}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">
                    Custom Domain{" "}
                    <span className="text-gray-400 font-normal">(optional, future)</span>
                  </Label>
                  <Input
                    placeholder="e.g. freshmart.in"
                    value={editCustomDomain}
                    onChange={(e) => setEditCustomDomain(e.target.value)}
                    className="h-9 text-sm font-mono"
                  />
                  <p className="text-[10px] text-gray-400">
                    Leave blank to use the auto-generated URL. DNS must point to Quantix servers.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Branding */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Branding</p>

                <div className="space-y-1">
                  <Label className="text-xs">Business Logo URL</Label>
                  <Input
                    placeholder="https://cdn.example.com/logo.png"
                    value={editLogo}
                    onChange={(e) => setEditLogo(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <p className="text-[10px] text-gray-400">
                    Used in storefront header, invoices, customer app, emails, and receipts.
                  </p>
                </div>

                {/* Color pickers */}
                {[
                  { label: "Primary Color",   val: editPrimary,   set: setEditPrimary,   ph: "#10B981" },
                  { label: "Secondary Color", val: editSecondary, set: setEditSecondary, ph: "#ffffff" },
                  { label: "Accent Color",    val: editAccent,    set: setEditAccent,    ph: "#3B82F6" },
                ].map(({ label, val, set, ph }) => (
                  <div key={label} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={val || ph}
                        onChange={(e) => set(e.target.value)}
                        className="h-9 w-10 rounded border border-gray-200 cursor-pointer p-0.5 shrink-0"
                      />
                      <Input
                        value={val}
                        onChange={(e) => set(e.target.value)}
                        placeholder={ph}
                        className="h-9 text-sm font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Contact Info */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Contact Information</p>
                <p className="text-[11px] text-gray-400 -mt-1">
                  Displayed on storefront, checkout, WhatsApp integrations, and customer support.
                </p>

                <div className="space-y-1">
                  <Label className="text-xs">Business Phone</Label>
                  <Input
                    placeholder="+91 98765 43210"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Business Email</Label>
                  <Input
                    type="email"
                    placeholder="contact@business.in"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Address</Label>
                  <Input
                    placeholder="Full business address"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">City</Label>
                    <Input
                      placeholder="Mumbai"
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">State</Label>
                    <Input
                      placeholder="Maharashtra"
                      value={editState}
                      onChange={(e) => setEditState(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Pincode</Label>
                    <Input
                      placeholder="400001"
                      value={editPincode}
                      onChange={(e) => setEditPincode(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* SSL info (read-only) */}
              {selected && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Domain & SSL</p>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 flex items-center justify-between">
                      <span className="text-xs text-gray-600">SSL Status</span>
                      {(() => {
                        const key = selected.sslStatus in SSL_CONFIG ? selected.sslStatus : "pending"
                        const cfg = SSL_CONFIG[key]
                        const Icon = cfg.Icon
                        return (
                          <div className={`flex items-center gap-1 text-xs font-semibold ${cfg.cls}`}>
                            <Icon className="h-3.5 w-3.5" />
                            {cfg.label}
                          </div>
                        )
                      })()}
                    </div>
                    {selected.sslExpiryDate && (
                      <p className="text-[10px] text-gray-400">
                        Expires:{" "}
                        {new Date(selected.sslExpiryDate).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400">
                      SSL provisioning is managed by the Quantix deployment team.
                    </p>
                  </div>
                </>
              )}

            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex gap-2 shrink-0">
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  )
}
