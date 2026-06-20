"use client"

import { useEffect, useState } from "react"
import { Building2, Store, Factory, Users, Route, UserCog } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useAuthStore } from "@/stores/auth-store"

type DashboardCounts = {
  stores: number
  departments: number
  processingCenters: number
  roles: number
  assignments: number
}

export function LaundryDashboard() {
  const { currentBusinessId } = useAuthStore()
  const [counts, setCounts] = useState<DashboardCounts | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!currentBusinessId) { setLoading(false); return }
      try {
        const [storesRes, deptsRes, centersRes, rolesRes, assignmentsRes] = await Promise.all([
          fetch(`/api/laundry/businesses/${currentBusinessId}/stores`),
          fetch(`/api/laundry/departments?businessId=${currentBusinessId}`),
          fetch(`/api/laundry/processing-centers?businessId=${currentBusinessId}`),
          fetch("/api/laundry/roles"),
          fetch(`/api/laundry/assignments?businessId=${currentBusinessId}`),
        ])
        const [stores, departments, centers, roles, assignments] = await Promise.all([
          storesRes.json(), deptsRes.json(), centersRes.json(), rolesRes.json(), assignmentsRes.json(),
        ])
        setCounts({
          stores: Array.isArray(stores) ? stores.length : 0,
          departments: Array.isArray(departments) ? departments.length : 0,
          processingCenters: Array.isArray(centers) ? centers.length : 0,
          roles: Array.isArray(roles) ? roles.length : 0,
          assignments: Array.isArray(assignments) ? assignments.length : 0,
        })
      } catch {
        setCounts({ stores: 0, departments: 0, processingCenters: 0, roles: 0, assignments: 0 })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [currentBusinessId])

  const stats = [
    { label: "Stores", value: counts?.stores ?? 0, icon: Store, color: "text-sky-600 bg-sky-100" },
    { label: "Departments", value: counts?.departments ?? 0, icon: Route, color: "text-violet-600 bg-violet-100" },
    { label: "Processing Centers", value: counts?.processingCenters ?? 0, icon: Factory, color: "text-amber-600 bg-amber-100" },
    { label: "Roles", value: counts?.roles ?? 0, icon: UserCog, color: "text-emerald-600 bg-emerald-100" },
    { label: "Assignments", value: counts?.assignments ?? 0, icon: Users, color: "text-rose-600 bg-rose-100" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Workspace Overview</h2>
        <p className="text-sm text-muted-foreground">Real-time summary of your laundry operations</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-bold">{loading ? "..." : stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
