'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Megaphone, Eye, Target, TrendingUp,
  Plus, Calendar, Clock,
} from 'lucide-react'

const stats = [
  { label: 'Campaigns', value: '3', icon: Megaphone, color: 'text-purple-600 bg-purple-50' },
  { label: 'Reach', value: '12,450', icon: Eye, color: 'text-blue-600 bg-blue-50' },
  { label: 'Conversions', value: '342', icon: Target, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'ROI', value: '285%', icon: TrendingUp, color: 'text-amber-600 bg-amber-50' },
]

const campaigns = [
  { name: 'New Year Sale', type: 'Discount', status: 'active', reach: '5,200', conversions: 142, spend: '₹8,500', roi: '312%', dates: 'Jan 1–15' },
  { name: 'Welcome Offer', type: 'First Order', status: 'active', reach: '4,120', conversions: 118, spend: '₹5,200', roi: '285%', dates: 'Ongoing' },
  { name: 'Loyalty Bonus', type: 'Retention', status: 'active', reach: '3,130', conversions: 82, spend: '₹3,800', roi: '248%', dates: 'Jan 10–31' },
  { name: 'Flash Friday', type: 'Flash Sale', status: 'scheduled', reach: '—', conversions: 0, spend: '₹2,000', roi: '—', dates: 'Jan 19' },
  { name: 'Referral Drive', type: 'Referral', status: 'scheduled', reach: '—', conversions: 0, spend: '₹4,000', roi: '—', dates: 'Feb 1–14' },
]

const statusColor: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  scheduled: 'bg-blue-100 text-blue-700',
  paused: 'bg-amber-100 text-amber-700',
  ended: 'bg-gray-100 text-gray-700',
}

const performanceMetrics = [
  { metric: 'Click Rate', value: '8.2%', trend: '+1.3%' },
  { metric: 'Conv. Rate', value: '2.7%', trend: '+0.4%' },
  { metric: 'CPA', value: '₹48', trend: '-₹5' },
  { metric: 'Avg Order', value: '₹385', trend: '+₹22' },
]

export function MarketingView() {
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
            <CardTitle className="text-sm font-semibold">Campaigns</CardTitle>
            <Button variant="outline" size="sm" className="text-xs h-7"><Plus className="size-3 mr-1" />New Campaign</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {campaigns.map(c => (
              <div key={c.name} className="p-3 rounded-lg border flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{c.name}</span>
                    <Badge variant="outline" className="text-[10px]">{c.type}</Badge>
                    <Badge className={`text-[10px] ${statusColor[c.status]}`}>{c.status}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span><Calendar className="size-3 inline mr-0.5" />{c.dates}</span>
                    <span>Reach: {c.reach}</span>
                    <span>Conv: {c.conversions}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{c.spend}</p>
                  <p className="text-[10px] text-emerald-600">ROI: {c.roi}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {performanceMetrics.map(m => (
                <div key={m.metric} className="p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground">{m.metric}</p>
                  <p className="text-xl font-bold">{m.value}</p>
                  <p className="text-[10px] text-emerald-600">{m.trend}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Scheduled Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {campaigns.filter(c => c.status === 'scheduled').map(c => (
                <div key={c.name} className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{c.name}</span>
                    <Badge className="text-[10px] bg-blue-100 text-blue-700">{c.type}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Clock className="size-3" />
                    <span>Scheduled: {c.dates}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Button variant="outline" size="sm" className="text-xs h-7 flex-1">Edit</Button>
                    <Button variant="outline" size="sm" className="text-xs h-7 flex-1">Preview</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
