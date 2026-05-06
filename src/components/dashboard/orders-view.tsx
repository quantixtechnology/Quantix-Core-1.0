'use client';

import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { orders, orderStatusColors } from './data';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

const statusFilters = ['ALL', 'PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PICKUP_ASSIGNED', 'PICKED_UP', 'PROCESSING', 'CANCELLED'];

export function OrdersView() {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Status Filters */}
      <motion.div variants={itemVariants} className="flex flex-wrap gap-1.5">
        {statusFilters.map(s => (
          <Badge key={s} variant="outline" className="text-[10px] h-6 cursor-pointer hover:bg-slate-100">{s.replace(/_/g, ' ')}</Badge>
        ))}
      </motion.div>

      {/* Orders Table */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Order</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Business</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Customer</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Type</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Status</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-slate-700">Payment</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-slate-700">Amount</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-slate-700"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {orders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-medium text-slate-900 font-mono">{order.orderNumber}</td>
                      <td className="py-2.5 px-3 text-slate-600">{order.businessName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{order.customerName}</td>
                      <td className="py-2.5 px-3"><Badge variant="outline" className="text-[9px] h-5">{order.type.replace(/_/g, ' ')}</Badge></td>
                      <td className="py-2.5 px-3"><Badge className={`text-[9px] h-5 ${orderStatusColors[order.status] || 'bg-slate-100 text-slate-700'}`} variant="secondary">{order.status.replace(/_/g, ' ')}</Badge></td>
                      <td className="py-2.5 px-3 text-slate-600">{order.paymentMethod}</td>
                      <td className="py-2.5 px-3 text-right font-medium">₹{order.total.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right"><Button variant="ghost" size="icon" className="h-6 w-6"><Eye className="h-3 w-3" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Pickup & Delivery Workflow */}
      <motion.div variants={itemVariants}>
        <Card className="bg-slate-50 border-dashed">
          <CardContent className="p-4">
            <h4 className="text-xs font-semibold text-slate-700 mb-2">Pickup & Delivery Workflow (Laundry etc.)</h4>
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              <span className="bg-white px-2 py-1 rounded border">Pickup Request</span><span className="text-emerald-500">→</span>
              <span className="bg-white px-2 py-1 rounded border">Pickup Assigned</span><span className="text-emerald-500">→</span>
              <span className="bg-white px-2 py-1 rounded border">Picked Up</span><span className="text-emerald-500">→</span>
              <span className="bg-white px-2 py-1 rounded border">Processing</span><span className="text-emerald-500">→</span>
              <span className="bg-white px-2 py-1 rounded border">Ready for Delivery</span><span className="text-emerald-500">→</span>
              <span className="bg-emerald-100 px-2 py-1 rounded border">Delivered ✅</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
