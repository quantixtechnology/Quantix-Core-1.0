'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Shield, Users, Key, AlertTriangle,
  Eye, Plus, RotateCcw, Copy,
} from 'lucide-react'

const stats = [
  { label: 'Active Users', value: '24', icon: Users, color: 'text-blue-600 bg-blue-50' },
  { label: 'Roles', value: '6', icon: Shield, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Logins', value: '48', icon: Key, color: 'text-amber-600 bg-amber-50' },
  { label: 'Alerts', value: '2', icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
]

const roles = [
  { role: 'Super Admin', users: 2, permissions: 'Full', level: 'platform', color: 'bg-red-100 text-red-700' },
  { role: 'Sales Team', users: 3, permissions: 'Leads, Onboarding', level: 'platform', color: 'bg-purple-100 text-purple-700' },
  { role: 'Client Owner', users: 8, permissions: 'Business CRUD', level: 'tenant', color: 'bg-blue-100 text-blue-700' },
  { role: 'Store Manager', users: 6, permissions: 'Store Ops', level: 'tenant', color: 'bg-emerald-100 text-emerald-700' },
  { role: 'Delivery Staff', users: 3, permissions: 'Deliveries', level: 'tenant', color: 'bg-amber-100 text-amber-700' },
  { role: 'Customer', users: 2, permissions: 'Browse, Order', level: 'public', color: 'bg-gray-100 text-gray-700' },
]

const accessLog = [
  { user: 'Arjun M.', action: 'Login', resource: 'Admin Panel', ip: '192.168.1.10', time: '2 min ago', status: 'success' },
  { user: 'Priya S.', action: 'Export', resource: 'Revenue Report', ip: '192.168.1.22', time: '15 min ago', status: 'success' },
  { user: 'Unknown', action: 'Login', resource: 'Admin Panel', ip: '10.0.0.55', time: '28 min ago', status: 'denied' },
  { user: 'Rahul K.', action: 'Deploy', resource: 'FreshMart v2.1.3', ip: '192.168.1.15', time: '1h ago', status: 'success' },
  { user: 'Sneha R.', action: 'Role Change', resource: 'User #42', ip: '192.168.1.18', time: '2h ago', status: 'success' },
  { user: 'Arjun M.', action: 'API Key', resource: 'Key rotation', ip: '192.168.1.10', time: '3h ago', status: 'success' },
  { user: 'Unknown', action: 'Login', resource: 'Admin Panel', ip: '203.0.113.5', time: '5h ago', status: 'denied' },
  { user: 'Priya S.', action: 'Delete', resource: 'Staging DB', ip: '192.168.1.22', time: '6h ago', status: 'success' },
]

const apiKeys = [
  { name: 'FreshMart Production', prefix: 'fm_prod_****3a2f', created: 'Jan 5', expires: 'Jul 5', lastUsed: '2 min ago' },
  { name: 'CleanHome Staging', prefix: 'ch_stag_****8b1d', created: 'Dec 20', expires: 'Jun 20', lastUsed: '1h ago' },
  { name: 'Internal Monitoring', prefix: 'int_mon_****5e9c', created: 'Nov 1', expires: 'May 1', lastUsed: '5 min ago' },
  { name: 'Partner API', prefix: 'prt_api_****2f7a', created: 'Oct 15', expires: 'Apr 15', lastUsed: '3d ago' },
]

export function SecurityAccessView() {
  return (
    <div className="animate-in fade-in duration-300 space-y-6">
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

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">RBAC Roles</CardTitle>
            <Button variant="outline" size="sm" className="text-xs h-7"><Plus className="size-3 mr-1" />Add Role</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">Role</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Users</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Permissions</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Level</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {roles.map(r => (
                  <tr key={r.role} className="border-b hover:bg-muted/50">
                    <td className="p-2"><Badge className={`text-[10px] ${r.color}`}>{r.role}</Badge></td>
                    <td className="p-2">{r.users}</td>
                    <td className="p-2 text-muted-foreground">{r.permissions}</td>
                    <td className="p-2"><Badge variant="outline" className="text-[10px]">{r.level}</Badge></td>
                    <td className="p-2"><Button variant="ghost" size="sm" className="h-6 w-6 p-0"><Eye className="size-3" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Permission Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">Permission</th>
                  {roles.map(r => <th key={r.role} className="p-2 text-center font-medium text-muted-foreground text-[10px]">{r.role.split(' ')[0]}</th>)}
                </tr>
              </thead>
              <tbody>
                {['Manage Users', 'Deploy Apps', 'Configure DNS', 'View Revenue', 'Manage Products', 'Process Orders', 'Access POS', 'View Deliveries'].map(perm => (
                  <tr key={perm} className="border-b">
                    <td className="p-2">{perm}</td>
                    {roles.map(r => {
                      const hasPermission = (r.role === 'Super Admin') ||
                        (r.role === 'Sales Team' && ['View Revenue', 'Manage Users'].includes(perm)) ||
                        (r.role === 'Client Owner' && ['Manage Products', 'Process Orders', 'Access POS', 'View Deliveries'].includes(perm)) ||
                        (r.role === 'Store Manager' && ['Manage Products', 'Process Orders', 'Access POS'].includes(perm)) ||
                        (r.role === 'Delivery Staff' && perm === 'View Deliveries')
                      return (
                        <td key={r.role} className="p-2 text-center">
                          {hasPermission ? <span className="text-emerald-600">✓</span> : <span className="text-gray-300">—</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Access Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {accessLog.map((l, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded text-xs border-b last:border-0">
                  <div className={`size-2 rounded-full shrink-0 ${l.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{l.user}</span>
                    <span className="text-muted-foreground"> {l.action} → {l.resource}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{l.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">API Keys</CardTitle>
              <Button variant="outline" size="sm" className="text-xs h-7"><Plus className="size-3 mr-1" />Generate</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {apiKeys.map(k => (
                <div key={k.name} className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{k.name}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><Copy className="size-3" /></Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><RotateCcw className="size-3" /></Button>
                    </div>
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground">{k.prefix}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                    <span>Created: {k.created}</span>
                    <span>Expires: {k.expires}</span>
                    <span>Last: {k.lastUsed}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
