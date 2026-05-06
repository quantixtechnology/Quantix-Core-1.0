'use client';

import { DollarSign, ShoppingCart, Users, CreditCard, ArrowUpRight, Power, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { businesses, orders } from './data';

interface Props { selectedBusiness: string }

export function BusinessDashboard({ selectedBusiness }: Props) {
  const biz = businesses.find(b => b.id === selectedBusiness);
  if (!biz) return <div className="text-sm text-slate-500">Select a business from the header dropdown</div>;

  const bizOrders = orders.filter(o => o.businessId === selectedBusiness);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Business Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{biz.name}</h2>
          <p className="text-xs text-slate-500">{biz.city} · {biz.type.replace(/_/g, ' ')} · Plan: {biz.plan}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`text-[10px] ${biz.isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${biz.isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {biz.isOnline ? 'Online' : 'Offline'}
          </Badge>
          <Button variant="outline" size="sm" className="text-xs h-8"><Power className="h-3.5 w-3.5 mr-1.5" />Toggle</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Monthly Revenue', value: `₹${biz.monthlyRevenue.toLocaleString()}`, change: '+8.2%', trend: 'up', icon: DollarSign, color: 'bg-emerald-50 text-emerald-600' },
          { title: 'Total Orders', value: biz.totalOrders.toLocaleString(), change: '+6.5%', trend: 'up', icon: ShoppingCart, color: 'bg-amber-50 text-amber-600' },
          { title: 'Active Customers', value: biz.activeCustomers.toLocaleString(), change: '+12%', trend: 'up', icon: Users, color: 'bg-blue-50 text-blue-600' },
          { title: 'Avg Order Value', value: `₹${biz.totalOrders ? Math.round(biz.monthlyRevenue / biz.totalOrders) : 0}`, change: '-2%', trend: 'down', icon: CreditCard, color: 'bg-purple-50 text-purple-600' },
        ].map(kpi => (
          <Card key={kpi.title} className="hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className={`p-2.5 rounded-xl ${kpi.color}`}><kpi.icon className="h-5 w-5" /></div>
                <div className="flex items-center gap-1">
                  {kpi.trend === 'up' ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> : <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                  <span className={`text-xs font-medium ${kpi.trend === 'up' ? 'text-emerald-600' : 'text-red-600'}`}>{kpi.change}</span>
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-3">{kpi.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{kpi.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {bizOrders.length > 0 ? (
            <div className="space-y-2">
              {bizOrders.slice(0, 5).map(order => (
                <div key={order.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors duration-150">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900">{order.orderNumber}</p>
                    <p className="text-[10px] text-slate-500">{order.customerName} · {order.items} items</p>
                  </div>
                  <Badge variant="outline" className="text-[9px] h-5">{order.type.replace(/_/g, ' ')}</Badge>
                  <span className="text-xs font-medium">₹{order.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-6">No orders yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
