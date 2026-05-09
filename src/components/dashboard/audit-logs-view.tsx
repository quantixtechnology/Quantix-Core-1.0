'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ScrollText, Calendar, AlertTriangle, Users,
  Eye, Download, Filter, Search,
} from 'lucide-react'

const stats = [
  { label: 'Events', value: '2,847', icon: ScrollText, color: 'text-slate-600 bg-slate-50' },
  { label: 'Today', value: '142', icon: Calendar, color: 'text-blue-600 bg-blue-50' },
  { label: 'Critical', value: '8', icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  { label: 'Users', value: '24', icon: Users, color: 'text-emerald-600 bg-emerald-50' },
]

const actionBadges: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  LOGIN: 'bg-purple-100 text-purple-700',
  DEPLOY: 'bg-amber-100 text-amber-700',
  EXPORT: 'bg-gray-100 text-gray-700',
}

const auditLogs = [
  { time: '14:32:18', user: 'Arjun M.', action: 'DEPLOY', resource: 'FreshMart v2.1.3', ip: '192.168.1.10', severity: 'normal' },
  { time: '14:28:45', user: 'Priya S.', action: 'EXPORT', resource: 'Revenue Report Q4', ip: '192.168.1.22', severity: 'normal' },
  { time: '14:15:02', user: 'System', action: 'DELETE', resource: 'Expired session tokens', ip: '—', severity: 'normal' },
  { time: '13:55:30', user: 'Rahul K.', action: 'UPDATE', resource: 'User #42 role → Admin', ip: '192.168.1.15', severity: 'critical' },
  { time: '13:42:11', user: 'Sneha R.', action: 'CREATE', resource: 'Business QuickWash', ip: '192.168.1.18', severity: 'normal' },
  { time: '13:30:00', user: 'Unknown', action: 'LOGIN', resource: 'Failed attempt', ip: '203.0.113.5', severity: 'critical' },
  { time: '12:55:18', user: 'Arjun M.', action: 'DEPLOY', resource: 'CleanHome v1.8.0', ip: '192.168.1.10', severity: 'normal' },
  { time: '12:40:22', user: 'Priya S.', action: 'UPDATE', resource: 'Subscription plan pricing', ip: '192.168.1.22', severity: 'warning' },
  { time: '12:15:08', user: 'System', action: 'DELETE', resource: 'Old backup BK-030', ip: '—', severity: 'normal' },
  { time: '11:55:30', user: 'Rahul K.', action: 'CREATE', resource: 'API Key Partner_API', ip: '192.168.1.15', severity: 'warning' },
  { time: '11:30:15', user: 'Sneha R.', action: 'UPDATE', resource: 'Domain spicegarden.in', ip: '192.168.1.18', severity: 'normal' },
  { time: '11:12:44', user: 'Unknown', action: 'LOGIN', resource: 'Failed attempt', ip: '10.0.0.55', severity: 'critical' },
]

const severityColor: Record<string, string> = {
  normal: '',
  warning: 'bg-amber-50',
  critical: 'bg-red-50',
}

export function AuditLogsView() {
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
            <CardTitle className="text-sm font-semibold">Filter</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs h-7"><Download className="size-3 mr-1" />Export CSV</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
              <input type="text" placeholder="Search logs..." className="w-full pl-7 pr-3 py-1.5 text-xs rounded-md border bg-background" />
            </div>
            <Button variant="outline" size="sm" className="text-xs h-7"><Filter className="size-3 mr-1" />Action</Button>
            <Button variant="outline" size="sm" className="text-xs h-7"><Filter className="size-3 mr-1" />User</Button>
            <Button variant="outline" size="sm" className="text-xs h-7"><Filter className="size-3 mr-1" />Severity</Button>
            <div className="flex gap-1">
              {Object.entries(actionBadges).map(([action, color]) => (
                <Badge key={action} className={`text-[9px] cursor-pointer ${color}`}>{action}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">Time</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">User</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Action</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Resource</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">IP</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((l, i) => (
                  <tr key={i} className={`border-b hover:bg-muted/50 ${severityColor[l.severity]}`}>
                    <td className="p-2 font-mono text-muted-foreground">{l.time}</td>
                    <td className="p-2 font-medium">{l.user}</td>
                    <td className="p-2"><Badge className={`text-[10px] ${actionBadges[l.action] || 'bg-gray-100 text-gray-700'}`}>{l.action}</Badge></td>
                    <td className="p-2 max-w-[200px] truncate">{l.resource}</td>
                    <td className="p-2 font-mono text-muted-foreground">{l.ip}</td>
                    <td className="p-2"><Button variant="ghost" size="sm" className="h-6 w-6 p-0"><Eye className="size-3" /></Button></td>
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
