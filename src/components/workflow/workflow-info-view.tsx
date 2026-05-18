"use client"

import { ShoppingCart, Truck, Calendar, CreditCard, Receipt, Lock, Shield, Check } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAdminStore, WORKFLOW_CONFIGS, BUSINESS_TYPE_WORKFLOWS, BUSINESS_TYPE_UI, type WorkflowType } from "@/stores/admin-store"

const workflowIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingCart, Truck, Calendar, CreditCard, Receipt,
}

export function WorkflowInfoView() {
  const { currentBusinessType, currentBusinessName } = useAdminStore()

  const typeUI = BUSINESS_TYPE_UI[currentBusinessType] || BUSINESS_TYPE_UI["GROCERY"]
  const activeWorkflows: WorkflowType[] = (BUSINESS_TYPE_WORKFLOWS[currentBusinessType] || ["ECOMMERCE"]) as WorkflowType[]
  const displayName = currentBusinessName || typeUI?.label || "This Business"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Plan &amp; Workflows
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Workflow configuration is managed by your Platform Admin
        </p>
      </div>

      {/* Locked notice */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4 flex items-start gap-3">
          <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Managed by Platform Admin</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Business type, workflow assignments, and plan features are controlled by Quantix platform administrators. Contact your account manager to request changes.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Business config */}
      <Card className="shadow-none">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-muted-foreground">Business</p>
              <p className="font-semibold">{displayName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Business Type</p>
              <Badge variant="outline" className="text-xs">{typeUI.label}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Active Workflows</p>
              <Badge className="text-xs bg-emerald-100 text-emerald-700 border-0">{activeWorkflows.length} workflow{activeWorkflows.length !== 1 ? "s" : ""}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active workflow cards */}
      <div>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Active Workflows</h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          {WORKFLOW_CONFIGS.map((wf) => {
            const isActive = activeWorkflows.includes(wf.type)
            const Icon = workflowIconMap[wf.icon] || ShoppingCart
            return (
              <Card key={wf.type} className={`shadow-none transition-opacity ${isActive ? "" : "opacity-40"}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${isActive ? wf.bgColor : "bg-muted/30 border-dashed"} shrink-0`}>
                      {isActive
                        ? <Icon className={`h-4 w-4 ${wf.color}`} />
                        : <Lock className="h-4 w-4 text-muted-foreground" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium">{wf.label}</p>
                        {isActive
                          ? <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] h-4 px-1.5"><Check className="h-2.5 w-2.5 mr-0.5" />Active</Badge>
                          : <Badge variant="outline" className="text-[9px] h-4 px-1.5"><Lock className="h-2.5 w-2.5 mr-0.5" />Not included</Badge>
                        }
                      </div>
                      <p className="text-xs text-muted-foreground">{wf.description}</p>
                      {isActive && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {wf.features.map(f => (
                            <span key={f} className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{f}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
