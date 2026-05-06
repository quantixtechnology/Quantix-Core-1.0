'use client';

import { motion } from 'framer-motion';
import { Monitor, CreditCard, Banknote, Wallet, Smartphone, Receipt, Plus, Minus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  gst: number;
}

const posProducts = [
  { id: 'pp1', name: 'Organic Basmati Rice', price: 520, gst: 5, category: 'Grains' },
  { id: 'pp2', name: 'Amul Butter 500g', price: 270, gst: 12, category: 'Dairy' },
  { id: 'pp3', name: 'Tata Salt 1kg', price: 24, gst: 0, category: 'Essentials' },
  { id: 'pp4', name: 'Maggi Noodles Pack', price: 168, gst: 12, category: 'Snacks' },
  { id: 'pp5', name: 'Olive Oil 500ml', price: 450, gst: 5, category: 'Oils' },
  { id: 'pp6', name: 'Green Tea (25 bags)', price: 180, gst: 5, category: 'Beverages' },
  { id: 'pp7', name: 'Whole Wheat Bread', price: 45, gst: 0, category: 'Bakery' },
  { id: 'pp8', name: 'Fresh Milk 1L', price: 68, gst: 5, category: 'Dairy' },
];

export function PosView() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>('upi');
  const [activeSession, setActiveSession] = useState(true);

  const addToCart = (product: typeof posProducts[0]) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: 1, gst: product.gst }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item))
        .filter((item) => item.qty > 0)
    );
  };

  const subtotal = cart.reduce((a, item) => a + item.price * item.qty, 0);
  const taxAmount = cart.reduce((a, item) => a + (item.price * item.qty * item.gst) / 100, 0);
  const total = subtotal + taxAmount;

  const paymentMethods = [
    { id: 'upi', label: 'UPI', icon: Smartphone },
    { id: 'card', label: 'Card', icon: CreditCard },
    { id: 'cash', label: 'Cash', icon: Banknote },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">POS Terminal</h2>
          <p className="text-sm text-slate-500">Point of Sale billing interface</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`text-xs ${activeSession ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`} variant="secondary">
            <div className={`w-2 h-2 rounded-full mr-1.5 ${activeSession ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {activeSession ? 'Session Active' : 'Session Closed'}
          </Badge>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Grid */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Quick Add Products</CardTitle>
                <Badge variant="outline" className="text-[10px]">FreshMart Andheri</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {posProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="flex flex-col items-center p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors text-center"
                  >
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mb-2">
                      <Receipt className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="text-[10px] font-medium text-slate-700 leading-tight mb-1">{product.name}</p>
                    <p className="text-xs font-bold text-emerald-700">₹{product.price}</p>
                    <p className="text-[9px] text-slate-400">GST {product.gst}%</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Cart & Checkout */}
        <motion.div variants={itemVariants}>
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Current Order
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {/* Cart Items */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {cart.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">No items in cart</p>
                )}
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-400">₹{item.price} × {item.qty}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-50"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-medium w-5 text-center">{item.qty}</span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-50"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="text-xs font-semibold text-slate-900 w-14 text-right">
                      ₹{(item.price * item.qty).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Tax (GST)</span>
                  <span>₹{taxAmount.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-sm">
                  <span>Total</span>
                  <span className="text-emerald-700">₹{total.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <p className="text-[10px] text-slate-500 mb-2">Payment Method</p>
                <div className="grid grid-cols-2 gap-2">
                  {paymentMethods.map((pm) => {
                    const Icon = pm.icon;
                    return (
                      <button
                        key={pm.id}
                        onClick={() => setPaymentMethod(pm.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs transition-colors ${
                          paymentMethod === pm.id
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {pm.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-xs h-10" disabled={cart.length === 0}>
                  Charge ₹{total.toFixed(2)}
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-xs h-8"
                  onClick={() => setCart([])}
                  disabled={cart.length === 0}
                >
                  <Trash2 className="h-3 w-3 mr-1.5" />
                  Clear Cart
                </Button>
              </div>

              {/* Session Info */}
              <div className="text-[10px] text-slate-400 space-y-1 pt-2 border-t">
                <p>Cashier: Admin User</p>
                <p>Terminal: POS-001</p>
                <p>Orders today: 45</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
