'use client';

import { motion } from 'framer-motion';
import { Truck, MapPin, Phone, Clock, Navigation, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { deliveries, type DeliveryStatus } from './data';

const statusColors: Record<DeliveryStatus, string> = {
  assigned: 'bg-blue-100 text-blue-700',
  picked_up: 'bg-amber-100 text-amber-700',
  in_transit: 'bg-purple-100 text-purple-700',
  delivered: 'bg-emerald-100 text-emerald-700',
};

const statusLabels: Record<DeliveryStatus, string> = {
  assigned: 'Assigned',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  delivered: 'Delivered',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

export function DeliveriesView() {
  const activeCount = deliveries.filter((d) => d.status !== 'delivered').length;
  const deliveredCount = deliveries.filter((d) => d.status === 'delivered').length;
  const avgDistance = (deliveries.reduce((a, d) => a + d.distance, 0) / deliveries.length).toFixed(1);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h2 className="text-xl font-bold text-slate-900">Deliveries</h2>
        <p className="text-sm text-slate-500">Track active deliveries and delivery partners</p>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600"><Truck className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{activeCount}</p>
              <p className="text-xs text-slate-500">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600"><Package className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{deliveredCount}</p>
              <p className="text-xs text-slate-500">Delivered Today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600"><Navigation className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{avgDistance}km</p>
              <p className="text-xs text-slate-500">Avg Distance</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600"><MapPin className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold text-slate-900">5</p>
              <p className="text-xs text-slate-500">Active Zones</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Delivery Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {deliveries.map((delivery) => (
          <Card key={delivery.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-700">{delivery.orderNumber}</span>
                  <Badge className={`text-[9px] h-5 ${statusColors[delivery.status]}`} variant="secondary">
                    {statusLabels[delivery.status]}
                  </Badge>
                </div>
                <span className="text-[10px] text-slate-400">{delivery.zone}</span>
              </div>

              {/* Route visualization */}
              <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-3">
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <div className="w-0.5 h-8 bg-slate-300" />
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-[10px] text-slate-500">Pickup</p>
                    <p className="text-xs font-medium text-slate-700">{delivery.pickupAddress}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Drop-off</p>
                    <p className="text-xs font-medium text-slate-700">{delivery.customerAddress}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-700">{delivery.partnerName}</span>
                  <span className="text-slate-400 flex items-center gap-1">
                    <Phone className="h-3 w-3" />{delivery.partnerPhone}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-500">
                  <span className="flex items-center gap-1"><Navigation className="h-3 w-3" />{delivery.distance}km</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />ETA {delivery.estimatedDelivery}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t text-xs">
                <span className="text-slate-500">Customer: <span className="font-medium text-slate-700">{delivery.customerName}</span></span>
                <span className="font-medium text-emerald-700">₹{delivery.fee}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Delivery Zone Map Placeholder */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery Zones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 bg-slate-50 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <MapPin className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Interactive map view</p>
                <p className="text-xs text-slate-400">Delivery zones and partner locations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
