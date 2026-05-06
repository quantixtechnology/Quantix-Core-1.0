'use client';

import { MapPin, Phone, Clock, Star, Store as StoreIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const demoStores = [
  { id: 's1', name: 'Main Store', city: 'Mumbai', status: 'ACTIVE', isMain: true, radius: 5, phone: '+91 22 1234 5678', rating: 4.5, orders: 890, pos: true },
  { id: 's2', name: 'Andheri Branch', city: 'Mumbai', status: 'ACTIVE', isMain: false, radius: 3, phone: '+91 22 2345 6789', rating: 4.2, orders: 350, pos: true },
  { id: 's3', name: 'Bandra Outlet', city: 'Mumbai', status: 'MAINTENANCE', isMain: false, radius: 4, phone: '+91 22 3456 7890', rating: 4.7, orders: 0, pos: true },
];

export function StoresView() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Stores', value: demoStores.length, color: 'text-slate-900' },
          { label: 'Active', value: demoStores.filter(s => s.status === 'ACTIVE').length, color: 'text-emerald-600' },
          { label: 'With POS', value: demoStores.filter(s => s.pos).length, color: 'text-blue-600' },
        ].map(stat => (
          <Card key={stat.label}><CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-slate-500">{stat.label}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {demoStores.map(store => (
          <Card key={store.id} className="hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <StoreIcon className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-slate-900">{store.name}</span>
                </div>
                {store.isMain && <Badge className="text-[8px] h-4 bg-emerald-100 text-emerald-700">Main</Badge>}
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-slate-400" />{store.city}</div>
                <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-slate-400" />{store.phone}</div>
                <div className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-slate-400" />Delivery Radius: {store.radius} km</div>
                <div className="flex items-center gap-1.5"><Star className="h-3 w-3 text-amber-400" />{store.rating}</div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <Badge className={`text-[9px] h-5 ${store.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`} variant="secondary">{store.status}</Badge>
                <span className="text-[10px] text-slate-400">{store.orders} orders/mo</span>
              </div>
              <div className="mt-3 p-2 bg-slate-50 rounded text-[10px] text-slate-500">
                <strong>Haversine Check:</strong> Customer address → Calculate distance → If ≤ {store.radius}km → Show products. Else → "Currently not available in your area"
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
