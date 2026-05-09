'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  MonitorSmartphone, Archive, ShieldCheck, Clock, AlertTriangle,
  RefreshCw, ToggleLeft, Eye,
} from 'lucide-react'

const stats = [
  { label: 'Active Versions', value: '4', icon: MonitorSmartphone, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Deprecated', value: '2', icon: Archive, color: 'text-gray-600 bg-gray-50' },
  { label: 'Compliance', value: '87%', icon: ShieldCheck, color: 'text-blue-600 bg-blue-50' },
  { label: 'Avg Lag', value: '3.2 days', icon: Clock, color: 'text-amber-600 bg-amber-50' },
]

const versionMatrix = [
  { app: 'FreshMart Mobile', latest: 'v2.1.3', minRequired: 'v2.0.0', activeUsers: '4,210', compliance: 92, forceUpdate: false },
  { app: 'CleanHome Web', latest: 'v1.8.0', minRequired: 'v1.6.0', activeUsers: '2,890', compliance: 85, forceUpdate: false },
  { app: 'SpiceGarden Mobile', latest: 'v3.0.0', minRequired: 'v2.8.0', activeUsers: '1,750', compliance: 78, forceUpdate: true },
  { app: 'TechHub Admin', latest: 'v1.2.0', minRequired: 'v1.0.0', activeUsers: '890', compliance: 95, forceUpdate: false },
  { app: 'FreshMart POS', latest: 'v2.1.0', minRequired: 'v2.0.0', activeUsers: '540', compliance: 88, forceUpdate: false },
  { app: 'CleanHome Mobile (old)', latest: 'v1.2.3', minRequired: '—', activeUsers: '120', compliance: 45, forceUpdate: false },
]

export function MobileVersionsView() {
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
            <CardTitle className="text-sm font-semibold">Version Matrix</CardTitle>
            <Button variant="outline" size="sm" className="text-xs h-7"><RefreshCw className="size-3 mr-1" />Check Updates</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">App</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Latest</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Min Required</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Active Users</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Compliance</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Force Update</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {versionMatrix.map(v => (
                  <tr key={v.app} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-medium">{v.app}</td>
                    <td className="p-2 font-mono">{v.latest}</td>
                    <td className="p-2 font-mono text-muted-foreground">{v.minRequired}</td>
                    <td className="p-2">{v.activeUsers}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${v.compliance >= 90 ? 'bg-emerald-500' : v.compliance >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${v.compliance}%` }} />
                        </div>
                        <span className="text-[10px]">{v.compliance}%</span>
                      </div>
                    </td>
                    <td className="p-2">
                      {v.forceUpdate ? (
                        <Badge className="text-[10px] bg-red-100 text-red-700">Mandatory</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Optional</Badge>
                      )}
                    </td>
                    <td className="p-2"><Button variant="ghost" size="sm" className="h-6 w-6 p-0"><Eye className="size-3" /></Button></td>
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
            <CardTitle className="text-sm font-semibold">Compliance Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {versionMatrix.map(v => (
                <div key={v.app} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate max-w-[180px]">{v.app}</span>
                    <span className={`font-medium ${v.compliance >= 90 ? 'text-emerald-600' : v.compliance >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{v.compliance}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${v.compliance >= 90 ? 'bg-emerald-500' : v.compliance >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${v.compliance}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-4 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1"><div className="size-2 rounded-full bg-emerald-500" />≥90%</div>
              <div className="flex items-center gap-1"><div className="size-2 rounded-full bg-amber-500" />70-89%</div>
              <div className="flex items-center gap-1"><div className="size-2 rounded-full bg-red-500" />&lt;70%</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Force Update Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { app: 'SpiceGarden Mobile', version: 'v3.0.0', active: true, reason: 'Critical security patch', deadline: 'Jan 20' },
                { app: 'FreshMart Mobile', version: 'v2.1.3', active: false, reason: '—', deadline: '—' },
              ].map(f => (
                <div key={f.app} className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{f.app}</span>
                    <Badge className={`text-[10px] ${f.active ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{f.active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground space-y-0.5">
                    <p>Version: {f.version}</p>
                    <p>Reason: {f.reason}</p>
                    {f.deadline !== '—' && <p>Deadline: {f.deadline}</p>}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="text-xs h-7 mt-3 w-full"><ToggleLeft className="size-3 mr-1" />Configure Force Update</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
