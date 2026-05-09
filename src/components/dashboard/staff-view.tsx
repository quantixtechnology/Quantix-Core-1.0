'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Users, UserCog, Plus, CheckCircle2,
} from 'lucide-react'

const stats = [
  { label: 'Total Staff', value: '18', icon: Users, color: 'text-slate-600 bg-slate-50' },
  { label: 'Active Now', value: '12', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Roles', value: '5', icon: UserCog, color: 'text-blue-600 bg-blue-50' },
  { label: 'Avg Performance', value: '87%', icon: Users, color: 'text-amber-600 bg-amber-50' },
]

type RoleKey = 'STORE_MANAGER' | 'DELIVERY_STAFF' | 'SALES' | 'SUPPORT' | 'ADMIN'

const roleConfig: Record<RoleKey, { color: string; label: string }> = {
  STORE_MANAGER: { color: 'bg-purple-100 text-purple-700', label: 'Store Manager' },
  DELIVERY_STAFF: { color: 'bg-blue-100 text-blue-700', label: 'Delivery Staff' },
  SALES: { color: 'bg-amber-100 text-amber-700', label: 'Sales' },
  SUPPORT: { color: 'bg-cyan-100 text-cyan-700', label: 'Support' },
  ADMIN: { color: 'bg-emerald-100 text-emerald-700', label: 'Admin' },
}

const staffMembers = [
  { name: 'Anand Sharma', role: 'STORE_MANAGER' as RoleKey, email: 'anand@freshmart.in', status: 'ONLINE', performance: 92 },
  { name: 'Ritu Patel', role: 'STORE_MANAGER' as RoleKey, email: 'ritu@freshmart.in', status: 'ONLINE', performance: 88 },
  { name: 'Karan Singh', role: 'DELIVERY_STAFF' as RoleKey, email: 'karan@freshmart.in', status: 'ONLINE', performance: 95 },
  { name: 'Deepak Joshi', role: 'DELIVERY_STAFF' as RoleKey, email: 'deepak@freshmart.in', status: 'ONLINE', performance: 78 },
  { name: 'Meera Iyer', role: 'DELIVERY_STAFF' as RoleKey, email: 'meera@freshmart.in', status: 'OFFLINE', performance: 82 },
  { name: 'Suresh Reddy', role: 'SALES' as RoleKey, email: 'suresh@freshmart.in', status: 'ONLINE', performance: 90 },
  { name: 'Pooja Nair', role: 'SALES' as RoleKey, email: 'pooja@freshmart.in', status: 'OFFLINE', performance: 85 },
  { name: 'Ravi Kumar', role: 'SUPPORT' as RoleKey, email: 'ravi@freshmart.in', status: 'ONLINE', performance: 91 },
  { name: 'Swati Das', role: 'SUPPORT' as RoleKey, email: 'swati@freshmart.in', status: 'ONLINE', performance: 87 },
  { name: 'Vikas Gupta', role: 'ADMIN' as RoleKey, email: 'vikas@freshmart.in', status: 'ONLINE', performance: 96 },
  { name: 'Nisha Agarwal', role: 'DELIVERY_STAFF' as RoleKey, email: 'nisha@freshmart.in', status: 'ONLINE', performance: 84 },
  { name: 'Pradeep M', role: 'DELIVERY_STAFF' as RoleKey, email: 'pradeep@freshmart.in', status: 'ONLINE', performance: 76 },
  { name: 'Kavitha R', role: 'SUPPORT' as RoleKey, email: 'kavitha@freshmart.in', status: 'OFFLINE', performance: 89 },
  { name: 'Rahul Verma', role: 'SALES' as RoleKey, email: 'rahul@freshmart.in', status: 'ONLINE', performance: 83 },
  { name: 'Lakshmi S', role: 'DELIVERY_STAFF' as RoleKey, email: 'lakshmi@freshmart.in', status: 'OFFLINE', performance: 79 },
  { name: 'Sandeep T', role: 'DELIVERY_STAFF' as RoleKey, email: 'sandeep@freshmart.in', status: 'ONLINE', performance: 88 },
  { name: 'Divya K', role: 'SUPPORT' as RoleKey, email: 'divya@freshmart.in', status: 'OFFLINE', performance: 92 },
  { name: 'Manoj P', role: 'DELIVERY_STAFF' as RoleKey, email: 'manoj@freshmart.in', status: 'OFFLINE', performance: 81 },
]

const roleDistribution = [
  { role: 'STORE_MANAGER', count: 2, total: 18, color: 'bg-purple-500' },
  { role: 'DELIVERY_STAFF', count: 8, total: 18, color: 'bg-blue-500' },
  { role: 'SALES', count: 3, total: 18, color: 'bg-amber-500' },
  { role: 'SUPPORT', count: 3, total: 18, color: 'bg-cyan-500' },
  { role: 'ADMIN', count: 2, total: 18, color: 'bg-emerald-500' },
]

const permissions = [
  { feature: 'Dashboard', STORE_MANAGER: true, DELIVERY_STAFF: false, SALES: true, SUPPORT: true, ADMIN: true },
  { feature: 'Orders', STORE_MANAGER: true, DELIVERY_STAFF: true, SALES: false, SUPPORT: true, ADMIN: true },
  { feature: 'Products', STORE_MANAGER: true, DELIVERY_STAFF: false, SALES: true, SUPPORT: false, ADMIN: true },
  { feature: 'POS', STORE_MANAGER: true, DELIVERY_STAFF: false, SALES: false, SUPPORT: false, ADMIN: true },
  { feature: 'Customers', STORE_MANAGER: true, DELIVERY_STAFF: false, SALES: true, SUPPORT: true, ADMIN: true },
  { feature: 'Reports', STORE_MANAGER: true, DELIVERY_STAFF: false, SALES: false, SUPPORT: false, ADMIN: true },
  { feature: 'Delivery', STORE_MANAGER: true, DELIVERY_STAFF: true, SALES: false, SUPPORT: false, ADMIN: true },
  { feature: 'Settings', STORE_MANAGER: false, DELIVERY_STAFF: false, SALES: false, SUPPORT: false, ADMIN: true },
  { feature: 'Staff Mgmt', STORE_MANAGER: true, DELIVERY_STAFF: false, SALES: false, SUPPORT: false, ADMIN: true },
  { feature: 'Tax Config', STORE_MANAGER: false, DELIVERY_STAFF: false, SALES: false, SUPPORT: false, ADMIN: true },
]

function getPerfColor(score: number) {
  if (score >= 90) return 'bg-emerald-500'
  if (score >= 80) return 'bg-blue-500'
  if (score >= 70) return 'bg-amber-500'
  return 'bg-red-500'
}

export function StaffView() {
  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Staff Management</h2>
        <Button variant="outline" size="sm" className="text-xs h-7">
          <Plus className="size-3 mr-1" />Invite Staff
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.color}`}><s.icon className="size-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Role Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Role Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {roleDistribution.map(r => (
              <div key={r.role} className="flex items-center gap-3">
                <Badge className={`text-[10px] min-w-[100px] justify-center ${roleConfig[r.role as RoleKey].color}`}>
                  {roleConfig[r.role as RoleKey].label}
                </Badge>
                <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${r.color} transition-all`}
                    style={{ width: `${(r.count / r.total) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold w-8 text-right">{r.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Staff List */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Staff Members</CardTitle>
            <Badge variant="outline" className="text-[10px]">{staffMembers.length} total</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
            {staffMembers.map(s => {
              const rc = roleConfig[s.role as RoleKey]
              return (
                <div key={s.email} className="p-3 rounded-lg border flex items-start gap-3">
                  <div className="size-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                    {s.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <Badge className={`text-[10px] ${rc.color}`}>{rc.label}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{s.email}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge className={`text-[10px] ${s.status === 'ONLINE' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s.status}
                      </Badge>
                      <div className="flex items-center gap-1 flex-1">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getPerfColor(s.performance)}`}
                            style={{ width: `${s.performance}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold">{s.performance}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Permissions Matrix */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Permissions Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">Feature</th>
                  {Object.values(roleConfig).map(r => (
                    <th key={r.label} className="text-center p-2 font-medium text-muted-foreground whitespace-nowrap">{r.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.map(p => (
                  <tr key={p.feature} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-medium">{p.feature}</td>
                    {Object.keys(roleConfig).map(r => (
                      <td key={r} className="text-center p-2">
                        {p[r as RoleKey] ? (
                          <CheckCircle2 className="size-4 text-emerald-500 mx-auto" />
                        ) : (
                          <div className="size-4 mx-auto rounded-full bg-gray-100 flex items-center justify-center">
                            <div className="size-1.5 rounded-full bg-gray-300" />
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
