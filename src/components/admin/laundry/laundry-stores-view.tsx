"use client"

import { useState, useEffect } from "react"
import { Plus, Pencil, Trash2, Store, Factory, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { StoreLocationPicker, type StoreLocation } from "@/components/shared/google/store-location-picker"
import { LocationQrCard } from "@/components/laundry/location-qr-card"
import { CopyButton } from "@/components/ui/copy-button"

type Store = {
  id: string
  storeCode: string
  storeName: string
  storeType: string
  managerName: string | null
  mobile: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  latitude: number | null
  longitude: number | null
  googlePlaceId: string | null
  formattedAddress: string | null
  serviceRadiusKm: number | null
  dailyCapacityKg: number | null
  isActive: boolean
}

export function LaundryStoresView({ businessId }: { businessId: string }) {
  const [stores, setStores] = useState<Store[]>([])
  // Business identity for the QR card label, from the same branding record the
  // sidebar and invoices read. Read-only; failure just falls back to the store.
  const [businessName, setBusinessName] = useState("")
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingStore, setEditingStore] = useState<Store | null>(null)
  const [form, setForm] = useState({
    storeName: "",
    storeType: "RETAIL_STORE",
    managerName: "",
    mobile: "",
    email: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    latitude: "",
    longitude: "",
    googlePlaceId: "",
    formattedAddress: "",
    serviceRadiusKm: "",
    dailyCapacityKg: "",
    isActive: true,
  })

  const fetchStores = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/laundry/businesses/${businessId}/stores`)
      if (res.ok) setStores(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (!businessId) return
    fetch(`/api/laundry/branding?businessId=${encodeURIComponent(businessId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.success) setBusinessName(j.data.businessName || "") })
      .catch(() => {})
  }, [businessId])

  useEffect(() => { fetchStores() }, [businessId])

  const openCreate = () => {
    setEditingStore(null)
    setForm({ storeName: "", storeType: "RETAIL_STORE", managerName: "", mobile: "", email: "", address: "", city: "", state: "", pincode: "", latitude: "", longitude: "", googlePlaceId: "", formattedAddress: "", serviceRadiusKm: "", dailyCapacityKg: "", isActive: true })
    setDialogOpen(true)
  }

  const openEdit = (store: Store) => {
    setEditingStore(store)
    setForm({
      storeName: store.storeName,
      storeType: store.storeType,
      managerName: store.managerName || "",
      mobile: store.mobile || "",
      email: store.email || "",
      address: store.address || "",
      city: store.city || "",
      state: store.state || "",
      pincode: store.pincode || "",
      latitude: store.latitude?.toString() || "",
      longitude: store.longitude?.toString() || "",
      googlePlaceId: store.googlePlaceId || "",
      formattedAddress: store.formattedAddress || "",
      serviceRadiusKm: store.serviceRadiusKm?.toString() || "",
      dailyCapacityKg: store.dailyCapacityKg?.toString() || "",
      isActive: store.isActive,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const url = editingStore
      ? `/api/laundry/stores/${editingStore.id}`
      : `/api/laundry/businesses/${businessId}/stores`
    const method = editingStore ? "PUT" : "POST"

    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    if (res.ok) {
      setDialogOpen(false)
      fetchStores()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this store?")) return
    const res = await fetch(`/api/laundry/stores/${id}`, { method: "DELETE" })
    if (res.ok) fetchStores()
  }

  const handleToggleActive = async (store: Store) => {
    await fetch(`/api/laundry/stores/${store.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !store.isActive }),
    })
    fetchStores()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Stores ({stores.length})</h2>
        <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> Add Store</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Radius</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-gray-400">Loading...</TableCell></TableRow>
              ) : stores.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-gray-400">No stores yet</TableCell></TableRow>
              ) : stores.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.storeCode}</TableCell>
                  <TableCell className="font-medium">{s.storeName}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      s.storeType === "PROCESSING_CENTER" ? "border-amber-300 text-amber-700"
                      : s.storeType === "BOTH" ? "border-emerald-300 text-emerald-700"
                      : "border-blue-300 text-blue-700"
                    }>
                      {s.storeType === "PROCESSING_CENTER" ? "Processing Center"
                        : s.storeType === "BOTH" ? "Retail + Processing"
                        : "Retail Store"}
                    </Badge>
                  </TableCell>
                  <TableCell>{s.managerName || "—"}</TableCell>
                  <TableCell>{s.mobile || "—"}</TableCell>
                  <TableCell>{s.serviceRadiusKm ? `${s.serviceRadiusKm} km` : "—"}</TableCell>
                  <TableCell>{s.dailyCapacityKg ? `${s.dailyCapacityKg} kg` : "—"}</TableCell>
                  <TableCell>
                    <Switch checked={s.isActive} onCheckedChange={() => handleToggleActive(s)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        {/* Wide two-column form. The old modal was one narrow column, so on a
            desktop the map, the coordinates and the QR were all pushed below
            the fold and the Save button with them. Capped at 90vh with only
            the BODY scrolling, so the header and the primary action stay put. */}
        <DialogContent className="!max-w-[min(1180px,calc(100vw-80px))] sm:!max-w-[min(1180px,calc(100vw-80px))] w-[min(1180px,calc(100vw-80px))] lg:min-w-[1000px] max-h-[92vh] p-0 gap-0 flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0 border-b border-slate-200 px-6 py-4 space-y-1 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold tracking-tight">{editingStore ? "Edit Store" : "Add Store"}</DialogTitle>
                {/* Business owns the branch; the branch never replaces it. */}
                <p className="mt-0.5 text-sm text-slate-600 break-words">
                  {businessName && <span className="font-medium">{businessName}</span>}
                  {businessName && (form.storeName || editingStore?.storeName) && <span className="text-slate-300"> · </span>}
                  <span>{form.storeName || editingStore?.storeName || "New store"}</span>
                </p>
                <DialogDescription className="text-xs mt-0.5">
                  Store details, manager, location and the customer-facing Location QR.
                </DialogDescription>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${form.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${form.isActive ? "bg-emerald-500" : "bg-slate-300"}`} />
                  {form.isActive ? "Active" : "Inactive"}
                </span>
                {editingStore?.storeCode && (
                  <CopyButton value={editingStore.storeCode} label="Store Code" size="sm" variant="ghost" className="h-6 px-1.5 !text-[10px] font-mono text-slate-400">
                    {editingStore.storeCode}
                  </CopyButton>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-5">
            <div className="grid gap-8 lg:grid-cols-[1.15fr_0.95fr] [&>*]:min-w-0">

              {/* ── Left: everything typed ─────────────────────────────── */}
              <div className="space-y-6">
                <Section title="Store Information">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>Store Name *</Label>
                      <Input value={form.storeName} onChange={e => setForm(p => ({ ...p, storeName: e.target.value }))} placeholder="Main Store" />
                    </div>
                    <div>
                      <Label>Store Type</Label>
                      <Select value={form.storeType} onValueChange={v => setForm(p => ({ ...p, storeType: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RETAIL_STORE">Retail Store</SelectItem>
                          <SelectItem value="PROCESSING_CENTER">Processing Center</SelectItem>
                          <SelectItem value="BOTH">Both (Retail + Processing)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <div className="flex items-center gap-2 pb-1.5">
                        <Switch checked={form.isActive} onCheckedChange={v => setForm(p => ({ ...p, isActive: v }))} />
                        <Label className="text-sm">Active</Label>
                      </div>
                    </div>
                  </div>
                </Section>

                <Section title="Manager">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Manager Name</Label>
                      <Input value={form.managerName} onChange={e => setForm(p => ({ ...p, managerName: e.target.value }))} placeholder="Store Manager" />
                    </div>
                    <div>
                      <Label>Mobile</Label>
                      <Input value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))} placeholder="+91 98765 43210" />
                    </div>
                    <div className="col-span-2">
                      <Label>Email</Label>
                      <Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="store@example.com" />
                    </div>
                  </div>
                </Section>

                <Section title="Address">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>Address</Label>
                      <Textarea rows={2} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Store address" />
                    </div>
                    <div>
                      <Label>City</Label>
                      <Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="Mumbai" />
                    </div>
                    <div>
                      <Label>State</Label>
                      <Input value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} placeholder="Maharashtra" />
                    </div>
                    <div>
                      <Label>Pincode</Label>
                      <Input value={form.pincode} onChange={e => setForm(p => ({ ...p, pincode: e.target.value }))} placeholder="400001" />
                    </div>
                  </div>
                </Section>

                <Section title="Operations">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Service Radius (KM)</Label>
                      <Input value={form.serviceRadiusKm} onChange={e => setForm(p => ({ ...p, serviceRadiusKm: e.target.value }))} placeholder="5" />
                    </div>
                    <div>
                      <Label>Daily Capacity (KG)</Label>
                      <Input value={form.dailyCapacityKg} onChange={e => setForm(p => ({ ...p, dailyCapacityKg: e.target.value }))} placeholder="500" />
                    </div>
                  </div>
                </Section>
              </div>

              {/* ── Right: the place, and the QR that points at it ─────── */}
              <div className="space-y-6">
                <Section title="Location" hint="Search and select the store\u2019s Google Maps location.">
                  {/* Height-capped so the map cannot swallow the column and
                      push the QR out of sight — the original complaint. */}
                  <div className="[&_.gm-style]:rounded-lg [&>div>div:has(>div>.gm-style)]:!h-[380px]">
                    <StoreLocationPicker
                      value={{
                        latitude: form.latitude ? parseFloat(form.latitude) : null,
                        longitude: form.longitude ? parseFloat(form.longitude) : null,
                        googlePlaceId: form.googlePlaceId || null,
                        formattedAddress: form.formattedAddress || null,
                        address: form.address || null,
                        city: form.city || null,
                        state: form.state || null,
                        pincode: form.pincode || null,
                      }}
                      onChange={(loc: StoreLocation) => {
                        setForm(p => ({
                          ...p,
                          latitude: loc.latitude != null ? String(loc.latitude) : "",
                          longitude: loc.longitude != null ? String(loc.longitude) : "",
                          googlePlaceId: loc.googlePlaceId ?? "",
                          formattedAddress: loc.formattedAddress ?? "",
                          address: loc.address ?? "",
                          city: loc.city ?? "",
                          state: loc.state ?? "",
                          pincode: loc.pincode ?? "",
                        }))
                      }}
                    />
                  </div>
                </Section>

                {/* Part 1's component, unchanged — placement only. */}
                <Section title="Location QR" hint="Customer-facing \u2014 for visiting cards, signage and sharing.">
                <LocationQrCard
                  variant="panel"
                  businessName={businessName || "Business"}
                  locationName={form.storeName || editingStore?.storeName || "Store"}
                  address={form.formattedAddress || form.address || null}
                  latitude={form.latitude ? parseFloat(form.latitude) : null}
                  longitude={form.longitude ? parseFloat(form.longitude) : null}
                  unsaved={
                    !!editingStore &&
                    (parseFloat(form.latitude || "NaN") !== (editingStore.latitude ?? NaN) ||
                     parseFloat(form.longitude || "NaN") !== (editingStore.longitude ?? NaN))
                  }
                />
                </Section>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-slate-200 px-6 py-3.5 sm:justify-between gap-3 flex-wrap">
            <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {editingStore ? "Unsaved changes apply when you save." : "The store is created when you save."}
            </span>
            <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.storeName} className="min-w-[130px]">{editingStore ? "Update" : "Create"} Store</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** A titled group inside the Store modal — keeps the two columns legible. */
/**
 * A titled group. Deliberately NOT a card: the previous version boxed every
 * group, and five nested cards inside a dialog reads as clutter rather than
 * structure. A rule and a heading separate them with far less noise.
 */
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</h4>
      {hint && <p className="mt-0.5 mb-3 text-[11px] text-slate-400">{hint}</p>}
      <div className={hint ? "" : "mt-3"}>{children}</div>
    </section>
  )
}
