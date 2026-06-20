"use client"

import { useEffect, useState } from "react"
import { Shield, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface WorkflowStage {
  id: string
  code: string
  name: string
  sequence: number
  isActive: boolean
  isSystem: boolean
}

interface LaundryRole {
  id: string
  code: string
  name: string
  isActive: boolean
  isSystem: boolean
}

interface StagePermission {
  id: string
  stageId: string
  roleId: string
  stage: WorkflowStage
  role: LaundryRole
}

export function LaundryStagePermissionsView() {
  const { toast } = useToast()
  const [stages, setStages] = useState<WorkflowStage[]>([])
  const [roles, setRoles] = useState<LaundryRole[]>([])
  const [permissions, setPermissions] = useState<StagePermission[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedStageId, setSelectedStageId] = useState<string>("")
  const [selectedRoleId, setSelectedRoleId] = useState<string>("")

  const fetchData = async () => {
    try {
      const [stagesRes, rolesRes, permissionsRes] = await Promise.all([
        fetch("/api/laundry/workflow-stages"),
        fetch("/api/laundry/roles"),
        fetch("/api/laundry/stage-permissions"),
      ])
      const [stagesData, rolesData, permissionsData] = await Promise.all([
        stagesRes.json(), rolesRes.json(), permissionsRes.json(),
      ])
      setStages(stagesData)
      setRoles(rolesData)
      setPermissions(permissionsData)
    } catch {
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleAddPermission = async () => {
    if (!selectedStageId || !selectedRoleId) {
      toast({ title: "Validation", description: "Select both a stage and a role", variant: "destructive" })
      return
    }

    const exists = permissions.some(
      (p) => p.stageId === selectedStageId && p.roleId === selectedRoleId
    )
    if (exists) {
      toast({ title: "Info", description: "This permission already exists" })
      return
    }

    try {
      const res = await fetch("/api/laundry/stage-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: selectedStageId, roleId: selectedRoleId }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      toast({ title: "Success", description: "Permission added" })
      setSelectedStageId("")
      setSelectedRoleId("")
      fetchData()
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" })
    }
  }

  const handleRemovePermission = async (id: string) => {
    try {
      const res = await fetch(`/api/laundry/stage-permissions/${id}`, { method: "DELETE" })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      toast({ title: "Success", description: "Permission removed" })
      fetchData()
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" })
    }
  }

  const activeStages = stages.filter((s) => s.isActive)
  const activeRoles = roles.filter((r) => r.isActive)

  const getStageName = (id: string) => stages.find((s) => s.id === id)?.name || id
  const getRoleName = (id: string) => roles.find((r) => r.id === id)?.name || id

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stage Permissions</h1>
          <p className="text-sm text-muted-foreground">Assign roles to workflow stages for inbox visibility</p>
        </div>
      </div>

      <div className="flex items-end gap-4 p-4 rounded-lg border bg-muted/30">
        <div className="space-y-2 flex-1">
          <label className="text-xs font-medium text-muted-foreground">Workflow Stage</label>
          <Select value={selectedStageId} onValueChange={setSelectedStageId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a stage" />
            </SelectTrigger>
            <SelectContent>
              {activeStages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 flex-1">
          <label className="text-xs font-medium text-muted-foreground">Role</label>
          <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {activeRoles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAddPermission}>
          Add Permission
        </Button>
      </div>

      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Workflow Stage</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground">Role</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((perm) => (
                <tr key={perm.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{perm.stage.name}</span>
                      <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{perm.stage.code}</code>
                      {perm.stage.isSystem && <Badge variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground">System</Badge>}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{perm.role.name}</Badge>
                      {perm.role.isSystem && <Badge variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground">System</Badge>}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      onClick={() => handleRemovePermission(perm.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {permissions.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-sm text-muted-foreground">
                    No permissions assigned yet. Use the form above to add permissions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
