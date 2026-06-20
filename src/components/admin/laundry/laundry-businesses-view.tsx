"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Plus, Sparkles, Building2, MapPin, Store, CreditCard, ChevronLeft, Pencil, Save, X, Users, Route, Settings2, ArrowUp, ArrowDown, CheckCircle2, Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAdminStore } from "@/stores/admin-store"
import { useToast } from "@/hooks/use-toast"
import { LaundryBusinessCreate } from "./laundry-business-create"
import { LaundryStoresView } from "./laundry-stores-view"
import { LaundryServiceArea } from "./laundry-service-area"
import { LaundryDepartmentsView } from "./laundry-departments-view"
import { LaundryBusinessConfig } from "./laundry-business-config"

type LaundryBusiness = {
  id: string
  businessCode: string
  businessName: string
  legalName: string | null
  ownerName: string
  mobile: string
  email: string | null
  gstNumber: string | null
  logo: string | null
  favicon: string | null
  address: string | null
  plan: string
  status: string
  createdAt: string
  updatedAt: string
  _count?: { stores: number }
  stores?: LaundryStore[]
}

type LaundryStore = {
  id: string
  storeCode: string
  laundryBusinessId: string
  storeName: string
  storeType: string
  contactPerson: string | null
  mobile: string | null
  email: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  serviceRadiusKm: number | null
  createdAt: string
  updatedAt: string
}

type WorkflowStage = {
  id: string
  code: string
  name: string
  sequence: number
  description: string | null
  isDefault: boolean
  isActive: boolean
  isSystem: boolean
}

type BusinessConfig = {
  stage: WorkflowStage
  configuration: { id: string; enabled: boolean; sequence: number | null } | null
  enabled: boolean
}

type LaundryRole = {
  id: string
  code: string
  name: string
  isActive: boolean
  isSystem: boolean
}

type StagePermission = {
  id: string
  stageId: string
  roleId: string
  stage: WorkflowStage
  role: LaundryRole
}

const statusColors: Record<string, string> = {
  ONBOARDING: "bg-amber-100 text-amber-800",
  ACTIVE: "bg-green-100 text-green-800",
  SUSPENDED: "bg-red-100 text-red-800",
}

