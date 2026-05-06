'use client';

import { motion } from 'framer-motion';
import { Search, Filter, Download, Eye, MoreHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { orders, businessTypeLabels, businessTypeColors, type OrderStatus, type OrderType, type BusinessType, type Order } from './data';
import { useState } from 'react';

const statusColors: Record<OrderStatus, string> = {
  pending: 'bg-slate-100 text-slate-700',
  confirmed: 'bg-blue-100 text-blue-700',
  preparing: 'bg-yellow-100 text-yellow-700',
  out_for_delivery: 'bg-purple-100 text-purple-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

const orderTypeColors: Record<OrderType, string> = {
  delivery: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pickup: 'bg-orange-50 text-orange-700 border-orange-200',
  pos: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  subscription: 'bg-violet-50 text-violet-700 border-violet-200',
};

const statusSteps: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

export function OrdersView() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filtered = orders.filter((o) => {
    const matchSearch =
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchType = typeFilter === 'all' || o.orderType === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const statusCounts = {
    all: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    confirmed: orders.filter((o) => o.status === 'confirmed').length,
    preparing: orders.filter((o) => o.status === 'preparing').length,
    out_for_delivery: orders.filter((o) => o.status === 'out_for_delivery').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Orders</h2>
          <p className="text-sm text-slate-500">Track and manage all orders across the platform</p>
        </div>
        <Button variant="outline" size="sm" className="text-xs h-9">
          <Download className="h-3.5 w-3.5 mr-2" />
          Export
        </Button>
      </motion.div>

      {/* Status Tabs */}
      <motion.div variants={itemVariants} className="flex gap-2 flex-wrap">
        {Object.entries(statusCounts).map(([key, count]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === key
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {key === 'all' ? 'All' : key.replace(/_/g, ' ')} ({count})
          </button>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by order # or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <select
          className="h-9 rounded-md border border-slate-200 px-3 text-xs bg-white"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">All Types</option>
          <option value="delivery">Delivery</option>
          <option value="pickup">Pickup</option>
          <option value="pos">POS</option>
          <option value="subscription">Subscription</option>
        </select>
      </motion.div>

      {/* Orders Table */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Order #</TableHead>
                    <TableHead className="text-xs">Customer</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Store</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Payment</TableHead>
                    <TableHead className="text-xs text-right">Total</TableHead>
                    <TableHead className="text-xs"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="text-xs font-medium text-emerald-700">{order.orderNumber}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-xs font-medium text-slate-900">{order.customerName}</p>
                          <p className="text-[10px] text-slate-500">{order.customerPhone}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs hidden md:table-cell">{order.storeName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] h-5 ${orderTypeColors[order.orderType]}`}>
                          {order.orderType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[9px] h-5 ${statusColors[order.status]}`} variant="secondary">
                          {order.status.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs hidden sm:table-cell">{order.paymentMethod}</TableCell>
                      <TableCell className="text-xs text-right font-semibold">₹{order.total.toLocaleString()}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedOrder(order)}>
                              <Eye className="h-3.5 w-3.5 mr-2" />
                              View Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-emerald-700">{selectedOrder?.orderNumber}</DialogTitle>
            <DialogDescription>Order details and timeline</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              {/* Status Timeline */}
              {selectedOrder.status !== 'cancelled' && (
                <div className="flex items-center gap-1 py-2">
                  {statusSteps.map((step, i) => {
                    const currentIdx = statusSteps.indexOf(selectedOrder.status);
                    const isActive = i <= currentIdx;
                    return (
                      <div key={step} className="flex items-center flex-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${
                          isActive ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                        }`}>
                          {i + 1}
                        </div>
                        {i < statusSteps.length - 1 && (
                          <div className={`flex-1 h-0.5 ${isActive && i < currentIdx ? 'bg-emerald-600' : 'bg-slate-200'}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-slate-500">Customer:</span> <span className="font-medium">{selectedOrder.customerName}</span></div>
                <div><span className="text-slate-500">Phone:</span> <span className="font-medium">{selectedOrder.customerPhone}</span></div>
                <div><span className="text-slate-500">Store:</span> <span className="font-medium">{selectedOrder.storeName}</span></div>
                <div><span className="text-slate-500">Type:</span> <span className="font-medium">{selectedOrder.orderType}</span></div>
                <div><span className="text-slate-500">Payment:</span> <span className="font-medium">{selectedOrder.paymentMethod}</span></div>
                <div><span className="text-slate-500">Items:</span> <span className="font-medium">{selectedOrder.items}</span></div>
                <div className="col-span-2"><span className="text-slate-500">Address:</span> <span className="font-medium">{selectedOrder.deliveryAddress}</span></div>
              </div>

              <div className="border-t pt-3 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>₹{selectedOrder.subtotal}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Tax</span><span>₹{selectedOrder.tax}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Delivery Fee</span><span>₹{selectedOrder.deliveryFee}</span></div>
                <div className="flex justify-between font-bold text-sm pt-1 border-t">
                  <span>Total</span><span className="text-emerald-700">₹{selectedOrder.total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
