'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Gift, TrendingUp, ArrowUpRight, ArrowDownRight,
  Zap, Users, Award, Crown,
} from 'lucide-react'

const stats = [
  { label: 'Enrolled Members', value: '856', icon: Users, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Points Issued', value: '1.42L', icon: Zap, color: 'text-blue-600 bg-blue-50' },
  { label: 'Points Redeemed', value: '89K', icon: Gift, color: 'text-amber-600 bg-amber-50' },
  { label: 'Redemption Rate', value: '63%', icon: TrendingUp, color: 'text-purple-600 bg-purple-50' },
]

const tiers = [
  { name: 'BRONZE', color: 'from-amber-700 to-amber-500', textColor: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', members: 412, minPoints: 0, icon: Award, benefits: '1x earn rate, Birthday bonus' },
  { name: 'SILVER', color: 'from-gray-400 to-gray-300', textColor: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', members: 268, minPoints: 500, icon: Award, benefits: '1.5x earn rate, Free delivery monthly' },
  { name: 'GOLD', color: 'from-yellow-500 to-yellow-400', textColor: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', members: 128, minPoints: 2000, icon: Crown, benefits: '2x earn rate, Priority support, Exclusive offers' },
  { name: 'PLATINUM', color: 'from-slate-600 to-slate-400', textColor: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', members: 48, minPoints: 5000, icon: Crown, benefits: '3x earn rate, Personal concierge, VIP events' },
]

const recentActivity = [
  { customer: 'Rajesh K.', type: 'earn', points: 120, desc: 'Order #1247 purchase', date: '2 min ago' },
  { customer: 'Priya S.', type: 'redeem', points: 500, desc: 'Free delivery coupon', date: '15 min ago' },
  { customer: 'Amit M.', type: 'earn', points: 340, desc: 'Order #1245 purchase', date: '1 hr ago' },
  { customer: 'Neha R.', type: 'earn', points: 85, desc: 'Review bonus', date: '2 hr ago' },
  { customer: 'Vikram D.', type: 'redeem', points: 1000, desc: '₹100 discount voucher', date: '3 hr ago' },
  { customer: 'Sana P.', type: 'earn', points: 200, desc: 'Order #1240 purchase', date: '5 hr ago' },
  { customer: 'Arjun T.', type: 'redeem', points: 750, desc: 'Free product reward', date: '6 hr ago' },
  { customer: 'Deepa N.', type: 'earn', points: 150, desc: 'Referral bonus', date: '8 hr ago' },
]

const rewardCatalog = [
  { name: 'Free Delivery', points: 250, type: 'delivery', icon: '🚚' },
  { name: '₹50 Discount', points: 500, type: 'discount', icon: '🏷️' },
  { name: '₹100 Discount', points: 1000, type: 'discount', icon: '🏷️' },
  { name: 'Free Product (under ₹200)', points: 1500, type: 'product', icon: '🎁' },
  { name: '₹250 Discount', points: 2500, type: 'discount', icon: '🏷️' },
  { name: 'VIP Experience', points: 5000, type: 'experience', icon: '👑' },
]

const loyaltyRules = [
  { label: 'Earn Rate', value: '1 point per ₹10 spent', detail: 'Varies by tier' },
  { label: 'Redeem Rate', value: '1 point = ₹0.20', detail: 'Minimum 250 points' },
  { label: 'Signup Bonus', value: '100 points', detail: 'On first enrollment' },
  { label: 'Birthday Bonus', value: '2x points', detail: 'For 24 hours on birthday' },
  { label: 'Review Bonus', value: '50 points', detail: 'Per verified review' },
  { label: 'Referral Bonus', value: '150 points', detail: 'When referral completes order' },
]

const topCustomers = [
  { name: 'Priya Sharma', tier: 'PLATINUM', points: 8450, orders: 142, spent: '₹1.24L' },
  { name: 'Amit Mehta', tier: 'PLATINUM', points: 6230, orders: 98, spent: '₹89K' },
  { name: 'Neha Reddy', tier: 'GOLD', points: 4180, orders: 76, spent: '₹62K' },
  { name: 'Vikram Desai', tier: 'GOLD', points: 3540, orders: 64, spent: '₹54K' },
  { name: 'Rajesh Kumar', tier: 'GOLD', points: 2890, orders: 52, spent: '₹41K' },
]

const tierColorMap: Record<string, string> = {
  BRONZE: 'bg-amber-100 text-amber-700',
  SILVER: 'bg-gray-200 text-gray-700',
  GOLD: 'bg-yellow-100 text-yellow-700',
  PLATINUM: 'bg-slate-200 text-slate-700',
}

export function LoyaltyView() {
  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Loyalty Program</h2>
        <Badge variant="outline" className="text-[10px]">856 members enrolled</Badge>
      </div>

      {/* Stats */}
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

      {/* Tier Cards */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Membership Tiers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {tiers.map(t => (
              <div key={t.name} className={`p-4 rounded-lg border ${t.border} ${t.bg}`}>
                <div className="flex items-center gap-2 mb-2">
                  <t.icon className={`size-4 ${t.textColor}`} />
                  <span className={`text-sm font-bold ${t.textColor}`}>{t.name}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Members</span>
                    <span className="text-xs font-semibold">{t.members}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Min Points</span>
                    <span className="text-xs font-semibold">{t.minPoints}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{t.benefits}</p>
                </div>
                <div className="mt-2 h-1.5 bg-background rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${t.color}`}
                    style={{ width: `${(t.members / 412) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Points Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Recent Points Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {recentActivity.map((a, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <div className={`p-1.5 rounded-full ${a.type === 'earn' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    {a.type === 'earn'
                      ? <ArrowUpRight className="size-3 text-emerald-600" />
                      : <ArrowDownRight className="size-3 text-red-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{a.customer}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{a.desc}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-semibold ${a.type === 'earn' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {a.type === 'earn' ? '+' : '−'}{a.points}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{a.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Reward Catalog */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Reward Catalog</CardTitle>
              <Button variant="outline" size="sm" className="text-xs h-7">Add Reward</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rewardCatalog.map(r => (
                <div key={r.name} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{r.icon}</span>
                    <div>
                      <p className="text-xs font-medium">{r.name}</p>
                      <Badge variant="outline" className="text-[10px] mt-0.5">{r.type}</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold">{r.points} pts</p>
                    <p className="text-[10px] text-muted-foreground">required</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loyalty Rules */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Loyalty Rules & Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {loyaltyRules.map(r => (
              <div key={r.label} className="p-3 rounded-lg border">
                <p className="text-xs font-medium">{r.label}</p>
                <p className="text-sm font-bold mt-0.5">{r.value}</p>
                <p className="text-[10px] text-muted-foreground">{r.detail}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Loyal Customers */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Top Loyal Customers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">#</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Customer</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Tier</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Points</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Orders</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Total Spent</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((c, i) => (
                  <tr key={c.name} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-bold text-muted-foreground">{i + 1}</td>
                    <td className="p-2 font-medium">{c.name}</td>
                    <td className="p-2">
                      <Badge className={`text-[10px] ${tierColorMap[c.tier]}`}>{c.tier}</Badge>
                    </td>
                    <td className="p-2 font-semibold">{c.points.toLocaleString()}</td>
                    <td className="p-2">{c.orders}</td>
                    <td className="p-2 font-semibold">{c.spent}</td>
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
