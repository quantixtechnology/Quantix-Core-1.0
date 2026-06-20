"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Plus, Sparkles, Building2, MapPin, Store, CreditCard, ChevronLeft, Pencil, Save, X, Users, Route, Settings2, ArrowUp, ArrowDown, CheckCircle2, Eye, EyeOff, Factory, Shield, UserCog, Loader2 } from "lucide-react"
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
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
  configuration: {
    id: string
    enabled: boolean
    sequence: number | null
    responsibleRoleId: string | null
    responsibleDepartmentId: string | null
    canView: boolean
    canUpdate: boolean
    canApprove: boolean
    responsibleRole?: { id: string; code: string; name: string; isSystem: boolean } | null
    responsibleDepartment?: { id: string; code: string; name: string } | null
  } | null
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
  const [roles, setRoles] = useState<LaundryRole[]>([])
  const [departments, setDepartments] = useState<{ id: string; code: string; name: string }[]>([])
  const [business, setBusiness] = useState<{ transportEnabled: boolean; barcodeTaggingEnabled: boolean; ironingEnabled: boolean; deliveryEnabled: boolean } | null>(null)

  const fetchConfigs = useCallback(async () => {
    setLoading(true)
    try {
      const [configRes, rolesRes, deptRes, bizRes] = await Promise.all([
        fetch(`/api/laundry/workflow-configurations/business/${businessId}`),
        fetch("/api/laundry/roles"),
        fetch(`/api/laundry/departments?businessId=${businessId}`),
        fetch(`/api/laundry/businesses/${businessId}`),
      ])
      if (configRes.ok) setConfigs(await configRes.json())
      if (rolesRes.ok) setRoles(await rolesRes.json())
      if (deptRes.ok) setDepartments(await deptRes.json())
      if (bizRes.ok) setBusiness(await bizRes.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [businessId])

  useEffect(() => { fetchConfigs() }, [fetchConfigs])

  const updateConfig = async (stageId: string, data: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/laundry/workflow-configurations/business/${businessId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId, ...data }),
      })
      if (res.ok) fetchConfigs()
      else toast({ title: "Error", description: "Failed to update", variant: "destructive" })
    } catch {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" })
    }
  }

  const handleToggle = (stageId: string, enabled: boolean) => updateConfig(stageId, { enabled: !enabled })

  const handleReorder = (stageId: string, newSequence: number) => updateConfig(stageId, { sequence: newSequence })

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
  const activeRoles = roles.filter(r => r.isActive)

  // Feature-toggle based filtering
  const FEATURE_TOGGLE_STAGES: Record<string, string[]> = {
    transportEnabled: ["IN_TRANSIT_TO_PROCESSING", "IN_TRANSIT_TO_STORE"],
    barcodeTaggingEnabled: ["BARCODE_TAGGING"],
    ironingEnabled: ["IRONING"],
    deliveryEnabled: ["READY_FOR_DELIVERY", "DELIVERED"],
  }

  const disabledByFeature: Set<string> = new Set()
  if (business) {
    for (const [feature, stageCodes] of Object.entries(FEATURE_TOGGLE_STAGES)) {
      if (!(business as Record<string, boolean>)[feature]) {
        for (const code of stageCodes) disabledByFeature.add(code)
      }
    }
  }

  return (
    <div className="rounded-lg border">
      {business && !business.transportEnabled && (
        <div className="px-3 py-2 bg-amber-50 text-amber-700 text-xs border-b">
          Transport is disabled. Transit stages are hidden from the active workflow.
        </div>
      )}
      {business && !business.ironingEnabled && (
        <div className="px-3 py-2 bg-amber-50 text-amber-700 text-xs border-b">
          Ironing service is disabled. Ironing stage is hidden from the active workflow.
        </div>
      )}
      {business && !business.deliveryEnabled && (
        <div className="px-3 py-2 bg-amber-50 text-amber-700 text-xs border-b">
          Home delivery is disabled. Delivery stages are hidden from the active workflow.
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 text-xs font-medium text-muted-foreground w-12">Seq</th>
              <th className="text-left p-3 text-xs font-medium text-muted-foreground">Stage</th>
              <th className="text-left p-3 text-xs font-medium text-muted-foreground">Code</th>
              <th className="text-left p-3 text-xs font-medium text-muted-foreground">Department</th>
              <th className="text-left p-3 text-xs font-medium text-muted-foreground">Responsible Role</th>
              <th className="text-center p-3 text-xs font-medium text-muted-foreground w-20">Enabled</th>
              <th className="text-center p-3 text-xs font-medium text-muted-foreground w-16">View</th>
              <th className="text-center p-3 text-xs font-medium text-muted-foreground w-16">Update</th>
              <th className="text-center p-3 text-xs font-medium text-muted-foreground w-16">Approve</th>
              <th className="text-right p-3 text-xs font-medium text-muted-foreground w-32">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((bc, index) => {
              const cfg = bc.configuration
              const isDisabledByToggle = disabledByFeature.has(bc.stage.code)
              const rowEnabled = bc.enabled && !isDisabledByToggle

              return (
                <tr key={bc.stage.id} className={`border-b last:border-0 hover:bg-muted/30 ${isDisabledByToggle ? "opacity-40" : ""}`}>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-mono text-muted-foreground w-6">{cfg?.sequence ?? bc.stage.sequence}</span>
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveStage(index, "up")} disabled={index === 0 || isDisabledByToggle} className="disabled:opacity-20 hover:text-foreground text-muted-foreground"><ArrowUp className="h-3 w-3" /></button>
                        <button onClick={() => moveStage(index, "down")} disabled={index === sorted.length - 1 || isDisabledByToggle} className="disabled:opacity-20 hover:text-foreground text-muted-foreground"><ArrowDown className="h-3 w-3" /></button>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{bc.stage.name}</span>
                      {bc.stage.isSystem && <Badge variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground">System</Badge>}
                      {isDisabledByToggle && <Badge variant="outline" className="text-[10px] h-4 px-1 text-amber-600 border-amber-300">Toggle Off</Badge>}
                    </div>
                  </td>
                  <td className="p-3">
                    <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{bc.stage.code}</code>
                  </td>
                  <td className="p-3">
                    <Select
                      value={cfg?.responsibleDepartmentId ?? "none"}
                      onValueChange={(v) => updateConfig(bc.stage.id, { responsibleDepartmentId: v === "none" ? null : v })}
                      disabled={isDisabledByToggle}
                    >
                      <SelectTrigger className="h-8 text-xs max-w-[160px]">
                        <SelectValue placeholder="Not set" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {departments.map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <Select
                      value={cfg?.responsibleRoleId ?? "none"}
                      onValueChange={(v) => updateConfig(bc.stage.id, { responsibleRoleId: v === "none" ? null : v })}
                      disabled={isDisabledByToggle}
                    >
                      <SelectTrigger className="h-8 text-xs max-w-[160px]">
                        <SelectValue placeholder="Not set" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {activeRoles.map(r => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-center">
                    <Switch
                      checked={rowEnabled}
                      onCheckedChange={() => handleToggle(bc.stage.id, rowEnabled)}
                      disabled={isDisabledByToggle}
                    />
                  </td>
                  <td className="p-3 text-center">
                    <Checkbox
                      checked={cfg?.canView ?? true}
                      onCheckedChange={(v) => updateConfig(bc.stage.id, { canView: v === true })}
                      disabled={isDisabledByToggle}
                    />
                  </td>
                  <td className="p-3 text-center">
                    <Checkbox
                      checked={cfg?.canUpdate ?? false}
                      onCheckedChange={(v) => updateConfig(bc.stage.id, { canUpdate: v === true })}
                      disabled={isDisabledByToggle}
                    />
                  </td>
                  <td className="p-3 text-center">
                    <Checkbox
                      checked={cfg?.canApprove ?? false}
                      onCheckedChange={(v) => updateConfig(bc.stage.id, { canApprove: v === true })}
                      disabled={isDisabledByToggle}
                    />
                  </td>
                  <td className="p-3 text-right">
                    {isDisabledByToggle ? (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">Toggle Off</Badge>
                    ) : bc.enabled ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Enabled</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>
                    )}
                  </td>
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="p-6 text-center text-sm text-muted-foreground">
                  No workflow stages found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BusinessPermissionsTab({ businessId }: { businessId: string }) {
  const { toast } = useToast()
  const [configs, setConfigs] = useState<BusinessConfig[]>([])
  const [roles, setRoles] = useState<LaundryRole[]>([])
  const [departments, setDepartments] = useState<{ id: string; code: string; name: string }[]>([])
  const [business, setBusiness] = useState<{ transportEnabled: boolean; barcodeTaggingEnabled: boolean; ironingEnabled: boolean; deliveryEnabled: boolean } | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [configRes, rolesRes, deptRes, bizRes] = await Promise.all([
        fetch(`/api/laundry/workflow-configurations/business/${businessId}`),
        fetch("/api/laundry/roles"),
        fetch(`/api/laundry/departments?businessId=${businessId}`),
        fetch(`/api/laundry/businesses/${businessId}`),
      ])
      if (configRes.ok) setConfigs(await configRes.json())
      if (rolesRes.ok) setRoles(await rolesRes.json())
      if (deptRes.ok) setDepartments(await deptRes.json())
      if (bizRes.ok) setBusiness(await bizRes.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [businessId])

  useEffect(() => { fetchData() }, [fetchData])

  const updatePermission = async (stageId: string, field: string, value: boolean) => {
    try {
      const res = await fetch(`/api/laundry/workflow-configurations/business/${businessId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId, [field]: value }),
      })
      if (res.ok) fetchData()
      else toast({ title: "Error", description: "Failed to update", variant: "destructive" })
    } catch {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" })
    }
  }

  if (loading) return <div className="py-8 text-center text-gray-400">Loading permissions...</div>

  const activeRoles = roles.filter(r => r.isActive)
  const sortedStages = [...configs].sort((a, b) => (a.configuration?.sequence ?? a.stage.sequence) - (b.configuration?.sequence ?? b.stage.sequence))

  const FEATURE_TOGGLE_STAGES: Record<string, string[]> = {
    transportEnabled: ["IN_TRANSIT_TO_PROCESSING", "IN_TRANSIT_TO_STORE"],
    barcodeTaggingEnabled: ["BARCODE_TAGGING"],
    ironingEnabled: ["IRONING"],
    deliveryEnabled: ["READY_FOR_DELIVERY", "DELIVERED"],
  }

  const disabledByFeature: Set<string> = new Set()
  if (business) {
    for (const [feature, stageCodes] of Object.entries(FEATURE_TOGGLE_STAGES)) {
      if (!(business as Record<string, boolean>)[feature]) {
        for (const code of stageCodes) disabledByFeature.add(code)
      }
    }
  }

  if (sortedStages.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        No workflow stages found. Configure stages for this business.
      </div>
    )
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-3 text-xs font-medium text-muted-foreground min-w-[160px]">Stage</th>
            <th className="text-left p-3 text-xs font-medium text-muted-foreground min-w-[120px]">Department</th>
            <th className="text-left p-3 text-xs font-medium text-muted-foreground min-w-[120px]">Responsible Role</th>
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
          {sortedStages.map(item => {
            const cfg = item.configuration
            const isDisabledByToggle = disabledByFeature.has(item.stage.code)
            const rolePerms = new Map<string, { canView: boolean; canUpdate: boolean; canApprove: boolean }>()

            for (const role of activeRoles) {
              const isAssignedRole = cfg?.responsibleRoleId === role.id
              rolePerms.set(role.id, {
                canView: isAssignedRole ? (cfg?.canView ?? true) : false,
                canUpdate: isAssignedRole ? (cfg?.canUpdate ?? false) : false,
                canApprove: isAssignedRole ? (cfg?.canApprove ?? false) : false,
              })
            }

            return (
              <tr key={item.stage.id} className={`border-b last:border-0 hover:bg-muted/30 ${isDisabledByToggle ? "opacity-40" : ""}`}>
                <td className="p-3 text-sm font-medium whitespace-nowrap">
                  {item.stage.name}
                  <code className="ml-2 text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{item.stage.code}</code>
                  {isDisabledByToggle && <Badge variant="outline" className="ml-1 text-[9px] h-3 px-1 text-amber-600 border-amber-300">Off</Badge>}
                </td>
                <td className="p-3 text-sm text-muted-foreground">
                  {cfg?.responsibleDepartment?.name || (cfg?.responsibleDepartmentId ? "Unknown" : "—")}
                </td>
                <td className="p-3 text-sm text-muted-foreground">
                  {cfg?.responsibleRole?.name || (cfg?.responsibleRoleId ? "Unknown" : "—")}
                </td>
                {activeRoles.map(role => {
                  const perms = rolePerms.get(role.id)!
                  const canEdit = cfg?.responsibleRoleId === role.id
                  return (
                    <td key={role.id} className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <div className="flex flex-col items-center gap-0.5">
                          <Checkbox
                            checked={perms.canView}
                            onCheckedChange={(v) => canEdit && updatePermission(item.stage.id, "canView", v === true)}
                            disabled={!canEdit || isDisabledByToggle}
                            className="h-3 w-3"
                          />
                          <span className="text-[9px] text-muted-foreground">V</span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <Checkbox
                            checked={perms.canUpdate}
                            onCheckedChange={(v) => canEdit && updatePermission(item.stage.id, "canUpdate", v === true)}
                            disabled={!canEdit || isDisabledByToggle}
                            className="h-3 w-3"
                          />
                          <span className="text-[9px] text-muted-foreground">U</span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <Checkbox
                            checked={perms.canApprove}
                            onCheckedChange={(v) => canEdit && updatePermission(item.stage.id, "canApprove", v === true)}
                            disabled={!canEdit || isDisabledByToggle}
                            className="h-3 w-3"
                          />
                          <span className="text-[9px] text-muted-foreground">A</span>
                        </div>
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function BusinessRolesTab({ businessId }: { businessId: string }) {
  const { toast } = useToast()
  const [assignments, setAssignments] = useState<{ id: string; roleId: string; role: LaundryRole; active: boolean }[]>([])
  const [allRoles, setAllRoles] = useState<LaundryRole[]>([])
  const [loading, setLoading] = useState(true)
  const [showAssign, setShowAssign] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState("")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [assignRes, rolesRes] = await Promise.all([
        fetch(`/api/laundry/assignments?businessId=${businessId}`),
        fetch("/api/laundry/roles"),
      ])
      if (assignRes.ok) setAssignments(await assignRes.json())
      if (rolesRes.ok) setAllRoles(await rolesRes.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [businessId])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAssign = async () => {
    if (!selectedRoleId) return
    try {
      const res = await fetch("/api/laundry/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, roleId: selectedRoleId, active: true }),
      })
      if (res.ok) {
        setShowAssign(false)
        setSelectedRoleId("")
        fetchData()
        toast({ title: "Success", description: "Role assigned to business" })
      } else {
        const err = await res.json()
        toast({ title: "Error", description: err.error || "Failed to assign", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to assign role", variant: "destructive" })
    }
  }

  const handleRemove = async (id: string) => {
    if (!confirm("Remove this role assignment?")) return
    try {
      const res = await fetch(`/api/laundry/assignments/${id}`, { method: "DELETE" })
      if (res.ok) {
        fetchData()
        toast({ title: "Success", description: "Assignment removed" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to remove", variant: "destructive" })
    }
  }

  if (loading) return <div className="py-8 text-center text-gray-400">Loading assignments...</div>

  const assignedRoleIds = new Set(assignments.map(a => a.roleId))
  const availableRoles = allRoles.filter(r => !assignedRoleIds.has(r.id) && r.isActive)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Assigned Roles ({assignments.length})</h2>
        <Button size="sm" onClick={() => setShowAssign(true)} disabled={availableRoles.length === 0}>
          <Plus className="mr-1 h-4 w-4" /> Assign Role
        </Button>
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No roles assigned to this business.</div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Role</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Code</th>
                <th className="text-center p-3 text-xs font-medium text-muted-foreground w-24">Type</th>
                <th className="text-center p-3 text-xs font-medium text-muted-foreground w-20">Active</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map(a => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 text-sm font-medium">{a.role.name}</td>
                  <td className="p-3">
                    <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{a.role.code}</code>
                  </td>
                  <td className="p-3 text-center">
                    {a.role.isSystem ? <Badge variant="outline" className="text-[10px]">System</Badge> : <Badge variant="outline">Custom</Badge>}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-block h-2 w-2 rounded-full ${a.active ? "bg-green-500" : "bg-gray-300"}`} />
                  </td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleRemove(a.id)}>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role to Business</DialogTitle>
            <DialogDescription>Select a role to assign to this business.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                <SelectContent>
                  {availableRoles.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssign(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!selectedRoleId}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function BusinessProcessingCentersTab({ businessId }: { businessId: string }) {
  const { toast } = useToast()
  const [centers, setCenters] = useState<{
    id: string; centerCode: string; centerName: string; centerType: string;
    managerName: string | null; mobile: string | null; dailyCapacityKg: number | null;
    isActive: boolean; city: string | null; state: string | null;
  }[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCenter, setEditingCenter] = useState<string | null>(null)
  const [form, setForm] = useState({
    centerName: "", centerType: "PROCESSING_HUB", managerName: "", mobile: "",
    email: "", address: "", city: "", state: "", pincode: "",
    latitude: "", longitude: "", dailyCapacityKg: "", isActive: true,
  })

  const fetchCenters = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/laundry/processing-centers?businessId=${businessId}`)
      if (res.ok) setCenters(await res.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchCenters() }, [businessId])

  const openCreate = () => {
    setEditingCenter(null)
    setForm({ centerName: "", centerType: "PROCESSING_HUB", managerName: "", mobile: "", email: "", address: "", city: "", state: "", pincode: "", latitude: "", longitude: "", dailyCapacityKg: "", isActive: true })
    setDialogOpen(true)
  }

  const openEdit = (center: typeof centers[0]) => {
    setEditingCenter(center.id)
    setForm({
      centerName: center.centerName,
      centerType: center.centerType,
      managerName: center.managerName || "",
      mobile: center.mobile || "",
      email: "",
      address: "",
      city: center.city || "",
      state: center.state || "",
      pincode: "",
      latitude: "",
      longitude: "",
      dailyCapacityKg: center.dailyCapacityKg?.toString() || "",
      isActive: center.isActive,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const url = editingCenter
      ? `/api/laundry/processing-centers/${editingCenter}`
      : "/api/laundry/processing-centers"
    const method = editingCenter ? "PUT" : "POST"
    const body = editingCenter ? form : { ...form, businessId }

    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    if (res.ok) {
      setDialogOpen(false)
      fetchCenters()
      toast({ title: "Success", description: editingCenter ? "Processing center updated" : "Processing center created" })
    } else {
      const err = await res.json()
      toast({ title: "Error", description: err.error || "Failed to save", variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this processing center?")) return
    const res = await fetch(`/api/laundry/processing-centers/${id}`, { method: "DELETE" })
    if (res.ok) fetchCenters()
  }

  if (loading) return <div className="py-8 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Processing Centers ({centers.length})</h2>
        <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> Add Center</Button>
      </div>

      {centers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No processing centers configured.</div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Code</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Name</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Type</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Manager</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Location</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground">Capacity</th>
                <th className="text-center p-3 text-xs font-medium text-muted-foreground w-20">Status</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {centers.map(c => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{c.centerCode}</td>
                  <td className="p-3 text-sm font-medium">{c.centerName}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={c.centerType === "PROCESSING_HUB" ? "border-purple-300 text-purple-700" : "border-blue-300 text-blue-700"}>
                      {c.centerType === "PROCESSING_HUB" ? "Processing Hub" : c.centerType === "WASHING_CENTER" ? "Washing Center" : c.centerType}
                    </Badge>
                  </td>
                  <td className="p-3 text-sm">{c.managerName || "—"}</td>
                  <td className="p-3 text-sm text-muted-foreground">{[c.city, c.state].filter(Boolean).join(", ") || "—"}</td>
                  <td className="p-3 text-right text-sm">{c.dailyCapacityKg ? `${c.dailyCapacityKg} kg` : "—"}</td>
                  <td className="p-3 text-center">
                    <span className={`inline-block h-2 w-2 rounded-full ${c.isActive ? "bg-green-500" : "bg-gray-300"}`} />
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(c.id)}>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingCenter ? "Edit Processing Center" : "Add Processing Center"}</DialogTitle>
            <DialogDescription>Configure processing center for this laundry business.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label>Center Name *</Label>
              <Input value={form.centerName} onChange={e => setForm(p => ({ ...p, centerName: e.target.value }))} placeholder="Main Processing Hub" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.centerType} onValueChange={v => setForm(p => ({ ...p, centerType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROCESSING_HUB">Processing Hub</SelectItem>
                  <SelectItem value="WASHING_CENTER">Washing Center</SelectItem>
                  <SelectItem value="IRONING_CENTER">Ironing Center</SelectItem>
                  <SelectItem value="PACKING_CENTER">Packing Center</SelectItem>
                  <SelectItem value="DISPATCH_CENTER">Dispatch Center</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end pb-1.5">
              <div className="flex items-center gap-2">
                <Switch checked={form.isActive} onCheckedChange={v => setForm(p => ({ ...p, isActive: v }))} />
                <Label className="text-sm">Active</Label>
              </div>
            </div>
            <div>
              <Label>Manager Name</Label>
              <Input value={form.managerName} onChange={e => setForm(p => ({ ...p, managerName: e.target.value }))} placeholder="Center Manager" />
            </div>
            <div>
              <Label>Mobile</Label>
              <Input value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))} placeholder="+91 98765 43210" />
            </div>
            <div className="col-span-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="center@example.com" />
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Textarea value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Center address" />
            </div>
            <div>
              <Label>City</Label>
              <Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
            </div>
            <div>
              <Label>State</Label>
              <Input value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} />
            </div>
            <div>
              <Label>Pincode</Label>
              <Input value={form.pincode} onChange={e => setForm(p => ({ ...p, pincode: e.target.value }))} />
            </div>
            <div>
              <Label>Daily Capacity (KG)</Label>
              <Input type="number" value={form.dailyCapacityKg} onChange={e => setForm(p => ({ ...p, dailyCapacityKg: e.target.value }))} placeholder="1000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.centerName}>{editingCenter ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
          <TabsTrigger value="roles" className="flex items-center gap-1.5"><UserCog className="h-3.5 w-3.5" /> Roles</TabsTrigger>
          <TabsTrigger value="processing-centers" className="flex items-center gap-1.5"><Factory className="h-3.5 w-3.5" /> Processing Centers</TabsTrigger>
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
            <p className="text-sm text-muted-foreground">Enable, disable, reorder stages, assign departments and responsible roles, and set permissions for each workflow stage.</p>
            <BusinessWorkflowTab businessId={businessId} />
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="mt-4">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Permission matrix showing which role has View (V), Update (U), and Approve (A) access per stage. Permissions are inherited from the workflow stage configuration.</p>
            <BusinessPermissionsTab businessId={businessId} />
          </div>
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <BusinessRolesTab businessId={businessId} />
        </TabsContent>

        <TabsContent value="processing-centers" className="mt-4">
          <BusinessProcessingCentersTab businessId={businessId} />
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
