"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Truck,
  Plus,
  Search,
  Phone,
  Mail,
  Star,
  Package,
  IndianRupee,
  Pencil,
  Trash2,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  Car,
  Shield,
  Smartphone,
  ChevronDown,
  ChevronUp,
  User,
} from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { showSuccess, showError } from "@/lib/toast-utils"
import { Skeleton } from "@/components/ui/skeleton"

// ─── Types ────────────────────────────────────────────────────────────────────

type PartnerType = "INTERNAL" | "EXTERNAL"
type PartnerAvailability = "ONLINE" | "OFFLINE" | "BUSY"

interface DeliveryPartner {
  id: string
  businessId: string
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
  vehicleType: "",
  vehicleNumber: "",
  licenseNumber: "",
  partnerType: "INTERNAL",
  availability: "OFFLINE",
  appEnabled: false,
  notes: "",
  bankAccount: "",
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

// ─── Component ────────────────────────────────────────────────────────────────

export function DeliveryPartnersView() {
  const { currentBusinessId } = useAdminStore()
  const { currentBusinessId: authBizId } = useAuthStore()
  const businessId = currentBusinessId || authBizId || ""

  const [partners, setPartners] = useState<DeliveryPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterAvailability, setFilterAvailability] = useState<string>("all")
  const [filterType, setFilterType] = useState<string>("all")

  // Sheet / dialog state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingPartner, setEditingPartner] = useState<DeliveryPartner | null>(null)
  const [formData, setFormData] = useState<PartnerFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<DeliveryPartner | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchPartners = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterAvailability !== "all") params.set("isOnline", filterAvailability === "ONLINE" ? "true" : "false")
      const url = `/api/core/delivery/partners?${params.toString()}`
      const res = await fetch(url, { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success) setPartners(json.data || [])
      else showError(json.error || "Failed to load partners")
    } catch {
      showError("Failed to load delivery partners")
    } finally {
      setLoading(false)
    }
  }, [businessId, filterAvailability])

  useEffect(() => { fetchPartners() }, [fetchPartners])

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
    setSheetOpen(true)
  }

  function openEdit(p: DeliveryPartner) {
    setEditingPartner(p)
    setFormData({
      name: p.name,
      phone: p.phone,
      email: p.email || "",
      vehicleType: p.vehicleType || "",
      vehicleNumber: p.vehicleNumber || "",
      licenseNumber: p.licenseNumber || "",
      partnerType: p.partnerType,
      availability: p.availability,
      appEnabled: p.appEnabled,
      notes: p.notes || "",
      bankAccount: "",
    })
    setSheetOpen(true)
  }

  function set(field: keyof PartnerFormData, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!formData.name.trim()) { showError("Name is required"); return }
    if (!formData.phone.trim()) { showError("Phone is required"); return }
    setSaving(true)
    try {
      const payload = {
        ...formData,
        businessId,
        isOnline: formData.availability === "ONLINE",
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
      fetchPartners()
    } catch {
      showError("Failed to save partner")
    } finally {
      setSaving(false)
    }
  }

  async function toggleAvailability(p: DeliveryPartner) {
    const next: PartnerAvailability = p.availability === "ONLINE" ? "OFFLINE" : "ONLINE"
    try {
      const res = await fetch(`/api/core/delivery/partners/${p.id}`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ availability: next, isOnline: next === "ONLINE" }),
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
                        <p className="text-xs text-muted-foreground mb-0.5">Joined</p>
                        <p className="font-medium">{new Date(p.createdAt).toLocaleDateString("en-IN")}</p>
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
                  <Label>Email</Label>
                  <Input value={formData.email} onChange={(e) => set("email", e.target.value)} placeholder="rahul@example.com" type="email" />
                </div>
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
