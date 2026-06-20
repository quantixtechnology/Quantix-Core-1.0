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
  serviceRadiusKm: number | null
  dailyCapacityKg: number | null
  isActive: boolean
}

export function LaundryStoresView({ businessId }: { businessId: string }) {
  const [stores, setStores] = useState<Store[]>([])
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

  useEffect(() => { fetchStores() }, [businessId])

  const openCreate = () => {
    setEditingStore(null)
    setForm({ storeName: "", storeType: "RETAIL_STORE", managerName: "", mobile: "", email: "", address: "", city: "", state: "", pincode: "", latitude: "", longitude: "", serviceRadiusKm: "", dailyCapacityKg: "", isActive: true })
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
                    <Badge variant="outline" className={s.storeType === "PROCESSING_CENTER" ? "border-amber-300 text-amber-700" : "border-blue-300 text-blue-700"}>
                      {s.storeType === "PROCESSING_CENTER" ? "Processing Center" : "Retail Store"}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingStore ? "Edit Store" : "Add Store"}</DialogTitle>
            <DialogDescription>Configure store details for this laundry business.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
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
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="flex items-center gap-2 pb-1.5">
                <Switch checked={form.isActive} onCheckedChange={v => setForm(p => ({ ...p, isActive: v }))} />
                <Label className="text-sm">Active</Label>
              </div>
            </div>
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
            <div className="col-span-2">
              <Label>Address</Label>
              <Textarea value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Store address" />
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
            <div>
              <Label>Latitude</Label>
              <Input value={form.latitude} onChange={e => setForm(p => ({ ...p, latitude: e.target.value }))} placeholder="28.6139" />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input value={form.longitude} onChange={e => setForm(p => ({ ...p, longitude: e.target.value }))} placeholder="77.2090" />
            </div>
            <div>
              <Label>Service Radius (KM)</Label>
              <Input value={form.serviceRadiusKm} onChange={e => setForm(p => ({ ...p, serviceRadiusKm: e.target.value }))} placeholder="5" />
            </div>
            <div>
              <Label>Daily Capacity (KG)</Label>
              <Input value={form.dailyCapacityKg} onChange={e => setForm(p => ({ ...p, dailyCapacityKg: e.target.value }))} placeholder="500" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.storeName}>{editingStore ? "Update" : "Create"} Store</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
