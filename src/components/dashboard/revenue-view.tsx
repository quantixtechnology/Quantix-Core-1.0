'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Wallet, RefreshCw, Clock, AlertTriangle,
  ArrowUpRight, Download, Eye, Calendar,
} from 'lucide-react'

const stats = [
  { label: 'Total Revenue', value: '₹14.98L', icon: Wallet, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Monthly Recurring', value: '₹1.87L', icon: RefreshCw, color: 'text-blue-600 bg-blue-50' },
  { label: 'Pending Payouts', value: '₹42,500', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  { label: 'Overdue', value: '₹8,200', icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
]

const revenueBreakdown = [
  { source: 'Subscriptions', amount: '₹1.12L', pct: 60 },
  { source: 'Setup Fees', amount: '₹38,500', pct: 20 },
  { source: 'Transaction Fees', amount: '₹22,800', pct: 12 },
  { source: 'Add-ons', amount: '₹13,700', pct: 8 },
]

const payoutHistory = [
  { id: 'PAY-015', business: 'FreshMart', amount: '₹18,200', method: 'UPI', status: 'completed', date: 'Jan 15' },
  { id: 'PAY-014', business: 'SpiceGarden', amount: '₹12,400', method: 'Bank Transfer', status: 'completed', date: 'Jan 14' },
  { id: 'PAY-013', business: 'CleanHome', amount: '₹8,900', method: 'UPI', status: 'processing', date: 'Jan 13' },
  { id: 'PAY-012', business: 'TechHub', amount: '₹5,600', method: 'Bank Transfer', status: 'completed', date: 'Jan 12' },
  { id: 'PAY-011', business: 'QuickWash', amount: '₹3,200', method: 'UPI', status: 'failed', date: 'Jan 11' },
]

const upcomingRenewals = [
  { business: 'FreshMart', plan: 'Enterprise', amount: '₹4,200', due: 'Jan 25', risk: 'low' },
  { business: 'CleanHome', plan: 'Professional', amount: '₹2,500', due: 'Jan 28', risk: 'low' },
  { business: 'TechHub', plan: 'Starter', amount: '₹1,200', due: 'Feb 1', risk: 'medium' },
  { business: 'QuickWash', plan: 'Professional', amount: '₹2,500', due: 'Feb 3', risk: 'high' },
]

const riskColor: Record<string, string> = {
  low: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
}

export function RevenueView() {
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
          <CardTitle className="text-sm font-semibold">Revenue Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {revenueBreakdown.map(r => (
              <div key={r.source} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span>{r.source}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{r.amount}</span>
                    <span className="text-muted-foreground">{r.pct}%</span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Payout History</CardTitle>
              <Button variant="outline" size="sm" className="text-xs h-7"><Download className="size-3 mr-1" />Export</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium text-muted-foreground">ID</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Business</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Amount</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Method</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutHistory.map(p => (
                    <tr key={p.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-mono">{p.id}</td>
                      <td className="p-2">{p.business}</td>
                      <td className="p-2 font-semibold">{p.amount}</td>
                      <td className="p-2"><Badge variant="outline" className="text-[10px]">{p.method}</Badge></td>
                      <td className="p-2"><Badge className={`text-[10px] ${p.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : p.status === 'processing' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{p.status}</Badge></td>
                      <td className="p-2 text-muted-foreground">{p.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Upcoming Renewals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingRenewals.map(r => (
                <div key={r.business} className="p-3 rounded-lg border flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{r.business}</p>
                    <p className="text-[10px] text-muted-foreground">{r.plan} · {r.amount}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Calendar className="size-3" />{r.due}
                    </div>
                    <Badge className={`text-[9px] mt-1 ${riskColor[r.risk]}`}>{r.risk} risk</Badge>
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
