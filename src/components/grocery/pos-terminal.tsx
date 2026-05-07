'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Barcode,
  Receipt,
  User,
  Phone,
  Banknote,
  CreditCard,
  Smartphone,
  X,
  Printer,
  LogOut,
  Play,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

// ============================================================================
// Constants & Types
// ============================================================================

const BUSINESS_ID = 'cmoui0c430002q9uv7w42p66l';
const STORE_ID = 'cmoui0c4b000aq9uv18514et5';
const API_BASE = `/api/businesses/${BUSINESS_ID}`;

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

interface ProductVariant {
  id: string;
  name: string;
  price: number;
  mrp: number;
  discountPrice: number | null;
  stock: number;
  isDefault: boolean;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  shortDesc: string | null;
  isVeg: boolean | null;
  unit: string | null;
  category: { id: string; name: string } | null;
  variants: ProductVariant[];
}

interface BillItem {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
  mrp: number;
  discountPrice: number | null;
  gstRate: number;
  isVeg: boolean | null;
}

interface POSSession {
  id: string;
  sessionNumber: string;
  status: string;
  openingBalance: number;
  totalSales: number;
  totalOrders: number;
  totalCash: number;
  totalCard: number;
  totalUpi: number;
  openedAt: string;
  store: { id: string; name: string };
}

type PaymentMethod = 'CASH' | 'CARD' | 'UPI';

// ============================================================================
// POS Terminal Component
// ============================================================================

