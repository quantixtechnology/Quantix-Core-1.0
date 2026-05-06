'use client';

import { motion } from 'framer-motion';
import { Truck, MapPin, Navigation, Phone, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

const demoDeliveries = [
  { id: 'd1', orderId: 'ORD-001', customer: 'Rajesh Kumar', partner: 'Amit Singh', status: 'ON_THE_WAY', vehicle: 'Bike', distance: '3.2 km', eta: '15 min', otp: '4829' },
  { id: 'd2', orderId: 'ORD-002', customer: 'Sneha Patil', partner: 'Ravi Kumar', status: 'PICKED_UP', vehicle: 'Bike', distance: '5.1 km', eta: '22 min', otp: '7163' },
  { id: 'd3', orderId: 'ORD-003', customer: 'Anand Joshi', partner: 'Suresh Yadav', status: 'ASSIGNED', vehicle: 'Bicycle', distance: '2.8 km', eta: '-', otp: '9254' },
];

const deliveryStatusColors: Record<string, string> = {
  ASSIGNING: 'bg-slate-100 text-slate-700', ASSIGNED: 'bg-blue-100 text-blue-700', PICKED_UP: 'bg-cyan-100 text-cyan-700',
  ON_THE_WAY: 'bg-purple-100 text-purple-700', ARRIVED: 'bg-amber-100 text-amber-700', DELIVERED: 'bg-emerald-100 text-emerald-700',
};

export function DeliveriesView() {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Delivery Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Active Deliveries', value: 2, color: 'text-blue-600' },
          { label: 'Completed Today', value: 24, color: 'text-emerald-600' },
          { label: 'Online Partners', value: 5, color: 'text-purple-600' },
        ].map(s => (
          <motion.div key={s.label} variants={itemVariants}>
            <Card><CardContent className="p-4 text-center"><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p><p className="text-xs text-slate-500">{s.label}</p></CardContent></Card>
          </motion.div>
        ))}
      </div>

      {/* Active Deliveries */}
      <div className="space-y-3">
        {demoDeliveries.map(del => (
          <motion.div key={del.id} variants={itemVariants}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 font-mono">{del.orderId}</span>
                      <Badge className={`text-[9px] h-5 ${deliveryStatusColors[del.status]}`} variant="secondary">{del.status.replace(/_/g, ' ')}</Badge>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Customer: {del.customer}</p>
                    <p className="text-[10px] text-slate-500">Partner: {del.partner} · {del.vehicle}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-900">{del.distance}</p>
                    <p className="text-[10px] text-slate-500">ETA: {del.eta}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="outline" className="text-[9px] h-5">OTP: {del.otp}</Badge>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: del.status === 'ON_THE_WAY' ? '75%' : del.status === 'PICKED_UP' ? '50%' : '25%' }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Haversine Explanation */}
      <motion.div variants={itemVariants}>
        <Card className="bg-slate-50 border-dashed">
          <CardContent className="p-4">
            <h4 className="text-xs font-semibold text-slate-700 mb-2">Delivery Radius Logic (Haversine Formula)</h4>
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              <span className="bg-white px-2 py-1 rounded border">Customer enters address</span><span className="text-emerald-500">→</span>
              <span className="bg-white px-2 py-1 rounded border">Find nearest store</span><span className="text-emerald-500">→</span>
              <span className="bg-white px-2 py-1 rounded border">Haversine distance check</span><span className="text-emerald-500">→</span>
              <span className="bg-emerald-100 px-2 py-1 rounded border">Show products ✅</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] mt-2">
              <span className="bg-white px-2 py-1 rounded border">If distance &gt; radius</span><span className="text-red-500">→</span>
              <span className="bg-red-100 px-2 py-1 rounded border text-red-700">"Currently not available in your area" ❌</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
