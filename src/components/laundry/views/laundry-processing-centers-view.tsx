"use client"

import { useEffect, useState } from "react"
import { Factory, Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useAuthStore } from "@/stores/auth-store"
import { useToast } from "@/hooks/use-toast"

type ProcessingCenter = {
  id: string
  centerCode: string
  centerName: string
  centerType: string
  managerName: string | null
  mobile: string | null
  address: string | null
  city: string | null
  dailyCapacityKg: number | null
  isActive: boolean
}

export function LaundryProcessingCentersView() {
  const { currentBusinessId } = useAuthStore()
  const { toast } = useToast()
  const [centers, setCenters] = useState<ProcessingCenter[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ centerName: "", centerType: "PROCESSING_HUB", managerName: "", mobile: "" })

  const fetchCenters = async () => {
    if (!currentBusinessId) return
    try {
      const res = await fetch(`/api/laundry/processing-centers?businessId=${currentBusinessId}`)
      if (res.ok) setCenters(await res.json())
    } catch {
      toast({ title: "Error", description: "Failed to load processing centers", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCenters() }, [currentBusinessId])

  const handleCreate = async () => {
    if (!form.centerName) { toast({ title: "Validation", description: "Center name is required", variant: "destructive" }); return }
    try {
      const res = await fetch("/api/laundry/processing-centers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, businessId: currentBusinessId }),
      })
      if (res.ok) {
        toast({ title: "Success", description: "Processing center created" })
        setShowCreate(false)
        setForm({ centerName: "", centerType: "PROCESSING_HUB", managerName: "", mobile: "" })
        fetchCenters()
      } else {
        const err = await res.json()
        throw new Error(err.error)
      }
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" })
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Processing Centers</h2>
          <p className="text-sm text-muted-foreground">Manage processing hubs and facilities</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Center</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Processing Center</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Center Name *</Label>
                <Input value={form.centerName} onChange={e => setForm(p => ({ ...p, centerName: e.target.value }))} placeholder="Main Processing Hub" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <select className="flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm" value={form.centerType} onChange={e => setForm(p => ({ ...p, centerType: e.target.value }))}>
                  <option value="PROCESSING_HUB">Processing Hub</option>
                  <option value="WASHING_CENTER">Washing Center</option>
                  <option value="DRY_CLEANING">Dry Cleaning</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Manager Name</Label>
                <Input value={form.managerName} onChange={e => setForm(p => ({ ...p, managerName: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Mobile</Label>
                <Input value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))} />
              </div>
              <Button onClick={handleCreate} className="w-full">Create Center</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {centers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Factory className="h-10 w-10 mb-3" />
          <p className="text-sm font-medium">No processing centers</p>
          <p className="text-xs">Add your first processing center to begin</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {centers.map((center) => (
            <Card key={center.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="font-mono text-[10px]">{center.centerCode}</Badge>
                  <Badge className={center.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                    {center.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <h3 className="font-medium text-sm">{center.centerName}</h3>
                <p className="text-xs text-muted-foreground">{center.centerType}</p>
                {center.managerName && <p className="text-xs mt-1">Manager: {center.managerName}</p>}
                {center.mobile && <p className="text-xs text-muted-foreground">{center.mobile}</p>}
                {center.dailyCapacityKg && <p className="text-xs text-muted-foreground mt-1">Capacity: {center.dailyCapacityKg} kg/day</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