function BusinessListView({ onSelect }: { onSelect: (id: string) => void }) {
  const [businesses, setBusinesses] = useState<LaundryBusiness[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [planFilter, setPlanFilter] = useState("")

  const fetchBusinesses = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (statusFilter) params.set("status", statusFilter)
      if (planFilter) params.set("plan", planFilter)
      const res = await fetch(`/api/laundry/businesses?${params}`)
      if (res.ok) setBusinesses(await res.json())
    } catch (err) {
      console.error("Failed to fetch laundry businesses:", err)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, planFilter])

  useEffect(() => { fetchBusinesses() }, [fetchBusinesses])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Laundry Businesses</h1>
            <p className="text-sm text-gray-500">Manage laundry business accounts</p>
          </div>
        </div>
        <Button onClick={() => onSelect("create")}>
          <Plus className="mr-2 h-4 w-4" /> Create Business
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search by name, code, owner, or mobile..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ONBOARDING">Onboarding</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={v => setPlanFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Plans" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="STANDARD">Standard</SelectItem>
            <SelectItem value="PRO">Pro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business ID</TableHead>
                <TableHead>Business Name</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Stores</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">Loading...</TableCell></TableRow>
              ) : businesses.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Building2 className="h-8 w-8" />
                    <p>No laundry businesses found</p>
                    <Button variant="outline" size="sm" onClick={() => onSelect("create")}>Create your first business</Button>
                  </div>
                </TableCell></TableRow>
              ) : businesses.map(b => (
                <TableRow key={b.id} className="cursor-pointer hover:bg-gray-50" onClick={() => onSelect(b.id)}>
                  <TableCell className="font-mono text-xs">{b.businessCode}</TableCell>
                  <TableCell className="font-medium">{b.businessName}</TableCell>
                  <TableCell>{b.ownerName}</TableCell>
                  <TableCell><Badge variant="outline" className={b.plan === "PRO" ? "border-purple-300 text-purple-700" : ""}>{b.plan}</Badge></TableCell>
                  <TableCell>{b._count?.stores ?? 0}</TableCell>
                  <TableCell><Badge className={statusColors[b.status] || "bg-gray-100 text-gray-800"}>{b.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); onSelect(b.id) }}>View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function BusinessWorkflowTab({ businessId }: { businessId: string }) {
  const { toast } = useToast()
  const [configs, setConfigs] = useState<BusinessConfig[]>([])
  const [loading, setLoading] = useState(true)

  const fetchConfigs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/laundry/workflow-configurations/business/${businessId}`)
      if (res.ok) setConfigs(await res.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [businessId])

  useEffect(() => { fetchConfigs() }, [fetchConfigs])

  const handleToggle = async (stageId: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/laundry/workflow-configurations/business/${businessId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId, enabled: !enabled }),
      })
      if (res.ok) fetchConfigs()
      else toast({ title: "Error", description: "Failed to update", variant: "destructive" })
    } catch {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" })
    }
  }

  const handleReorder = async (stageId: string, newSequence: number) => {
    try {
      const res = await fetch(`/api/laundry/workflow-configurations/business/${businessId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId, sequence: newSequence }),
      })
      if (!res.ok) toast({ title: "Error", description: "Failed to reorder", variant: "destructive" })
    } catch {
      toast({ title: "Error", description: "Failed to reorder", variant: "destructive" })
    }
  }

  const moveStage = (index: number, direction: "up" | "down") => {
    const sorted = [...configs].sort((a, b) => (a.configuration?.sequence ?? a.stage.sequence) - (b.configuration?.sequence ?? b.stage.sequence))
    const swapIndex = direction === "up" ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= sorted.length) return
    const current = sorted[index]
    const swap = sorted[swapIndex]
    const tempSeq = current.configuration?.sequence ?? current.stage.sequence
    handleReorder(current.stage.id, swap.configuration?.sequence ?? swap.stage.sequence)
    handleReorder(swap.stage.id, tempSeq)
  }

  if (loading) return <div className="py-8 text-center text-gray-400">Loading stages...</div>

  const sorted = [...configs].sort((a, b) => (a.configuration?.sequence ?? a.stage.sequence) - (b.configuration?.sequence ?? b.stage.sequence))

  return (
    <div className="rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 text-xs font-medium text-muted-foreground w-12">Seq</th>
              <th className="text-left p-3 text-xs font-medium text-muted-foreground">Stage</th>
              <th className="text-left p-3 text-xs font-medium text-muted-foreground">Code</th>
              <th className="text-center p-3 text-xs font-medium text-muted-foreground w-24">Enabled</th>
              <th className="text-right p-3 text-xs font-medium text-muted-foreground w-24">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((bc, index) => (
              <tr key={bc.stage.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-mono text-muted-foreground w-6">{bc.configuration?.sequence ?? bc.stage.sequence}</span>
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveStage(index, "up")} disabled={index === 0} className="disabled:opacity-20 hover:text-foreground text-muted-foreground"><ArrowUp className="h-3 w-3" /></button>
                      <button onClick={() => moveStage(index, "down")} disabled={index === sorted.length - 1} className="disabled:opacity-20 hover:text-foreground text-muted-foreground"><ArrowDown className="h-3 w-3" /></button>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{bc.stage.name}</span>
                    {bc.stage.isSystem && <Badge variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground">System</Badge>}
                  </div>
                </td>
                <td className="p-3">
                  <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{bc.stage.code}</code>
                </td>
                <td className="p-3 text-center">
                  <Switch checked={bc.enabled} onCheckedChange={() => handleToggle(bc.stage.id, bc.enabled)} />
                </td>
                <td className="p-3 text-right">
                  {bc.enabled ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Enabled</Badge> : <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BusinessPermissionsTab({ businessId }: { businessId: string }) {
  const { toast } = useToast()
  const [roles, setRoles] = useState<LaundryRole[]>([])
  const [stages, setStages] = useState<WorkflowStage[]>([])
  const [permissions, setPermissions] = useState<StagePermission[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [rolesRes, stagesRes, permsRes] = await Promise.all([
        fetch("/api/laundry/roles"),
        fetch("/api/laundry/workflow-stages"),
        fetch("/api/laundry/stage-permissions"),
      ])
      const [rolesData, stagesData, permsData] = await Promise.all([
        rolesRes.json(), stagesRes.json(), permsRes.json(),
      ])
      setRoles(rolesData)
      setStages(stagesData)
      setPermissions(permsData)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleToggle = async (stageId: string, roleId: string, hasPermission: boolean) => {
    if (hasPermission) {
      const perm = permissions.find(p => p.stageId === stageId && p.roleId === roleId)
      if (!perm) return
      try {
        const res = await fetch(`/api/laundry/stage-permissions/${perm.id}`, { method: "DELETE" })
        if (res.ok) fetchData()
        else toast({ title: "Error", description: "Failed to remove", variant: "destructive" })
      } catch {
        toast({ title: "Error", description: "Failed to remove", variant: "destructive" })
      }
    } else {
      try {
        const res = await fetch("/api/laundry/stage-permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stageId, roleId }),
        })
        if (res.ok) fetchData()
        else toast({ title: "Error", description: "Failed to add", variant: "destructive" })
      } catch {
        toast({ title: "Error", description: "Failed to add", variant: "destructive" })
      }
    }
  }

  if (loading) return <div className="py-8 text-center text-gray-400">Loading permissions...</div>

  const activeRoles = roles.filter(r => r.isActive)
  const sortedStages = [...stages].sort((a, b) => a.sequence - b.sequence)

  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-3 text-xs font-medium text-muted-foreground min-w-[160px]">Stage</th>
            {activeRoles.map(role => (
              <th key={role.id} className="text-center p-3 text-xs font-medium text-muted-foreground min-w-[100px]">
                <div className="flex items-center justify-center gap-1">
                  <span>{role.name}</span>
                  {role.isSystem && <Badge variant="outline" className="text-[9px] h-3 px-1">S</Badge>}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedStages.map(stage => (
            <tr key={stage.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="p-3 text-sm font-medium">{stage.name}</td>
              {activeRoles.map(role => {
                const hasPermission = permissions.some(p => p.stageId === stage.id && p.roleId === role.id)
                return (
                  <td key={role.id} className="p-3 text-center">
                    <Checkbox checked={hasPermission} onCheckedChange={() => handleToggle(stage.id, role.id, hasPermission)} />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BusinessProfile({ businessId, onBack }: { businessId: string; onBack: () => void }) {
  const [business, setBusiness] = useState<LaundryBusiness | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const { toast } = useToast()

  const [editForm, setEditForm] = useState({
    businessName: "", legalName: "", ownerName: "", mobile: "", email: "",
    gstNumber: "", address: "", plan: "", status: "",
  })

  const fetchBusiness = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/laundry/businesses/${businessId}`)
      if (res.ok) {
        const d = await res.json()
        setBusiness(d)
        setEditForm({
          businessName: d.businessName, legalName: d.legalName || "", ownerName: d.ownerName,
          mobile: d.mobile, email: d.email || "", gstNumber: d.gstNumber || "",
          address: d.address || "", plan: d.plan, status: d.status,
        })
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [businessId])

  useEffect(() => { fetchBusiness() }, [fetchBusiness])

  const handleSaveOverview = async () => {
    try {
      const res = await fetch(`/api/laundry/businesses/${businessId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        toast({ title: "Saved", description: "Business details updated" })
        setEditing(false)
        fetchBusiness()
      } else {
        toast({ title: "Error", description: "Failed to update", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" })
    }
  }

  if (loading) return <div className="py-8 text-center text-gray-400">Loading...</div>
  if (!business) return <div className="py-8 text-center text-gray-400">Business not found</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ChevronLeft className="h-5 w-5" /></Button>
        {business.logo ? (
          <img src={business.logo} alt="" className="h-10 w-10 rounded-lg object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
            <Building2 className="h-5 w-5" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{business.businessName}</h1>
          <p className="text-sm text-gray-500 font-mono">{business.businessCode}</p>
        </div>
        <Badge className={statusColors[business.status] || ""}>{business.status}</Badge>
        <Badge variant="outline" className={business.plan === "PRO" ? "border-purple-300 text-purple-700" : ""}>{business.plan}</Badge>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview" className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="stores" className="flex items-center gap-1.5"><Store className="h-3.5 w-3.5" /> Stores</TabsTrigger>
          <TabsTrigger value="departments" className="flex items-center gap-1.5"><Route className="h-3.5 w-3.5" /> Departments</TabsTrigger>
          <TabsTrigger value="workflow" className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Workflow</TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Permissions</TabsTrigger>
          <TabsTrigger value="configuration" className="flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">Business Details</h3>
                {editing ? (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5 mr-1" /> Cancel</Button>
                    <Button size="sm" onClick={handleSaveOverview}><Save className="h-3.5 w-3.5 mr-1" /> Save</Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                )}
              </div>
              {editing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Business Name</Label>
                    <Input value={editForm.businessName} onChange={e => setEditForm(p => ({ ...p, businessName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Legal Name</Label>
                    <Input value={editForm.legalName} onChange={e => setEditForm(p => ({ ...p, legalName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Owner Name</Label>
                    <Input value={editForm.ownerName} onChange={e => setEditForm(p => ({ ...p, ownerName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Mobile</Label>
                    <Input value={editForm.mobile} onChange={e => setEditForm(p => ({ ...p, mobile: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <Input value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">GST Number</Label>
                    <Input value={editForm.gstNumber} onChange={e => setEditForm(p => ({ ...p, gstNumber: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Plan</Label>
                    <Select value={editForm.plan} onValueChange={v => setEditForm(p => ({ ...p, plan: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STANDARD">Standard</SelectItem>
                        <SelectItem value="PRO">Pro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={editForm.status} onValueChange={v => setEditForm(p => ({ ...p, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ONBOARDING">Onboarding</SelectItem>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="SUSPENDED">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Address</Label>
                    <Textarea value={editForm.address} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="text-xs text-gray-500">Business Name</label><p className="font-medium">{business.businessName}</p></div>
                  <div><label className="text-xs text-gray-500">Legal Name</label><p className="font-medium">{business.legalName || "—"}</p></div>
                  <div><label className="text-xs text-gray-500">Owner Name</label><p className="font-medium">{business.ownerName}</p></div>
                  <div><label className="text-xs text-gray-500">Mobile</label><p className="font-medium">{business.mobile}</p></div>
                  <div><label className="text-xs text-gray-500">Email</label><p className="font-medium">{business.email || "—"}</p></div>
                  <div><label className="text-xs text-gray-500">GST Number</label><p className="font-medium">{business.gstNumber || "—"}</p></div>
                  <div><label className="text-xs text-gray-500">Address</label><p className="font-medium">{business.address || "—"}</p></div>
                  <div><label className="text-xs text-gray-500">Plan</label><p className="font-medium">{business.plan}</p></div>
                  <div><label className="text-xs text-gray-500">Created</label><p className="font-medium">{new Date(business.createdAt).toLocaleDateString()}</p></div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stores" className="mt-4">
          <div className="space-y-4">
            <LaundryStoresView businessId={businessId} />
            <LaundryServiceArea businessId={businessId} />
          </div>
        </TabsContent>

        <TabsContent value="departments" className="mt-4">
          <LaundryDepartmentsView businessId={businessId} />
        </TabsContent>

        <TabsContent value="workflow" className="mt-4">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Enable, disable, and reorder workflow stages for this business.</p>
            <BusinessWorkflowTab businessId={businessId} />
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="mt-4">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Assign stage visibility to roles. System roles and stages are protected.</p>
            <BusinessPermissionsTab businessId={businessId} />
          </div>
        </TabsContent>

        <TabsContent value="configuration" className="mt-4">
          <LaundryBusinessConfig businessId={businessId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function LaundryBusinessesView() {
  const { setActivePage } = useAdminStore()
  const [view, setView] = useState<"list" | "create" | "profile">("list")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const handleSelect = (idOrAction: string) => {
    if (idOrAction === "create") {
      setView("create")
    } else {
      setSelectedId(idOrAction)
      setView("profile")
    }
  }

  if (view === "create") {
    return <LaundryBusinessCreate onComplete={() => { setView("list"); setSelectedId(null) }} onCancel={() => setView("list")} />
  }

  if (view === "profile" && selectedId) {
    return <BusinessProfile businessId={selectedId} onBack={() => { setView("list"); setSelectedId(null) }} />
  }

  return <BusinessListView onSelect={handleSelect} />
}
