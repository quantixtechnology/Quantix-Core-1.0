'use client';

import { motion } from 'framer-motion';
import { MapPin, Star, Phone, Package, ShoppingCart, Clock, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { stores, type StoreStatus } from './data';

const statusColors: Record<StoreStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-slate-100 text-slate-600',
  maintenance: 'bg-amber-100 text-amber-700',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

export function StoresView() {
  const activeStores = stores.filter((s) => s.status === 'active').length;
  const totalProducts = stores.reduce((acc, s) => acc + s.totalProducts, 0);
  const avgRating = (stores.reduce((acc, s) => acc + s.rating, 0) / stores.length).toFixed(1);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Stores</h2>
          <p className="text-sm text-slate-500">Manage store locations and performance</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-xs h-9">
          <Plus className="h-3.5 w-3.5 mr-2" />
          Add Store
        </Button>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{activeStores}</p>
              <p className="text-xs text-slate-500">Active Stores</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{totalProducts.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Total Products</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Star className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{avgRating}</p>
              <p className="text-xs text-slate-500">Average Rating</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Store Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {stores.map((store) => (
          <Card key={store.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">{store.name}</CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">{store.businessName}</p>
                </div>
                <Badge className={`text-[10px] h-5 ${statusColors[store.status]}`} variant="secondary">
                  {store.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-start gap-2 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>{store.address}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Phone className="h-3.5 w-3.5" />
                <span>{store.phone}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-900">{store.totalProducts}</p>
                  <p className="text-[10px] text-slate-500">Products</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-900">{store.dailyOrders}</p>
                  <p className="text-[10px] text-slate-500">Daily Orders</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                    <span className="text-sm font-bold text-slate-900">{store.rating}</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Rating</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Delivery: {store.deliveryRadius}km
                </span>
                <span className="text-slate-500">Mgr: {store.manager}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>
    </motion.div>
  );
}
