"use client"

import { useEffect, useState } from "react"
import { Inbox, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/stores/auth-store"

type StageWithDetails = {
  id: string
  code: string
  name: string
  sequence: number
  description: string | null
  isActive: boolean
  isSystem: boolean
  department?: { code: string; name: string } | null
  role?: { code: string; name: string } | null
}

export function LaundryInboxView() {
  const { currentBusinessId } = useAuthStore()
  const [stages, setStages] = useState<StageWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!currentBusinessId) { setLoading(false); return }
      try {
        const res = await fetch(`/api/laundry/workflow-configurations/business/${currentBusinessId}`)
        const data = await res.json()
        if (Array.isArray(data)) {
          setStages(
            data
              .filter((s: { enabled: boolean }) => s.enabled)
              .map((s: { stage: StageWithDetails; configuration: { responsibleRole?: { code: string; name: string } | null; responsibleDepartment?: { code: string; name: string } | null } | null }) => ({
                ...s.stage,
                department: s.configuration?.responsibleDepartment ?? null,
                role: s.configuration?.responsibleRole ?? null,
              }))
          )
        }
      } catch {
        setStages([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [currentBusinessId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">My Inbox</h2>
        <p className="text-sm text-muted-foreground">Workflow stages grouped by department and role</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {stages.map((stage) => (
          <Card key={stage.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="font-mono text-[10px]">
                  Seq {stage.sequence}
                </Badge>
                <Badge className="bg-green-100 text-green-700 text-[10px]">Active</Badge>
              </div>
              <h3 className="font-medium text-sm mb-1">{stage.name}</h3>
              <code className="text-[10px] font-mono text-muted-foreground">{stage.code}</code>
              {stage.description && (
                <p className="text-xs text-muted-foreground mt-1">{stage.description}</p>
              )}
              <div className="flex items-center gap-2 mt-3 pt-2 border-t text-xs text-muted-foreground">
                {stage.department && (
                  <Badge variant="secondary" className="text-[10px]">{stage.department.name}</Badge>
                )}
                {stage.role && (
                  <Badge variant="outline" className="text-[10px]">{stage.role.name}</Badge>
                )}
                {!stage.department && !stage.role && (
                  <span className="text-[10px]">No assignment</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {stages.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Inbox className="h-10 w-10 mb-3" />
            <p className="text-sm font-medium">No workflow stages configured</p>
            <p className="text-xs">Enable stages in Business &rarr; Workflow to populate your inbox</p>
          </div>
        )}
      </div>
    </div>
  )
}
