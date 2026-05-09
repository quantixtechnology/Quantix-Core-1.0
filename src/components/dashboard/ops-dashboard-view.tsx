'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Rocket, Clock, CheckCircle2, XCircle, Server, Database, Wifi, HardDrive,
  Play, RefreshCw, Eye,
} from 'lucide-react'

const stats = [
  { label: 'Apps Building', value: '2', icon: Rocket, color: 'text-amber-600 bg-amber-50' },
  { label: 'Pending Publish', value: '3', icon: Clock, color: 'text-orange-600 bg-orange-50' },
  { label: 'Active Deployments', value: '8', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Failed Builds', value: '1', icon: XCircle, color: 'text-red-600 bg-red-50' },
]

const deploymentQueue = [
  { id: 'DP-001', app: 'FreshMart Admin', env: 'production', status: 'deploying', progress: 72, started: '2 min ago' },
  { id: 'DP-002', app: 'CleanHome Web', env: 'staging', status: 'queued', progress: 0, started: '—' },
  { id: 'DP-003', app: 'SpiceGarden Mobile', env: 'production', status: 'building', progress: 45, started: '5 min ago' },
  { id: 'DP-004', app: 'TechHub Portal', env: 'preview', status: 'completed', progress: 100, started: '12 min ago' },
]

const systemHealth = [
  { name: 'API Server', status: 'healthy', latency: '45ms', icon: Server },
  { name: 'Database', status: 'healthy', latency: '12ms', icon: Database },
  { name: 'WebSocket', status: 'degraded', latency: '89ms', icon: Wifi },
  { name: 'Storage', status: 'healthy', latency: '28ms', icon: HardDrive },
]

const statusColor: Record<string, string> = {
  deploying: 'bg-blue-100 text-blue-700',
  queued: 'bg-gray-100 text-gray-700',
  building: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
}

const healthColor: Record<string, string> = {
  healthy: 'text-emerald-600',
  degraded: 'text-amber-600',
  down: 'text-red-600',
}

export function OpsDashboardView() {
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
            <CardTitle className="text-sm font-semibold">Live Deployment Queue</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs h-7"><RefreshCw className="size-3 mr-1" />Refresh</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {deploymentQueue.map(d => (
              <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{d.app}</span>
                    <Badge variant="outline" className="text-[10px]">{d.env}</Badge>
                    <Badge className={`text-[10px] ${statusColor[d.status]}`}>{d.status}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${d.progress}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{d.progress}%</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-muted-foreground">{d.id}</p>
                  <p className="text-[10px] text-muted-foreground">{d.started}</p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Eye className="size-3" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {systemHealth.map(h => (
              <div key={h.name} className="p-3 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <h.icon className={`size-4 ${healthColor[h.status]}`} />
                  <span className="text-sm font-medium">{h.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={`text-[10px] ${healthColor[h.status]}`}>{h.status}</Badge>
                  <span className="text-xs text-muted-foreground">{h.latency}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
