'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  MessageSquare, Clock, CheckCircle2, ThumbsUp,
  AlertCircle, AlertTriangle, Info, Eye, Filter,
} from 'lucide-react'

const stats = [
  { label: 'Open', value: '12', icon: MessageSquare, color: 'text-blue-600 bg-blue-50' },
  { label: 'Avg Response', value: '2.4h', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  { label: 'Resolved Today', value: '8', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Satisfaction', value: '94%', icon: ThumbsUp, color: 'text-purple-600 bg-purple-50' },
]

const priorityConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  critical: { color: 'bg-red-100 text-red-700', icon: <AlertCircle className="size-3" /> },
  high: { color: 'bg-orange-100 text-orange-700', icon: <AlertTriangle className="size-3" /> },
  medium: { color: 'bg-amber-100 text-amber-700', icon: <Info className="size-3" /> },
  low: { color: 'bg-blue-100 text-blue-700', icon: <MessageSquare className="size-3" /> },
}

const tickets = [
  { id: 'TKT-142', subject: 'Payment gateway not responding', business: 'FreshMart', priority: 'critical', status: 'open', assignee: 'Arjun M.', created: '1h ago' },
  { id: 'TKT-141', subject: 'Product import CSV failing', business: 'SpiceGarden', priority: 'high', status: 'in_progress', assignee: 'Priya S.', created: '3h ago' },
  { id: 'TKT-140', subject: 'Logo upload not working', business: 'TechHub', priority: 'medium', status: 'open', assignee: '—', created: '5h ago' },
  { id: 'TKT-139', subject: 'Receipt font size too small', business: 'FreshMart', priority: 'low', status: 'in_progress', assignee: 'Rahul K.', created: '8h ago' },
  { id: 'TKT-138', subject: 'Delivery zone radius update', business: 'CleanHome', priority: 'medium', status: 'open', assignee: '—', created: '12h ago' },
  { id: 'TKT-137', subject: 'Subscription renewal failed', business: 'QuickWash', priority: 'high', status: 'open', assignee: 'Arjun M.', created: '1d ago' },
  { id: 'TKT-136', subject: 'POS offline mode issue', business: 'FreshMart', priority: 'critical', status: 'in_progress', assignee: 'Sneha R.', created: '1d ago' },
  { id: 'TKT-135', subject: 'Staff cannot login', business: 'SpiceGarden', priority: 'high', status: 'resolved', assignee: 'Priya S.', created: '2d ago' },
]

const statusColor: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved: 'bg-emerald-100 text-emerald-700',
}

const priorityCounts = [
  { priority: 'Critical', count: 2, color: 'text-red-600' },
  { priority: 'High', count: 3, color: 'text-orange-600' },
  { priority: 'Medium', count: 4, color: 'text-amber-600' },
  { priority: 'Low', count: 3, color: 'text-blue-600' },
]

export function SupportView() {
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

      <div className="grid md:grid-cols-4 gap-4">
        {priorityCounts.map(p => (
          <div key={p.priority} className="p-3 rounded-lg border flex items-center justify-between">
            <span className={`text-sm font-medium ${p.color}`}>{p.priority}</span>
            <span className="text-lg font-bold">{p.count}</span>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Support Tickets</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs h-7"><Filter className="size-3 mr-1" />Filter</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">ID</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Subject</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Business</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Priority</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Assignee</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Created</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => (
                  <tr key={t.id} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-mono">{t.id}</td>
                    <td className="p-2 font-medium max-w-[200px] truncate">{t.subject}</td>
                    <td className="p-2">{t.business}</td>
                    <td className="p-2"><Badge className={`text-[10px] gap-1 ${priorityConfig[t.priority].color}`}>{priorityConfig[t.priority].icon}{t.priority}</Badge></td>
                    <td className="p-2"><Badge className={`text-[10px] ${statusColor[t.status]}`}>{t.status.replace('_', ' ')}</Badge></td>
                    <td className="p-2">{t.assignee}</td>
                    <td className="p-2 text-muted-foreground">{t.created}</td>
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
