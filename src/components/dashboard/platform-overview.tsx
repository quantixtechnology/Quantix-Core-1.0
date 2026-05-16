'use client';

import { DollarSign, Building2, TrendingUp, Users, ArrowUpRight, Plus, ShoppingCart, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { businesses, revenueData, businessTypeData, leads, clientSubscriptions, leadSourceData } from './data';

const formatCurrency = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  return `₹${val.toLocaleString()}`;
};

export function PlatformOverview() {
  const totalMRR = clientSubscriptions.filter(s => s.status === 'ACTIVE').reduce((sum, s) => sum + (s.customPrice || s.planPrice), 0);
  const activeBusinesses = businesses.filter(b => b.status === 'ACTIVE').length;
  const totalRevenue = businesses.reduce((sum, b) => sum + b.monthlyRevenue, 0);
  const activeLeads = leads.filter(l => !['NOT_INTERESTED', 'WRONG_NUMBER', 'RNR', 'LOST', 'DUPLICATE', 'CLOSED_WON'].includes(l.stage)).length;

  const kpis = [
    { title: 'Active Businesses', value: `${activeBusinesses}/11`, change: '+2', icon: Building2, color: 'bg-emerald-50 text-emerald-600' },
    { title: 'Monthly Revenue (MRR)', value: formatCurrency(totalMRR * 100), change: '+12%', icon: DollarSign, color: 'bg-amber-50 text-amber-600' },
    { title: 'Active Leads', value: `${activeLeads}`, change: '+5', icon: TrendingUp, color: 'bg-blue-50 text-blue-600' },
    { title: 'Platform GMV', value: formatCurrency(totalRevenue), change: '+8.2%', icon: ShoppingCart, color: 'bg-purple-50 text-purple-600' },
  ];

  const maxRevenue = Math.max(...revenueData.map(d => d.revenue));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <Card key={kpi.title} className="hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className={`p-2.5 rounded-xl ${kpi.color}`}><kpi.icon className="h-5 w-5" /></div>
                <div className="flex items-center gap-1">
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs font-medium text-emerald-600">{kpi.change}</span>
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-3">{kpi.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{kpi.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CSS Bar Chart - Revenue */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Platform Revenue</CardTitle>
            <CardDescription className="text-xs">Monthly GMV across all businesses</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-[280px] flex flex-col">
              {/* Y-axis labels + bars */}
              <div className="flex-1 flex items-end gap-0">
                {/* Y-axis */}
                <div className="flex flex-col justify-between h-full text-[10px] text-slate-400 py-1 pr-2 min-w-[40px] text-right">
                  <span>{formatCurrency(maxRevenue)}</span>
                  <span>{formatCurrency(maxRevenue * 0.75)}</span>
                  <span>{formatCurrency(maxRevenue * 0.5)}</span>
                  <span>{formatCurrency(maxRevenue * 0.25)}</span>
                  <span>0</span>
                </div>
                {/* Bars area */}
                <div className="flex-1 flex items-end gap-1.5 h-full border-b border-l border-slate-100 pl-1 pb-0">
                  {revenueData.map((d, i) => {
                    const heightPct = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
                        {/* Tooltip on hover */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 mb-1 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap">
                          {formatCurrency(d.revenue)}
                        </div>
                        <div
                          className="w-full bg-emerald-500 rounded-t-md transition-all duration-300 hover:bg-emerald-600 min-w-[8px] max-w-[48px]"
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* X-axis labels */}
              <div className="flex gap-0 ml-[40px]">
                {revenueData.map((d, i) => (
                  <div key={i} className="flex-1 text-center text-[10px] text-slate-400 pt-1.5">
                    {d.month}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CSS Donut Chart - Business Types */}
        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Business Types</CardTitle>
            <CardDescription className="text-xs">Distribution across platform</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col items-center gap-3">
              {/* Donut using conic-gradient */}
              <div
                className="w-40 h-40 rounded-full relative"
                style={{
                  background: `conic-gradient(${businessTypeData.reduce<{ stops: string[]; cum: number }>((acc, item) => {
                    const start = acc.cum;
                    acc.cum += item.value;
                    acc.stops.push(`${item.color} ${start}% ${acc.cum}%`);
                    return acc;
                  }, { stops: [], cum: 0 }).stops.join(', ')})`,
                }}
              >
                <div className="absolute inset-8 bg-white rounded-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-900">{businessTypeData.length}</p>
                    <p className="text-[9px] text-slate-500">Types</p>
                  </div>
                </div>
              </div>
              {/* Legend */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 w-full">
                {businessTypeData.map(item => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] text-slate-600 truncate">{item.name}</span>
                    <span className="text-[10px] font-medium text-slate-900 ml-auto">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Leads */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Active Leads</CardTitle>
                <CardDescription className="text-xs">Sales pipeline overview</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="text-xs h-8">View All <ArrowUpRight className="h-3 w-3 ml-1" /></Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {leads.filter(l => !['NOT_INTERESTED', 'WRONG_NUMBER', 'RNR', 'LOST', 'DUPLICATE', 'CLOSED_WON'].includes(l.stage)).slice(0, 5).map(lead => (
                <div key={lead.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors duration-150">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900 truncate">{lead.businessName}</p>
                    <p className="text-[10px] text-slate-500">{lead.contactName} · {lead.source.replace(/_/g, ' ')}</p>
                  </div>
                  <Badge className={`text-[9px] h-5 ${
                    lead.stage === 'LEAD' ? 'bg-slate-100 text-slate-700' :
                    lead.stage === 'FOLLOW_UP' ? 'bg-blue-100 text-blue-700' :
                    lead.stage === 'HOT_LEAD' ? 'bg-orange-100 text-orange-700' :
                    lead.stage === 'NEGOTIATION' ? 'bg-orange-100 text-orange-800' :
                    lead.stage === 'PAYMENT_PENDING' ? 'bg-yellow-100 text-yellow-700' :
                    lead.stage === 'PAYMENT_RECEIVED' ? 'bg-teal-100 text-teal-700' :
                    'bg-violet-100 text-violet-700'
                  }`} variant="secondary">{lead.stage.replace(/_/g, ' ')}</Badge>
                  <span className="text-xs font-medium text-slate-700">₹{(lead.estimatedValue / 12).toLocaleString()}/mo</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Lead Sources */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Lead Sources</CardTitle>
            <CardDescription className="text-xs">Where leads come from</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {leadSourceData.map(item => (
                <div key={item.name} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-slate-700 flex-1">{item.name}</span>
                  <span className="text-xs font-medium text-slate-900">{item.value}%</span>
                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-semibold text-slate-900">Quick Actions</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700"><Plus className="h-3.5 w-3.5 mr-1.5" />Create Business</Button>
            <Button variant="outline" size="sm" className="text-xs h-8"><Plus className="h-3.5 w-3.5 mr-1.5" />Add Lead</Button>
            <Button variant="outline" size="sm" className="text-xs h-8">View Deployments</Button>
            <Button variant="outline" size="sm" className="text-xs h-8">Manage Plans</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
