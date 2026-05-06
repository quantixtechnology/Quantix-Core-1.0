'use client';

import { AlertCircle, CheckCircle2, Clock, Pause, Play, RefreshCw, Edit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { clientSubscriptions, subStatusColors, businesses } from './data';
import type { SubscriptionStatus } from './data';

const statusCounts = clientSubscriptions.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {} as Record<string, number>);

export function SubscriptionsView() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {(['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'EXPIRED', 'PAUSED'] as SubscriptionStatus[]).map(status => (
          <Card key={status} className="transition-shadow duration-200">
            <CardContent className="p-3 text-center">
              <Badge className={`text-[9px] h-5 mb-1 ${subStatusColors[status]}`} variant="secondary">{status.replace(/_/g, ' ')}</Badge>
              <p className="text-2xl font-bold text-slate-900">{statusCounts[status] || 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* MRR Summary */}
      <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
        <CardContent className="p-5">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-emerald-700">₹{(clientSubscriptions.filter(s => s.status === 'ACTIVE').reduce((sum, s) => sum + (s.customPrice || s.planPrice), 0) * 100).toLocaleString()}</p>
              <p className="text-xs text-emerald-600">Monthly Recurring Revenue</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700">{clientSubscriptions.filter(s => s.manualOverride).length}</p>
              <p className="text-xs text-emerald-600">Custom Pricing</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700">{clientSubscriptions.filter(s => s.status === 'TRIAL').length}</p>
              <p className="text-xs text-emerald-600">In Trial</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Client Subscriptions</CardTitle>
          <CardDescription className="text-xs">Super Admin can override pricing per customer</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Business</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Plan</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Status</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Plan Price</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Custom Price</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Discount</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Cycle</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Next Billing</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {clientSubscriptions.map(sub => (
                  <tr key={sub.id} className="hover:bg-slate-50 transition-colors duration-150">
                    <td className="py-2.5 px-3 font-medium text-slate-900">{sub.businessName}</td>
                    <td className="py-2.5 px-3">{sub.plan}</td>
                    <td className="py-2.5 px-3"><Badge className={`text-[9px] h-5 ${subStatusColors[sub.status]}`} variant="secondary">{sub.status.replace(/_/g, ' ')}</Badge></td>
                    <td className="py-2.5 px-3 text-slate-600">₹{sub.planPrice.toLocaleString()}</td>
                    <td className="py-2.5 px-3">
                      {sub.customPrice ? (
                        <span className="font-medium text-amber-600">₹{sub.customPrice.toLocaleString()} <Badge className="text-[8px] h-3.5 bg-amber-100 text-amber-700" variant="secondary">override</Badge></span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {sub.discountPercentage ? <span className="text-emerald-600">{sub.discountPercentage}%</span> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 capitalize">{sub.billingCycle}</td>
                    <td className="py-2.5 px-3 text-slate-500">{sub.nextBilling}</td>
                    <td className="py-2.5 px-3 text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Edit className="h-3 w-3" /></Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader><DialogTitle className="text-sm">Override Pricing — {sub.businessName}</DialogTitle></DialogHeader>
                          <div className="space-y-3 text-xs">
                            <div className="p-3 bg-amber-50 rounded-lg text-amber-700 text-[10px]">
                              ⚠️ Only Super Admin can override pricing. This is a manual override.
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div><label className="text-slate-500 text-[10px]">Custom Price</label><div className="h-8 rounded border px-2 mt-1 flex items-center">₹{sub.customPrice || sub.planPrice}</div></div>
                              <div><label className="text-slate-500 text-[10px]">Discount %</label><div className="h-8 rounded border px-2 mt-1 flex items-center">{sub.discountPercentage || 0}%</div></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <Button size="sm" variant="outline" className="text-xs h-8"><Pause className="h-3 w-3 mr-1" />Pause</Button>
                              <Button size="sm" variant="outline" className="text-xs h-8"><RefreshCw className="h-3 w-3 mr-1" />Extend Trial</Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
