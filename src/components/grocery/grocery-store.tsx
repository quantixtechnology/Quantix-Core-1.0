'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  MapPin,
  Truck,
  CheckCircle2,
  X,
  Leaf,
  Drumstick,
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
  _count: { products: number };
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
  isFeatured: boolean;
  isPopular: boolean;
  images: string;
  unit: string | null;
  category: { id: string; name: string } | null;
  variants: ProductVariant[];
}

interface CartItem {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
  mrp: number;
  discountPrice: number | null;
  isVeg: boolean | null;
  gstRate: number;
}

// ============================================================================
// Grocery Store Component
// ============================================================================

export function GroceryStore() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orderPlacing, setOrderPlacing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ orderNumber: string } | null>(null);

  // Fetch categories
  useEffect(() => {
    fetch(`${API_BASE}/categories`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setCategories(res.data);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch products
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const params = new URLSearchParams({ limit: '50' });
    if (selectedCategory) params.set('categoryId', selectedCategory);
    if (searchQuery) params.set('search', searchQuery);

    fetch(`${API_BASE}/products?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setProducts(res.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCategory, searchQuery]);

  // Cart helpers
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cartMrpTotal = cart.reduce((sum, item) => sum + item.mrp * item.quantity, 0);
  const cartDiscount = cartMrpTotal - cartSubtotal;
  const deliveryFee = cartSubtotal >= 500 ? 0 : 30;
  const gstAmount = cart.reduce((sum, item) => {
    const itemGst = (item.unitPrice * item.quantity * item.gstRate) / (100 + item.gstRate);
    return sum + itemGst;
  }, 0);
  const cartTotal = cartSubtotal + deliveryFee;

  const addToCart = useCallback((product: Product, variant?: ProductVariant) => {
    const v = variant || product.variants[0];
    if (!v) return;

    setCart((prev) => {
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
          isVeg: product.isVeg,
          gstRate: 0,
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((variantId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.variantId === variantId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
        )
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const removeFromCart = useCallback((variantId: string) => {
    setCart((prev) => prev.filter((item) => item.variantId !== variantId));
  }, []);

  const getItemQty = useCallback(
    (variantId: string) => {
      return cart.find((item) => item.variantId === variantId)?.quantity || 0;
    },
    [cart]
  );

  const placeOrder = async () => {
    setOrderPlacing(true);
    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: STORE_ID,
          orderType: 'DELIVERY',
          paymentMethod: 'COD',
          customerName: 'Walk-in Customer',
          customerPhone: '9999999999',
          deliveryAddress: '42 Linking Road, Bandra West, Mumbai 400050',
          items: cart.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            productName: item.productName,
            variantName: item.variantName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            mrp: item.mrp,
            discountPrice: item.discountPrice,
            totalPrice: item.unitPrice * item.quantity,
            totalMrp: item.mrp * item.quantity,
            isVeg: item.isVeg,
          })),
          subtotal: cartSubtotal,
          totalDiscount: cartDiscount,
          totalTax: gstAmount,
          deliveryFee,
          totalAmount: cartTotal,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setOrderSuccess({ orderNumber: data.data.orderNumber });
        setCart([]);
      }
    } catch (err) {
      console.error('Order failed:', err);
    } finally {
      setOrderPlacing(false);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-4 py-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center text-lg">
                🛒
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold">FreshMart Grocery</h1>
                <p className="text-emerald-100 text-xs">Fresh to your doorstep</p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="relative bg-white/20 hover:bg-white/30 text-white border-0"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <Badge className="absolute -top-2 -right-2 w-5 h-5 p-0 flex items-center justify-center bg-amber-500 text-white text-[10px] border-0">
                  {cartCount}
                </Badge>
              )}
            </Button>
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-300" />
            <Input
              placeholder="Search for groceries..."
              className="pl-10 bg-white/20 border-white/30 text-white placeholder:text-emerald-200 focus-visible:ring-white/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          {/* Category Pills */}
          <div className="border-b bg-white px-4 sm:px-6 py-2 flex-shrink-0">
            <ScrollArea className="w-full">
              <div className="flex gap-2 pb-1">
                <Button
                  size="sm"
                  variant={selectedCategory === null ? 'default' : 'outline'}
                  className={
                    selectedCategory === null
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shrink-0'
                      : 'shrink-0 border-slate-200'
                  }
                  onClick={() => setSelectedCategory(null)}
                >
                  🏠 All
                </Button>
                {categories.map((cat) => (
                  <Button
                    key={cat.id}
                    size="sm"
                    variant={selectedCategory === cat.id ? 'default' : 'outline'}
                    className={
                      selectedCategory === cat.id
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shrink-0'
                        : 'shrink-0 border-slate-200'
                    }
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    {cat.icon || '📦'} {cat.name}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Product Grid */}
          <ScrollArea className="flex-1">
            <div className="p-4 sm:p-6">
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <div className="h-28 bg-slate-200 rounded-t-lg" />
                      <CardContent className="p-3">
                        <div className="h-4 bg-slate-200 rounded mb-2" />
                        <div className="h-3 bg-slate-100 rounded mb-2 w-2/3" />
                        <div className="h-5 bg-slate-200 rounded w-1/2" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Search className="w-12 h-12 mb-3" />
                  <p className="text-lg font-medium">No products found</p>
                  <p className="text-sm">Try a different search or category</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {products.map((product) => {
                    const defaultVariant = product.variants[0];
                    if (!defaultVariant) return null;
                    const sellingPrice = defaultVariant.discountPrice || defaultVariant.price;
                    const hasDiscount = defaultVariant.mrp > sellingPrice;
                    const qty = getItemQty(defaultVariant.id);

                    return (
                      <Card
                        key={product.id}
                        className="group hover:shadow-md transition-shadow overflow-hidden border-slate-200"
                      >
                        {/* Image placeholder */}
                        <div className="relative h-28 bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center">
                          <span className="text-4xl">🛍️</span>
                          {/* Veg / Non-veg indicator */}
                          <div className="absolute top-2 left-2">
                            <div
                              className={cn(
                                'w-4 h-4 border rounded-sm flex items-center justify-center',
                                product.isVeg ? 'border-green-600' : 'border-red-600'
                              )}
                            >
                              <div
                                className={cn(
                                  'w-2 h-2 rounded-full',
                                  product.isVeg ? 'bg-green-600' : 'bg-red-600'
                                )}
                              />
                            </div>
                          </div>
                          {hasDiscount && (
                            <Badge className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] px-1.5 py-0 border-0">
                              {Math.round(((defaultVariant.mrp - sellingPrice) / defaultVariant.mrp) * 100)}% OFF
                            </Badge>
                          )}
                          {product.isFeatured && (
                            <Badge className="absolute bottom-2 left-2 bg-emerald-600 text-white text-[10px] px-1.5 py-0 border-0">
                              Featured
                            </Badge>
                          )}
                        </div>
                        <CardContent className="p-3">
                          <h3 className="font-medium text-sm leading-tight line-clamp-2 min-h-[2.5rem]">
                            {product.name}
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5">{defaultVariant.name}</p>
                          <div className="flex items-baseline gap-1.5 mt-1.5">
                            <span className="font-bold text-emerald-700">
                              {formatCurrency(sellingPrice)}
                            </span>
                            {hasDiscount && (
                              <span className="text-xs text-slate-400 line-through">
                                {formatCurrency(defaultVariant.mrp)}
                              </span>
                            )}
                          </div>
                          {/* Add / Quantity controls */}
                          <div className="mt-2">
                            {qty === 0 ? (
                              <Button
                                size="sm"
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs"
                                onClick={() => addToCart(product)}
                              >
                                <Plus className="w-3 h-3 mr-1" /> Add
                              </Button>
                            ) : (
                              <div className="flex items-center justify-center gap-2 bg-emerald-50 rounded-md h-8">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-emerald-700 hover:text-emerald-900"
                                  onClick={() => updateQuantity(defaultVariant.id, -1)}
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                                <span className="font-semibold text-sm text-emerald-700 w-6 text-center">
                                  {qty}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-emerald-700 hover:text-emerald-900"
                                  onClick={() => updateQuantity(defaultVariant.id, 1)}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Floating Cart Bar (Mobile) */}
      {cartCount > 0 && !cartOpen && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-white border-t shadow-lg z-40">
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-base font-semibold"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            {cartCount} item{cartCount > 1 ? 's' : ''} &middot; {formatCurrency(cartTotal)}
          </Button>
        </div>
      )}

      {/* Cart Sheet */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="p-4 border-b bg-emerald-50">
            <SheetTitle className="flex items-center gap-2 text-emerald-800">
              <ShoppingCart className="w-5 h-5" />
              Your Cart
              {cartCount > 0 && (
                <Badge className="bg-emerald-600 text-white ml-1">{cartCount}</Badge>
              )}
            </SheetTitle>
          </SheetHeader>

          {orderSuccess ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-emerald-800 mb-1">Order Placed!</h3>
              <p className="text-slate-500 mb-3">Your order has been placed successfully</p>
              <Badge className="bg-emerald-100 text-emerald-800 text-sm px-4 py-1 border-0">
                {orderSuccess.orderNumber}
              </Badge>
              <Button
                className="mt-6 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  setOrderSuccess(null);
                  setCartOpen(false);
                }}
              >
                Continue Shopping
              </Button>
            </div>
          ) : cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <ShoppingCart className="w-16 h-16 text-slate-300 mb-4" />
              <p className="text-lg font-medium text-slate-500">Your cart is empty</p>
              <p className="text-sm text-slate-400 mt-1">Add some groceries to get started</p>
              <Button
                variant="outline"
                className="mt-4 border-emerald-300 text-emerald-700"
                onClick={() => setCartOpen(false)}
              >
                Browse Products
              </Button>
            </div>
          ) : (
            <>
              {/* Delivery Address */}
              <div className="px-4 py-3 bg-amber-50 border-b flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-amber-800">Delivering to</p>
                  <p className="text-xs text-amber-600 truncate">
                    42 Linking Road, Bandra West, Mumbai
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="text-amber-700 text-xs h-auto p-1">
                  Change
                </Button>
              </div>

              {/* Cart Items */}
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.variantId}
                      className="flex items-start gap-3 bg-slate-50 rounded-lg p-3"
                    >
                      <div
                        className={cn(
                          'w-8 h-8 rounded flex items-center justify-center shrink-0',
                          item.isVeg ? 'bg-green-100' : 'bg-red-100'
                        )}
                      >
                        {item.isVeg ? (
                          <Leaf className="w-4 h-4 text-green-600" />
                        ) : (
                          <Drumstick className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm leading-tight">{item.productName}</h4>
                        <p className="text-xs text-slate-400">{item.variantName}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="font-semibold text-sm text-emerald-700">
                            {formatCurrency(item.unitPrice * item.quantity)}
                          </span>
                          {item.mrp > item.unitPrice && (
                            <span className="text-xs text-slate-400 line-through">
                              {formatCurrency(item.mrp * item.quantity)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 border-emerald-300"
                          onClick={() => updateQuantity(item.variantId, -1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-6 text-center font-semibold text-sm">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 border-emerald-300"
                          onClick={() => updateQuantity(item.variantId, 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                          onClick={() => removeFromCart(item.variantId)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Cart Footer */}
              <div className="border-t bg-white">
                <div className="p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-medium">{formatCurrency(cartSubtotal)}</span>
                  </div>
                  {cartDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-600">Discount</span>
                      <span className="text-emerald-600 font-medium">
                        -{formatCurrency(cartDiscount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Truck className="w-3 h-3" /> Delivery Fee
                    </span>
                    <span className={deliveryFee === 0 ? 'text-emerald-600 font-medium' : 'font-medium'}>
                      {deliveryFee === 0 ? 'FREE' : formatCurrency(deliveryFee)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-base font-bold">
                    <span>Total</span>
                    <span className="text-emerald-700">{formatCurrency(cartTotal)}</span>
                  </div>
                  {cartSubtotal < 500 && (
                    <p className="text-xs text-slate-400 text-center">
                      Add {formatCurrency(500 - cartSubtotal)} more for free delivery
                    </p>
                  )}
                </div>
                <SheetFooter className="px-4 pb-4">
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-base font-semibold"
                    onClick={placeOrder}
                    disabled={orderPlacing}
                  >
                    {orderPlacing ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Placing Order...
                      </div>
                    ) : (
                      `Place Order · ${formatCurrency(cartTotal)}`
                    )}
                  </Button>
                </SheetFooter>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
