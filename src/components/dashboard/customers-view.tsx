'use client';

import { Users as UsersIcon, Phone, Mail, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { customers } from './data';

const tierColors: Record<string, string> = { BRONZE: 'bg-orange-100 text-orange-700', SILVER: 'bg-slate-200 text-slate-700', GOLD: 'bg-amber-100 text-amber-700', PLATINUM: 'bg-purple-100 text-purple-700' };

export function CustomersView() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map(cust => (
          <Card key={cust.id} className="hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">{cust.name.split(' ').map(n => n[0]).join('')}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{cust.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={`text-[9px] h-5 ${tierColors[cust.tier]}`} variant="secondary">{cust.tier}</Badge>
                    <span className="text-[10px] text-amber-600 flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400" />{cust.loyaltyPoints} pts</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div className="p-1.5 bg-slate-50 rounded"><p className="text-sm font-bold text-slate-900">{cust.totalOrders}</p><p className="text-[9px] text-slate-500">Orders</p></div>
                <div className="p-1.5 bg-slate-50 rounded"><p className="text-sm font-bold text-slate-900">₹{(cust.totalSpent / 1000).toFixed(1)}K</p><p className="text-[9px] text-slate-500">Spent</p></div>
                <div className="p-1.5 bg-slate-50 rounded"><p className="text-sm font-bold text-slate-900">₹{Math.round(cust.totalSpent / cust.totalOrders)}</p><p className="text-[9px] text-slate-500">AOV</p></div>
              </div>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{cust.phone}</span>
                <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{cust.email}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
