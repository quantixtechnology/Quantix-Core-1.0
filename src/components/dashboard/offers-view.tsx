'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tag, Ticket, TrendingUp, Percent,
  Plus, Eye, Copy, ToggleLeft,
} from 'lucide-react'

const stats = [
  { label: 'Active', value: '5', icon: Tag, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Redemptions', value: '2,847', icon: Ticket, color: 'text-blue-600 bg-blue-50' },
  { label: 'Impact', value: '₹1.2L', icon: TrendingUp, color: 'text-purple-600 bg-purple-50' },
  { label: 'Discount', value: '15%', icon: Percent, color: 'text-amber-600 bg-amber-50' },
]

const offers = [
  { code: 'NEWYEAR25', name: 'New Year Sale', type: 'Percentage', value: '25% off', minOrder: '₹500', redemptions: 842, maxRedemptions: 1000, status: 'active', expires: 'Jan 31' },
  { code: 'WELCOME10', name: 'First Order', type: 'Percentage', value: '10% off', minOrder: '₹200', redemptions: 1205, maxRedemptions: '∞', status: 'active', expires: 'No expiry' },
  { code: 'FLAT100', name: 'Flat Discount', type: 'Flat', value: '₹100 off', minOrder: '₹600', redemptions: 456, maxRedemptions: 500, status: 'active', expires: 'Feb 15' },
  { code: 'LOYALTY15', name: 'Loyalty Bonus', type: 'Percentage', value: '15% off', minOrder: '₹300', redemptions: 234, maxRedemptions: '∞', status: 'active', expires: 'Mar 31' },
  { code: 'FREEDELIVERY', name: 'Free Delivery', type: 'Delivery', value: '₹0 delivery', minOrder: '₹400', redemptions: 110, maxRedemptions: 200, status: 'active', expires: 'Jan 20' },
  { code: 'SUMMER20', name: 'Summer Sale', type: 'Percentage', value: '20% off', minOrder: '₹800', redemptions: 0, maxRedemptions: 500, status: 'scheduled', expires: 'Apr 1' },
  { code: 'REFER50', name: 'Referral', type: 'Flat', value: '₹50 off', minOrder: '₹250', redemptions: 0, maxRedemptions: '∞', status: 'draft', expires: 'TBD' },
  { code: 'BULK15', name: 'Bulk Order', type: 'Percentage', value: '15% off', minOrder: '₹2,000', redemptions: 0, maxRedemptions: 100, status: 'draft', expires: 'TBD' },
]

const statusColor: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  scheduled: 'bg-blue-100 text-blue-700',
  draft: 'bg-gray-100 text-gray-700',
  expired: 'bg-red-100 text-red-700',
}

const topPerformers = [
  { code: 'WELCOME10', redemptions: 1205, revenue: '₹42K', convRate: '8.2%' },
  { code: 'NEWYEAR25', redemptions: 842, revenue: '₹38K', convRate: '6.5%' },
  { code: 'FLAT100', redemptions: 456, revenue: '₹22K', convRate: '5.1%' },
]

export function OffersView() {
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
            <CardTitle className="text-sm font-semibold">Offers</CardTitle>
            <Button variant="outline" size="sm" className="text-xs h-7"><Plus className="size-3 mr-1" />Create Offer</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">Code</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Value</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Min Order</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Redemptions</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Expires</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {offers.map(o => (
                  <tr key={o.code} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-mono font-semibold">{o.code}</td>
                    <td className="p-2">{o.name}</td>
                    <td className="p-2"><Badge variant="outline" className="text-[10px]">{o.value}</Badge></td>
                    <td className="p-2">{o.minOrder}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <span>{o.redemptions}</span>
                        <span className="text-muted-foreground">/ {o.maxRedemptions}</span>
                      </div>
                    </td>
                    <td className="p-2"><Badge className={`text-[10px] ${statusColor[o.status]}`}>{o.status}</Badge></td>
                    <td className="p-2 text-muted-foreground">{o.expires}</td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><Eye className="size-3" /></Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><Copy className="size-3" /></Button>
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
            <CardTitle className="text-sm font-semibold">Quick Create</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Offer Name</label>
                  <input className="w-full px-2 py-1.5 text-xs rounded-md border" placeholder="e.g., Flash Sale" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Code</label>
                  <input className="w-full px-2 py-1.5 text-xs rounded-md border" placeholder="e.g., FLASH20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Discount</label>
                  <input className="w-full px-2 py-1.5 text-xs rounded-md border" placeholder="20%" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Min Order</label>
                  <input className="w-full px-2 py-1.5 text-xs rounded-md border" placeholder="₹500" />
                </div>
              </div>
              <Button size="sm" className="text-xs h-7 w-full"><Plus className="size-3 mr-1" />Create Offer</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top Performers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topPerformers.map((t, i) => (
                <div key={t.code} className="p-3 rounded-lg border flex items-center gap-3">
                  <span className="text-lg font-bold text-muted-foreground w-6">#{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-mono font-semibold">{t.code}</p>
                    <p className="text-[10px] text-muted-foreground">{t.redemptions} redemptions</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{t.revenue}</p>
                    <p className="text-[10px] text-emerald-600">{t.convRate} conv.</p>
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
