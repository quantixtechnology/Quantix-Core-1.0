'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Hammer, Clock, TrendingUp, ListOrdered, Play, Eye,
  RotateCcw, Download, Terminal,
} from 'lucide-react'

const stats = [
  { label: 'Total Builds', value: '124', icon: Hammer, color: 'text-slate-600 bg-slate-50' },
  { label: 'Avg Time', value: '8.5 min', icon: Clock, color: 'text-blue-600 bg-blue-50' },
  { label: 'Success Rate', value: '94%', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Queue', value: '2', icon: ListOrdered, color: 'text-amber-600 bg-amber-50' },
]

const buildQueue = [
  { id: 'BLD-124', app: 'FreshMart Mobile', platform: 'android', profile: 'production', status: 'building', progress: 67, time: '5m 42s', branch: 'main' },
  { id: 'BLD-123', app: 'CleanHome Admin', platform: 'web', profile: 'staging', status: 'building', progress: 34, time: '2m 18s', branch: 'develop' },
  { id: 'BLD-122', app: 'SpiceGarden Mobile', platform: 'android', profile: 'preview', status: 'queued', progress: 0, time: '—', branch: 'feat/payments' },
  { id: 'BLD-121', app: 'TechHub Web', platform: 'web', profile: 'production', status: 'completed', progress: 100, time: '7m 33s', branch: 'main' },
  { id: 'BLD-120', app: 'FreshMart POS', platform: 'android', profile: 'production', status: 'completed', progress: 100, time: '9m 15s', branch: 'main' },
  { id: 'BLD-119', app: 'CleanHome Mobile', platform: 'ios', profile: 'development', status: 'failed', progress: 45, time: '3m 02s', branch: 'fix/auth' },
]

const statusColor: Record<string, string> = {
  building: 'bg-blue-100 text-blue-700',
  queued: 'bg-gray-100 text-gray-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
}

const buildLogs = [
  { time: '14:32:18', level: 'info', msg: 'Installing dependencies...' },
  { time: '14:32:45', level: 'info', msg: 'Running Expo export...' },
  { time: '14:33:12', level: 'warn', msg: 'Asset optimization skipped for dev profile' },
  { time: '14:34:01', level: 'info', msg: 'EAS Build triggered — build ID: 2a4f-8c3e' },
  { time: '14:34:55', level: 'error', msg: 'Gradle build failed: Cannot find symbol R.string.app_name' },
]

const logColor: Record<string, string> = {
  info: 'text-blue-600',
  warn: 'text-amber-600',
  error: 'text-red-600',
}

export function BuildAutomationView() {
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
            <CardTitle className="text-sm font-semibold">Build Queue</CardTitle>
            <Button variant="outline" size="sm" className="text-xs h-7"><Play className="size-3 mr-1" />New Build</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {buildQueue.map(b => (
              <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{b.app}</span>
                    <Badge variant="outline" className="text-[10px]">{b.platform}</Badge>
                    <Badge variant="outline" className="text-[10px]">{b.profile}</Badge>
                    <Badge className={`text-[10px] ${statusColor[b.status]}`}>{b.status}</Badge>
                  </div>
                  {b.status === 'building' && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${b.progress}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{b.progress}%</span>
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0 text-[10px] text-muted-foreground">
                  <p className="font-mono">{b.id}</p>
                  <p>{b.time}</p>
                  <p className="font-mono">{b.branch}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Eye className="size-3" /></Button>
                  {b.status === 'failed' && <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><RotateCcw className="size-3" /></Button>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">EAS Integration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { key: 'Project ID', val: '2a4f-8c3e-91d2' },
                { key: 'Connected', val: 'Yes' },
                { key: 'Android Keystore', val: 'Managed' },
                { key: 'iOS Cert', val: 'Managed' },
                { key: 'Last Sync', val: '2 min ago' },
              ].map(r => (
                <div key={r.key} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                  <span className="text-muted-foreground">{r.key}</span>
                  <span className="font-medium">{r.val}</span>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="text-xs h-7 mt-3 w-full"><Download className="size-3 mr-1" />Sync EAS Config</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Build Logs</CardTitle>
              <Terminal className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-950 rounded-lg p-3 font-mono text-[10px] space-y-1 max-h-48 overflow-y-auto">
              {buildLogs.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-slate-500">{l.time}</span>
                  <span className={`uppercase font-bold w-10 ${logColor[l.level]}`}>[{l.level}]</span>
                  <span className="text-slate-300">{l.msg}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
