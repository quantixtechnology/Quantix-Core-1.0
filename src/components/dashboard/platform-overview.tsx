'use client';

import { motion } from 'framer-motion';
import { DollarSign, Building2, TrendingUp, Users, ArrowUpRight, Plus, ShoppingCart, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { businesses, revenueData, businessTypeData, leads, clientSubscriptions, leadSourceData } from './data';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

const formatCurrency = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  return `₹${val.toLocaleString()}`;
};

export function PlatformOverview() {
  const totalMRR = clientSubscriptions.filter(s => s.status === 'ACTIVE').reduce((sum, s) => sum + (s.customPrice || s.planPrice), 0);
  const activeBusinesses = businesses.filter(b => b.status === 'ACTIVE').length;
  const totalRevenue = businesses.reduce((sum, b) => sum + b.monthlyRevenue, 0);
  const activeLeads = leads.filter(l => !['WON', 'LOST'].includes(l.status)).length;

  const kpis = [
    { title: 'Active Businesses', value: `${activeBusinesses}/11`, change: '+2', icon: Building2, color: 'bg-emerald-50 text-emerald-600' },
    { title: 'Monthly Revenue (MRR)', value: formatCurrency(totalMRR * 100), change: '+12%', icon: DollarSign, color: 'bg-amber-50 text-amber-600' },
    { title: 'Active Leads', value: `${activeLeads}`, change: '+5', icon: TrendingUp, color: 'bg-blue-50 text-blue-600' },
    { title: 'Platform GMV', value: formatCurrency(totalRevenue), change: '+8.2%', icon: ShoppingCart, color: 'bg-purple-50 text-purple-600' },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <motion.div key={kpi.title} variants={itemVariants}>
            <Card className="hover:shadow-md transition-shadow">
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
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Platform Revenue</CardTitle>
              <CardDescription className="text-xs">Monthly GMV across all businesses</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={formatCurrency} />
                    <Tooltip formatter={(value: number) => [formatCurrency(value), 'Revenue']} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    <Bar dataKey="revenue" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Business Types</CardTitle>
              <CardDescription className="text-xs">Distribution across platform</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={businessTypeData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {businessTypeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value}%`, 'Share']} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} formatter={(v: string) => <span className="text-xs text-slate-600">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Leads */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
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
                {leads.filter(l => !['WON', 'LOST'].includes(l.status)).slice(0, 5).map(lead => (
                  <div key={lead.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-900 truncate">{lead.businessName}</p>
                      <p className="text-[10px] text-slate-500">{lead.contactName} · {lead.source.replace(/_/g, ' ')}</p>
                    </div>
                    <Badge className={`text-[9px] h-5 ${
                      lead.status === 'NEW' ? 'bg-slate-100 text-slate-700' :
                      lead.status === 'CONTACTED' ? 'bg-blue-100 text-blue-700' :
                      lead.status === 'QUALIFIED' ? 'bg-cyan-100 text-cyan-700' :
                      lead.status === 'PROPOSAL_SENT' ? 'bg-yellow-100 text-yellow-700' :
                      lead.status === 'NEGOTIATION' ? 'bg-orange-100 text-orange-700' :
                      'bg-purple-100 text-purple-700'
                    }`} variant="secondary">{lead.status.replace(/_/g, ' ')}</Badge>
                    <span className="text-xs font-medium text-slate-700">₹{(lead.estimatedValue / 12).toLocaleString()}/mo</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Lead Sources */}
        <motion.div variants={itemVariants}>
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
                      <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants}>
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
      </motion.div>
    </motion.div>
  );
}
