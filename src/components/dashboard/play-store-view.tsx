'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  MonitorSmartphone, Clock, XCircle, Download, Upload,
  ShieldCheck, FileCheck, Eye,
} from 'lucide-react'

const stats = [
  { label: 'Published', value: '4', icon: MonitorSmartphone, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'In Review', value: '1', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  { label: 'Rejected', value: '0', icon: XCircle, color: 'text-red-600 bg-red-50' },
  { label: 'Installs', value: '12.5K', icon: Download, color: 'text-blue-600 bg-blue-50' },
]

const apps = [
  { name: 'FreshMart', pkg: 'com.quantix.freshmart', version: 'v2.1.3', status: 'published', installs: '5.2K', rating: 4.3, updated: 'Jan 15' },
  { name: 'CleanHome', pkg: 'com.quantix.cleanhome', version: 'v1.8.0', status: 'in_review', installs: '3.8K', rating: 4.1, updated: 'Jan 10' },
  { name: 'SpiceGarden', pkg: 'com.quantix.spicegarden', version: 'v2.0.1', status: 'published', installs: '2.1K', rating: 4.5, updated: 'Jan 7' },
  { name: 'TechHub', pkg: 'com.quantix.techhub', version: 'v1.2.0', status: 'published', installs: '1.4K', rating: 4.0, updated: 'Dec 28' },
  { name: 'FreshMart POS', pkg: 'com.quantix.freshmart.pos', version: 'v2.1.0', status: 'published', installs: '0.8K', rating: 4.4, updated: 'Jan 5' },
]

const statusColor: Record<string, string> = {
  published: 'bg-emerald-100 text-emerald-700',
  in_review: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
  draft: 'bg-gray-100 text-gray-700',
}

const checklist = [
  { item: 'App signing key', done: true },
  { item: 'Store listing (title, desc, icons)', done: true },
  { item: 'Screenshots (min 4)', done: true },
  { item: 'Content rating questionnaire', done: true },
  { item: 'Privacy policy URL', done: true },
  { item: 'Data safety declaration', done: true },
  { item: 'Target API level 34+', done: true },
  { item: 'AAB format upload', done: false },
]

export function PlayStoreView() {
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
            <CardTitle className="text-sm font-semibold">App Listings</CardTitle>
            <Button variant="outline" size="sm" className="text-xs h-7"><Upload className="size-3 mr-1" />New Submission</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">App</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Package</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Version</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Installs</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Rating</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Updated</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {apps.map(a => (
                  <tr key={a.pkg} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-medium">{a.name}</td>
                    <td className="p-2 font-mono text-muted-foreground">{a.pkg}</td>
                    <td className="p-2 font-mono">{a.version}</td>
                    <td className="p-2"><Badge className={`text-[10px] ${statusColor[a.status]}`}>{a.status.replace('_', ' ')}</Badge></td>
                    <td className="p-2">{a.installs}</td>
                    <td className="p-2">⭐ {a.rating}</td>
                    <td className="p-2 text-muted-foreground">{a.updated}</td>
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
            <CardTitle className="text-sm font-semibold">Submission Checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {checklist.map(c => (
                <div key={c.item} className="flex items-center gap-2 text-xs py-1">
                  <FileCheck className={`size-3 ${c.done ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                  <span className={c.done ? '' : 'text-muted-foreground'}>{c.item}</span>
                  {c.done && <Badge className="text-[9px] bg-emerald-100 text-emerald-700 ml-auto">Done</Badge>}
                  {!c.done && <Badge className="text-[9px] bg-amber-100 text-amber-700 ml-auto">Pending</Badge>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Signing Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { app: 'FreshMart', keystore: 'Managed', sha1: 'A1:B2:C3...:F1', expires: 'Oct 2027' },
                { app: 'CleanHome', keystore: 'Managed', sha1: 'D4:E5:F6...:A2', expires: 'Mar 2028' },
                { app: 'SpiceGarden', keystore: 'Managed', sha1: 'G7:H8:I9...:B3', expires: 'Jun 2028' },
                { app: 'TechHub', keystore: 'Upload', sha1: 'J0:K1:L2...:C4', expires: 'Dec 2027' },
              ].map(s => (
                <div key={s.app} className="p-2 rounded-lg border flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{s.app}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">SHA1: {s.sha1}</p>
                  </div>
                  <div className="text-right">
                    <Badge className="text-[10px] bg-emerald-100 text-emerald-700">{s.keystore}</Badge>
                    <p className="text-[10px] text-muted-foreground mt-1">Exp: {s.expires}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="text-xs h-7 mt-3 w-full"><ShieldCheck className="size-3 mr-1" />Manage Keystores</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
