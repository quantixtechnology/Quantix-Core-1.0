'use client';

import { motion } from 'framer-motion';
import {
  ShoppingCart,
  UtensilsCrossed,
  WashingMachine,
  Car,
  Home,
  Plus,
  Search,
  Filter,
  Mail,
  Phone,
  MapPin,
  Building2,
} from 'lucide-react';
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
import { businesses, businessTypeLabels, businessTypeColors, type BusinessType, type Business } from './data';
import { useState } from 'react';

const businessTypeIcons: Record<BusinessType, React.ElementType> = {
  grocery: ShoppingCart,
  food_delivery: UtensilsCrossed,
  laundry: WashingMachine,
  car_wash: Car,
  home_services: Home,
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

export function BusinessesView() {
  const [search, setSearch] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);

  const filtered = businesses.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.owner.toLowerCase().includes(search.toLowerCase()) ||
      b.city.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Businesses</h2>
          <p className="text-sm text-slate-500">Manage all on-boarded businesses on the platform</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-xs h-9">
          <Plus className="h-3.5 w-3.5 mr-2" />
          Add Business
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search businesses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" className="h-9 text-xs">
          <Filter className="h-3.5 w-3.5 mr-2" />
          Filter
        </Button>
      </motion.div>

      {/* Business Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(Object.keys(businessTypeLabels) as BusinessType[]).map((type) => {
          const Icon = businessTypeIcons[type];
          const count = businesses.filter((b) => b.type === type).length;
          return (
            <Card key={type} className="hover:shadow-sm transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${businessTypeColors[type]}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900">{count}</p>
                  <p className="text-[10px] text-slate-500">{businessTypeLabels[type]}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </motion.div>

      {/* Businesses Table */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Business</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Owner</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">City</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">Stores</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">Revenue</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((business) => {
                  const Icon = businessTypeIcons[business.type];
                  return (
                    <TableRow
                      key={business.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => setSelectedBusiness(business)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-lg ${businessTypeColors[business.type]}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-900">{business.name}</p>
                            <p className="text-[10px] text-slate-500">{business.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] h-5 ${businessTypeColors[business.type]}`} variant="secondary">
                          {businessTypeLabels[business.type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs hidden md:table-cell">{business.owner}</TableCell>
                      <TableCell className="text-xs hidden sm:table-cell">{business.city}</TableCell>
                      <TableCell className="text-xs hidden lg:table-cell">{business.totalStores}</TableCell>
                      <TableCell className="text-xs hidden lg:table-cell font-medium">
                        ₹{(business.monthlyRevenue / 100000).toFixed(1)}L
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-[10px] h-5 ${
                            business.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                          variant="secondary"
                        >
                          {business.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      {/* Business Detail Dialog */}
      <Dialog open={!!selectedBusiness} onOpenChange={() => setSelectedBusiness(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-600" />
              {selectedBusiness?.name}
            </DialogTitle>
            <DialogDescription>Business details and overview</DialogDescription>
          </DialogHeader>
          {selectedBusiness && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] h-5 ${businessTypeColors[selectedBusiness.type]}`} variant="secondary">
                    {businessTypeLabels[selectedBusiness.type]}
                  </Badge>
                </div>
                <Badge
                  className={`text-[10px] h-5 justify-self-end ${
                    selectedBusiness.status === 'active'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                  variant="secondary"
                >
                  {selectedBusiness.status}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-600">{selectedBusiness.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-600">{selectedBusiness.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-600">{selectedBusiness.city}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Card className="bg-slate-50">
                  <CardContent className="p-3 text-center">
                    <p className="text-lg font-bold text-slate-900">{selectedBusiness.totalStores}</p>
                    <p className="text-[10px] text-slate-500">Stores</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-50">
                  <CardContent className="p-3 text-center">
                    <p className="text-lg font-bold text-slate-900">
                      {(selectedBusiness.totalOrders / 1000).toFixed(1)}K
                    </p>
                    <p className="text-[10px] text-slate-500">Orders</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-50">
                  <CardContent className="p-3 text-center">
                    <p className="text-lg font-bold text-emerald-700">
                      ₹{(selectedBusiness.monthlyRevenue / 100000).toFixed(1)}L
                    </p>
                    <p className="text-[10px] text-slate-500">Monthly Rev.</p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex items-center justify-between text-sm border-t pt-3">
                <span className="text-slate-500">Plan: <span className="font-medium text-slate-700">{selectedBusiness.subscriptionPlan}</span></span>
                <span className="text-slate-500">Since: <span className="font-medium text-slate-700">{selectedBusiness.createdAt}</span></span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
