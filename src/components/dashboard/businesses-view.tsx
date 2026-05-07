'use client';

import { Plus, ShoppingCart, UtensilsCrossed, Shirt, Car, Pill, Home, Package, Sparkles, Beef, Sofa, BookOpen, Eye, Power } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { businesses, businessTypeConfig, statusColors } from './data';
import type { BusinessType } from './data';

const iconMap: Record<string, React.ElementType> = { ShoppingCart, UtensilsCrossed, Shirt, Car, Pill, Home, Package, Sparkles, Beef, Sofa, BookOpen };

export function BusinessesView() {
  const typeCounts = businesses.reduce((acc, b) => { acc[b.type] = (acc[b.type] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Type Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {Object.entries(businessTypeConfig).map(([type, config]) => {
          const Icon = iconMap[config.icon] || ShoppingCart;
          const count = typeCounts[type] || 0;
          return (
            <Card key={type} className="hover:shadow-md transition-shadow duration-200 cursor-pointer">
              <CardContent className="p-3 text-center">
                <div className="w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center" style={{ backgroundColor: `${config.color}15`, color: config.color }}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-[10px] text-slate-500 truncate">{config.label}</p>
                <p className="text-lg font-bold text-slate-900">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">All Businesses</h3>
          <p className="text-xs text-slate-500">{businesses.length} total businesses on platform</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-3.5 w-3.5 mr-1.5" />Create Business
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">Create New Business</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-xs text-slate-600">
              <p>Only <strong>Quantix Super Admin</strong> can create businesses.</p>
              <p>After creation, configure branding, assign a subscription plan, map domain, and deploy.</p>
              <div className="p-3 bg-amber-50 rounded-lg text-amber-700 text-[10px]">
                ⚠️ Customers CANNOT self-signup. This is a managed platform.
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Business Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Business</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">City</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Plan</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Online</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Revenue</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {businesses.map(biz => {
                  const config = businessTypeConfig[biz.type];
                  const Icon = iconMap[config?.icon || 'ShoppingCart'] || ShoppingCart;
                  return (
                    <tr key={biz.id} className="hover:bg-slate-50 transition-colors duration-150">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${config?.color}15`, color: config?.color }}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{biz.name}</p>
                            <p className="text-[10px] text-slate-400">{biz.contactPhone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-[9px] h-5">{config?.label || biz.type}</Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{biz.city}</td>
                      <td className="py-3 px-4">
                        <span className="font-medium">{biz.plan}</span>
                        {biz.customPrice && <span className="text-[9px] text-amber-600 ml-1">custom</span>}
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={`text-[9px] h-5 ${statusColors[biz.status]}`} variant="secondary">{biz.status}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className={`w-2 h-2 rounded-full ${biz.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      </td>
                      <td className="py-3 px-4 text-right font-medium">₹{biz.monthlyRevenue.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Power className="h-3 w-3" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
