"use client";

// ============================================================================
// Quantix Core — POS Production Component
// Enhanced production-ready POS with: barcode scanning, keyboard shortcuts,
// split payment, hold/recall, cash drawer, day-end settlement, GST invoices
// ============================================================================

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ThermalPrintDialog } from "./thermal-print-dialog";
import { PrintStyles } from "./print-styles";
import { getDemoProducts, getDemoCategories, getDemoCustomers, getDemoBusinessOrders, getDemoOrderPrefix, getDemoStoreInfo } from "@/lib/demo-data";
import { useAdminStore } from "@/stores/admin-store";
import { PageHeader } from "@/components/admin/shared/page-header";
import { formatCurrency, formatIndianDateTime } from "@/lib/utils";
import { calculatePOSCart, numberToWords } from "@/lib/core/pos";
import type { POSCartItem, POSCartSummary } from "@/lib/core/pos";
import {
  Monitor, Search, Plus, Minus, Trash2, CreditCard, Banknote,
  Smartphone, Receipt, Printer, X, ShoppingCart, User, Barcode,
  Tag, Percent, Keyboard, Pause, Play, Wallet, Clock, AlertCircle,
  ChevronRight, Check, Hash, ArrowRight, Settings, FileText,
  Package, Zap, RefreshCw,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

type PaymentMethod = "CASH" | "UPI" | "CARD";
type DiscountType = "PERCENTAGE" | "FLAT";
type PaperSize = "58mm" | "80mm" | "A4";

interface SplitPayment {
  method: PaymentMethod;
  amount: number;
}

interface HeldOrder {
  id: string;
  items: POSCartItem[];
  customer: string;
  discountType: DiscountType;
  discountValue: string;
  heldAt: Date;
  label: string;
}

// ============================================================================
// Helpers
// ============================================================================

function generateBillNumber(prefix: string): string {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const rand = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
  return `${prefix}${datePart}-${rand}`;
}

// ============================================================================
// Component
// ============================================================================

export function POSProduction() {
  // Get demo business context
  const { demoBusinessId } = useAdminStore()

  // Demo data — context-aware
  const products = useMemo(() => getDemoProducts(demoBusinessId).map((p) => ({
    id: p.id, name: p.name, slug: p.slug, categoryId: p.categoryId, category: p.category,
    status: p.status, isVeg: p.isVeg, isFeatured: p.isFeatured, image: p.image,
    variants: p.variants.map((v) => ({ id: v.id, name: v.name, sku: v.sku, mrp: v.mrp, price: v.price, stock: v.stock, isDefault: v.isDefault })),
  })), [demoBusinessId])

  const categories = useMemo(() => {
    const cats = getDemoCategories(demoBusinessId)
    const prods = getDemoProducts(demoBusinessId)
    return cats.map((c) => ({ id: c.id, name: c.name, slug: c.slug, productCount: prods.filter((p) => p.categoryId === c.id).length, icon: c.icon, color: c.color, sortOrder: c.sortOrder }))
  }, [demoBusinessId])

  const businessCustomers = useMemo(() => getDemoCustomers(demoBusinessId).map((c) => ({
    id: c.id, name: c.name, phone: c.phone, email: c.email, totalOrders: c.totalOrders, totalSpent: c.totalSpent, loyaltyPoints: c.loyaltyPoints, tier: c.tier, lastOrder: c.lastOrder,
  })), [demoBusinessId])

  const businessOrders = useMemo(() => getDemoBusinessOrders(demoBusinessId), [demoBusinessId])

  // ---- Core State ----
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("walk-in");
  const [discountType, setDiscountType] = useState<DiscountType>("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState<string>("");
  const [isInterState, setIsInterState] = useState(false);

  // ---- Payment State ----
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [activePaymentMethod, setActivePaymentMethod] = useState<PaymentMethod>("CASH");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([
    { method: "CASH", amount: 0 },
    { method: "UPI", amount: 0 },
  ]);

  // ---- Print State ----
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [lastBillNumber, setLastBillNumber] = useState<string>("");
  const [paperSize, setPaperSize] = useState<PaperSize>("80mm");

  // ---- Hold/Recall State ----
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [holdDialogOpen, setHoldDialogOpen] = useState(false);
  const [holdLabel, setHoldLabel] = useState("");

  // ---- Session State ----
  const [sessionBillCount, setSessionBillCount] = useState(0);
  const [sessionStartTime] = useState(new Date());
  const [sessionCashTotal, setSessionCashTotal] = useState(0);
  const [sessionUpiTotal, setSessionUpiTotal] = useState(0);
  const [sessionCardTotal, setSessionCardTotal] = useState(0);
  const [openingBalance, setOpeningBalance] = useState(5000);

  // ---- Day-End Settlement ----
  const [settlementDialogOpen, setSettlementDialogOpen] = useState(false);
  const [closingBalance, setClosingBalance] = useState<string>("");

  // ---- Mobile State ----
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // ---- Shortcuts help ----
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // ---- Search/Barcode input ref ----
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ---- Online Order Queue (simulated) ----
  const [onlineOrders] = useState(
    businessOrders.filter((o) => o.type === "DELIVERY" && o.status !== "DELIVERED" && o.status !== "CANCELLED")
  );

  // ---- Cart calculations using core POS library ----
  const cartSummary: POSCartSummary = useMemo(() => {
    const discountAmt = (() => {
      const val = parseFloat(discountValue) || 0;
      const sub = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      if (discountType === "PERCENTAGE") return Math.round(sub * (val / 100) * 100) / 100;
      return Math.min(val, sub);
    })();

    return calculatePOSCart({
      items: cart,
      isInterState,
      roundOff: true,
    });
  }, [cart, isInterState]);

  const discountAmount = useMemo(() => {
    const val = parseFloat(discountValue) || 0;
    const sub = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    if (discountType === "PERCENTAGE") return Math.round(sub * (val / 100) * 100) / 100;
    return Math.min(val, sub);
  }, [cart, discountType, discountValue]);

  const totalAmount = useMemo(() => {
    return Math.round((cartSummary.totalAmount - discountAmount) * 100) / 100;
  }, [cartSummary.totalAmount, discountAmount]);

  // ---- Selected customer data ----
  const selectedCustomerData = useMemo(() => {
    if (selectedCustomer === "walk-in") return null;
    return businessCustomers.find((c) => c.id === selectedCustomer) || null;
  }, [selectedCustomer]);

  // ---- Session duration ----
  const sessionDuration = useMemo(() => {
    const diff = Date.now() - sessionStartTime.getTime();
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hrs}h ${mins}m`;
  }, [sessionStartTime]);

  // ---- Filtered products ----
  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => p.status === "ACTIVE");
    if (selectedCategory !== "all") {
      result = result.filter((p) => p.categoryId === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.variants.some((v) => v.sku.toLowerCase().includes(q))
      );
    }
    return result;
  }, [selectedCategory, searchQuery]);

  // ---- Cart actions ----
  const addToCart = useCallback((productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const defaultVariant = product.variants.find((v) => v.isDefault) || product.variants[0];
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
          gstRate: 18,
          isVeg: product.isVeg,
          sku: defaultVariant.sku,
        },
      ];
    });
  }, []);

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

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // F1 - Search
      if (e.key === "F1") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // F2 - Pay
      if (e.key === "F2" && cart.length > 0) {
        e.preventDefault();
        setPaymentDialogOpen(true);
      }
      // F3 - Hold order
      if (e.key === "F3" && cart.length > 0) {
        e.preventDefault();
        setHoldDialogOpen(true);
      }
      // F4 - Clear
      if (e.key === "F4") {
        e.preventDefault();
        setCart([]);
        setDiscountValue("");
        setSelectedCustomer("walk-in");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart.length]);

  // ---- Hold/Recall ----
  const holdCurrentOrder = useCallback(() => {
    if (cart.length === 0) return;
    const held: HeldOrder = {
      id: `hold_${Date.now()}`,
      items: [...cart],
      customer: selectedCustomer,
      discountType,
      discountValue,
      heldAt: new Date(),
      label: holdLabel || `Order ${heldOrders.length + 1}`,
    };
    setHeldOrders((prev) => [...prev, held]);
    clearCart();
    setHoldLabel("");
    setHoldDialogOpen(false);
  }, [cart, selectedCustomer, discountType, discountValue, holdLabel, heldOrders.length, clearCart]);

  const recallOrder = useCallback((held: HeldOrder) => {
    setCart(held.items);
    setSelectedCustomer(held.customer);
    setDiscountType(held.discountType);
    setDiscountValue(held.discountValue);
    setHeldOrders((prev) => prev.filter((o) => o.id !== held.id));
  }, []);

  // ---- Payment ----
  const confirmPayment = useCallback(() => {
    setPaymentConfirmed(true);
    setSessionBillCount((prev) => prev + 1);
    const billNum = generateBillNumber(getDemoOrderPrefix(demoBusinessId));
    setLastBillNumber(billNum);

    // Track session totals
    if (activePaymentMethod === "CASH" || (isSplitPayment && splitPayments.some((s) => s.method === "CASH"))) {
      const cashAmt = isSplitPayment ? splitPayments.find((s) => s.method === "CASH")?.amount || 0 : totalAmount;
      setSessionCashTotal((prev) => prev + cashAmt);
    }
    if (activePaymentMethod === "UPI" || (isSplitPayment && splitPayments.some((s) => s.method === "UPI"))) {
      const upiAmt = isSplitPayment ? splitPayments.find((s) => s.method === "UPI")?.amount || 0 : totalAmount;
      setSessionUpiTotal((prev) => prev + upiAmt);
    }
    if (activePaymentMethod === "CARD" || (isSplitPayment && splitPayments.some((s) => s.method === "CARD"))) {
      const cardAmt = isSplitPayment ? splitPayments.find((s) => s.method === "CARD")?.amount || 0 : totalAmount;
      setSessionCardTotal((prev) => prev + cardAmt);
    }
  }, [activePaymentMethod, isSplitPayment, splitPayments, totalAmount]);

  const cashChange = useMemo(() => {
    const received = parseFloat(cashReceived) || 0;
    return Math.max(0, Math.round((received - totalAmount) * 100) / 100);
  }, [cashReceived, totalAmount]);

  const splitTotal = useMemo(() => {
    return splitPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [splitPayments]);

  const handleNewBill = useCallback(() => {
    clearCart();
    setPaymentConfirmed(false);
    setPaymentDialogOpen(false);
    setCashReceived("");
    setIsSplitPayment(false);
  }, [clearCart]);

  // ---- Render: Cart Panel ----
  const renderCartPanel = () => (
    <div className="flex flex-col h-full bg-card">
      {/* Customer Selection */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Customer</span>
          </div>
          {selectedCustomerData && (
            <Badge variant="outline" className="text-[10px]">
              {selectedCustomerData.loyaltyPoints} pts · {selectedCustomerData.tier}
            </Badge>
          )}
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
                  <span className="text-xs text-muted-foreground">{customer.phone}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cart Items */}
      <ScrollArea className="flex-1">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
            <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Cart is empty</p>
            <p className="text-xs mt-1">Click products or scan barcode</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {cart.map((item) => (
              <div
                key={item.variantId}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 hover:bg-muted group"
              >
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

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.variantName} · {item.gstRate}% GST
                  </p>
                </div>

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

                <span className="text-sm font-semibold w-20 text-right">
                  {formatCurrency(item.unitPrice * item.quantity)}
                </span>

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

      {/* Discount, GST Toggle & Summary */}
      <div className="border-t bg-card">
        {/* GST Inter-State Toggle */}
        {cart.length > 0 && (
          <div className="px-3 pt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Inter-State (IGST)</Label>
            </div>
            <Switch
              checked={isInterState}
              onCheckedChange={setIsInterState}
              className="scale-75"
            />
          </div>
        )}

        {/* Discount */}
        {cart.length > 0 && (
          <div className="px-3 pt-2">
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
            <span className="font-medium">{formatCurrency(cartSummary.subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3" /> Discount
              </span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
          )}
          {!isInterState && cartSummary.cgstTotal > 0 && (
            <div className="flex justify-between text-muted-foreground text-xs">
              <span>CGST</span>
              <span>{formatCurrency(cartSummary.cgstTotal)}</span>
            </div>
          )}
          {!isInterState && cartSummary.sgstTotal > 0 && (
            <div className="flex justify-between text-muted-foreground text-xs">
              <span>SGST</span>
              <span>{formatCurrency(cartSummary.sgstTotal)}</span>
            </div>
          )}
          {isInterState && cartSummary.igstTotal > 0 && (
            <div className="flex justify-between text-muted-foreground text-xs">
              <span>IGST</span>
              <span>{formatCurrency(cartSummary.igstTotal)}</span>
            </div>
          )}
          {cartSummary.roundOff !== 0 && (
            <div className="flex justify-between text-muted-foreground text-xs">
              <span>Round Off</span>
              <span>{cartSummary.roundOff > 0 ? "+" : ""}{cartSummary.roundOff.toFixed(2)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(totalAmount)}</span>
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            {numberToWords(Math.round(totalAmount))}
          </p>
        </div>

        {/* Payment Buttons */}
        <div className="px-3 pb-2">
          <div className="grid grid-cols-3 gap-2">
            <Button
              className="h-12 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={cart.length === 0}
              onClick={() => {
                setActivePaymentMethod("CASH");
                setIsSplitPayment(false);
                setPaymentDialogOpen(true);
              }}
            >
              <Banknote className="w-5 h-5 mr-1.5" />
              Cash
            </Button>
            <Button
              className="h-12 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white"
              disabled={cart.length === 0}
              onClick={() => {
                setActivePaymentMethod("UPI");
                setIsSplitPayment(false);
                setPaymentDialogOpen(true);
              }}
            >
              <Smartphone className="w-5 h-5 mr-1.5" />
              UPI
            </Button>
            <Button
              className="h-12 text-sm font-semibold bg-sky-600 hover:bg-sky-700 text-white"
              disabled={cart.length === 0}
              onClick={() => {
                setActivePaymentMethod("CARD");
                setIsSplitPayment(false);
                setPaymentDialogOpen(true);
              }}
            >
              <CreditCard className="w-5 h-5 mr-1.5" />
              Card
            </Button>
          </div>
        </div>

        {/* Action Row */}
        <div className="px-3 pb-3 flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-9 flex-1"
            disabled={cart.length === 0}
            onClick={() => setHoldDialogOpen(true)}
          >
            <Pause className="w-3.5 h-3.5 mr-1" />
            Hold
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-9 flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={clearCart}
            disabled={cart.length === 0}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Clear
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-9 flex-1"
            disabled={cart.length === 0}
            onClick={() => {
              setIsSplitPayment(true);
              setPaymentDialogOpen(true);
            }}
          >
            <Wallet className="w-3.5 h-3.5 mr-1" />
            Split
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-9"
            onClick={() => setShortcutsOpen(true)}
          >
            <Keyboard className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  // ---- Render: Payment Dialog ----
  const renderPaymentDialog = () => (
    <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {activePaymentMethod === "CASH" && <Banknote className="w-5 h-5 text-emerald-600" />}
            {activePaymentMethod === "UPI" && <Smartphone className="w-5 h-5 text-violet-600" />}
            {activePaymentMethod === "CARD" && <CreditCard className="w-5 h-5 text-sky-600" />}
            {paymentConfirmed ? "Payment Successful" : isSplitPayment ? "Split Payment" : `Pay with ${activePaymentMethod}`}
          </DialogTitle>
          <DialogDescription>
            {paymentConfirmed
              ? "Transaction completed successfully"
              : isSplitPayment
                ? "Split the bill across multiple payment methods"
                : "Complete the payment to generate bill"}
          </DialogDescription>
        </DialogHeader>

        {paymentConfirmed ? (
          <div className="py-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-700 mb-1">
              {formatCurrency(totalAmount)}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Payment received via {isSplitPayment ? "Split" : activePaymentMethod}
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Bill: {lastBillNumber}
            </p>
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setPaymentDialogOpen(false);
                  setPrintDialogOpen(true);
                }}
              >
                <Printer className="w-4 h-4 mr-1.5" />
                Print Receipt
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
          <div className="space-y-4 py-2">
            {/* Order Total */}
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Order Total</p>
              <p className="text-3xl font-bold text-primary mt-1">
                {formatCurrency(totalAmount)}
              </p>
            </div>

            {/* Split Payment UI */}
            {isSplitPayment && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Split Payment Breakdown</Label>
                {splitPayments.map((sp, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select
                      value={sp.method}
                      onValueChange={(v) => {
                        const updated = [...splitPayments];
                        updated[idx] = { ...updated[idx], method: v as PaymentMethod };
                        setSplitPayments(updated);
                      }}
                    >
                      <SelectTrigger className="w-[120px] h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">Cash</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="CARD">Card</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="₹0.00"
                      className="flex-1 h-10"
                      value={sp.amount || ""}
                      onChange={(e) => {
                        const updated = [...splitPayments];
                        updated[idx] = { ...updated[idx], amount: parseFloat(e.target.value) || 0 };
                        setSplitPayments(updated);
                      }}
                    />
                    {splitPayments.length > 2 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 p-0 text-destructive"
                        onClick={() => {
                          setSplitPayments((prev) => prev.filter((_, i) => i !== idx));
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setSplitPayments((prev) => [...prev, { method: "CARD", amount: 0 }])}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Payment Method
                  </Button>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Remaining: </span>
                    <span className={`font-bold ${splitTotal >= totalAmount ? "text-emerald-600" : "text-destructive"}`}>
                      {formatCurrency(Math.max(0, totalAmount - splitTotal))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Cash Payment */}
            {!isSplitPayment && activePaymentMethod === "CASH" && (
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
                    <span className="text-sm font-medium text-emerald-700">Change to Return</span>
                    <span className="text-xl font-bold text-emerald-700">{formatCurrency(cashChange)}</span>
                  </div>
                )}
              </div>
            )}

            {/* UPI Payment */}
            {!isSplitPayment && activePaymentMethod === "UPI" && (
              <div className="bg-muted/30 border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center">
                <div className="w-32 h-32 bg-white border-2 border-muted rounded-lg flex items-center justify-center mb-3">
                  <div className="grid grid-cols-5 gap-0.5">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-4 h-4 rounded-sm ${Math.random() > 0.4 ? "bg-foreground" : "bg-background"}`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Scan QR code to pay</p>
                <p className="text-lg font-bold mt-1">{formatCurrency(totalAmount)}</p>
              </div>
            )}

            {/* Card Payment */}
            {!isSplitPayment && activePaymentMethod === "CARD" && (
              <div className="bg-muted/30 border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center">
                <CreditCard className="w-12 h-12 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Swipe or Tap Card</p>
                <p className="text-xs text-muted-foreground mt-1">Waiting for card terminal...</p>
                <p className="text-lg font-bold mt-2">{formatCurrency(totalAmount)}</p>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
                onClick={confirmPayment}
                disabled={
                  isSplitPayment
                    ? splitTotal < totalAmount
                    : activePaymentMethod === "CASH" && (!cashReceived || parseFloat(cashReceived) < totalAmount)
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

  // ---- Render: Hold Dialog ----
  const renderHoldDialog = () => (
    <Dialog open={holdDialogOpen} onOpenChange={setHoldDialogOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pause className="w-5 h-5 text-amber-600" />
            Hold Order
          </DialogTitle>
          <DialogDescription>Put the current order on hold to recall later</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Order Label</Label>
            <Input
              placeholder="e.g., Customer waiting for friend"
              value={holdLabel}
              onChange={(e) => setHoldLabel(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p>Items: {cart.length}</p>
            <p>Total: {formatCurrency(totalAmount)}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setHoldDialogOpen(false)}>Cancel</Button>
          <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={holdCurrentOrder}>
            Hold Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ---- Render: Shortcuts Dialog ----
  const renderShortcutsDialog = () => (
    <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {[
            { key: "F1", label: "Search / Scan Barcode" },
            { key: "F2", label: "Open Payment" },
            { key: "F3", label: "Hold Current Order" },
            { key: "F4", label: "Clear Cart" },
          ].map((s) => (
            <div key={s.key} className="flex items-center justify-between py-1.5 border-b last:border-0">
              <span className="text-sm">{s.label}</span>
              <Badge variant="outline" className="font-mono text-xs">{s.key}</Badge>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );

  // ---- Render: Settlement Dialog ----
  const renderSettlementDialog = () => {
    const expectedCash = openingBalance + sessionCashTotal;
    const closingBal = parseFloat(closingBalance) || 0;
    const difference = closingBal - expectedCash;

    return (
      <Dialog open={settlementDialogOpen} onOpenChange={setSettlementDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Day-End Settlement
            </DialogTitle>
            <DialogDescription>Close the POS session and review daily totals</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">Opening Balance</p>
                <p className="font-bold text-lg">{formatCurrency(openingBalance)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">Total Sales</p>
                <p className="font-bold text-lg">{formatCurrency(sessionCashTotal + sessionUpiTotal + sessionCardTotal)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">Cash Received</p>
                <p className="font-bold text-lg text-emerald-600">{formatCurrency(sessionCashTotal)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">UPI Received</p>
                <p className="font-bold text-lg text-violet-600">{formatCurrency(sessionUpiTotal)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">Card Received</p>
                <p className="font-bold text-lg text-sky-600">{formatCurrency(sessionCardTotal)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">Total Bills</p>
                <p className="font-bold text-lg">{sessionBillCount}</p>
              </div>
            </div>

            <Separator />

            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Expected Cash in Drawer</span>
                <span className="font-bold">{formatCurrency(expectedCash)}</span>
              </div>
            </div>

            <div>
              <Label>Actual Cash in Drawer</Label>
              <Input
                type="number"
                placeholder="Count cash in drawer"
                className="mt-1.5 text-lg h-12 font-semibold"
                value={closingBalance}
                onChange={(e) => setClosingBalance(e.target.value)}
              />
            </div>

            {closingBalance && (
              <div className={`rounded-lg p-3 flex justify-between items-center ${
                difference === 0 ? "bg-emerald-50 border border-emerald-200" :
                difference > 0 ? "bg-sky-50 border border-sky-200" :
                "bg-red-50 border border-red-200"
              }`}>
                <span className="text-sm font-medium">Difference</span>
                <span className={`text-lg font-bold ${
                  difference === 0 ? "text-emerald-700" :
                  difference > 0 ? "text-sky-700" :
                  "text-red-700"
                }`}>
                  {difference === 0 ? "Exact" : difference > 0 ? `+${formatCurrency(difference)}` : formatCurrency(difference)}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettlementDialogOpen(false)}>Cancel</Button>
            <Button className="bg-primary hover:bg-primary/90 text-white">
              Close Session & Settle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // ---- Thermal receipt data for print dialog ----
  const receiptOrderData = useMemo(() => ({
    orderNumber: lastBillNumber || generateBillNumber(getDemoOrderPrefix(demoBusinessId)),
    date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
    cashier: "Counter 1",
    items: cart.map((item) => ({
      name: item.productName,
      qty: item.quantity,
      rate: item.unitPrice,
      amount: item.unitPrice * item.quantity,
      gstRate: item.gstRate,
      hsnCode: item.hsnCode,
    })),
    subtotal: cartSummary.subtotal,
    discount: discountAmount,
    cgst: cartSummary.cgstTotal,
    sgst: cartSummary.sgstTotal,
    igst: cartSummary.igstTotal,
    totalTax: cartSummary.totalTax,
    totalAmount,
    roundOff: cartSummary.roundOff,
    paymentMethod: activePaymentMethod,
    amountInWords: numberToWords(Math.round(totalAmount)),
    taxBreakdown: cartSummary.taxBreakdown,
    customerName: selectedCustomerData?.name,
    customerPhone: selectedCustomerData?.phone,
  }), [cart, cartSummary, discountAmount, totalAmount, activePaymentMethod, selectedCustomerData, lastBillNumber]);

  const storeInfo = useMemo(() => getDemoStoreInfo(demoBusinessId), [demoBusinessId]);

  const receiptBusinessData = useMemo(() => ({
    name: storeInfo.name,
    address: storeInfo.address,
    gstNumber: "27AABCF1234A1Z5",
    phone: storeInfo.phone,
    email: storeInfo.email,
    fssaiLicense: "12345678901234",
    supportPhone: storeInfo.phone,
    tagline: "Fresh quality, best prices",
  }), [storeInfo]);

  // ============================================================================
  // Main Render
  // ============================================================================
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <PrintStyles />

      {/* Page Header */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <PageHeader
          title="POS Production"
          description="Enhanced billing terminal — scan, split pay, hold, GST invoices"
          icon={Monitor}
          action={
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Session Active
                </Badge>
                <span>{sessionDuration} · {sessionBillCount} bills · {formatCurrency(sessionCashTotal + sessionUpiTotal + sessionCardTotal)}</span>
              </div>

              {/* Held Orders */}
              {heldOrders.length > 0 && (
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                  <Pause className="w-3.5 h-3.5 text-amber-600" />
                  Held ({heldOrders.length})
                </Button>
              )}

              {/* Day-End Settlement */}
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setSettlementDialogOpen(true)}
              >
                <FileText className="w-3.5 h-3.5 mr-1" />
                Day-End
              </Button>

              <Button variant="outline" size="sm" className="h-8" onClick={handleNewBill}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                New Bill
              </Button>
            </div>
          }
        />
      </div>

      {/* Two-Panel Layout */}
      <div className="flex flex-1 min-h-0 px-4 pb-4 gap-4">
        {/* LEFT PANEL — Product Catalog */}
        <div className="flex-[3] flex flex-col min-w-0 border rounded-xl overflow-hidden bg-card">
          {/* Search Bar */}
          <div className="p-3 border-b flex gap-2">
            <div className="relative flex-1">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="F1: Scan barcode or search products..."
                className="pl-10 h-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {searchQuery && (
              <Button variant="ghost" size="sm" className="h-10 px-2" onClick={() => setSearchQuery("")}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Category Pills */}
          <div className="border-b px-3 py-2 bg-muted/30">
            <ScrollArea className="w-full" orientation="horizontal">
              <div className="flex gap-1.5 pb-0.5">
                <Button
                  size="sm"
                  variant={selectedCategory === "all" ? "default" : "outline"}
                  className={`shrink-0 text-xs h-8 px-3 ${
                    selectedCategory === "all" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                  }`}
                  onClick={() => setSelectedCategory("all")}
                >
                  All Items
                </Button>
                {categories.map((cat) => (
                  <Button
                    key={cat.id}
                    size="sm"
                    variant={selectedCategory === cat.id ? "default" : "outline"}
                    className={`shrink-0 text-xs h-8 px-3 ${
                      selectedCategory === cat.id ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                    }`}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Online Order Queue Indicator */}
          {onlineOrders.length > 0 && (
            <div className="px-3 py-2 bg-violet-50 border-b border-violet-200 flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-600" />
              <span className="text-xs font-medium text-violet-700">
                {onlineOrders.length} online order{onlineOrders.length > 1 ? "s" : ""} in queue
              </span>
              <Badge variant="outline" className="text-[10px] border-violet-300 text-violet-700">
                {onlineOrders.filter((o) => o.status === "PENDING").length} pending
              </Badge>
            </div>
          )}

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
                      product.variants.find((v) => v.isDefault) || product.variants[0];
                    if (!defaultVariant) return null;
                    return (
                      <button
                        key={product.id}
                        onClick={() => addToCart(product.id)}
                        className="flex flex-col items-start gap-1.5 p-3 rounded-lg border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all text-left group"
                      >
                        <div className="flex items-start justify-between w-full">
                          <div
                            className={`w-4 h-4 border rounded-sm flex items-center justify-center shrink-0 ${
                              product.isVeg ? "border-green-600" : "border-red-600"
                            }`}
                          >
                            <div
                              className={`w-2 h-2 rounded-full ${
                                product.isVeg ? "bg-green-600" : "bg-red-600"
                              }`}
                            />
                          </div>
                          {defaultVariant.stock < 10 && defaultVariant.stock > 0 && (
                            <Badge variant="outline" className="text-[8px] h-4 px-1 text-amber-600 border-amber-300">
                              Low
                            </Badge>
                          )}
                          {defaultVariant.stock === 0 && (
                            <Badge variant="outline" className="text-[8px] h-4 px-1 text-red-600 border-red-300">
                              Out
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium leading-tight line-clamp-2 w-full">
                          {product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{defaultVariant.name}</p>
                        <div className="flex items-baseline gap-1.5 w-full">
                          <span className="text-sm font-bold text-primary">
                            {formatCurrency(defaultVariant.price)}
                          </span>
                          {defaultVariant.mrp > defaultVariant.price && (
                            <span className="text-xs text-muted-foreground line-through">
                              {formatCurrency(defaultVariant.mrp)}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Held Orders Bar */}
          {heldOrders.length > 0 && (
            <div className="border-t px-3 py-2 bg-amber-50">
              <div className="flex items-center gap-2 overflow-x-auto">
                <span className="text-xs font-medium text-amber-700 shrink-0">On Hold:</span>
                {heldOrders.map((held) => (
                  <Button
                    key={held.id}
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
                    onClick={() => recallOrder(held)}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    {held.label} · {formatCurrency(held.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0))}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL — Cart */}
        <div className="flex-[2] hidden md:flex flex-col min-w-0 border rounded-xl overflow-hidden">
          {renderCartPanel()}
        </div>
      </div>

      {/* Mobile Cart Sheet */}
      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="p-4 pb-0">
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Cart ({cart.length})
            </SheetTitle>
          </SheetHeader>
          {renderCartPanel()}
        </SheetContent>
      </Sheet>

      {/* Mobile Cart FAB */}
      {cart.length > 0 && (
        <button
          className="md:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full bg-emerald-600 text-white shadow-lg flex items-center justify-center z-50"
          onClick={() => setMobileCartOpen(true)}
        >
          <ShoppingCart className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 bg-destructive text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {cart.length}
          </span>
        </button>
      )}

      {/* Dialogs */}
      {renderPaymentDialog()}
      {renderHoldDialog()}
      {renderShortcutsDialog()}
      {renderSettlementDialog()}

      {/* Thermal Print Dialog */}
      <ThermalPrintDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        order={receiptOrderData}
        business={receiptBusinessData}
        store={{ name: storeInfo.name, code: storeInfo.code, phone: storeInfo.phone, address: storeInfo.address }}
        defaultPaperSize={paperSize}
        onPrintComplete={() => {
          setPrintDialogOpen(false);
        }}
      />
    </div>
  );
}
