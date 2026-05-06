'use client';

import { motion } from 'framer-motion';
import { Search, Plus, Mail, Phone, MapPin, Crown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { customers, type Customer } from './data';
import { useState } from 'react';

const tierColors: Record<string, string> = {
  bronze: 'bg-orange-100 text-orange-700',
  silver: 'bg-slate-200 text-slate-700',
  gold: 'bg-yellow-100 text-yellow-700',
  platinum: 'bg-emerald-100 text-emerald-700',
};

const tierIcons: Record<string, string> = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  platinum: '💎',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

export function CustomersView() {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  const totalCustomers = customers.length;
  const totalSpent = customers.reduce((a, c) => a + c.totalSpent, 0);
  const totalLoyalty = customers.reduce((a, c) => a + c.loyaltyPoints, 0);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Customers</h2>
          <p className="text-sm text-slate-500">Manage customer relationships and loyalty</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-xs h-9">
          <Plus className="h-3.5 w-3.5 mr-2" />
          Add Customer
        </Button>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{totalCustomers}</p>
              <p className="text-xs text-slate-500">Total Customers</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">₹{(totalSpent / 1000).toFixed(0)}K</p>
              <p className="text-xs text-slate-500">Total Spent</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{totalLoyalty.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Loyalty Points</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Search */}
      <motion.div variants={itemVariants}>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </motion.div>

      {/* Customer Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((customer) => (
          <Card
            key={customer.id}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setSelectedCustomer(customer)}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                    {customer.name.split(' ').map((n) => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">{customer.name}</p>
                  <Badge className={`text-[9px] h-4 ${tierColors[customer.tier]}`} variant="secondary">
                    {tierIcons[customer.tier]} {customer.tier}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{customer.email}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <Phone className="h-3 w-3" />
                  <span>{customer.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <MapPin className="h-3 w-3" />
                  <span>{customer.city}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-900">{customer.totalOrders}</p>
                  <p className="text-[9px] text-slate-500">Orders</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-emerald-700">₹{(customer.totalSpent / 1000).toFixed(0)}K</p>
                  <p className="text-[9px] text-slate-500">Spent</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-amber-700">{customer.loyaltyPoints}</p>
                  <p className="text-[9px] text-slate-500">Points</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Customer Detail Dialog */}
      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                  {selectedCustomer?.name.split(' ').map((n) => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              {selectedCustomer?.name}
            </DialogTitle>
            <DialogDescription>Customer profile and activity</DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={`text-xs h-5 ${tierColors[selectedCustomer.tier]}`} variant="secondary">
                  {tierIcons[selectedCustomer.tier]} {selectedCustomer.tier.charAt(0).toUpperCase() + selectedCustomer.tier.slice(1)} Member
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" />{selectedCustomer.email}</div>
                <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />{selectedCustomer.phone}</div>
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" />{selectedCustomer.city}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-slate-50"><CardContent className="p-3 text-center">
                  <p className="text-lg font-bold">{selectedCustomer.totalOrders}</p>
                  <p className="text-[10px] text-slate-500">Total Orders</p>
                </CardContent></Card>
                <Card className="bg-slate-50"><CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-emerald-700">₹{(selectedCustomer.totalSpent / 1000).toFixed(1)}K</p>
                  <p className="text-[10px] text-slate-500">Total Spent</p>
                </CardContent></Card>
              </div>
              <div className="text-xs text-slate-500 space-y-1 border-t pt-3">
                <p>Last order: {selectedCustomer.lastOrder}</p>
                <p>Member since: {selectedCustomer.joinedAt}</p>
                <p>Loyalty points: <span className="font-medium text-amber-700">{selectedCustomer.loyaltyPoints}</span></p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
