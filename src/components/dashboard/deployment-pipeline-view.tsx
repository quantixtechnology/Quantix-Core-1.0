'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  GitBranch, Loader2, CheckCircle2, XCircle, ArrowRight, Package,
  Play, RotateCcw, Eye,
} from 'lucide-react'

const stats = [
  { label: 'Total', value: '47', icon: GitBranch, color: 'text-slate-600 bg-slate-50' },
  { label: 'In Progress', value: '4', icon: Loader2, color: 'text-blue-600 bg-blue-50' },
  { label: 'Successful', value: '38', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Failed', value: '5', icon: XCircle, color: 'text-red-600 bg-red-50' },
]

const deployments = [
  { id: 'DEP-047', app: 'FreshMart Admin', env: 'production', branch: 'main', commit: 'a3f2c1d', status: 'success', time: '3m 22s', deployer: 'Arjun M.', when: '2h ago' },
  { id: 'DEP-046', app: 'CleanHome Web', env: 'staging', branch: 'develop', commit: 'b7e4d2a', status: 'success', time: '2m 48s', deployer: 'Priya S.', when: '4h ago' },
  { id: 'DEP-045', app: 'SpiceGarden API', env: 'production', branch: 'main', commit: 'c1a9f3e', status: 'failed', time: '1m 05s', deployer: 'Rahul K.', when: '6h ago' },
  { id: 'DEP-044', app: 'TechHub Mobile', env: 'preview', branch: 'feat/payments', commit: 'd4b2e7c', status: 'deploying', time: '—', deployer: 'Arjun M.', when: '12m ago' },
  { id: 'DEP-043', app: 'FreshMart POS', env: 'production', branch: 'main', commit: 'e8c5f1a', status: 'success', time: '4m 11s', deployer: 'Sneha R.', when: '1d ago' },
  { id: 'DEP-042', app: 'CleanHome Admin', env: 'staging', branch: 'fix/auth', commit: 'f2d6a3b', status: 'success', time: '2m 55s', deployer: 'Priya S.', when: '1d ago' },
  { id: 'DEP-041', app: 'SpiceGarden Web', env: 'production', branch: 'main', commit: 'a1b3c5d', status: 'failed', time: '0m 48s', deployer: 'Rahul K.', when: '2d ago' },
  { id: 'DEP-040', app: 'TechHub Admin', env: 'staging', branch: 'develop', commit: 'b2c4d6e', status: 'success', time: '3m 07s', deployer: 'Arjun M.', when: '2d ago' },
]

const statusConfig: Record<string, { badge: string; icon: React.ReactNode }> = {
  success: { badge: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="size-3" /> },
  failed: { badge: 'bg-red-100 text-red-700', icon: <XCircle className="size-3" /> },
  deploying: { badge: 'bg-blue-100 text-blue-700', icon: <Loader2 className="size-3 animate-spin" /> },
  queued: { badge: 'bg-gray-100 text-gray-700', icon: <Package className="size-3" /> },
}

const flowSteps = ['Commit', 'Build', 'Test', 'Stage', 'Deploy', 'Verify']

export function DeploymentPipelineView() {
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
          <CardTitle className="text-sm font-semibold">Status Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {flowSteps.map((step, i) => (
              <div key={step} className="flex items-center gap-1 shrink-0">
                <div className="px-3 py-1.5 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-700 text-xs font-medium">{step}</div>
                {i < flowSteps.length - 1 && <ArrowRight className="size-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Deployment Queue</CardTitle>
            <Button variant="outline" size="sm" className="text-xs h-7"><RotateCcw className="size-3 mr-1" />Retry Failed</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">ID</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">App</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Env</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Branch</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Commit</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Time</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">By</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {deployments.map(d => (
                  <tr key={d.id} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-mono">{d.id}</td>
                    <td className="p-2 font-medium">{d.app}</td>
                    <td className="p-2"><Badge variant="outline" className="text-[10px]">{d.env}</Badge></td>
                    <td className="p-2 font-mono text-muted-foreground">{d.branch}</td>
                    <td className="p-2 font-mono text-muted-foreground">{d.commit}</td>
                    <td className="p-2"><Badge className={`text-[10px] gap-1 ${statusConfig[d.status].badge}`}>{statusConfig[d.status].icon}{d.status}</Badge></td>
                    <td className="p-2 text-muted-foreground">{d.time}</td>
                    <td className="p-2">{d.deployer}</td>
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
          <CardTitle className="text-sm font-semibold">Artifact Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { name: 'FreshMart v2.1.3', size: '24.5 MB', type: 'APK', hash: 'sha256:a3f2...' },
              { name: 'CleanHome v1.8.0', size: '18.2 MB', type: 'Web Bundle', hash: 'sha256:b7e4...' },
              { name: 'SpiceGarden v3.0.1', size: '31.8 MB', type: 'AAB', hash: 'sha256:c1a9...' },
              { name: 'TechHub v1.2.0', size: '22.1 MB', type: 'APK', hash: 'sha256:d4b2...' },
            ].map(a => (
              <div key={a.name} className="p-3 rounded-lg border">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="size-3 text-muted-foreground" />
                  <span className="text-sm font-medium truncate">{a.name}</span>
                </div>
                <div className="text-[10px] text-muted-foreground space-y-0.5">
                  <p>{a.type} · {a.size}</p>
                  <p className="font-mono">{a.hash}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