export function PosTerminal() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [billGenerating, setBillGenerating] = useState(false);
  const [session, setSession] = useState<POSSession | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastBill, setLastBill] = useState<{ orderNumber: string; totalAmount: number } | null>(null);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('5000');

  // Fetch categories
  useEffect(() => {
    fetch(`${API_BASE}/categories`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) setCategories(res.data);
      })
      .catch(console.error);
  }, []);

  // Fetch products
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '50' });
    if (selectedCategory) params.set('categoryId', selectedCategory);
    if (searchQuery) params.set('search', searchQuery);

    fetch(`${API_BASE}/products?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) setProducts(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCategory, searchQuery]);

  // Fetch active POS session
  useEffect(() => {
    fetch(`${API_BASE}/pos/sessions?status=OPEN`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data && res.data.length > 0) {
          setSession(res.data[0]);
        }
      })
      .catch(console.error);
  }, []);

  // Bill calculations
  const subtotal = billItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalGst = billItems.reduce((sum, item) => {
    const gstAmt = (item.unitPrice * item.quantity * item.gstRate) / (100 + item.gstRate);
    return sum + gstAmt;
  }, 0);
  const cgst = totalGst / 2;
  const sgst = totalGst / 2;
  const roundOff = Math.round(subtotal + totalGst) - (subtotal + totalGst);
  const totalAmount = subtotal + totalGst + roundOff;

  const addToBill = useCallback((product: Product, variant?: ProductVariant) => {
    const v = variant || product.variants[0];
    if (!v) return;

    setBillItems((prev) => {
      const existing = prev.find((item) => item.variantId === v.id);
      if (existing) {
        return prev.map((item) =>
          item.variantId === v.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          variantId: v.id,
          productName: product.name,
          variantName: v.name,
          quantity: 1,
          unitPrice: v.discountPrice || v.price,
          mrp: v.mrp,
          discountPrice: v.discountPrice,
          gstRate: 0,
          isVeg: product.isVeg,
        },
      ];
    });
  }, []);

  const updateBillQty = useCallback((variantId: string, delta: number) => {
    setBillItems((prev) =>
      prev
        .map((item) =>
          item.variantId === variantId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const removeBillItem = useCallback((variantId: string) => {
    setBillItems((prev) => prev.filter((item) => item.variantId !== variantId));
  }, []);

  const clearBill = useCallback(() => {
    setBillItems([]);
    setCustomerName('');
    setCustomerPhone('');
  }, []);

  const generateBill = async () => {
    if (billItems.length === 0) return;
    setBillGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/pos/billing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: STORE_ID,
          posSessionId: session?.id,
          operatorId: 'operator_1',
          customerId: undefined,
          customerName: customerName || 'Walk-in Customer',
          customerPhone: customerPhone || undefined,
          paymentMethod,
          items: billItems.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            productName: item.productName,
            variantName: item.variantName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            mrp: item.mrp,
            discountPrice: item.discountPrice,
            totalPrice: item.unitPrice * item.quantity,
            gstRate: item.gstRate,
            cgstAmount: (item.unitPrice * item.quantity * item.gstRate) / (2 * (100 + item.gstRate)),
            sgstAmount: (item.unitPrice * item.quantity * item.gstRate) / (2 * (100 + item.gstRate)),
            gstAmount: (item.unitPrice * item.quantity * item.gstRate) / (100 + item.gstRate),
            isVeg: item.isVeg,
          })),
          subtotal,
          totalDiscount: 0,
          totalTax: totalGst,
          cgstAmount: cgst,
          sgstAmount: sgst,
          roundOff,
          totalAmount,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setLastBill({
          orderNumber: data.data.orderNumber,
          totalAmount: data.data.totalAmount,
        });
        setShowReceipt(true);
        clearBill();
        // Refresh session
        if (session) {
          const sessRes = await fetch(`${API_BASE}/pos/sessions/${session.id}`);
          const sessData = await sessRes.json();
          if (sessData.success && sessData.data) setSession(sessData.data);
        }
      }
    } catch (err) {
      console.error('Bill generation failed:', err);
    } finally {
      setBillGenerating(false);
    }
  };

  const openSession = async () => {
    try {
      const res = await fetch(`${API_BASE}/pos/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: STORE_ID,
          operatorId: 'operator_1',
          openingBalance: parseFloat(openingBalance) || 5000,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setSession(data.data);
        setSessionDialogOpen(false);
      }
    } catch (err) {
      console.error('Open session failed:', err);
    }
  };

  const closeSession = async () => {
    if (!session) return;
    try {
      await fetch(`${API_BASE}/pos/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close' }),
      });
      setSession(null);
    } catch (err) {
      console.error('Close session failed:', err);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="flex h-full">
      {/* LEFT SIDE — Product Search/Browse (70%) */}
      <div className="flex-1 flex flex-col border-r min-w-0">
        {/* Search Bar */}
        <div className="p-3 border-b bg-white flex gap-2">
          <div className="relative flex-1">
            <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Scan barcode or search products..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Category Quick Access */}
        <div className="border-b bg-slate-50 px-3 py-2">
          <ScrollArea className="w-full">
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant={selectedCategory === null ? 'default' : 'outline'}
                className={
                  selectedCategory === null
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 text-xs h-7'
                    : 'shrink-0 text-xs h-7'
                }
                onClick={() => setSelectedCategory(null)}
              >
                All
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  size="sm"
                  variant={selectedCategory === cat.id ? 'default' : 'outline'}
                  className={
                    selectedCategory === cat.id
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 text-xs h-7'
                      : 'shrink-0 text-xs h-7'
                  }
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.icon} {cat.name}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Product Grid */}
        <ScrollArea className="flex-1">
          <div className="p-3">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-2">
                      <div className="h-4 bg-slate-200 rounded mb-2" />
                      <div className="h-3 bg-slate-100 rounded mb-2 w-2/3" />
                      <div className="h-6 bg-slate-200 rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Search className="w-10 h-10 mb-2" />
                <p className="text-sm">No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {products.map((product) => {
                  const v = product.variants[0];
                  if (!v) return null;
                  const price = v.discountPrice || v.price;

                  return (
                    <button
                      key={product.id}
                      className="text-left bg-white border border-slate-200 rounded-lg p-2.5 hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors"
                      onClick={() => addToBill(product)}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <div
                              className={cn(
                                'w-3 h-3 border rounded-sm flex items-center justify-center shrink-0',
                                product.isVeg ? 'border-green-600' : 'border-red-600'
                              )}
                            >
                              <div
                                className={cn(
                                  'w-1.5 h-1.5 rounded-full',
                                  product.isVeg ? 'bg-green-600' : 'bg-red-600'
                                )}
                              />
                            </div>
                            <span className="font-medium text-xs truncate">{product.name}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">{v.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="font-bold text-sm text-emerald-700">
                          {formatCurrency(price)}
                        </span>
                        <Plus className="w-4 h-4 text-emerald-600" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* RIGHT SIDE — Current Bill (30%) */}
      <div className="w-[340px] lg:w-[380px] flex flex-col bg-white shrink-0 hidden md:flex">
        {/* Session Info Bar */}
        <div className="p-3 border-b bg-slate-50 flex items-center justify-between">
          <div>
            {session ? (
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                  <Play className="w-3 h-3 mr-1" />
                  Session Open
                </Badge>
                <span className="text-xs text-slate-500">
                  {formatCurrency(session.totalSales)} sales · {session.totalOrders} orders
                </span>
              </div>
            ) : (
              <Badge className="bg-slate-100 text-slate-500 border-0 text-xs">No Session</Badge>
            )}
          </div>
          <div className="flex gap-1">
            {!session ? (
              <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setSessionDialogOpen(true)}>
                Open Session
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={closeSession}>
                <LogOut className="w-3 h-3 mr-1" /> Close
              </Button>
            )}
          </div>
        </div>

        {/* Customer */}
        <div className="p-3 border-b">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Customer phone"
                className="pl-8 h-8 text-xs"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
            <div className="relative flex-1">
              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Customer name"
                className="pl-8 h-8 text-xs"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Bill Items */}
        <ScrollArea className="flex-1">
          {billItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6">
              <Receipt className="w-10 h-10 mb-2" />
              <p className="text-sm font-medium">No items in bill</p>
              <p className="text-xs">Click products to add</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {billItems.map((item) => (
                <div
                  key={item.variantId}
                  className="flex items-center gap-2 p-2 rounded bg-slate-50 hover:bg-slate-100 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <div
                        className={cn(
                          'w-3 h-3 border rounded-sm flex items-center justify-center shrink-0',
                          item.isVeg ? 'border-green-600' : 'border-red-600'
                        )}
                      >
                        <div
                          className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            item.isVeg ? 'bg-green-600' : 'bg-red-600'
                          )}
                        />
                      </div>
                      <span className="text-xs font-medium truncate">{item.productName}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{item.variantName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0 text-xs"
                      onClick={() => updateBillQty(item.variantId, -1)}
                    >
                      <Minus className="w-2.5 h-2.5" />
                    </Button>
                    <span className="w-5 text-center text-xs font-semibold">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0 text-xs"
                      onClick={() => updateBillQty(item.variantId, 1)}
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </Button>
                  </div>
                  <span className="text-xs font-semibold w-16 text-right">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"
                    onClick={() => removeBillItem(item.variantId)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Payment & Totals */}
        <div className="border-t">
          {/* Payment Method */}
          <div className="p-3 border-b">
            <p className="text-xs font-medium text-slate-500 mb-2">Payment Method</p>
            <div className="flex gap-1.5">
              {[
                { method: 'CASH' as const, icon: Banknote, label: 'Cash' },
                { method: 'CARD' as const, icon: CreditCard, label: 'Card' },
                { method: 'UPI' as const, icon: Smartphone, label: 'UPI' },
              ].map(({ method, icon: Icon, label }) => (
                <Button
                  key={method}
                  variant={paymentMethod === method ? 'default' : 'outline'}
                  size="sm"
                  className={
                    paymentMethod === method
                      ? 'flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9'
                      : 'flex-1 text-xs h-9'
                  }
                  onClick={() => setPaymentMethod(method)}
                >
                  <Icon className="w-4 h-4 mr-1" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="p-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            {totalGst > 0 && (
              <>
                <div className="flex justify-between text-slate-400">
                  <span>CGST</span>
                  <span>{formatCurrency(cgst)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>SGST</span>
                  <span>{formatCurrency(sgst)}</span>
                </div>
              </>
            )}
            {Math.abs(roundOff) > 0.01 && (
              <div className="flex justify-between text-slate-400">
                <span>Round Off</span>
                <span>{roundOff > 0 ? '+' : ''}{formatCurrency(roundOff)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span className="text-emerald-700">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="px-3 pb-3 flex gap-2">
            {billItems.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-9 border-red-200 text-red-600 hover:bg-red-50"
                onClick={clearBill}
              >
                Clear
              </Button>
            )}
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-10 font-semibold"
              disabled={billItems.length === 0 || billGenerating}
              onClick={generateBill}
            >
              {billGenerating ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </div>
              ) : (
                <>
                  <Printer className="w-4 h-4 mr-1" />
                  Generate Bill · {formatCurrency(totalAmount)}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Session Dialog */}
      <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Open POS Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Opening Balance</label>
              <Input
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="mt-1"
                placeholder="Enter opening cash balance"
              />
              <p className="text-xs text-slate-400 mt-1">Cash in drawer at the start of session</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={openSession}>
              Open Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Preview Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" />
              Bill Generated
            </DialogTitle>
          </DialogHeader>
          {lastBill && (
            <div className="bg-slate-50 rounded-lg p-4 font-mono text-xs space-y-3 border">
              {/* Thermal Receipt Style */}
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <p className="font-bold text-sm">FRESHMART GROCERY</p>
                <p className="text-slate-500">42 Linking Road, Bandra West</p>
                <p className="text-slate-500">Mumbai - 400050</p>
                <p className="text-slate-500">GSTIN: 27AABCF1234A1Z5</p>
              </div>
              <div className="border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span>Bill No:</span>
                  <span className="font-bold">{lastBill.orderNumber}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Date:</span>
                  <span>{new Date().toLocaleDateString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Payment:</span>
                  <span>{paymentMethod}</span>
                </div>
              </div>
              <div className="text-center border-t border-dashed border-slate-300 pt-3">
                <p className="font-bold text-lg text-emerald-700">{formatCurrency(lastBill.totalAmount)}</p>
                <p className="text-slate-500 mt-1">Thank you for shopping!</p>
                <p className="text-slate-400 text-[10px]">Visit again</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setShowReceipt(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile POS - Show bill button */}
      {billItems.length > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-3 bg-white border-t shadow-lg z-40">
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 font-semibold"
            onClick={generateBill}
            disabled={billGenerating}
          >
            {billGenerating ? 'Processing...' : `Generate Bill · ${formatCurrency(totalAmount)}`}
          </Button>
        </div>
      )}
    </div>
  );
}
