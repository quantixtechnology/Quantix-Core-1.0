'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Plus, Printer, CreditCard, Banknote, Smartphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

const posProducts = [
  { id: 'pp1', name: 'Basmati Rice 5kg', price: 450, gst: 5, inStock: true },
  { id: 'pp2', name: 'Toor Dal 1kg', price: 145, gst: 5, inStock: true },
  { id: 'pp3', name: 'Amul Butter 500g', price: 270, gst: 12, inStock: true },
  { id: 'pp4', name: 'Olive Oil 1L', price: 850, gst: 5, inStock: true },
  { id: 'pp5', name: 'Green Tea 25pk', price: 195, gst: 18, inStock: true },
  { id: 'pp6', name: 'Almond Flour', price: 450, gst: 12, inStock: true },
];

export function PosView() {
  const [cart, setCart] = useState<{ id: string; name: string; price: number; qty: number; gst: number }[]>([]);
  const [paperSize, setPaperSize] = useState('80mm');

  const addToCart = (p: typeof posProducts[0]) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === p.id);
      if (existing) return prev.map(c => c.id === p.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1, gst: p.gst }];
    });
  };

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const totalGst = cart.reduce((s, c) => s + (c.price * c.qty * c.gst / 100), 0);
  const total = subtotal + totalGst;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Products Grid */}
        <div className="lg:col-span-2">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Products</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {posProducts.map(p => (
                    <button key={p.id} onClick={() => addToCart(p)} className="p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors text-left">
                      <p className="text-xs font-medium text-slate-900 truncate">{p.name}</p>
                      <p className="text-sm font-bold text-slate-900 mt-1">₹{p.price}</p>
                      <p className="text-[9px] text-slate-400">GST {p.gst}%</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Cart & Payment */}
        <div className="space-y-3">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Cart</CardTitle>
                  {cart.length > 0 && <Button variant="ghost" size="sm" className="text-[10px] h-6 text-red-500" onClick={() => setCart([])}>Clear</Button>}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {cart.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Click products to add</p>
                ) : (
                  <div className="space-y-2">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center justify-between text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-900 truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-400">₹{item.price} × {item.qty}</p>
                        </div>
                        <span className="font-medium ml-2">₹{(item.price * item.qty).toLocaleString()}</span>
                        <button onClick={() => setCart(prev => prev.filter(c => c.id !== item.id))} className="ml-2 text-red-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t border-slate-200 mt-3 pt-3 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">CGST</span><span>₹{(totalGst / 2).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">SGST</span><span>₹{(totalGst / 2).toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Payment Methods */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] font-semibold text-slate-700 mb-2">Payment</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Cash', icon: Banknote, method: 'cash' },
                    { label: 'UPI', icon: Smartphone, method: 'upi' },
                    { label: 'Card', icon: CreditCard, method: 'card' },
                  ].map(pm => (
                    <Button key={pm.method} variant="outline" size="sm" className="text-[10px] h-8 flex-col gap-0.5">
                      <pm.icon className="h-3.5 w-3.5" />{pm.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Printer & Paper Size */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] font-semibold text-slate-700 mb-2">Print Receipt</p>
                <div className="flex gap-1.5 mb-2">
                  {['58mm', '80mm', 'A4'].map(size => (
                    <Button key={size} variant={paperSize === size ? 'default' : 'outline'} size="sm" className={`text-[10px] h-7 ${paperSize === size ? 'bg-emerald-600' : ''}`} onClick={() => setPaperSize(size)}>
                      {size}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="text-[10px] h-7 flex-1"><Printer className="h-3 w-3 mr-1" />Bluetooth</Button>
                  <Button variant="outline" size="sm" className="text-[10px] h-7 flex-1"><Printer className="h-3 w-3 mr-1" />USB</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-sm h-10" disabled={cart.length === 0}>
            Charge ₹{total.toFixed(2)}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
