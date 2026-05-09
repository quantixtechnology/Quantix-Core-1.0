'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  TrendingUp, BarChart3, Building2, Wallet,
  ArrowUpRight, ArrowDownRight, Eye,
} from 'lucide-react'

const stats = [
  { label: 'Revenue', value: '₹14.98L', icon: Wallet, color: 'text-emerald-600 bg-emerald-50', change: '+8.2%' },
  { label: 'MRR Growth', value: '+12.5%', icon: TrendingUp, color: 'text-blue-600 bg-blue-50', change: '+2.1%' },
  { label: 'Active Biz', value: '8', icon: Building2, color: 'text-amber-600 bg-amber-50', change: '+1' },
  { label: 'Avg/Biz', value: '₹18.7K', icon: BarChart3, color: 'text-purple-600 bg-purple-50', change: '+₹1.2K' },
]

const revenueMonths = [
  { month: 'Aug', value: 9.2 },
  { month: 'Sep', value: 10.1 },
  { month: 'Oct', value: 11.4 },
  { month: 'Nov', value: 12.8 },
  { month: 'Dec', value: 13.9 },
  { month: 'Jan', value: 14.98 },
]

const businessTypes = [
  { type: 'Restaurant', count: 3, pct: 37.5, color: 'bg-emerald-500' },
  { type: 'Retail', count: 2, pct: 25, color: 'bg-blue-500' },
  { type: 'Services', count: 2, pct: 25, color: 'bg-amber-500' },
  { type: 'Other', count: 1, pct: 12.5, color: 'bg-purple-500' },
]

const leadFunnel = [
  { stage: 'Leads', count: 42 },
  { stage: 'Contacted', count: 28 },
  { stage: 'Demo', count: 18 },
  { stage: 'Proposal', count: 12 },
  { stage: 'Closed', count: 8 },
]

const topBusinesses = [
  { name: 'FreshMart', type: 'Restaurant', mrr: '₹4,200', growth: '+15%', health: 92 },
  { name: 'SpiceGarden', type: 'Restaurant', mrr: '₹3,800', growth: '+22%', health: 88 },
  { name: 'CleanHome', type: 'Services', mrr: '₹2,500', growth: '+8%', health: 95 },
  { name: 'TechHub', type: 'Retail', mrr: '₹2,200', growth: '+5%', health: 78 },
]

export function PlatformAnalyticsView() {
  const maxRev = Math.max(...revenueMonths.map(m => m.value))
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
                <p className="text-[10px] text-emerald-600 flex items-center gap-0.5"><ArrowUpRight className="size-2.5" />{s.change}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue Trend (₹ Lakhs)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-40">
              {revenueMonths.map(m => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-medium">{m.value}</span>
                  <div className="w-full bg-emerald-500 rounded-t-sm transition-all" style={{ height: `${(m.value / maxRev) * 120}px` }} />
                  <span className="text-[10px] text-muted-foreground">{m.month}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Business Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {businessTypes.map(b => (
                <div key={b.type} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`size-3 rounded ${b.color}`} />
                      <span>{b.type}</span>
                    </div>
                    <span className="text-muted-foreground">{b.count} ({b.pct}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${b.color}`} style={{ width: `${b.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Lead Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {leadFunnel.map((l, i) => (
                <div key={l.stage} className="flex items-center gap-3">
                  <span className="text-xs w-20 text-muted-foreground">{l.stage}</span>
                  <div className="flex-1 h-6 bg-muted rounded overflow-hidden relative">
                    <div className="h-full bg-emerald-500 rounded transition-all" style={{ width: `${(l.count / 42) * 100}%`, opacity: 1 - i * 0.15 }} />
                    <span className="absolute inset-0 flex items-center pl-2 text-[10px] font-medium">{l.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top Businesses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topBusinesses.map(b => (
                <div key={b.name} className="p-2 rounded-lg border flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="text-[10px] text-muted-foreground">{b.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{b.mrr}</p>
                    <p className="text-[10px] text-emerald-600">{b.growth}</p>
                  </div>
                  <div className="w-12">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${b.health}%` }} />
                    </div>
                    <p className="text-[8px] text-muted-foreground text-center mt-0.5">{b.health}%</p>
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
