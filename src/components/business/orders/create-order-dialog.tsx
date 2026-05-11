"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Card, CardContent } from "@/components/ui/card"
import {
  Plus,
  Trash2,
  Search,
  Check,
  ChevronDown,
  User,
  Package,
  MapPin,
  StickyNote,
  Loader2,
  X,
} from "lucide-react"
import { showSuccess, showError } from "@/lib/toast-utils"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Customer {
  id: string
  name: string
  email?: string | null
  phone?: string | null
}

interface ProductVariant {
  id: string
  name: string
  price: number
  mrp: number
  discountPrice: number | null
  discountPercent: number | null
  stock: number
  isDefault: boolean
}

interface Product {
  id: string
  name: string
  slug: string
  isVeg: boolean | null
  images: string[]
  variants: ProductVariant[]
  category: { id: string; name: string } | null
}

interface Store {
  id: string
  name: string
  isMainStore: boolean
  deliveryFee: number
}

interface OrderFormItem {
  key: string
  productId: string
  productName: string
  variantId: string
  variantName: string
  quantity: number
  unitPrice: number
  mrp: number
  gstRate: number
}

interface CreateOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessId: string
  onOrderCreated: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GST_RATE = 18
const DEFAULT_DELIVERY_FEE = 30

function formatINR(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

let itemKeyCounter = 0
function nextItemKey(): string {
  return `item-${++itemKeyCounter}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateOrderDialog({
  open,
  onOpenChange,
  businessId,
  onOrderCreated,
}: CreateOrderDialogProps) {
  // ---- Data fetching state ----
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [loadingStores, setLoadingStores] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ---- Form state ----
  const [customerId, setCustomerId] = useState("")
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const [orderType, setOrderType] = useState("DELIVERY")
  const [paymentMethod, setPaymentMethod] = useState("UPI")
  const [items, setItems] = useState<OrderFormItem[]>([])
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [notes, setNotes] = useState("")
  const [productSearchOpen, setProductSearchOpen] = useState(false)
  const [storeId, setStoreId] = useState("")

  // ---- Computed ----
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId),
    [customers, customerId]
  )

  const mainStore = useMemo(
    () => stores.find((s) => s.isMainStore) || stores[0],
    [stores]
  )

  const activeStoreId = storeId || mainStore?.id || ""

  const deliveryFee = useMemo(() => {
    if (orderType === "DELIVERY" || orderType === "PICKUP_AND_DELIVERY") {
      const store = stores.find((s) => s.id === activeStoreId)
      return store?.deliveryFee ?? DEFAULT_DELIVERY_FEE
    }
    return 0
  }, [orderType, stores, activeStoreId])

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [items]
  )

  const totalTax = useMemo(
    () => items.reduce((sum, item) => sum + (item.unitPrice * item.quantity * item.gstRate) / 100, 0),
    [items]
  )

  const totalAmount = useMemo(
    () => subtotal + totalTax + deliveryFee,
    [subtotal, totalTax, deliveryFee]
  )

  // ---- Fetch data on open ----
  useEffect(() => {
    if (!open || !businessId) return
    resetForm()
    fetchCustomers()
    fetchProducts()
    fetchStores()
  }, [open, businessId])

  async function fetchCustomers() {
    setLoadingCustomers(true)
    try {
      const res = await fetch(
        `/api/core/businesses/${businessId}/customers?limit=100`
      )
      const data = await res.json()
      if (data.success) {
        setCustomers(data.data || [])
      }
    } catch {
      // silent
    } finally {
      setLoadingCustomers(false)
    }
  }

  async function fetchProducts() {
    setLoadingProducts(true)
    try {
      const res = await fetch(
        `/api/core/storefront/products?businessId=${businessId}&status=ALL&limit=200&includeAllVariants=true`
      )
      const data = await res.json()
      if (data.success) {
        setProducts(data.data || [])
      }
    } catch {
      // silent
    } finally {
      setLoadingProducts(false)
    }
  }

  async function fetchStores() {
    setLoadingStores(true)
    try {
      const res = await fetch(`/api/core/stores?businessId=${businessId}`)
      const data = await res.json()
      if (data.success) {
        const storeList = data.data || []
        setStores(storeList)
        // Auto-select main store
        const main = storeList.find((s: Store) => s.isMainStore) || storeList[0]
        if (main) setStoreId(main.id)
      }
    } catch {
      // silent
    } finally {
      setLoadingStores(false)
    }
  }

  // ---- Form actions ----
  function resetForm() {
    setCustomerId("")
    setOrderType("DELIVERY")
    setPaymentMethod("UPI")
    setItems([])
    setDeliveryAddress("")
    setNotes("")
    setStoreId("")
  }

  const addProductItem = useCallback(
    (product: Product) => {
      const defaultVariant =
        product.variants.find((v) => v.isDefault) || product.variants[0]
      if (!defaultVariant) return

      // Check if already added
      const existing = items.find((i) => i.variantId === defaultVariant.id)
      if (existing) {
        setItems((prev) =>
          prev.map((i) =>
            i.variantId === defaultVariant.id
              ? { ...i, quantity: i.quantity + 1 }
              : i
          )
        )
        return
      }

      const newItem: OrderFormItem = {
        key: nextItemKey(),
        productId: product.id,
        productName: product.name,
        variantId: defaultVariant.id,
        variantName: defaultVariant.name,
        quantity: 1,
        unitPrice: defaultVariant.price,
        mrp: defaultVariant.mrp,
        gstRate: GST_RATE,
      }
      setItems((prev) => [...prev, newItem])
      setProductSearchOpen(false)
    },
    [items]
  )

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key))
  }

  function updateItemQuantity(key: string, quantity: number) {
    if (quantity < 1) return
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, quantity } : i))
    )
  }

  function updateItemVariant(key: string, variantId: string) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item
        const product = products.find((p) => p.id === item.productId)
        const variant = product?.variants.find((v) => v.id === variantId)
        if (!variant) return item
        return {
          ...item,
          variantId: variant.id,
          variantName: variant.name,
          unitPrice: variant.price,
          mrp: variant.mrp,
        }
      })
    )
  }

  // ---- Submit ----
  async function handleSubmit() {
    if (!businessId) {
      showError("Missing business context")
      return
    }
    if (!activeStoreId) {
      showError("No store found for this business")
      return
    }
    if (items.length === 0) {
      showError("Add at least one item to the order")
      return
    }
    if ((orderType === "DELIVERY" || orderType === "PICKUP_AND_DELIVERY") && !deliveryAddress.trim()) {
      showError("Delivery address is required for delivery orders")
      return
    }

    setSubmitting(true)
    try {
      const orderItems = items.map((item) => {
        const lineTotal = item.unitPrice * item.quantity
        const gstAmount = (lineTotal * item.gstRate) / 100
        return {
          itemType: "product",
          itemId: item.variantId,
          itemName: item.productName,
          variantName: item.variantName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          mrp: item.mrp,
          totalPrice: Math.round(lineTotal * 100) / 100,
          gstRate: item.gstRate,
          gstAmount: Math.round(gstAmount * 100) / 100,
        }
      })

      const body = {
        businessId,
        storeId: activeStoreId,
        orderType,
        paymentMethod,
        customerId: customerId || undefined,
        customerName: selectedCustomer?.name || undefined,
        customerPhone: selectedCustomer?.phone || undefined,
        deliveryAddress:
          orderType === "DELIVERY" || orderType === "PICKUP_AND_DELIVERY"
            ? deliveryAddress
            : undefined,
        deliveryFee,
        items: orderItems,
        subtotal: Math.round(subtotal * 100) / 100,
        totalTax: Math.round(totalTax * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        notes: notes.trim() || undefined,
      }

      const res = await fetch("/api/core/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create order")
      }

      showSuccess(
        "Order created!",
        `Order #${data.data?.orderNumber || "N/A"} has been placed successfully.`
      )
      onOpenChange(false)
      onOrderCreated()
    } catch (err) {
      showError(
        "Failed to create order",
        err instanceof Error ? err.message : "Unknown error"
      )
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Render ----
  const canSubmit =
    items.length > 0 &&
    activeStoreId &&
    !submitting &&
    ((orderType !== "DELIVERY" && orderType !== "PICKUP_AND_DELIVERY") ||
      deliveryAddress.trim() !== "")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl">Create New Order</DialogTitle>
          <DialogDescription>
            Fill in the details below to create a new order for your business.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)] px-6">
          <div className="space-y-6 pb-6">
            {/* ─── Customer Section ─── */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                <User className="h-4 w-4" />
                Customer
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-select">Select Customer</Label>
                <Popover
                  open={customerSearchOpen}
                  onOpenChange={setCustomerSearchOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerSearchOpen}
                      className="w-full justify-between font-normal"
                    >
                      {selectedCustomer ? (
                        <span className="flex items-center gap-2">
                          {selectedCustomer.name}
                          {selectedCustomer.phone && (
                            <span className="text-muted-foreground text-xs">
                              ({selectedCustomer.phone})
                            </span>
                          )}
                        </span>
                      ) : loadingCustomers ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading...
                        </span>
                      ) : (
                        "Search customer by name or phone..."
                      )}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[500px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search customers..." />
                      <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                          {customers.map((customer) => (
                            <CommandItem
                              key={customer.id}
                              value={`${customer.name} ${customer.phone || ""}`}
                              onSelect={() => {
                                setCustomerId(customer.id)
                                setCustomerSearchOpen(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  customerId === customer.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {customer.name}
                                </span>
                                {customer.phone && (
                                  <span className="text-xs text-muted-foreground">
                                    {customer.phone}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedCustomer && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {selectedCustomer.name}
                    </Badge>
                    {selectedCustomer.phone && (
                      <span className="text-xs text-muted-foreground">
                        {selectedCustomer.phone}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={() => setCustomerId("")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </section>

            <Separator />

            {/* ─── Order Details ─── */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                <Package className="h-4 w-4" />
                Order Details
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Order Type</Label>
                  <Select value={orderType} onValueChange={setOrderType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DELIVERY">Delivery</SelectItem>
                      <SelectItem value="PICKUP">Pickup</SelectItem>
                      <SelectItem value="POS">POS</SelectItem>
                      <SelectItem value="PICKUP_AND_DELIVERY">
                        Pickup & Delivery
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="CARD">Card</SelectItem>
                      <SelectItem value="COD">Cash on Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <Separator />

            {/* ─── Items Section ─── */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  <Package className="h-4 w-4" />
                  Items
                </div>
                <Popover
                  open={productSearchOpen}
                  onOpenChange={setProductSearchOpen}
                >
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Add Item
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[480px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search products..." />
                      <CommandList>
                        <CommandEmpty>
                          {loadingProducts
                            ? "Loading products..."
                            : "No product found."}
                        </CommandEmpty>
                        <CommandGroup>
                          {products.map((product) => {
                            const defaultVariant =
                              product.variants.find((v) => v.isDefault) ||
                              product.variants[0]
                            if (!defaultVariant) return null
                            return (
                              <CommandItem
                                key={product.id}
                                value={`${product.name} ${product.category?.name || ""}`}
                                onSelect={() => addProductItem(product)}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      {product.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {product.category?.name || "Uncategorized"}{" "}
                                      · {defaultVariant.name}
                                    </span>
                                  </div>
                                  <span className="font-semibold text-sm ml-4">
                                    {formatINR(defaultVariant.price)}
                                  </span>
                                </div>
                              </CommandItem>
                            )
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {items.length === 0 ? (
                <Card>
                  <CardContent className="py-8 flex flex-col items-center justify-center text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">No items added yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Click &quot;Add Item&quot; to search and add products
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => {
                    const product = products.find(
                      (p) => p.id === item.productId
                    )
                    const lineTotal = item.unitPrice * item.quantity
                    const itemTax = (lineTotal * item.gstRate) / 100

                    return (
                      <Card key={item.key}>
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0 space-y-2">
                              {/* Product name + variant selector */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm truncate">
                                  {item.productName}
                                </span>
                                {product && product.variants.length > 1 && (
                                  <Select
                                    value={item.variantId}
                                    onValueChange={(v) =>
                                      updateItemVariant(item.key, v)
                                    }
                                  >
                                    <SelectTrigger className="h-7 w-auto min-w-[80px] text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {product.variants.map((v) => (
                                        <SelectItem
                                          key={v.id}
                                          value={v.id}
                                          className="text-xs"
                                        >
                                          {v.name} - {formatINR(v.price)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                                {product && product.variants.length <= 1 && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px]"
                                  >
                                    {item.variantName}
                                  </Badge>
                                )}
                              </div>

                              {/* Quantity + Price */}
                              <div className="flex items-center gap-3">
                                <div className="flex items-center border rounded-md">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() =>
                                      updateItemQuantity(
                                        item.key,
                                        item.quantity - 1
                                      )
                                    }
                                    disabled={item.quantity <= 1}
                                  >
                                    -
                                  </Button>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={(e) =>
                                      updateItemQuantity(
                                        item.key,
                                        Math.max(1, parseInt(e.target.value) || 1)
                                      )
                                    }
                                    className="h-7 w-12 text-center text-sm border-0 p-0 focus-visible:ring-0"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() =>
                                      updateItemQuantity(
                                        item.key,
                                        item.quantity + 1
                                      )
                                    }
                                  >
                                    +
                                  </Button>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {formatINR(item.unitPrice)} × {item.quantity}
                                </span>
                                {item.gstRate > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    GST {item.gstRate}%: {formatINR(itemTax)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              <span className="font-semibold text-sm">
                                {formatINR(lineTotal + itemTax)}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => removeItem(item.key)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </section>

            <Separator />

            {/* ─── Delivery Address ─── */}
            {(orderType === "DELIVERY" || orderType === "PICKUP_AND_DELIVERY") && (
              <>
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    <MapPin className="h-4 w-4" />
                    Delivery Address
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delivery-address">Address</Label>
                    <Textarea
                      id="delivery-address"
                      placeholder="Enter full delivery address..."
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      rows={2}
                    />
                  </div>
                </section>
                <Separator />
              </>
            )}

            {/* ─── Notes ─── */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                <StickyNote className="h-4 w-4" />
                Notes
              </div>
              <Textarea
                placeholder="Any special instructions or notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </section>

            <Separator />

            {/* ─── Order Summary ─── */}
            <section className="space-y-3">
              <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Order Summary
              </div>
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Subtotal ({items.length} item{items.length !== 1 ? "s" : ""})
                    </span>
                    <span>{formatINR(subtotal)}</span>
                  </div>
                  {totalTax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Tax (GST {GST_RATE}%)
                      </span>
                      <span>{formatINR(totalTax)}</span>
                    </div>
                  )}
                  {deliveryFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Delivery Fee
                      </span>
                      <span>{formatINR(deliveryFee)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span>{formatINR(totalAmount)}</span>
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </span>
            ) : (
              "Create Order"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
