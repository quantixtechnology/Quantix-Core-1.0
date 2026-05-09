'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Database, Activity, Clock, AlertTriangle,
  CheckCircle2, XCircle, HardDrive, Eye, RefreshCw,
} from 'lucide-react'

const stats = [
  { label: 'DB Backups', value: '24h', icon: Database, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Uptime', value: '99.9%', icon: Activity, color: 'text-blue-600 bg-blue-50' },
  { label: 'Response', value: '142ms', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  { label: 'Error Rate', value: '0.12%', icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
]

const backupHistory = [
  { id: 'BK-047', time: 'Jan 15, 03:00', size: '2.4 GB', duration: '8 min', status: 'success', type: 'Full' },
  { id: 'BK-046', time: 'Jan 14, 03:00', size: '2.3 GB', duration: '7 min', status: 'success', type: 'Incremental' },
  { id: 'BK-045', time: 'Jan 13, 03:00', size: '2.3 GB', duration: '9 min', status: 'success', type: 'Full' },
  { id: 'BK-044', time: 'Jan 12, 03:00', size: '2.2 GB', duration: '7 min', status: 'success', type: 'Incremental' },
  { id: 'BK-043', time: 'Jan 11, 03:00', size: '2.2 GB', duration: '—', status: 'failed', type: 'Full' },
]

const deploymentHealth = [
  { name: 'API Server', status: 'healthy', uptime: '99.99%', lastCheck: '30s ago' },
  { name: 'Web App', status: 'healthy', uptime: '99.95%', lastCheck: '30s ago' },
  { name: 'Admin Panel', status: 'healthy', uptime: '99.97%', lastCheck: '30s ago' },
  { name: 'WebSocket', status: 'degraded', uptime: '99.2%', lastCheck: '30s ago' },
  { name: 'Worker', status: 'healthy', uptime: '99.98%', lastCheck: '30s ago' },
  { name: 'CDN', status: 'healthy', uptime: '100%', lastCheck: '30s ago' },
]

const errors = [
  { time: '14:32:18', source: 'API', error: 'ECONNREFUSED 10.0.1.5:5432', count: 3, severity: 'critical' },
  { time: '14:28:45', source: 'Worker', error: 'Timeout: job BULK-EMAIL exceeded 30s', count: 1, severity: 'warning' },
  { time: '14:15:02', source: 'API', error: '429 Rate limit exceeded for IP 192.168.1.x', count: 12, severity: 'warning' },
  { time: '13:55:30', source: 'WebSocket', error: 'Socket hang up — client disconnected', count: 8, severity: 'info' },
  { time: '13:42:11', source: 'CDN', error: 'Origin timeout — static asset cache miss', count: 2, severity: 'warning' },
]

const healthStatus: Record<string, { color: string; dotColor: string }> = {
  healthy: { color: 'text-emerald-600', dotColor: 'bg-emerald-500' },
  degraded: { color: 'text-amber-600', dotColor: 'bg-amber-500' },
  down: { color: 'text-red-600', dotColor: 'bg-red-500' },
}

const severityColor: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
  info: 'bg-blue-100 text-blue-700',
}

export function BackupMonitoringView() {
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
            <CardTitle className="text-sm font-semibold">Backup History</CardTitle>
            <Button variant="outline" size="sm" className="text-xs h-7"><RefreshCw className="size-3 mr-1" />Backup Now</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">ID</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Time</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Size</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Duration</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Type</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {backupHistory.map(b => (
                  <tr key={b.id} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-mono">{b.id}</td>
                    <td className="p-2">{b.time}</td>
                    <td className="p-2">{b.size}</td>
                    <td className="p-2">{b.duration}</td>
                    <td className="p-2"><Badge variant="outline" className="text-[10px]">{b.type}</Badge></td>
                    <td className="p-2"><Badge className={`text-[10px] gap-1 ${b.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{b.status === 'success' ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}{b.status}</Badge></td>
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
            <CardTitle className="text-sm font-semibold">Deployment Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {deploymentHealth.map(d => (
                <div key={d.name} className="p-3 rounded-lg border">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`size-2 rounded-full ${healthStatus[d.status].dotColor}`} />
                    <span className="text-sm font-medium">{d.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={healthStatus[d.status].color}>{d.status}</span>
                    <span className="text-muted-foreground">{d.uptime}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Error Monitoring</CardTitle>
              <Badge className="text-[10px] bg-red-100 text-red-700">5 events</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {errors.map((e, i) => (
                <div key={i} className="p-2 rounded-lg border text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[9px] ${severityColor[e.severity]}`}>{e.severity}</Badge>
                      <span className="font-medium">{e.source}</span>
                    </div>
                    <span className="text-muted-foreground font-mono">{e.time}</span>
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground truncate">{e.error}</p>
                  <p className="text-[10px] text-muted-foreground">×{e.count} occurrences</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Storage Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { label: 'Database', used: '2.4 GB', total: '10 GB', pct: 24 },
              { label: 'File Storage', used: '18.2 GB', total: '50 GB', pct: 36 },
              { label: 'Backups', used: '12.8 GB', total: '100 GB', pct: 13 },
              { label: 'Logs', used: '1.5 GB', total: '5 GB', pct: 30 },
            ].map(s => (
              <div key={s.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2"><HardDrive className="size-3 text-muted-foreground" />{s.label}</div>
                  <span className="text-muted-foreground">{s.used} / {s.total}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${s.pct > 80 ? 'bg-red-500' : s.pct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
