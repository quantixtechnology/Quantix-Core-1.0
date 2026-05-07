'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  IndianRupee,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  Clock,
  AlertTriangle,
  Plus,
  Eye,
  CheckCircle2,
  XCircle,
  Truck,
  PackageCheck,
} from 'lucide-react';
import { cn, formatCurrency, formatIndianDateTime } from '@/lib/utils';

// ============================================================================
// Constants & Types
// ============================================================================

const BUSINESS_ID = 'cmoui0c430002q9uv7w42p66l';
const API_BASE = `/api/businesses/${BUSINESS_ID}`;

interface Stats {
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  totalProducts: number;
  activeStores: number;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    createdAt: string;
  }>;
  ordersByStatus: Record<string, number>;
}

interface Order {
  id: string;
  orderNumber: string;
  orderType: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  customerName: string | null;
  createdAt: string;
  store: { id: string; name: string };
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  totalOrders: number;
  totalSpent: number;
  isActive: boolean;
}

// ============================================================================
// Status Color Mapping
// ============================================================================

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-purple-100 text-purple-700',
  READY_FOR_PICKUP: 'bg-cyan-100 text-cyan-700',
  OUT_FOR_DELIVERY: 'bg-indigo-100 text-indigo-700',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-slate-100 text-slate-700',
  POS: 'bg-emerald-100 text-emerald-700',
};

const statusIcons: Record<string, typeof Clock> = {
  PENDING: Clock,
  CONFIRMED: CheckCircle2,
  PREPARING: Package,
  OUT_FOR_DELIVERY: Truck,
  DELIVERED: PackageCheck,
  CANCELLED: XCircle,
};

// ============================================================================
// Admin Dashboard Component
// ============================================================================

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/stats`).then((r) => r.json()),
      fetch(`${API_BASE}/orders?limit=10`).then((r) => r.json()),
      fetch(`${API_BASE}/customers?limit=5`).then((r) => r.json()),
    ])
      .then(([statsRes, ordersRes, customersRes]) => {
        if (statsRes.success) setStats(statsRes.data);
        if (ordersRes.success) setOrders(ordersRes.data);
        if (customersRes.success) setCustomers(customersRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-slate-200 rounded mb-3 w-24" />
                <div className="h-8 bg-slate-200 rounded w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-6 bg-slate-200 rounded mb-4 w-40" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Revenue',
      value: formatCurrency(stats?.totalRevenue || 0),
      icon: IndianRupee,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      title: 'Total Orders',
      value: stats?.totalOrders || 0,
      icon: ShoppingCart,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Customers',
      value: stats?.totalCustomers || 0,
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      title: 'Products',
      value: stats?.totalProducts || 0,
      icon: Package,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  const orderStatusBreakdown = stats?.ordersByStatus || {};

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="border-slate-200">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs sm:text-sm text-slate-500 font-medium">{stat.title}</span>
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', stat.bg)}>
                  <stat.icon className={cn('w-5 h-5', stat.color)} />
                </div>
              </div>
              <p className={cn('text-xl sm:text-2xl font-bold', stat.color)}>
                {typeof stat.value === 'number' ? stat.value.toLocaleString('en-IN') : stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Order Status Breakdown */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Orders by Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(orderStatusBreakdown).map(([status, count]) => {
              const StatusIcon = statusIcons[status] || Clock;
              return (
                <div
                  key={status}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium',
                    statusColors[status] || 'bg-slate-100 text-slate-700'
                  )}
                >
                  <StatusIcon className="w-3.5 h-3.5" />
                  <span>{status.replace(/_/g, ' ')}</span>
                  <Badge
                    variant="secondary"
                    className="bg-white/60 text-current text-[10px] h-5 px-1.5"
                  >
                    {count as number}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Recent Orders Table */}
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-600" />
                Recent Orders
              </CardTitle>
              <Button variant="outline" size="sm" className="text-xs h-7">
                <Eye className="w-3 h-3 mr-1" /> View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Order #</TableHead>
                    <TableHead className="text-xs">Customer</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-400 text-sm">
                        No orders yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-xs font-medium">
                          {order.orderNumber}
                        </TableCell>
                        <TableCell className="text-xs">
                          {order.customerName || 'Walk-in'}
                        </TableCell>
                        <TableCell className="text-xs font-semibold">
                          {formatCurrency(order.totalAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              'text-[10px] px-1.5 py-0 border-0',
                              statusColors[order.status] || 'bg-slate-100 text-slate-700'
                            )}
                          >
                            {order.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">
                          {formatIndianDateTime(order.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="space-y-4 sm:space-y-6">
          {/* Products Overview */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-600" />
                Products Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Active Products</span>
                <span className="font-semibold text-emerald-700">
                  {stats?.totalProducts || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Active Stores</span>
                <span className="font-semibold text-emerald-700">
                  {stats?.activeStores || 0}
                </span>
              </div>
              <Separator />
              <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-800">Low Stock Alerts</p>
                  <p className="text-[10px] text-amber-600">
                    Check inventory for items below minimum stock level
                  </p>
                </div>
              </div>
              <Button variant="outline" className="w-full text-xs h-8 border-emerald-300 text-emerald-700">
                <Plus className="w-3 h-3 mr-1" /> Add Product
              </Button>
            </CardContent>
          </Card>

          {/* Top Customers */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                Top Customers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {customers.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No customers yet</p>
              ) : (
                customers.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-slate-50"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold text-sm shrink-0">
                      {customer.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{customer.name}</p>
                      <p className="text-xs text-slate-400">{customer.totalOrders} orders</p>
                    </div>
                    <span className="font-semibold text-xs text-emerald-700">
                      {formatCurrency(customer.totalSpent)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
