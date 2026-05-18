"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Smartphone, Globe, Truck, LayoutDashboard, CheckCircle2, Clock, AlertCircle, XCircle } from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { PageHeader } from "@/components/admin/shared/page-header"

interface AppCheck {
  key: string
  label: string
  passed: boolean
  priority: "critical" | "recommended" | "optional"
}

interface AppScore {
  score: number
  passed: number
  total: number
  checks: AppCheck[]
}

interface ReadinessData {
  overallScore: number
  readyForFlutter: boolean
  apps: {
    customer: AppScore
    delivery: AppScore
    pos: AppScore
    admin: AppScore
  }
  topBlockers: { app: string; key: string; label: string; priority: string }[]
}

const appMeta = [
  { key: "customer", label: "Customer App", icon: Smartphone, description: "Flutter mobile app for end customers", color: "text-blue-600" },
  { key: "delivery", label: "Delivery App",  icon: Truck,       description: "Driver / delivery partner app",       color: "text-orange-600" },
  { key: "pos",      label: "POS Billing",   icon: LayoutDashboard, description: "Point-of-sale billing terminal",  color: "text-purple-600" },
  { key: "admin",    label: "Admin Panel",   icon: Globe,       description: "Business owner web dashboard",        color: "text-emerald-600" },
] as const

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-600"
  if (score >= 50) return "text-amber-600"
  return "text-red-600"
}

function scoreLabel(score: number) {
  if (score >= 80) return "Ready"
  if (score >= 50) return "Partial"
  return "Not Ready"
}

function ScoreBadge({ score }: { score: number }) {
  if (score >= 80) return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Ready</Badge>
  if (score >= 50) return <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Partial</Badge>
  return <Badge className="bg-red-100 text-red-700 border-0 text-xs">Not Ready</Badge>
}

function CheckIcon({ passed, priority }: { passed: boolean; priority: string }) {
  if (passed) return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
  if (priority === "critical") return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
  if (priority === "recommended") return <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
  return <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
}

export function AppsView() {
  const { currentBusinessId } = useAdminStore()
  const { currentBusinessId: authBizId } = useAuthStore()
  const businessId = currentBusinessId || authBizId || ""

  const [data, setData] = useState<ReadinessData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/core/businesses/${businessId}/readiness-score`, {
        headers: { "x-business-id": businessId },
      })
      const json = await res.json()
      if (json.success) setData(json.data)
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  if (!data) return (
    <div className="flex flex-col items-center justify-center py-20 gap-2">
      <AlertCircle className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Could not load readiness data</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="App Readiness"
        description="Check platform readiness before launching your apps"
        icon={Smartphone}
      />

      {/* Overall score */}
      <Card className="shadow-none">
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Overall Readiness</p>
              <p className={`text-4xl font-bold mt-1 ${scoreColor(data.overallScore)}`}>{data.overallScore}%</p>
            </div>
            <div className="text-right">
              <Badge className={`text-sm px-3 py-1 ${data.readyForFlutter ? "bg-emerald-100 text-emerald-700 border-0" : "bg-amber-100 text-amber-700 border-0"}`}>
                {data.readyForFlutter ? "✓ Ready for Flutter" : "Setup Incomplete"}
              </Badge>
              {data.topBlockers.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{data.topBlockers.length} blockers remaining</p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${data.overallScore >= 80 ? "bg-emerald-500" : data.overallScore >= 50 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${data.overallScore}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Per-app cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {appMeta.map(({ key, label, icon: Icon, description, color }) => {
          const app = data.apps[key as keyof typeof data.apps]
          const isOpen = expanded === key
          return (
            <Card key={key} className="shadow-none">
              <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpanded(isOpen ? null : key)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{label}</CardTitle>
                      <CardDescription className="text-xs">{description}</CardDescription>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xl font-bold ${scoreColor(app.score)}`}>{app.score}%</p>
                    <ScoreBadge score={app.score} />
                  </div>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${app.score >= 80 ? "bg-emerald-500" : app.score >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${app.score}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{app.passed}/{app.total} checks passed · tap to {isOpen ? "collapse" : "expand"}</p>
              </CardHeader>

              {isOpen && (
                <CardContent className="pt-0 space-y-1">
                  {app.checks.map(check => (
                    <div key={check.key} className="flex items-center gap-2 py-1">
                      <CheckIcon passed={check.passed} priority={check.priority} />
                      <span className={`text-xs flex-1 ${check.passed ? "text-foreground" : "text-muted-foreground"}`}>{check.label}</span>
                      {!check.passed && (
                        <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${check.priority === "critical" ? "border-red-200 text-red-600" : check.priority === "recommended" ? "border-amber-200 text-amber-600" : ""}`}>
                          {check.priority}
                        </Badge>
                      )}
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* Top blockers */}
      {data.topBlockers.length > 0 && (
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top Blockers</CardTitle>
            <CardDescription className="text-xs">Fix these to improve your readiness score</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 p-0">
            <div className="divide-y">
              {data.topBlockers.map((b, i) => (
                <div key={`${b.app}-${b.key}`} className="flex items-center gap-3 px-6 py-2.5">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{b.label}</p>
                    <p className="text-xs text-muted-foreground capitalize">{b.app} app</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] h-4 px-1.5 shrink-0 ${b.priority === "critical" ? "border-red-200 text-red-600" : "border-amber-200 text-amber-600"}`}>
                    {b.priority}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
