'use client';

import { motion } from 'framer-motion';
import { Search, Filter, Package, IndianRupee } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const itemVariants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

const demoProducts = [
  { id: 'p1', name: 'Basmati Rice 5kg', category: 'Rice & Grains', price: 450, mrp: 520, gst: 5, stock: 150, status: 'ACTIVE', isVeg: true },
  { id: 'p2', name: 'Toor Dal 1kg', category: 'Pulses', price: 145, mrp: 160, gst: 5, stock: 200, status: 'ACTIVE', isVeg: true },
  { id: 'p3', name: 'Amul Butter 500g', category: 'Dairy', price: 270, mrp: 280, gst: 12, stock: 80, status: 'ACTIVE', isVeg: true },
  { id: 'p4', name: 'Chicken Breast 1kg', category: 'Meat', price: 320, mrp: 350, gst: 0, stock: 25, status: 'ACTIVE', isVeg: false },
  { id: 'p5', name: 'Olive Oil 1L', category: 'Cooking Oil', price: 850, mrp: 950, gst: 5, stock: 40, status: 'ACTIVE', isVeg: true },
  { id: 'p6', name: 'Organic Honey 500g', category: 'Organic', price: 380, mrp: 420, gst: 12, stock: 0, status: 'OUT_OF_STOCK', isVeg: true },
  { id: 'p7', name: 'Green Tea 25 bags', category: 'Beverages', price: 195, mrp: 220, gst: 18, stock: 120, status: 'ACTIVE', isVeg: true },
  { id: 'p8', name: 'Almond Flour 500g', category: 'Baking', price: 450, mrp: 500, gst: 12, stock: 15, status: 'ACTIVE', isVeg: true },
];

export function ProductsView() {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Search & Filter */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input type="text" placeholder="Search products..." className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        </div>
        <Button variant="outline" size="sm" className="text-xs h-9"><Filter className="h-3.5 w-3.5 mr-1" />Filter</Button>
        <Button size="sm" className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700">+ Add Product</Button>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {demoProducts.map(product => (
          <motion.div key={product.id} variants={itemVariants}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{product.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{product.category}</p>
                  </div>
                  {product.isVeg !== null && (
                    <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${product.isVeg ? 'border-emerald-500' : 'border-red-500'}`}>
                      <div className={`w-2 h-2 rounded-full ${product.isVeg ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm font-bold text-slate-900">₹{product.price}</span>
                  <span className="text-[10px] text-slate-400 line-through">₹{product.mrp}</span>
                  <Badge variant="outline" className="text-[8px] h-4 ml-auto">GST {product.gst}%</Badge>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className={`text-[10px] ${product.stock > 20 ? 'text-emerald-600' : product.stock > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                    {product.stock > 20 ? `${product.stock} in stock` : product.stock > 0 ? `Low: ${product.stock} left` : 'Out of stock'}
                  </span>
                  <Badge className={`text-[9px] h-5 ${product.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`} variant="secondary">{product.status}</Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
