'use client';

import { motion } from 'framer-motion';
import { Search, Filter, Plus, Package, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { products, businessTypeLabels, businessTypeColors, type BusinessType } from './data';
import { useState } from 'react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

const productStatusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-slate-100 text-slate-600',
  out_of_stock: 'bg-red-100 text-red-700',
};

const allCategories = Array.from(new Set(products.map((p) => p.category)));
const allBusinessTypes = Array.from(new Set(products.map((p) => p.businessType)));

export function ProductsView() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.storeName.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'all' || p.category === categoryFilter;
    const matchType = typeFilter === 'all' || p.businessType === typeFilter;
    return matchSearch && matchCategory && matchType;
  });

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Products</h2>
          <p className="text-sm text-slate-500">Manage product catalog across all stores</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-xs h-9">
          <Plus className="h-3.5 w-3.5 mr-2" />
          Add Product
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            className="h-9 rounded-md border border-slate-200 px-3 text-xs bg-white"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-slate-200 px-3 text-xs bg-white"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            {allBusinessTypes.map((t) => (
              <option key={t} value={t}>{businessTypeLabels[t as BusinessType]}</option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* Products Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((product) => (
          <Card key={product.id} className="hover:shadow-md transition-shadow overflow-hidden">
            {/* Product image placeholder */}
            <div className="h-32 bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
              <Package className="h-10 w-10 text-slate-300" />
            </div>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">{product.name}</p>
                  <p className="text-[10px] text-slate-500">{product.storeName}</p>
                </div>
                <Badge className={`text-[9px] h-4 shrink-0 ${productStatusColors[product.status]}`} variant="secondary">
                  {product.status.replace(/_/g, ' ')}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Badge className={`text-[9px] h-4 ${businessTypeColors[product.businessType]}`} variant="secondary">
                  {businessTypeLabels[product.businessType]}
                </Badge>
                <span className="text-[10px] text-slate-400">{product.category}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-emerald-700">₹{product.price}</span>
                  {product.mrp > product.price && (
                    <span className="text-[10px] text-slate-400 line-through">₹{product.mrp}</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500">GST: {product.gstRate}%</span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t">
                {product.stock > 0 ? (
                  <span className="text-[10px] text-slate-500">
                    Stock: <span className={product.stock < 10 ? 'text-red-600 font-medium' : 'text-emerald-600 font-medium'}>
                      {product.stock} {product.unit}
                    </span>
                  </span>
                ) : (
                  <span className="text-[10px] text-red-600 font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Out of Stock
                  </span>
                )}
                <span className="text-[10px] text-slate-400">/ {product.unit}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Package className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium">No products found</p>
          <p className="text-xs">Try adjusting your search or filters</p>
        </div>
      )}
    </motion.div>
  );
}
