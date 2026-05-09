'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tags, Package, AlertTriangle, ShieldCheck, Plus, Eye,
  Download, RotateCcw,
} from 'lucide-react'

const stats = [
  { label: 'Total Releases', value: '28', icon: Tags, color: 'text-slate-600 bg-slate-50' },
  { label: 'Latest', value: 'v2.1.3', icon: Package, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Hotfixes', value: '2', icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
  { label: 'Mandatory', value: '1', icon: ShieldCheck, color: 'text-red-600 bg-red-50' },
]

const releases = [
  { version: 'v2.1.3', app: 'FreshMart Mobile', type: 'minor', status: 'released', rollout: 100, date: 'Jan 15', notes: 'Added UPI intent flow, GST fixes' },
  { version: 'v2.1.2', app: 'FreshMart Mobile', type: 'patch', status: 'released', rollout: 100, date: 'Jan 12', notes: 'Fixed payment timeout on slow networks' },
  { version: 'v2.1.1', app: 'CleanHome Web', type: 'patch', status: 'released', rollout: 100, date: 'Jan 10', notes: 'Hotfix: Auth token refresh bug' },
  { version: 'v3.0.0', app: 'SpiceGarden Mobile', type: 'major', status: 'rollout', rollout: 25, date: 'Jan 9', notes: 'Complete UI overhaul, new menu system' },
  { version: 'v1.8.0', app: 'TechHub Admin', type: 'minor', status: 'released', rollout: 100, date: 'Jan 7', notes: 'Dashboard redesign, analytics v2' },
  { version: 'v2.1.0', app: 'FreshMart POS', type: 'minor', status: 'released', rollout: 100, date: 'Jan 5', notes: 'Offline mode, receipt template editor' },
  { version: 'v1.2.3', app: 'CleanHome Mobile', type: 'patch', status: 'halted', rollout: 40, date: 'Jan 3', notes: 'HALTED: Crash on Android 11 devices' },
  { version: 'v1.7.0', app: 'SpiceGarden Web', type: 'minor', status: 'released', rollout: 100, date: 'Dec 28', notes: 'Order scheduling, bulk edit products' },
]

const typeColor: Record<string, string> = {
  major: 'bg-red-100 text-red-700',
  minor: 'bg-blue-100 text-blue-700',
  patch: 'bg-gray-100 text-gray-700',
}

const statusColor: Record<string, string> = {
  released: 'bg-emerald-100 text-emerald-700',
  rollout: 'bg-amber-100 text-amber-700',
  halted: 'bg-red-100 text-red-700',
}

export function ReleaseManagementView() {
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
            <CardTitle className="text-sm font-semibold">Release History</CardTitle>
            <Button variant="outline" size="sm" className="text-xs h-7"><Plus className="size-3 mr-1" />New Release</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">Version</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">App</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Type</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Rollout</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Date</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Notes</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {releases.map(r => (
                  <tr key={`${r.version}-${r.app}`} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-mono font-semibold">{r.version}</td>
                    <td className="p-2">{r.app}</td>
                    <td className="p-2"><Badge className={`text-[10px] ${typeColor[r.type]}`}>{r.type}</Badge></td>
                    <td className="p-2"><Badge className={`text-[10px] ${statusColor[r.status]}`}>{r.status}</Badge></td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${r.status === 'halted' ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${r.rollout}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{r.rollout}%</span>
                      </div>
                    </td>
                    <td className="p-2 text-muted-foreground">{r.date}</td>
                    <td className="p-2 text-muted-foreground max-w-[200px] truncate">{r.notes}</td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><Eye className="size-3" /></Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><RotateCcw className="size-3" /></Button>
                      </div>
                    </td>
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
            <CardTitle className="text-sm font-semibold">Phased Rollout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { app: 'SpiceGarden Mobile', version: 'v3.0.0', current: 25, target: 100, next: '50% → Jan 12' },
                { app: 'CleanHome Mobile', version: 'v1.2.3', current: 40, target: 0, next: 'HALTED — investigating' },
              ].map(p => (
                <div key={p.app} className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{p.app}</span>
                    <span className="font-mono text-xs text-muted-foreground">{p.version}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${p.target === 0 ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${p.current}%` }} />
                    </div>
                    <span className="text-xs font-medium">{p.current}%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Next: {p.next}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Hotfix Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { id: 'HF-002', version: 'v2.1.1', app: 'CleanHome Web', severity: 'critical', status: 'deployed', fix: 'Auth token refresh loop' },
                { id: 'HF-001', version: 'v2.0.9', app: 'FreshMart Mobile', severity: 'high', status: 'deployed', fix: 'Payment gateway timeout' },
              ].map(h => (
                <div key={h.id} className="p-3 rounded-lg border">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-semibold">{h.id}</span>
                    <Badge className={`text-[10px] ${h.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{h.severity}</Badge>
                    <Badge className="text-[10px] bg-emerald-100 text-emerald-700">{h.status}</Badge>
                  </div>
                  <p className="text-xs">{h.app} — {h.version}</p>
                  <p className="text-[10px] text-muted-foreground">Fix: {h.fix}</p>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="text-xs h-7 mt-3 w-full"><Plus className="size-3 mr-1" />Create Hotfix</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
