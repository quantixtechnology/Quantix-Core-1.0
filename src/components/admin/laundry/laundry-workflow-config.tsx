"use client"

import { useEffect, useState, useCallback } from "react"
import { Route, Sparkles, Plus, Eye, EyeOff, ArrowUp, ArrowDown, Trash2, Loader2, ToggleLeft, ToggleRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface WorkflowStage {
  id: string
  code: string
  name: string
  sequence: number
  description: string | null
  isDefault: boolean
  isActive: boolean
}

interface LaundryBusiness {
  id: string
  businessCode: string
  businessName: string
  plan: string
  status: string
}

interface BusinessConfig {
  stage: WorkflowStage
  configuration: { id: string; enabled: boolean; sequence: number | null } | null
  enabled: boolean
}

interface LaundryRole {
  id: string
  code: string
  name: string
}

interface StagePermission {
  id: string
  stageId: string
  roleId: string
  stage: WorkflowStage
  role: LaundryRole
}

export function LaundryWorkflowConfigView() {
  const { toast } = useToast()
  const [stages, setStages] = useState<WorkflowStage[]>([])
  const [businesses, setBusinesses] = useState<LaundryBusiness[]>([])
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("")
  const [businessConfigs, setBusinessConfigs] = useState<BusinessConfig[]>([])
  const [roles, setRoles] = useState<LaundryRole[]>([])
  const [permissions, setPermissions] = useState<StagePermission[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateStage, setShowCreateStage] = useState(false)
  const [editingStage, setEditingStage] = useState<WorkflowStage | null>(null)

  const [newStage, setNewStage] = useState({
    code: "", name: "", sequence: 0, description: "", isDefault: false, isActive: true,
  })

  const fetchData = useCallback(async () => {
    try {
      const [stagesRes, businessesRes, rolesRes, permissionsRes] = await Promise.all([
        fetch("/api/laundry/workflow-stages"),
        fetch("/api/laundry/businesses"),
        fetch("/api/laundry/roles"),
        fetch("/api/laundry/stage-permissions"),
      ])
      const [stagesData, businessesData, rolesData, permissionsData] = await Promise.all([
        stagesRes.json(), businessesRes.json(), rolesRes.json(), permissionsRes.json(),
      ])
      setStages(stagesData)
      setBusinesses(businessesData)
      setRoles(rolesData)
      setPermissions(permissionsData)
    } catch {
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const fetchBusinessConfig = useCallback(async (businessId: string) => {
    if (!businessId) { setBusinessConfigs([]); return }
    try {
      const res = await fetch(`/api/laundry/workflow-configurations/business/${businessId}`)
      const data = await res.json()
      setBusinessConfigs(data)
    } catch {
      toast({ title: "Error", description: "Failed to load business config", variant: "destructive" })
    }
  }, [toast])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (selectedBusinessId) fetchBusinessConfig(selectedBusinessId)
    else setBusinessConfigs([])
  }, [selectedBusinessId, fetchBusinessConfig])

  const handleCreateStage = async () => {
    if (!newStage.code || !newStage.name) {
      toast({ title: "Validation", description: "Code and name are required", variant: "destructive" })
      return
    }
    try {
      const res = await fetch("/api/laundry/workflow-stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStage),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      toast({ title: "Success", description: "Workflow stage created" })
      setShowCreateStage(false)
      setNewStage({ code: "", name: "", sequence: 0, description: "", isDefault: false, isActive: true })
      fetchData()
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" })
    }
  }

  const handleUpdateStage = async () => {
    if (!editingStage) return
    try {
      const res = await fetch(`/api/laundry/workflow-stages/${editingStage.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingStage),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      toast({ title: "Success", description: "Workflow stage updated" })
      setEditingStage(null)
      fetchData()
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" })
    }
  }

  const handleDeleteStage = async (id: string) => {
    try {
      const res = await fetch(`/api/laundry/workflow-stages/${id}`, { method: "DELETE" })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      toast({ title: "Success", description: "Workflow stage deleted" })
      fetchData()
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" })
    }
  }

  const handleToggleBusinessStage = async (stageId: string, currentlyEnabled: boolean) => {
    if (!selectedBusinessId) return
    try {
      const res = await fetch(`/api/laundry/workflow-configurations/business/${selectedBusinessId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId, enabled: !currentlyEnabled }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      fetchBusinessConfig(selectedBusinessId)
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" })
    }
  }

  const handleToggleStageRole = async (stageId: string, roleId: string, hasPermission: boolean) => {
    if (hasPermission) {
      const perm = permissions.find((p) => p.stageId === stageId && p.roleId === roleId)
      if (!perm) return
      try {
        const res = await fetch(`/api/laundry/stage-permissions/${perm.id}`, { method: "DELETE" })
        if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
        fetchData()
      } catch (e) {
        toast({ title: "Error", description: String(e), variant: "destructive" })
      }
    } else {
      try {
        const res = await fetch("/api/laundry/stage-permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stageId, roleId }),
        })
        if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
        fetchData()
      } catch (e) {
        toast({ title: "Error", description: String(e), variant: "destructive" })
      }
    }
  }

  const moveStage = async (index: number, direction: "up" | "down") => {
    const sorted = [...stages].sort((a, b) => a.sequence - b.sequence)
    const swapIndex = direction === "up" ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= sorted.length) return

    const current = sorted[index]
    const swap = sorted[swapIndex]
    const tempSeq = current.sequence

    try {
      await Promise.all([
        fetch(`/api/laundry/workflow-stages/${current.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sequence: swap.sequence }),
        }),
        fetch(`/api/laundry/workflow-stages/${swap.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sequence: tempSeq }),
        }),
      ])
      fetchData()
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" })
    }
  }

  const selectedBusiness = businesses.find((b) => b.id === selectedBusinessId)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const sortedStages = [...stages].sort((a, b) => a.sequence - b.sequence)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
            <Route className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Workflow Configuration</h1>
            <p className="text-sm text-muted-foreground">Configure laundry workflow stages per business</p>
          </div>
        </div>
        <Dialog open={showCreateStage} onOpenChange={setShowCreateStage}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Stage
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Workflow Stage</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input
                    value={newStage.code}
                    onChange={(e) => setNewStage({ ...newStage, code: e.target.value.toUpperCase().replace(/\s+/g, "_") })}
                    placeholder="STAGE_CODE"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sequence</Label>
                  <Input
                    type="number"
                    value={newStage.sequence}
                    onChange={(e) => setNewStage({ ...newStage, sequence: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newStage.name}
                  onChange={(e) => setNewStage({ ...newStage, name: e.target.value })}
                  placeholder="Stage Name"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newStage.description}
                  onChange={(e) => setNewStage({ ...newStage, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={newStage.isDefault}
                    onCheckedChange={(v) => setNewStage({ ...newStage, isDefault: v === true })}
                  />
                  <Label className="text-sm">Default</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={newStage.isActive}
                    onCheckedChange={(v) => setNewStage({ ...newStage, isActive: v === true })}
                  />
                  <Label className="text-sm">Active</Label>
                </div>
              </div>
              <Button onClick={handleCreateStage} className="w-full">Create Stage</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="stages">
        <TabsList>
          <TabsTrigger value="stages">All Stages</TabsTrigger>
          <TabsTrigger value="business">Per Business Config</TabsTrigger>
          <TabsTrigger value="roles">Stage Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="stages" className="space-y-4 pt-4">
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground w-12">Seq</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Code</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground">Description</th>
                    <th className="text-center p-3 text-xs font-medium text-muted-foreground w-20">Default</th>
                    <th className="text-center p-3 text-xs font-medium text-muted-foreground w-20">Active</th>
                    <th className="text-right p-3 text-xs font-medium text-muted-foreground w-32">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStages.map((stage, index) => (
                    <tr key={stage.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-mono text-muted-foreground w-6">{stage.sequence}</span>
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => moveStage(index, "up")}
                              disabled={index === 0}
                              className="disabled:opacity-20 hover:text-foreground text-muted-foreground"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => moveStage(index, "down")}
                              disabled={index === sortedStages.length - 1}
                              className="disabled:opacity-20 hover:text-foreground text-muted-foreground"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{stage.code}</code>
                      </td>
                      <td className="p-3 text-sm font-medium">{stage.name}</td>
                      <td className="p-3 text-sm text-muted-foreground max-w-[200px] truncate">
                        {stage.description || "—"}
                      </td>
                      <td className="p-3 text-center">
                        {stage.isDefault ? <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">Yes</Badge> : "—"}
                      </td>
                      <td className="p-3 text-center">
                        {stage.isActive ? <Eye className="h-4 w-4 text-green-600 mx-auto" /> : <EyeOff className="h-4 w-4 text-muted-foreground mx-auto" />}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingStage(stage)}>
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => handleDeleteStage(stage.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="business" className="space-y-4 pt-4">
          <div className="flex items-center gap-4 mb-4">
            <Label className="whitespace-nowrap">Select Business:</Label>
            <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Choose a laundry business" />
              </SelectTrigger>
              <SelectContent>
                {businesses.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.businessName} ({b.plan})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBusiness && (
              <Badge variant="outline" className="text-xs">
                Plan: {selectedBusiness.plan}
              </Badge>
            )}
          </div>

          {selectedBusinessId && businessConfigs.length > 0 && (
            <div className="rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Stage</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Code</th>
                      <th className="text-center p-3 text-xs font-medium text-muted-foreground w-24">Enabled</th>
                      <th className="text-center p-3 text-xs font-medium text-muted-foreground w-24">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {businessConfigs.map((bc) => (
                      <tr key={bc.stage.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3 text-sm font-medium">{bc.stage.name}</td>
                        <td className="p-3">
                          <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{bc.stage.code}</code>
                        </td>
                        <td className="p-3 text-center">
                          <Switch
                            checked={bc.enabled}
                            onCheckedChange={() => handleToggleBusinessStage(bc.stage.id, bc.enabled)}
                          />
                        </td>
                        <td className="p-3 text-center">
                          {bc.enabled ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Enabled</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedBusinessId && businessConfigs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No stages configured. Create workflow stages first.
            </div>
          )}
        </TabsContent>

        <TabsContent value="roles" className="space-y-4 pt-4">
          {selectedBusinessId ? (
            <div className="rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Stage</th>
                      {roles.filter((r) => r.isActive).map((role) => (
                        <th key={role.id} className="text-center p-3 text-xs font-medium text-muted-foreground">
                          {role.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStages.map((stage) => (
                      <tr key={stage.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3 text-sm font-medium">{stage.name}</td>
                        {roles.filter((r) => r.isActive).map((role) => {
                          const hasPermission = permissions.some(
                            (p) => p.stageId === stage.id && p.roleId === role.id
                          )
                          return (
                            <td key={role.id} className="p-3 text-center">
                              <Checkbox
                                checked={hasPermission}
                                onCheckedChange={() => handleToggleStageRole(stage.id, role.id, hasPermission)}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Select a business to configure stage-role permissions.
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingStage} onOpenChange={(o) => { if (!o) setEditingStage(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Workflow Stage</DialogTitle>
          </DialogHeader>
          {editingStage && (
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input
                    value={editingStage.code}
                    onChange={(e) => setEditingStage({ ...editingStage, code: e.target.value.toUpperCase().replace(/\s+/g, "_") })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sequence</Label>
                  <Input
                    type="number"
                    value={editingStage.sequence}
                    onChange={(e) => setEditingStage({ ...editingStage, sequence: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={editingStage.name}
                  onChange={(e) => setEditingStage({ ...editingStage, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingStage.description || ""}
                  onChange={(e) => setEditingStage({ ...editingStage, description: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={editingStage.isDefault}
                    onCheckedChange={(v) => setEditingStage({ ...editingStage, isDefault: v === true })}
                  />
                  <Label className="text-sm">Default</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={editingStage.isActive}
                    onCheckedChange={(v) => setEditingStage({ ...editingStage, isActive: v === true })}
                  />
                  <Label className="text-sm">Active</Label>
                </div>
              </div>
              <Button onClick={handleUpdateStage} className="w-full">Update Stage</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
