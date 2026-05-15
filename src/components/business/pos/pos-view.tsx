"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Monitor,
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  Receipt,
  Printer,
  X,
  ShoppingCart,
  User,
  Barcode,
  Tag,
  Percent,
} from "lucide-react";
import { useProducts, useCategories, useCreateOrder } from "@/hooks/use-api";
import { setBusinessContext } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast-utils";
import { PageHeader } from "@/components/admin/shared/page-header";
import { useAdminStore } from "@/stores/admin-store";
import { getDemoProducts, getDemoCategories, getDemoCustomers, getDemoOrderPrefix, getDemoStoreInfo } from "@/lib/demo-data";

// ============================================================================
// Types
// ============================================================================

const BUSINESS_ID = "biz_1"

interface CartItem {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
  mrp: number;
  isVeg: boolean;
}

type PaymentMethod = "CASH" | "UPI" | "CARD";
type DiscountType = "PERCENTAGE" | "FLAT";
type ReceiptPaperSize = "58mm" | "80mm" | "A4";

// ============================================================================
// Format helpers
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function generateBillNumber(prefix: string): string {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const rand = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
  return `${prefix}${datePart}-${rand}`;
}

// ============================================================================
// POSView Component
// ============================================================================

export function POSView() {
  // Get demo business context
  const { currentBusinessType } = useAdminStore()

  // Demo data — context-aware fallbacks
  const demoProductsFallback = useMemo(() => {
    return getDemoProducts(currentBusinessType).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      categoryId: p.categoryId,
      category: p.category,
      status: p.status,
      isVeg: p.isVeg,
      isFeatured: p.isFeatured,
      image: p.image,
      variants: p.variants.map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        mrp: v.mrp,
        price: v.price,
        stock: v.stock,
        isDefault: v.isDefault,
      })),
    }))
  }, [currentBusinessType])

  const demoCategoriesFallback = useMemo(() => {
    const cats = getDemoCategories(currentBusinessType)
    const prods = getDemoProducts(currentBusinessType)
    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      productCount: prods.filter((p) => p.categoryId === c.id).length,
      icon: c.icon,
      color: c.color,
      sortOrder: c.sortOrder,
    }))
  }, [currentBusinessType])

  const businessCustomers = useMemo(() => {
    return getDemoCustomers(currentBusinessType).map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      totalOrders: c.totalOrders,
      totalSpent: c.totalSpent,
      loyaltyPoints: c.loyaltyPoints,
      tier: c.tier,
      lastOrder: c.lastOrder,
    }))
  }, [currentBusinessType])

  // Set business context on mount
  useEffect(() => {
    setBusinessContext(BUSINESS_ID)
  }, [])

  // ---- API hooks ----
  const { data: productsData } = useProducts(BUSINESS_ID)
  const { data: categoriesData } = useCategories(BUSINESS_ID)
  const createOrderMutation = useCreateOrder()

  // Map API products data (fall back to demo data if API hasn't loaded)
  const apiProducts = useMemo(() => {
    if (!productsData?.data || !Array.isArray(productsData.data)) return demoProductsFallback
    return (productsData.data as unknown as Record<string, unknown>[]).map((p) => ({
      ...p,
      id: String(p.id || ""),
      name: String(p.name || ""),
      status: String(p.status || "ACTIVE"),
      categoryId: String(p.categoryId || ""),
      category: String(p.categoryName || p.category || ""),
      isVeg: Boolean(p.isVeg !== undefined ? p.isVeg : true),
      isFeatured: Boolean(p.isFeatured || false),
      variants: Array.isArray(p.variants)
        ? p.variants.map((v: Record<string, unknown>, i: number) => ({
            id: String(v.id || `var_${i}`),
            name: String(v.name || "Default"),
            sku: String(v.sku || ""),
            mrp: Number(v.mrp || 0),
            price: Number(v.price || 0),
            stock: Number(v.stock || 0),
            isDefault: Boolean(v.isDefault || i === 0),
          }))
        : undefined,
    }))
  }, [productsData, demoProductsFallback])

  const apiCategories = useMemo(() => {
    if (!categoriesData?.data || !Array.isArray(categoriesData.data)) return demoCategoriesFallback
    return (categoriesData.data as unknown as Record<string, unknown>[]).map((c) => ({
      ...c,
      id: String(c.id || ""),
      name: String(c.name || ""),
      slug: String(c.slug || ""),
      productCount: Number(c.productCount || 0),
    }))
  }, [categoriesData, demoCategoriesFallback])

  // ---- State ----
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("walk-in");
  const [discountType, setDiscountType] = useState<DiscountType>("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState<string>("");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [activePaymentMethod, setActivePaymentMethod] = useState<PaymentMethod>("CASH");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptPaperSize, setReceiptPaperSize] = useState<ReceiptPaperSize>("80mm");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [lastBillNumber, setLastBillNumber] = useState<string>("");
  const [sessionBillCount, setSessionBillCount] = useState(0);
  const [sessionStartTime] = useState(new Date());

  // ---- Filtered products ----
  const filteredProducts = useMemo(() => {
    let result = apiProducts.filter((p) => p.status === "ACTIVE");
    if (selectedCategory !== "all") {
      result = result.filter((p) => p.categoryId === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.variants && p.variants.some((v) => v.sku.toLowerCase().includes(q)))
      );
    }
    return result;
  }, [selectedCategory, searchQuery, apiProducts]);

  // ---- Cart calculations ----
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart]
  );

  const discountAmount = useMemo(() => {
    const val = parseFloat(discountValue) || 0;
    if (discountType === "PERCENTAGE") {
      return Math.round(subtotal * (val / 100) * 100) / 100;
    }
    return Math.min(val, subtotal);
  }, [subtotal, discountType, discountValue]);

  const taxableAmount = subtotal - discountAmount;
  const cgst = Math.round(taxableAmount * 0.09 * 100) / 100;
  const sgst = Math.round(taxableAmount * 0.09 * 100) / 100;
  const totalAmount = Math.round((taxableAmount + cgst + sgst) * 100) / 100;

  // ---- Cart actions ----
  const addToCart = useCallback(
    (productId: string) => {
      const product = apiProducts.find((p) => p.id === productId);
      if (!product) return;
      const defaultVariant = product.variants?.find((v) => v.isDefault) || product.variants?.[0];
      if (!defaultVariant) return;

      setCart((prev) => {
        const existing = prev.find((item) => item.variantId === defaultVariant.id);
        if (existing) {
          return prev.map((item) =>
            item.variantId === defaultVariant.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        }
        return [
          ...prev,
          {
            productId: product.id,
            variantId: defaultVariant.id,
            productName: product.name,
            variantName: defaultVariant.name,
            quantity: 1,
            unitPrice: defaultVariant.price,
            mrp: defaultVariant.mrp,
            isVeg: product.isVeg,
          },
        ];
      });
    },
    [apiProducts]
  );

  const updateQuantity = useCallback((variantId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.variantId === variantId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((variantId: string) => {
    setCart((prev) => prev.filter((item) => item.variantId !== variantId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setDiscountValue("");
    setSelectedCustomer("walk-in");
  }, []);

  const handleNewBill = useCallback(() => {
    clearCart();
    setPaymentConfirmed(false);
    setPaymentDialogOpen(false);
    setReceiptDialogOpen(false);
    setCashReceived("");
  }, [clearCart]);

  // ---- Payment ----
  const openPaymentDialog = useCallback(
    (method: PaymentMethod) => {
      if (cart.length === 0) return;
      setActivePaymentMethod(method);
      setPaymentConfirmed(false);
      setCashReceived("");
      setPaymentDialogOpen(true);
    },
    [cart.length]
  );

  const selectedCustomerData = useMemo(() => {
    if (selectedCustomer === "walk-in") return null;
    return businessCustomers.find((c) => c.id === selectedCustomer) || null;
  }, [selectedCustomer, businessCustomers]);

  const confirmPayment = useCallback(async () => {
    try {
      // Create order via API for POS orders
      if (cart.length > 0) {
        createOrderMutation.mutate({
          storeId: "store_1",
          orderType: "POS",
          customerName: selectedCustomerData?.name || "Walk-in Customer",
          customerPhone: selectedCustomerData?.phone,
          paymentMethod: activePaymentMethod,
          items: cart.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
          posSessionId: `pos_session_${sessionStartTime.getTime()}`,
        })
      }
    } catch {
      // Non-blocking - payment is still confirmed locally
    }

    setPaymentConfirmed(true);
    setSessionBillCount((prev) => prev + 1);
    const billNum = generateBillNumber(getDemoOrderPrefix(currentBusinessType));
    setLastBillNumber(billNum);
  }, [cart, selectedCustomerData, activePaymentMethod, createOrderMutation, sessionStartTime, currentBusinessType]);

  const openReceipt = useCallback(() => {
    setPaymentDialogOpen(false);
    setReceiptDialogOpen(true);
  }, []);

  const handlePrintAndClose = useCallback(() => {
    setReceiptDialogOpen(false);
    clearCart();
    setPaymentConfirmed(false);
  }, [clearCart]);

  const cashChange = useMemo(() => {
    const received = parseFloat(cashReceived) || 0;
    return Math.max(0, Math.round((received - totalAmount) * 100) / 100);
  }, [cashReceived, totalAmount]);

  // ---- Session info ----
  const sessionDuration = useMemo(() => {
    const diff = Date.now() - sessionStartTime.getTime();
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hrs}h ${mins}m`;
  }, [sessionStartTime]);

  // ---- Receipt width based on paper size ----
  const receiptWidthClass = useMemo(() => {
    switch (receiptPaperSize) {
      case "58mm":
        return "max-w-[232px]";
      case "80mm":
        return "max-w-[320px]";
      case "A4":
        return "max-w-[595px]";
      default:
        return "max-w-[320px]";
    }
  }, [receiptPaperSize]);

  // ---- Keyboard shortcuts ----
  const shortcuts = [
    { key: "F2", label: "New Bill" },
    { key: "F3", label: "Search" },
    { key: "F4", label: "Pay Cash" },
    { key: "F5", label: "Pay UPI" },
    { key: "F6", label: "Pay Card" },
    { key: "F8", label: "Clear Cart" },
    { key: "Esc", label: "Close" },
  ];

  // ============================================================================
  // Render: Cart Panel (shared between desktop & mobile sheet)
  // ============================================================================
  const renderCartPanel = () => (
    <div className="flex flex-col h-full bg-card">
      {/* Customer Selection */}
      <div className="p-3 border-b">
        <div className="flex items-center gap-2 mb-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Customer</span>
        </div>
        <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
          <SelectTrigger className="w-full h-9">
            <SelectValue placeholder="Select customer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="walk-in">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Walk-in Customer</span>
              </div>
            </SelectItem>
            {businessCustomers.map((customer) => (
              <SelectItem key={customer.id} value={customer.id}>
                <div className="flex items-center gap-2">
                  <span>{customer.name}</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    {customer.tier}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedCustomerData && (
          <p className="text-xs text-muted-foreground mt-1.5">
            {selectedCustomerData.phone} · {selectedCustomerData.loyaltyPoints} pts
          </p>
        )}
      </div>

      {/* Cart Items */}
      <ScrollArea className="flex-1">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
            <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Cart is empty</p>
            <p className="text-xs mt-1">Click products to add items</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {cart.map((item) => (
              <div
                key={item.variantId}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 hover:bg-muted group"
              >
                {/* Veg/Non-veg indicator */}
                <div
                  className={`w-4 h-4 border rounded-sm flex items-center justify-center shrink-0 ${
                    item.isVeg ? "border-green-600" : "border-red-600"
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      item.isVeg ? "bg-green-600" : "bg-red-600"
                    }`}
                  />
                </div>

                {/* Item details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">{item.variantName}</p>
                </div>

                {/* Quantity controls */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => updateQuantity(item.variantId, -1)}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="w-6 text-center text-sm font-semibold">
                    {item.quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => updateQuantity(item.variantId, 1)}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>

                {/* Price */}
                <span className="text-sm font-semibold w-20 text-right">
                  {formatCurrency(item.unitPrice * item.quantity)}
                </span>

                {/* Remove */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  onClick={() => removeItem(item.variantId)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Discount & Summary & Actions - Sticky Bottom */}
      <div className="border-t bg-card">
        {/* Discount */}
        {cart.length > 0 && (
          <div className="px-3 pt-3">
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <Select
                value={discountType}
                onValueChange={(v) => setDiscountType(v as DiscountType)}
              >
                <SelectTrigger className="w-[110px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENTAGE">
                    <div className="flex items-center gap-1">
                      <Percent className="w-3 h-3" /> Percent
                    </div>
                  </SelectItem>
                  <SelectItem value="FLAT">
                    <div className="flex items-center gap-1">
                      <Tag className="w-3 h-3" /> Flat
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder={discountType === "PERCENTAGE" ? "0%" : "₹0"}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="h-8 text-xs flex-1"
                min="0"
                max={discountType === "PERCENTAGE" ? "100" : undefined}
              />
            </div>
          </div>
        )}

        {/* Cart Summary */}
        <div className="p-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3" />
                Discount
                {discountType === "PERCENTAGE" && discountValue
                  ? ` (${discountValue}%)`
                  : ""}
              </span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground text-xs">
            <span>CGST (9%)</span>
            <span>{formatCurrency(cgst)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground text-xs">
            <span>SGST (9%)</span>
            <span>{formatCurrency(sgst)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(totalAmount)}</span>
          </div>
        </div>

        {/* Payment Buttons */}
        <div className="px-3 pb-2">
          <div className="grid grid-cols-3 gap-2">
            <Button
              className="h-12 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={cart.length === 0}
              onClick={() => openPaymentDialog("CASH")}
            >
              <Banknote className="w-5 h-5 mr-1.5" />
              Cash
            </Button>
            <Button
              className="h-12 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white"
              disabled={cart.length === 0}
              onClick={() => openPaymentDialog("UPI")}
            >
              <Smartphone className="w-5 h-5 mr-1.5" />
              UPI
            </Button>
            <Button
              className="h-12 text-sm font-semibold bg-sky-600 hover:bg-sky-700 text-white"
              disabled={cart.length === 0}
              onClick={() => openPaymentDialog("CARD")}
            >
              <CreditCard className="w-5 h-5 mr-1.5" />
              Card
            </Button>
          </div>
        </div>

        {/* Clear Cart & Print */}
        <div className="px-3 pb-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-9 border-destructive/30 text-destructive hover:bg-destructive/10 flex-1"
            onClick={clearCart}
            disabled={cart.length === 0}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Clear Cart
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-9 flex-1"
            disabled={cart.length === 0}
            onClick={() => {
              if (cart.length > 0) {
                const billNum = lastBillNumber || generateBillNumber(getDemoOrderPrefix(currentBusinessType));
                setLastBillNumber(billNum);
                setReceiptDialogOpen(true);
              }
            }}
          >
            <Printer className="w-3.5 h-3.5 mr-1" />
            Print Receipt
          </Button>
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // Render: Payment Dialog
  // ============================================================================
  const renderPaymentDialog = () => (
    <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {activePaymentMethod === "CASH" && (
              <Banknote className="w-5 h-5 text-emerald-600" />
            )}
            {activePaymentMethod === "UPI" && (
              <Smartphone className="w-5 h-5 text-violet-600" />
            )}
            {activePaymentMethod === "CARD" && (
              <CreditCard className="w-5 h-5 text-sky-600" />
            )}
            {paymentConfirmed ? "Payment Successful" : `Pay with ${activePaymentMethod}`}
          </DialogTitle>
          <DialogDescription>
            {paymentConfirmed
              ? "Transaction completed successfully"
              : "Complete the payment to generate bill"}
          </DialogDescription>
        </DialogHeader>

        {paymentConfirmed ? (
          /* Success State */
          <div className="py-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <Receipt className="w-8 h-8 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-700 mb-1">
              {formatCurrency(totalAmount)}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Payment received via {activePaymentMethod}
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Bill: {lastBillNumber}
            </p>
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={openReceipt}
              >
                <Receipt className="w-4 h-4 mr-1.5" />
                View Receipt
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleNewBill}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                New Bill
              </Button>
            </div>
          </div>
        ) : (
          /* Payment Form */
          <div className="space-y-4 py-2">
            {/* Order Total */}
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Order Total</p>
              <p className="text-3xl font-bold text-primary mt-1">
                {formatCurrency(totalAmount)}
              </p>
            </div>

            {/* Cash: Amount received & change */}
            {activePaymentMethod === "CASH" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Amount Received</Label>
                  <Input
                    type="number"
                    placeholder="Enter amount received"
                    className="mt-1.5 text-lg h-12 font-semibold"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    min={0}
                  />
                </div>
                {parseFloat(cashReceived) >= totalAmount && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex justify-between items-center">
                    <span className="text-sm font-medium text-emerald-700">
                      Change to Return
                    </span>
                    <span className="text-xl font-bold text-emerald-700">
                      {formatCurrency(cashChange)}
                    </span>
                  </div>
                )}
                {cashReceived && parseFloat(cashReceived) < totalAmount && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-center">
                    <p className="text-sm text-destructive font-medium">
                      Insufficient amount. Short by{" "}
                      {formatCurrency(totalAmount - parseFloat(cashReceived))}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* UPI: QR placeholder */}
            {activePaymentMethod === "UPI" && (
              <div className="space-y-3">
                <div className="bg-muted/30 border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center">
                  <div className="w-32 h-32 bg-white border-2 border-muted rounded-lg flex items-center justify-center mb-3">
                    <div className="grid grid-cols-5 gap-0.5">
                      {Array.from({ length: 25 }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-4 h-4 rounded-sm ${
                            Math.random() > 0.4 ? "bg-foreground" : "bg-background"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Scan QR code to pay
                  </p>
                  <p className="text-lg font-bold mt-1">
                    {formatCurrency(totalAmount)}
                  </p>
                </div>
              </div>
            )}

            {/* Card: Swipe/Tap placeholder */}
            {activePaymentMethod === "CARD" && (
              <div className="space-y-3">
                <div className="bg-muted/30 border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center">
                  <CreditCard className="w-12 h-12 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium">Swipe or Tap Card</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Waiting for card terminal...
                  </p>
                  <p className="text-lg font-bold mt-2">
                    {formatCurrency(totalAmount)}
                  </p>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setPaymentDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
                onClick={confirmPayment}
                disabled={
                  activePaymentMethod === "CASH" &&
                  (!cashReceived || parseFloat(cashReceived) < totalAmount)
                }
              >
                Confirm Payment
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  // ============================================================================
  // Render: Receipt Preview Dialog
  // ============================================================================
  const renderReceiptDialog = () => {
    const now = new Date();
    return (
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              Receipt Preview
            </DialogTitle>
            <DialogDescription>
              Preview and print the thermal receipt
            </DialogDescription>
          </DialogHeader>

          {/* Paper size selector */}
          <div className="flex items-center gap-3 mb-2">
            <Label className="text-sm font-medium">Paper Size:</Label>
            <div className="flex gap-2">
              {(["58mm", "80mm", "A4"] as ReceiptPaperSize[]).map((size) => (
                <Button
                  key={size}
                  variant={receiptPaperSize === size ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setReceiptPaperSize(size)}
                >
                  {size}
                </Button>
              ))}
            </div>
          </div>

          {/* Receipt Preview */}
          <ScrollArea className="max-h-[60vh]">
            <div className="flex justify-center p-4 bg-muted/30 rounded-lg">
              <div
                className={`${receiptWidthClass} bg-white border border-dashed border-muted-foreground/30 shadow-sm`}
              >
                <div className="p-4 font-mono text-xs space-y-2">
                  {/* Store Header */}
                  <div className="text-center border-b border-dashed border-muted-foreground/30 pb-2">
                    <p className="font-bold text-sm">FRESHMART GROCERS</p>
                    <p className="text-[10px] text-muted-foreground">
                      42 Linking Road, Bandra West
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Mumbai - 400050
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      GSTIN: 27AABCF1234A1Z5
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Ph: +91 22 2640 0000
                    </p>
                  </div>

                  {/* Bill Info */}
                  <div className="border-b border-dashed border-muted-foreground/30 pb-2 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Bill No:</span>
                      <span className="font-bold">{lastBillNumber || generateBillNumber(getDemoOrderPrefix(currentBusinessType))}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Date:</span>
                      <span>
                        {now.toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Time:</span>
                      <span>
                        {now.toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Customer:</span>
                      <span>
                        {selectedCustomerData?.name || "Walk-in Customer"}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Cashier:</span>
                      <span>Counter 1</span>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="border-b border-dashed border-muted-foreground/30 pb-2">
                    <div className="flex font-bold text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                      <span className="flex-1">Item</span>
                      <span className="w-8 text-center">Qty</span>
                      <span className="w-14 text-right">Rate</span>
                      <span className="w-16 text-right">Amt</span>
                    </div>
                    {cart.map((item) => (
                      <div
                        key={item.variantId}
                        className="flex text-[10px] py-0.5"
                      >
                        <span className="flex-1 truncate">
                          {item.productName} {item.variantName}
                        </span>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <span className="w-14 text-right">
                          {item.unitPrice.toFixed(2)}
                        </span>
                        <span className="w-16 text-right font-medium">
                          {(item.unitPrice * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="space-y-0.5 pb-2">
                    <div className="flex justify-between text-[10px]">
                      <span>Subtotal</span>
                      <span>{subtotal.toFixed(2)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-[10px] text-emerald-600">
                        <span>Discount</span>
                        <span>-{discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>CGST @ 9%</span>
                      <span>{cgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>SGST @ 9%</span>
                      <span>{sgst.toFixed(2)}</span>
                    </div>
                    <Separator className="my-1" />
                    <div className="flex justify-between font-bold text-sm">
                      <span>TOTAL</span>
                      <span>₹{totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>Payment</span>
                      <span className="font-medium">{activePaymentMethod}</span>
                    </div>
                    {activePaymentMethod === "CASH" && cashReceived && (
                      <>
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Cash Received</span>
                          <span>₹{parseFloat(cashReceived).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Change</span>
                          <span>₹{cashChange.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="text-center border-t border-dashed border-muted-foreground/30 pt-2 space-y-1">
                    <p className="font-bold text-[10px]">
                      Thank you for visiting {getDemoStoreInfo(currentBusinessType).name}!
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      Visit again · Fresh quality, best prices
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      *** CUSTOMER COPY ***
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setReceiptDialogOpen(false)}>
              Close
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handlePrintAndClose}
            >
              <Printer className="w-4 h-4 mr-1.5" />
              Print & Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Page Header */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <PageHeader
          title="POS Billing"
          description="Fast billing terminal — scan, add, and bill"
          icon={Monitor}
          action={
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Session Active
                </Badge>
                <span>{sessionDuration} · {sessionBillCount} bills</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={handleNewBill}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                New Bill
              </Button>
            </div>
          }
        />
      </div>

      {/* Two-Panel Layout */}
      <div className="flex flex-1 min-h-0 px-4 pb-4 gap-4">
        {/* LEFT PANEL — Product Catalog (60%) */}
        <div className="flex-[3] flex flex-col min-w-0 border rounded-xl overflow-hidden bg-card">
          {/* Search Bar */}
          <div className="p-3 border-b flex gap-2">
            <div className="relative flex-1">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Scan barcode or search products..."
                className="pl-10 h-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="h-10 px-2"
                onClick={() => setSearchQuery("")}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Category Pills */}
          <div className="border-b px-3 py-2 bg-muted/30">
            <ScrollArea className="w-full">
              <div className="flex gap-1.5 pb-0.5">
                <Button
                  size="sm"
                  variant={selectedCategory === "all" ? "default" : "outline"}
                  className={`shrink-0 text-xs h-8 px-3 ${
                    selectedCategory === "all"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : ""
                  }`}
                  onClick={() => setSelectedCategory("all")}
                >
                  All Items
                </Button>
                {apiCategories.map((cat) => (
                  <Button
                    key={cat.id}
                    size="sm"
                    variant={
                      selectedCategory === cat.id ? "default" : "outline"
                    }
                    className={`shrink-0 text-xs h-8 px-3 ${
                      selectedCategory === cat.id
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : ""
                    }`}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    {cat.name}
                    <Badge
                      variant="secondary"
                      className="ml-1.5 text-[10px] px-1 py-0 h-4"
                    >
                      {cat.productCount}
                    </Badge>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Product Grid */}
          <ScrollArea className="flex-1">
            <div className="p-3">
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Search className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No products found</p>
                  <p className="text-xs mt-1">Try a different search or category</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {filteredProducts.map((product) => {
                    const defaultVariant =
                      (product.variants ?? []).find((v) => v.isDefault) ||
                      (product.variants ?? [])[0];
                    if (!defaultVariant) return null;
                    const hasDiscount = defaultVariant.mrp > defaultVariant.price;
                    const inCart = cart.find(
                      (item) => item.variantId === defaultVariant.id
                    );

                    return (
                      <Card
                        key={product.id}
                        className="cursor-pointer hover:border-emerald-400 hover:shadow-sm transition-all group relative overflow-hidden"
                        onClick={() => addToCart(product.id)}
                      >
                        {/* Quick add indicator */}
                        {inCart && (
                          <div className="absolute top-1.5 right-1.5 z-10">
                            <Badge className="bg-emerald-600 text-white text-[10px] h-5 px-1.5">
                              {inCart.quantity}
                            </Badge>
                          </div>
                        )}
                        <CardContent className="p-3">
                          {/* Veg indicator + Name */}
                          <div className="flex items-start gap-1.5 mb-1">
                            <div
                              className={`w-3.5 h-3.5 border rounded-sm flex items-center justify-center shrink-0 mt-0.5 ${
                                product.isVeg
                                  ? "border-green-600"
                                  : "border-red-600"
                              }`}
                            >
                              <div
                                className={`w-1.5 h-1.5 rounded-full ${
                                  product.isVeg ? "bg-green-600" : "bg-red-600"
                                }`}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate leading-tight">
                                {product.name}
                              </p>
                            </div>
                          </div>

                          {/* Variant */}
                          <p className="text-xs text-muted-foreground mb-2 pl-5">
                            {defaultVariant.name}
                            {(product.variants?.length ?? 0) > 1 && (
                              <span className="text-[10px] ml-1 opacity-60">
                                (+{(product.variants?.length ?? 0) - 1} more)
                              </span>
                            )}
                          </p>

                          {/* Price + Add */}
                          <div className="flex items-center justify-between pl-5">
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-bold text-sm text-emerald-700">
                                {formatCurrency(defaultVariant.price)}
                              </span>
                              {hasDiscount && (
                                <span className="text-[10px] text-muted-foreground line-through">
                                  {formatCurrency(defaultVariant.mrp)}
                                </span>
                              )}
                            </div>
                            <div className="w-7 h-7 rounded-full bg-emerald-100 group-hover:bg-emerald-600 flex items-center justify-center transition-colors">
                              <Plus className="w-3.5 h-3.5 text-emerald-600 group-hover:text-white transition-colors" />
                            </div>
                          </div>

                          {/* Stock indicator */}
                          {defaultVariant.stock <= 10 && defaultVariant.stock > 0 && (
                            <p className="text-[10px] text-amber-600 mt-1 pl-5">
                              Low stock: {defaultVariant.stock} left
                            </p>
                          )}
                          {defaultVariant.stock === 0 && (
                            <p className="text-[10px] text-destructive mt-1 pl-5">
                              Out of stock
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT PANEL — Cart & Billing (40%) — Desktop */}
        <div className="flex-[2] min-w-[340px] max-w-[480px] hidden md:flex border rounded-xl overflow-hidden">
          {renderCartPanel()}
        </div>
      </div>

      {/* Mobile: Cart floating button */}
      {cart.length > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-3 bg-background/95 backdrop-blur border-t shadow-lg z-40">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium">
                {cart.length} item{cart.length > 1 ? "s" : ""}
              </p>
              <p className="text-lg font-bold text-primary">
                {formatCurrency(totalAmount)}
              </p>
            </div>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 px-6"
              onClick={() => setMobileCartOpen(true)}
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              View Cart
            </Button>
          </div>
        </div>
      )}

      {/* Mobile: Cart Sheet */}
      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="p-4 pb-2 border-b">
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Cart & Billing
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col h-[calc(100vh-5rem)]">
            {renderCartPanel()}
          </div>
        </SheetContent>
      </Sheet>

      {/* Payment Dialog */}
      {renderPaymentDialog()}

      {/* Receipt Preview Dialog */}
      {renderReceiptDialog()}

      {/* Keyboard Shortcuts Hint — Desktop only */}
      <div className="hidden lg:flex items-center justify-center gap-4 px-4 pb-3 text-[10px] text-muted-foreground">
        {shortcuts.map((s) => (
          <div key={s.key} className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px] font-mono">
              {s.key}
            </kbd>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
