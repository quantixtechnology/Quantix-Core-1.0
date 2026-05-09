'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Building2, Loader2, Clock, XCircle, CheckCircle2, ArrowRight,
  Key, Eye, RotateCcw,
} from 'lucide-react'

const stats = [
  { label: 'Provisioned', value: '8', icon: Building2, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'In Progress', value: '3', icon: Loader2, color: 'text-blue-600 bg-blue-50' },
  { label: 'Avg Time', value: '45 min', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  { label: 'Failed', value: '1', icon: XCircle, color: 'text-red-600 bg-red-50' },
]

const pipelineSteps = [
  { step: 1, name: 'Create Business', status: 'done' },
  { step: 2, name: 'Configure Store', status: 'done' },
  { step: 3, name: 'Setup Domain', status: 'done' },
  { step: 4, name: 'Deploy Web App', status: 'done' },
  { step: 5, name: 'Provision Database', status: 'done' },
  { step: 6, name: 'Build Mobile App', status: 'active' },
  { step: 7, name: 'Upload to Play Store', status: 'pending' },
  { step: 8, name: 'Configure Payments', status: 'pending' },
  { step: 9, name: 'Import Products', status: 'pending' },
  { step: 10, name: 'Go Live', status: 'pending' },
]

const activeJobs = [
  { id: 'PRV-011', business: 'QuickWash', currentStep: 6, totalSteps: 10, startedBy: 'Arjun M.', elapsed: '32 min' },
  { id: 'PRV-010', business: 'MediCare+', currentStep: 3, totalSteps: 10, startedBy: 'Priya S.', elapsed: '15 min' },
  { id: 'PRV-009', business: 'FitZone', currentStep: 8, totalSteps: 10, startedBy: 'Rahul K.', elapsed: '41 min' },
]

const stepColor: Record<string, string> = {
  done: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  active: 'bg-blue-100 text-blue-700 border-blue-300',
  pending: 'bg-gray-50 text-gray-400 border-gray-200',
  failed: 'bg-red-100 text-red-700 border-red-300',
}

export function TenantProvisioningView() {
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
          <CardTitle className="text-sm font-semibold">Provisioning Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {pipelineSteps.map((s, i) => (
              <div key={s.step} className="flex items-center gap-1 shrink-0">
                <div className={`px-2 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 ${stepColor[s.status]}`}>
                  {s.status === 'done' && <CheckCircle2 className="size-3" />}
                  {s.status === 'active' && <Loader2 className="size-3 animate-spin" />}
                  <span className="font-mono">{s.step}.</span> {s.name}
                </div>
                {i < pipelineSteps.length - 1 && <ArrowRight className="size-3 text-muted-foreground shrink-0" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Active Jobs</CardTitle>
            <Button variant="outline" size="sm" className="text-xs h-7"><Building2 className="size-3 mr-1" />New Provisioning</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {activeJobs.map(j => (
              <div key={j.id} className="p-3 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold">{j.id}</span>
                    <span className="text-sm font-medium">{j.business}</span>
                  </div>
                  <Badge className="text-[10px] bg-blue-100 text-blue-700">Step {j.currentStep}/{j.totalSteps}</Badge>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(j.currentStep / j.totalSteps) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{Math.round((j.currentStep / j.totalSteps) * 100)}%</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>By {j.startedBy}</span>
                  <span>Elapsed: {j.elapsed}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Credential Generation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              { type: 'API Keys', count: 8, active: 6, action: 'Generate New' },
              { type: 'Client Secrets', count: 4, active: 4, action: 'Rotate' },
              { type: 'Webhook URLs', count: 3, active: 3, action: 'Regenerate' },
              { type: 'Access Tokens', count: 12, active: 8, action: 'Refresh' },
            ].map(c => (
              <div key={c.type} className="p-3 rounded-lg border flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{c.type}</p>
                  <p className="text-[10px] text-muted-foreground">{c.active}/{c.count} active</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-xs"><Eye className="size-3 mr-1" />View</Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs"><Key className="size-3 mr-1" />{c.action}</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
