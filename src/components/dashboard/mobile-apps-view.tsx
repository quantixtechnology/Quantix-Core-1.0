'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  MonitorSmartphone, Loader2, Clock, Radio,
  Eye, Download, Hammer, Palette,
} from 'lucide-react'

const stats = [
  { label: 'Brands', value: '4', icon: Palette, color: 'text-purple-600 bg-purple-50' },
  { label: 'Active Builds', value: '2', icon: Hammer, color: 'text-blue-600 bg-blue-50' },
  { label: 'Pending', value: '1', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  { label: 'Channels', value: '3', icon: Radio, color: 'text-emerald-600 bg-emerald-50' },
]

const brands = [
  { name: 'FreshMart', color: '#10B981', bgColor: '#D1FAE5', buildVersion: 'v2.1.3', buildStatus: 'published', platform: 'Android + Web', bundleId: 'com.quantix.freshmart', lastBuild: '2h ago' },
  { name: 'CleanHome', color: '#3B82F6', bgColor: '#DBEAFE', buildVersion: 'v1.8.0', buildStatus: 'building', platform: 'Android + iOS + Web', bundleId: 'com.quantix.cleanhome', lastBuild: '4h ago' },
  { name: 'SpiceGarden', color: '#F59E0B', bgColor: '#FEF3C7', buildVersion: 'v3.0.0', buildStatus: 'preview', platform: 'Android', bundleId: 'com.quantix.spicegarden', lastBuild: '1d ago' },
  { name: 'TechHub', color: '#8B5CF6', bgColor: '#EDE9FE', buildVersion: 'v1.2.0', buildStatus: 'published', platform: 'Android + Web', bundleId: 'com.quantix.techhub', lastBuild: '3d ago' },
]

const statusColor: Record<string, string> = {
  published: 'bg-emerald-100 text-emerald-700',
  building: 'bg-blue-100 text-blue-700',
  preview: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
}

const easInfo = [
  { key: 'Account', value: 'Quantix (Production)' },
  { key: 'Plan', value: 'Production (30 builds/mo)' },
  { key: 'Builds Used', value: '18 / 30' },
  { key: 'Android Keystore', value: 'Managed (auto)' },
  { key: 'iOS Certificate', value: 'Managed (auto)' },
  { key: 'Auto-Submit', value: 'Enabled' },
]

export function MobileAppsView() {
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
          <CardTitle className="text-sm font-semibold">Brand Apps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {brands.map(b => (
              <div key={b.name} className="p-4 rounded-lg border">
                <div className="flex items-center gap-3 mb-3">
                  <div className="size-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: b.color }}>
                    {b.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{b.name}</span>
                      <Badge className={`text-[10px] ${statusColor[b.buildStatus]}`}>{b.buildStatus}</Badge>
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground">{b.bundleId}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div><span className="text-muted-foreground">Version:</span> <span className="font-mono">{b.buildVersion}</span></div>
                  <div><span className="text-muted-foreground">Platform:</span> {b.platform}</div>
                  <div><span className="text-muted-foreground">Last Build:</span> {b.lastBuild}</div>
                  <div><span className="text-muted-foreground">Theme:</span> <div className="inline-flex items-center gap-1"><div className="size-3 rounded-full border" style={{ backgroundColor: b.color }} /></div></div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="text-xs h-7 flex-1"><Hammer className="size-3 mr-1" />Build</Button>
                  <Button variant="outline" size="sm" className="text-xs h-7 flex-1"><Download className="size-3 mr-1" />Download</Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Eye className="size-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">EAS Build Info</CardTitle>
            <MonitorSmartphone className="size-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {easInfo.map(e => (
              <div key={e.key} className="p-3 rounded-lg border">
                <p className="text-[10px] text-muted-foreground">{e.key}</p>
                <p className="text-sm font-medium">{e.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Monthly Build Quota</span>
              <span>18 / 30</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: '60%' }} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
