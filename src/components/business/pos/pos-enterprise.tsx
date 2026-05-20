"use client"

/**
 * Enterprise POS — Workflow-Aware · Multi-Mode · Virtualized
 *
 * DISPLAY MODES             DENSITY LEVELS
 * ─────────────────         ──────────────────────────────────
 * List     keyboard-first   Comfortable  full info, 44px rows
 * Grid     visual browse    Compact      balanced,  32px rows
 * Service  service-panel    Ultra        name+price, 24px rows
 * Touch    tablet/counter               6-10 grid columns
 *
 * PERFORMANCE
 * ───────────────────────────────────────────────────────────
 * • react-virtual windowed rendering (only visible rows in DOM)
 * • useInfiniteQuery — 60-item pages, accumulated on scroll
 * • Debounced 200ms search
 * • Auto-detect defaults: workflow→mode, inventory scale→density
 * • Preferences persisted to localStorage
 *
 * CORE ENGINE (shared across ALL workflows)
 * ───────────────────────────────────────────────────────────
 * Cart · Billing · Tax · Discount · Payment · Ledger · Split
 */

import {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react"
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Search, Plus, Minus, Trash2, Barcode, Receipt, User,
  Banknote, CreditCard, Smartphone, QrCode, SplitSquareHorizontal,
  X, LayoutList, LayoutGrid, ShoppingCart, CheckCircle2, BookOpen,
  Eye, Thermometer, Car, Wrench, FlaskConical, Scale, ChefHat,
  Rows3, MonitorSmartphone, ChevronDown, ChevronUp, Loader2,
} from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { useAdminStore } from "@/stores/admin-store"
import { useBusinessContext } from "@/hooks/use-business-context"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { showSuccess, showError } from "@/lib/toast-utils"
import { calculatePOSCart } from "@/lib/core/pos"

// ─── Core Types ───────────────────────────────────────────────────────────────

type DisplayMode = "list" | "grid" | "service" | "touch"
type Density = "comfortable" | "compact" | "ultra"

interface DensityConfig {
  rowHeight: number          // list mode row height px
  gridCols: number           // grid columns
  touchCols: number          // touch mode columns
  tileHeight: number         // grid/touch tile height px
  tileGap: number            // gap between tiles px
  fontSize: string           // tailwind text size class
}

const DENSITY_CONFIG: Record<Density, DensityConfig> = {
  comfortable: { rowHeight: 44, gridCols: 4,  touchCols: 2, tileHeight: 100, tileGap: 6, fontSize: "text-xs" },
  compact:     { rowHeight: 32, gridCols: 6,  touchCols: 3, tileHeight: 76,  tileGap: 4, fontSize: "text-[10px]" },
  ultra:       { rowHeight: 24, gridCols: 10, touchCols: 4, tileHeight: 56,  tileGap: 3, fontSize: "text-[9px]" },
}

interface GatewayPlugin {
  id: string; gateway: string; displayName: string; isGloballyEnabled: boolean
  businessAccess: { isAssigned: boolean; canConfigure: boolean; isActive: boolean }[]
}

interface ProductVariant {
  id: string; name: string; price: number; mrp: number
  discountPrice: number | null; stock: number; isDefault: boolean
}

interface Product {
  id: string; name: string; barcode?: string | null; unit: string | null
  isVeg: boolean | null; category: { id: string; name: string } | null
  variants: ProductVariant[]; metadata?: Record<string, unknown>
}

interface CartItem {
  productId: string; variantId: string; productName: string; variantName: string
  quantity: number; unitPrice: number; mrp: number; discountPrice: number | null
  gstRate?: number
  meta?: Record<string, string | number | boolean>
}

interface SplitEntry { method: PaymentMethod; amount: string }
type PaymentMethod = "CASH" | "CARD" | "UPI" | "QR" | "LEDGER" | "SPLIT"

// ─── Workflow Plugin Interface ────────────────────────────────────────────────

interface ProductRowProps {
  product: Product
  onAdd: (p: Product, v: ProductVariant, meta?: Record<string, unknown>) => void
  focused: boolean
}
interface ProductCardProps {
  product: Product
  onAdd: (p: Product, v: ProductVariant, meta?: Record<string, unknown>) => void
}
interface ServicePanelProps {
  onAddItem: (item: Omit<CartItem, "quantity">) => void
  onSetOrderContext: (ctx: Record<string, unknown>) => void
  orderContext: Record<string, unknown>
}

interface WorkflowPlugin {
  id: string; label: string; businessTypes: string[]
  searchPlaceholder: string; showBarcodeIcon: boolean
  ProductRow: (props: ProductRowProps) => React.ReactElement | null
  ProductCard: (props: ProductCardProps) => React.ReactElement | null
  ServicePanel?: (props: ServicePanelProps) => React.ReactElement | null
  formatCartMeta?: (meta: CartItem["meta"]) => string | null
}

// ─── Payment Constants ────────────────────────────────────────────────────────

const METHOD_META: Record<PaymentMethod, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  CASH:   { label: "Cash",       icon: Banknote,              color: "text-emerald-600" },
  CARD:   { label: "Card",       icon: CreditCard,            color: "text-blue-600" },
  UPI:    { label: "UPI",        icon: Smartphone,            color: "text-violet-600" },
  QR:     { label: "QR Pay",     icon: QrCode,                color: "text-orange-600" },
  LEDGER: { label: "Ledger/Due", icon: BookOpen,              color: "text-rose-600" },
  SPLIT:  { label: "Split",      icon: SplitSquareHorizontal, color: "text-amber-600" },
}
const GATEWAY_TO_METHOD: Record<string, PaymentMethod> = {
  razorpay: "UPI", phonepe: "UPI", paytm: "UPI", bharatpe: "QR",
  pinelabs: "CARD", cashfree: "UPI", payu: "CARD", stripe: "CARD",
  hdfc: "CARD", ccavenue: "CARD",
}

// ═════════════════════════════════════════════════════════════════════════════
// WORKFLOW PLUGINS — Each plugin defines rendering + optional service panel.
// The core cart/billing/payment engine below is completely plugin-independent.
// ═════════════════════════════════════════════════════════════════════════════

// ── 1. Grocery / Ecommerce / General Retail ───────────────────────────────────
const GroceryPlugin: WorkflowPlugin = {
  id: "grocery", label: "Grocery & Retail",
  businessTypes: ["GROCERY", "ECOMMERCE", "COSMETICS", "FURNITURE", "DIRECTORY", "PLATFORM"],
  searchPlaceholder: "Barcode scan or search products…", showBarcodeIcon: true,
  ProductRow({ product, onAdd, focused }) {
    const v = product.variants.find((v) => v.isDefault) ?? product.variants[0]
    if (!v) return null
    const price = v.discountPrice ?? v.price
    return (
      <div className={cn("flex items-center gap-2 px-3 border-b last:border-0 cursor-pointer hover:bg-accent/60 transition-colors group h-full", focused && "bg-primary/5 ring-1 ring-inset ring-primary/30")} onClick={() => onAdd(product, v)}>
        {product.isVeg !== null && <div className={cn("size-2.5 rounded-sm border-2 shrink-0", product.isVeg ? "border-emerald-600 bg-emerald-500" : "border-rose-600 bg-rose-500")} />}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium leading-tight truncate">{product.name}</p>
          {product.category && <p className="text-[9px] text-muted-foreground truncate">{product.category.name}</p>}
        </div>
        {v.stock < 10 && <Badge variant="outline" className="text-[9px] h-3.5 px-1 text-amber-600 border-amber-300 shrink-0">Low</Badge>}
        <div className="text-right shrink-0">
          <p className="text-[10px] font-semibold tabular-nums">{formatCurrency(price)}</p>
          {v.discountPrice && <p className="text-[9px] line-through text-muted-foreground">{formatCurrency(v.mrp)}</p>}
        </div>
        <button className="size-5 rounded bg-primary/10 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 shrink-0" onClick={(e) => { e.stopPropagation(); onAdd(product, v) }}><Plus className="size-3" /></button>
      </div>
    )
  },
  ProductCard({ product, onAdd }) {
    const v = product.variants.find((v) => v.isDefault) ?? product.variants[0]
    if (!v) return null
    return (
      <button onClick={() => onAdd(product, v)} className="flex flex-col rounded border bg-card p-1.5 text-left hover:border-primary/50 hover:bg-accent/50 transition-colors active:scale-95 overflow-hidden h-full w-full">
        <div className="flex items-start justify-between gap-0.5 flex-1">
          <p className="text-[9px] font-medium leading-tight line-clamp-3 flex-1">{product.name}</p>
          {product.isVeg !== null && <div className={cn("size-2 rounded-sm border shrink-0 mt-0.5", product.isVeg ? "border-emerald-600 bg-emerald-500" : "border-rose-600 bg-rose-500")} />}
        </div>
        <div className="flex items-center justify-between mt-auto pt-0.5">
          <span className="text-[9px] font-bold tabular-nums text-primary">{formatCurrency(v.discountPrice ?? v.price)}</span>
          <Plus className="size-2.5 text-primary shrink-0" />
        </div>
      </button>
    )
  },
}

// ── 2. Pharmacy ───────────────────────────────────────────────────────────────
const PharmacyPlugin: WorkflowPlugin = {
  id: "pharmacy", label: "Pharmacy",
  businessTypes: ["PHARMACY"],
  searchPlaceholder: "Medicine name, batch no., or scan barcode…", showBarcodeIcon: true,
  formatCartMeta(meta) {
    if (!meta) return null
    const parts: string[] = []
    if (meta.batch) parts.push(`Batch: ${meta.batch}`)
    if (meta.expiry) parts.push(`Exp: ${meta.expiry}`)
    if (meta.schedule) parts.push(String(meta.schedule))
    return parts.join(" · ") || null
  },
  ProductRow({ product, onAdd, focused }) {
    const v = product.variants.find((v) => v.isDefault) ?? product.variants[0]
    if (!v) return null
    const m = (product.metadata ?? {}) as Record<string, string>
    const meta = { batch: m.batchNumber ?? "", expiry: m.expiryDate ?? "", schedule: m.schedule ?? "OTC" }
    return (
      <div className={cn("flex items-center gap-2 px-3 border-b last:border-0 cursor-pointer hover:bg-accent/60 transition-colors group h-full", focused && "bg-primary/5 ring-1 ring-inset ring-primary/30")} onClick={() => onAdd(product, v, meta)}>
        <FlaskConical className="size-3 text-emerald-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium truncate">{product.name}</p>
          <div className="flex items-center gap-1">
            {m.schedule && <Badge variant="outline" className="text-[8px] h-3 px-0.5">{m.schedule}</Badge>}
            {m.expiryDate && <span className="text-[9px] text-muted-foreground">Exp {m.expiryDate}</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-semibold tabular-nums">{formatCurrency(v.discountPrice ?? v.price)}</p>
          {v.stock < 20 && <p className="text-[9px] text-amber-600">Stk:{v.stock}</p>}
        </div>
        <button className="size-5 rounded bg-primary/10 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 shrink-0" onClick={(e) => { e.stopPropagation(); onAdd(product, v, meta) }}><Plus className="size-3" /></button>
      </div>
    )
  },
  ProductCard({ product, onAdd }) {
    const v = product.variants.find((v) => v.isDefault) ?? product.variants[0]
    if (!v) return null
    const m = (product.metadata ?? {}) as Record<string, string>
    const meta = { batch: m.batchNumber ?? "", expiry: m.expiryDate ?? "", schedule: m.schedule ?? "OTC" }
    return (
      <button onClick={() => onAdd(product, v, meta)} className="flex flex-col rounded border bg-card p-1.5 text-left hover:border-primary/50 hover:bg-accent/50 transition-colors active:scale-95 h-full w-full overflow-hidden">
        <div className="flex items-start gap-0.5 flex-1"><FlaskConical className="size-2.5 text-emerald-500 mt-0.5 shrink-0" /><p className="text-[9px] font-medium line-clamp-2 flex-1">{product.name}</p></div>
        {m.schedule && <Badge variant="outline" className="text-[8px] h-3 px-0.5 self-start mt-0.5">{m.schedule}</Badge>}
        <div className="flex items-center justify-between mt-auto pt-0.5"><span className="text-[9px] font-bold tabular-nums text-primary">{formatCurrency(v.discountPrice ?? v.price)}</span><Plus className="size-2.5 text-primary" /></div>
      </button>
    )
  },
}

// ── 3. Meat / Seafood ─────────────────────────────────────────────────────────
const FRESHNESS = ["Live", "Fresh", "Chilled", "Frozen"] as const
const CUT_TYPES  = ["Whole", "Half", "Curry Cut", "Boneless", "Minced", "Fillets"] as const
const MeatPlugin: WorkflowPlugin = {
  id: "meat", label: "Meat & Seafood", businessTypes: ["MEAT_DELIVERY"],
  searchPlaceholder: "Search meat, fish, or seafood…", showBarcodeIcon: false,
  formatCartMeta(meta) {
    if (!meta) return null
    const parts: string[] = []
    if (meta.cut) parts.push(String(meta.cut))
    if (meta.freshness) parts.push(String(meta.freshness))
    if (meta.weight) parts.push(`${meta.weight}g`)
    return parts.join(" · ") || null
  },
  ServicePanel({ onAddItem }) {
    const [name, setName] = useState(""); const [cut, setCut] = useState<string>(CUT_TYPES[2])
    const [freshness, setFreshness] = useState<string>(FRESHNESS[1])
    const [rateKg, setRateKg] = useState(""); const [weightG, setWeightG] = useState("")
    const total = (Number(rateKg) * Number(weightG)) / 1000
    return (
      <div className="border-t px-3 py-2 space-y-2 bg-red-50/50">
        <p className="text-xs font-semibold text-red-700 flex items-center gap-1"><Scale className="size-3" /> Custom Weight Entry</p>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item (e.g. Chicken, Rohu)" className="h-7 text-xs" />
        <div className="flex gap-1.5">
          <select value={cut} onChange={(e) => setCut(e.target.value)} className="flex-1 text-xs border rounded px-2 py-1.5 bg-background">{CUT_TYPES.map((c) => <option key={c}>{c}</option>)}</select>
          <select value={freshness} onChange={(e) => setFreshness(e.target.value)} className="flex-1 text-xs border rounded px-2 py-1.5 bg-background">{FRESHNESS.map((f) => <option key={f}>{f}</option>)}</select>
        </div>
        <div className="flex gap-1.5">
          <Input value={rateKg} onChange={(e) => setRateKg(e.target.value)} placeholder="₹/kg" type="number" className="h-7 text-xs flex-1" />
          <Input value={weightG} onChange={(e) => setWeightG(e.target.value)} placeholder="grams" type="number" className="h-7 text-xs flex-1" />
        </div>
        {total > 0 && <p className="text-xs font-semibold text-red-700">{weightG}g = {formatCurrency(total)}</p>}
        <Button size="sm" className="w-full h-7 text-xs" disabled={!name || !rateKg || !weightG || total <= 0} onClick={() => { onAddItem({ productId: `meat-${Date.now()}`, variantId: "custom", productName: name, variantName: `${weightG}g · ${cut} · ${freshness}`, unitPrice: total, mrp: total, discountPrice: null, meta: { cut, freshness, weight: weightG } }); setName(""); setRateKg(""); setWeightG("") }}>Add to Cart</Button>
      </div>
    )
  },
  ProductRow({ product, onAdd, focused }) {
    const v = product.variants.find((v) => v.isDefault) ?? product.variants[0]
    if (!v) return null
    return (
      <div className={cn("flex items-center gap-2 px-3 border-b last:border-0 cursor-pointer hover:bg-accent/60 transition-colors group h-full", focused && "bg-primary/5 ring-1 ring-inset ring-primary/30")} onClick={() => onAdd(product, v, { cut: "Curry Cut", freshness: "Fresh" })}>
        <Thermometer className="size-3 text-red-400 shrink-0" />
        <div className="flex-1 min-w-0"><p className="text-[10px] font-medium truncate">{product.name}</p><p className="text-[9px] text-muted-foreground">{product.unit ?? "per piece"}</p></div>
        <p className="text-[10px] font-semibold tabular-nums shrink-0">{formatCurrency(v.discountPrice ?? v.price)}</p>
        <button className="size-5 rounded bg-primary/10 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 shrink-0" onClick={(e) => { e.stopPropagation(); onAdd(product, v, { cut: "Curry Cut", freshness: "Fresh" }) }}><Plus className="size-3" /></button>
      </div>
    )
  },
  ProductCard({ product, onAdd }) {
    const v = product.variants.find((v) => v.isDefault) ?? product.variants[0]
    if (!v) return null
    return (
      <button onClick={() => onAdd(product, v, { cut: "Curry Cut", freshness: "Fresh" })} className="flex flex-col rounded border bg-card p-1.5 text-left hover:border-primary/50 hover:bg-accent/50 transition-colors active:scale-95 h-full w-full overflow-hidden">
        <div className="flex items-start gap-0.5 flex-1"><Thermometer className="size-2.5 text-red-400 mt-0.5 shrink-0" /><p className="text-[9px] font-medium line-clamp-2 flex-1">{product.name}</p></div>
        <div className="flex items-center justify-between mt-auto pt-0.5"><span className="text-[9px] font-bold tabular-nums text-primary">{formatCurrency(v.discountPrice ?? v.price)}</span><Plus className="size-2.5 text-primary" /></div>
      </button>
    )
  },
}

// ── 4. Laundry ────────────────────────────────────────────────────────────────
const LAUNDRY_SVCS = [
  { label: "Wash & Fold", unit: "kg", emoji: "🧺" }, { label: "Dry Clean", unit: "piece", emoji: "👔" },
  { label: "Iron Only",   unit: "piece", emoji: "🪣" }, { label: "Wash & Iron", unit: "piece", emoji: "👕" },
  { label: "Express",     unit: "kg",    emoji: "⚡" }, { label: "Carpet",    unit: "sqft",  emoji: "🪞" },
] as const
const LaundryPlugin: WorkflowPlugin = {
  id: "laundry", label: "Laundry & Dry Clean", businessTypes: ["LAUNDRY"],
  searchPlaceholder: "Search laundry packages…", showBarcodeIcon: false,
  formatCartMeta(meta) {
    if (!meta) return null
    const parts: string[] = []
    if (meta.qty && meta.unit) parts.push(`${meta.qty} ${meta.unit}`)
    if (meta.stain) parts.push(`Stain: ${meta.stain}`)
    if (meta.express) parts.push("Express")
    return parts.join(" · ") || null
  },
  ServicePanel({ onAddItem }) {
    const [idx, setIdx] = useState(0); const [qty, setQty] = useState(""); const [rate, setRate] = useState("")
    const [stain, setStain] = useState(""); const [express, setExpress] = useState(false)
    const svc = LAUNDRY_SVCS[idx]; const total = Number(rate) * Number(qty) * (express ? 1.3 : 1)
    return (
      <div className="border-t px-3 py-2 space-y-2 bg-sky-50/50">
        <p className="text-xs font-semibold text-sky-700">🧺 Laundry Service Entry</p>
        <div className="grid grid-cols-3 gap-1">{LAUNDRY_SVCS.map((s, i) => <button key={i} onClick={() => setIdx(i)} className={cn("text-[10px] px-1.5 py-1 rounded border text-left transition-colors", idx === i ? "bg-sky-500 text-white border-sky-500" : "hover:bg-accent")}>{s.emoji} {s.label}</button>)}</div>
        <div className="flex gap-1.5">
          <Input value={qty} onChange={(e) => setQty(e.target.value)} placeholder={`Qty (${svc.unit})`} type="number" className="h-7 text-xs flex-1" />
          <Input value={rate} onChange={(e) => setRate(e.target.value)} placeholder={`₹/${svc.unit}`} type="number" className="h-7 text-xs flex-1" />
        </div>
        <Input value={stain} onChange={(e) => setStain(e.target.value)} placeholder="Stain / special instructions…" className="h-7 text-xs" />
        <div className="flex items-center gap-2">
          <button onClick={() => setExpress(!express)} className={cn("text-[10px] px-3 py-1 rounded border transition-colors", express ? "bg-amber-500 text-white border-amber-500" : "hover:bg-accent")}>⚡ Express +30%</button>
          {total > 0 && <span className="text-xs font-semibold text-sky-700 ml-auto">{formatCurrency(total)}</span>}
        </div>
        <Button size="sm" className="w-full h-7 text-xs" disabled={!qty || !rate} onClick={() => { onAddItem({ productId: `laundry-${Date.now()}`, variantId: "svc", productName: svc.label, variantName: `${qty} ${svc.unit}${express ? " · Express" : ""}`, unitPrice: total, mrp: total, discountPrice: null, meta: { qty, unit: svc.unit, stain: stain || "", express: express ? 1 : 0 } }); setQty(""); setRate(""); setStain(""); setExpress(false) }}>Add to Bill</Button>
      </div>
    )
  },
  ProductRow({ product, onAdd, focused }) {
    const v = product.variants.find((v) => v.isDefault) ?? product.variants[0]
    if (!v) return null
    return (
      <div className={cn("flex items-center gap-2 px-3 border-b last:border-0 cursor-pointer hover:bg-accent/60 transition-colors group h-full", focused && "bg-primary/5 ring-1 ring-inset ring-primary/30")} onClick={() => onAdd(product, v)}>
        <span className="text-xs shrink-0">🧺</span>
        <div className="flex-1 min-w-0"><p className="text-[10px] font-medium truncate">{product.name}</p><p className="text-[9px] text-muted-foreground">{product.unit ?? "per piece"}</p></div>
        <p className="text-[10px] font-semibold tabular-nums shrink-0">{formatCurrency(v.discountPrice ?? v.price)}</p>
        <button className="size-5 rounded bg-primary/10 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 shrink-0" onClick={(e) => { e.stopPropagation(); onAdd(product, v) }}><Plus className="size-3" /></button>
      </div>
    )
  },
  ProductCard({ product, onAdd }) {
    const v = product.variants.find((v) => v.isDefault) ?? product.variants[0]
    if (!v) return null
    return (
      <button onClick={() => onAdd(product, v)} className="flex flex-col rounded border bg-card p-1.5 text-left hover:border-primary/50 hover:bg-accent/50 transition-colors active:scale-95 h-full w-full">
        <p className="text-xs">🧺</p><p className="text-[9px] font-medium line-clamp-2 flex-1">{product.name}</p>
        <div className="flex items-center justify-between mt-auto pt-0.5"><span className="text-[9px] font-bold tabular-nums text-primary">{formatCurrency(v.discountPrice ?? v.price)}</span><Plus className="size-2.5 text-primary" /></div>
      </button>
    )
  },
}

// ── 5. Car / Bike Wash ────────────────────────────────────────────────────────
const VEHICLE_TYPES  = ["2-Wheeler", "Hatchback", "Sedan", "SUV", "MUV", "Van"] as const
const WASH_PACKAGES  = [{ label: "Basic", price: 149 }, { label: "Standard", price: 249 }, { label: "Premium", price: 399 }, { label: "Deluxe", price: 699 }] as const
const WASH_ADDONS    = [{ label: "Interior Vacuum", price: 99 }, { label: "Wax Polish", price: 149 }, { label: "Engine Clean", price: 199 }, { label: "Tyre Shine", price: 49 }, { label: "Ceramic Coat", price: 499 }] as const
const CarWashPlugin: WorkflowPlugin = {
  id: "carwash", label: "Car & Bike Wash", businessTypes: ["CAR_WASH"],
  searchPlaceholder: "Search wash packages or add-ons…", showBarcodeIcon: false,
  formatCartMeta(meta) {
    if (!meta) return null
    const parts: string[] = []
    if (meta.vehicle) parts.push(String(meta.vehicle))
    if (meta.package) parts.push(String(meta.package))
    if (meta.regNum)  parts.push(String(meta.regNum))
    return parts.join(" · ") || null
  },
  ServicePanel({ onAddItem }) {
    const [vehicle, setVehicle] = useState<string>(VEHICLE_TYPES[1]); const [pkgIdx, setPkgIdx] = useState(1)
    const [addons, setAddons] = useState<Set<number>>(new Set()); const [regNum, setRegNum] = useState("")
    const toggleAddon = (i: number) => setAddons((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })
    const total = WASH_PACKAGES[pkgIdx].price + Array.from(addons).reduce((s, i) => s + WASH_ADDONS[i].price, 0)
    return (
      <div className="border-t px-3 py-2 space-y-2 bg-blue-50/50">
        <p className="text-xs font-semibold text-blue-700 flex items-center gap-1"><Car className="size-3" /> Wash Configurator</p>
        <div className="flex flex-wrap gap-1">{VEHICLE_TYPES.map((v) => <button key={v} onClick={() => setVehicle(v)} className={cn("text-[10px] px-2 py-1 rounded border transition-colors", vehicle === v ? "bg-blue-500 text-white border-blue-500" : "hover:bg-accent")}>{v}</button>)}</div>
        <div className="flex gap-1">{WASH_PACKAGES.map((p, i) => <button key={i} onClick={() => setPkgIdx(i)} className={cn("flex-1 text-[10px] px-1.5 py-1 rounded border text-center transition-colors", pkgIdx === i ? "bg-blue-500 text-white border-blue-500" : "hover:bg-accent")}>{p.label}<br />{formatCurrency(p.price)}</button>)}</div>
        <div className="flex flex-wrap gap-1">{WASH_ADDONS.map((a, i) => <button key={i} onClick={() => toggleAddon(i)} className={cn("text-[10px] px-2 py-1 rounded border transition-colors", addons.has(i) ? "bg-amber-500 text-white border-amber-500" : "hover:bg-accent")}>{a.label} +{formatCurrency(a.price)}</button>)}</div>
        <Input value={regNum} onChange={(e) => setRegNum(e.target.value)} placeholder="Vehicle reg. no. (optional)" className="h-7 text-xs" />
        <Button size="sm" className="w-full h-7 text-xs" onClick={() => { const al = Array.from(addons).map((i) => WASH_ADDONS[i].label).join(", "); onAddItem({ productId: `wash-${Date.now()}`, variantId: "wash", productName: `${WASH_PACKAGES[pkgIdx].label} — ${vehicle}`, variantName: al || "No add-ons", unitPrice: total, mrp: total, discountPrice: null, meta: { vehicle, package: WASH_PACKAGES[pkgIdx].label, regNum: regNum || "" } }); setRegNum("") }}>Add to Bill — {formatCurrency(total)}</Button>
      </div>
    )
  },
  ProductRow({ product, onAdd, focused }) {
    const v = product.variants.find((v) => v.isDefault) ?? product.variants[0]
    if (!v) return null
    return (
      <div className={cn("flex items-center gap-2 px-3 border-b last:border-0 cursor-pointer hover:bg-accent/60 transition-colors group h-full", focused && "bg-primary/5 ring-1 ring-inset ring-primary/30")} onClick={() => onAdd(product, v, { vehicle: "Hatchback" })}>
        <Car className="size-3 text-blue-500 shrink-0" />
        <div className="flex-1 min-w-0"><p className="text-[10px] font-medium truncate">{product.name}</p>{product.category && <p className="text-[9px] text-muted-foreground">{product.category.name}</p>}</div>
        <p className="text-[10px] font-semibold tabular-nums shrink-0">{formatCurrency(v.discountPrice ?? v.price)}</p>
        <button className="size-5 rounded bg-primary/10 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 shrink-0" onClick={(e) => { e.stopPropagation(); onAdd(product, v, { vehicle: "Hatchback" }) }}><Plus className="size-3" /></button>
      </div>
    )
  },
  ProductCard({ product, onAdd }) {
    const v = product.variants.find((v) => v.isDefault) ?? product.variants[0]
    if (!v) return null
    return (
      <button onClick={() => onAdd(product, v, { vehicle: "Hatchback" })} className="flex flex-col rounded border bg-card p-1.5 text-left hover:border-primary/50 hover:bg-accent/50 transition-colors active:scale-95 h-full w-full overflow-hidden">
        <div className="flex items-start gap-0.5 flex-1"><Car className="size-2.5 text-blue-500 mt-0.5 shrink-0" /><p className="text-[9px] font-medium line-clamp-2 flex-1">{product.name}</p></div>
        <div className="flex items-center justify-between mt-auto pt-0.5"><span className="text-[9px] font-bold tabular-nums text-primary">{formatCurrency(v.discountPrice ?? v.price)}</span><Plus className="size-2.5 text-primary" /></div>
      </button>
    )
  },
}

// ── 6. Home Services ──────────────────────────────────────────────────────────
const HOME_CATS = ["Plumbing", "Electrical", "AC Repair", "Carpentry", "Painting", "Cleaning", "Pest Control", "Appliance Repair", "CCTV"] as const
const HomeServicesPlugin: WorkflowPlugin = {
  id: "home-services", label: "Home Services", businessTypes: ["HOME_SERVICES"],
  searchPlaceholder: "Search home services…", showBarcodeIcon: false,
  formatCartMeta(meta) {
    if (!meta) return null
    const parts: string[] = []
    if (meta.technician) parts.push(`Tech: ${meta.technician}`)
    if (meta.note) parts.push(String(meta.note))
    if (meta.postBilling) parts.push("Post-service")
    return parts.join(" · ") || null
  },
  ServicePanel({ onAddItem }) {
    const [cat, setCat] = useState<string>(HOME_CATS[0]); const [desc, setDesc] = useState("")
    const [price, setPrice] = useState(""); const [tech, setTech] = useState(""); const [note, setNote] = useState(""); const [post, setPost] = useState(false)
    return (
      <div className="border-t px-3 py-2 space-y-2 bg-violet-50/50">
        <p className="text-xs font-semibold text-violet-700 flex items-center gap-1"><Wrench className="size-3" /> Service Job Entry</p>
        <div className="flex flex-wrap gap-1">{HOME_CATS.map((c) => <button key={c} onClick={() => setCat(c)} className={cn("text-[10px] px-2 py-1 rounded border transition-colors", cat === c ? "bg-violet-500 text-white border-violet-500" : "hover:bg-accent")}>{c}</button>)}</div>
        <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Job description…" className="h-7 text-xs" />
        <div className="flex gap-1.5">
          <Input value={tech} onChange={(e) => setTech(e.target.value)} placeholder="Technician" className="h-7 text-xs flex-1" />
          <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder={post ? "Est. ₹" : "₹"} type="number" className="h-7 text-xs w-24" />
        </div>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Inspection / special notes…" className="h-7 text-xs" />
        <div className="flex items-center gap-2">
          <button onClick={() => setPost(!post)} className={cn("text-[10px] px-3 py-1 rounded border transition-colors", post ? "bg-rose-500 text-white border-rose-500" : "hover:bg-accent")}>📋 Post-Service</button>
          {post && <span className="text-[10px] text-rose-600">Price after inspection</span>}
        </div>
        <Button size="sm" className="w-full h-7 text-xs" disabled={!desc || !price} onClick={() => { onAddItem({ productId: `svc-${Date.now()}`, variantId: "service", productName: `${cat}: ${desc}`, variantName: post ? "Post-service" : `₹${price}`, unitPrice: Number(price), mrp: Number(price), discountPrice: null, meta: { technician: tech || "", note: note || "", postBilling: post ? 1 : 0 } }); setDesc(""); setPrice(""); setTech(""); setNote("") }}>Add Job to Bill</Button>
      </div>
    )
  },
  ProductRow({ product, onAdd, focused }) {
    const v = product.variants.find((v) => v.isDefault) ?? product.variants[0]
    if (!v) return null
    return (
      <div className={cn("flex items-center gap-2 px-3 border-b last:border-0 cursor-pointer hover:bg-accent/60 transition-colors group h-full", focused && "bg-primary/5 ring-1 ring-inset ring-primary/30")} onClick={() => onAdd(product, v)}>
        <Wrench className="size-3 text-violet-500 shrink-0" />
        <div className="flex-1 min-w-0"><p className="text-[10px] font-medium truncate">{product.name}</p>{product.category && <p className="text-[9px] text-muted-foreground">{product.category.name}</p>}</div>
        <p className="text-[10px] font-semibold tabular-nums shrink-0">{formatCurrency(v.discountPrice ?? v.price)}</p>
        <button className="size-5 rounded bg-primary/10 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 shrink-0" onClick={(e) => { e.stopPropagation(); onAdd(product, v) }}><Plus className="size-3" /></button>
      </div>
    )
  },
  ProductCard({ product, onAdd }) {
    const v = product.variants.find((v) => v.isDefault) ?? product.variants[0]
    if (!v) return null
    return (
      <button onClick={() => onAdd(product, v)} className="flex flex-col rounded border bg-card p-1.5 text-left hover:border-primary/50 hover:bg-accent/50 transition-colors active:scale-95 h-full w-full overflow-hidden">
        <div className="flex items-start gap-0.5 flex-1"><Wrench className="size-2.5 text-violet-500 mt-0.5 shrink-0" /><p className="text-[9px] font-medium line-clamp-2 flex-1">{product.name}</p></div>
        <div className="flex items-center justify-between mt-auto pt-0.5"><span className="text-[9px] font-bold tabular-nums text-primary">{formatCurrency(v.discountPrice ?? v.price)}</span><Plus className="size-2.5 text-primary" /></div>
      </button>
    )
  },
}

// ── 7. Food Delivery / Restaurant ─────────────────────────────────────────────
const ORDER_TYPES = ["Dine-in", "Takeaway", "Delivery"] as const
const FoodDeliveryPlugin: WorkflowPlugin = {
  id: "food", label: "Food & Restaurant", businessTypes: ["FOOD_DELIVERY"],
  searchPlaceholder: "Search menu items…", showBarcodeIcon: false,
  formatCartMeta(meta) {
    if (!meta) return null
    const parts: string[] = []
    if (meta.note) parts.push(String(meta.note))
    return parts.join(" · ") || null
  },
  ServicePanel({ orderContext, onSetOrderContext }) {
    const orderType = (orderContext.orderType as string) ?? ORDER_TYPES[0]
    const tableNum  = (orderContext.tableNum as string) ?? ""
    const kotNote   = (orderContext.kotNote as string) ?? ""
    return (
      <div className="border-t px-3 py-2 space-y-2 bg-amber-50/50">
        <p className="text-xs font-semibold text-amber-700 flex items-center gap-1"><ChefHat className="size-3" /> Order Context</p>
        <div className="flex gap-1">{ORDER_TYPES.map((t) => <button key={t} onClick={() => onSetOrderContext({ ...orderContext, orderType: t })} className={cn("flex-1 text-[10px] py-1.5 rounded border transition-colors", orderType === t ? "bg-amber-500 text-white border-amber-500" : "hover:bg-accent")}>{t}</button>)}</div>
        {orderType === "Dine-in" && <Input value={tableNum} onChange={(e) => onSetOrderContext({ ...orderContext, tableNum: e.target.value })} placeholder="Table / Section no." className="h-7 text-xs" />}
        <Input value={kotNote} onChange={(e) => onSetOrderContext({ ...orderContext, kotNote: e.target.value })} placeholder="KOT note (less spicy, no onion…)" className="h-7 text-xs" />
        <Badge variant="outline" className="text-[10px]">{orderType}{tableNum ? ` · Table ${tableNum}` : ""}{kotNote ? ` · "${kotNote}"` : ""}</Badge>
      </div>
    )
  },
  ProductRow({ product, onAdd, focused }) {
    const v = product.variants.find((v) => v.isDefault) ?? product.variants[0]
    if (!v) return null
    return (
      <div className={cn("flex items-center gap-2 px-3 border-b last:border-0 cursor-pointer hover:bg-accent/60 transition-colors group h-full", focused && "bg-primary/5 ring-1 ring-inset ring-primary/30")} onClick={() => onAdd(product, v)}>
        {product.isVeg !== null && <div className={cn("size-2.5 rounded-sm border-2 shrink-0", product.isVeg ? "border-emerald-600 bg-emerald-500" : "border-rose-600 bg-rose-500")} />}
        <div className="flex-1 min-w-0"><p className="text-[10px] font-medium truncate">{product.name}</p>{product.category && <p className="text-[9px] text-muted-foreground">{product.category.name}</p>}</div>
        <p className="text-[10px] font-semibold tabular-nums shrink-0">{formatCurrency(v.discountPrice ?? v.price)}</p>
        <button className="size-5 rounded bg-primary/10 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 shrink-0" onClick={(e) => { e.stopPropagation(); onAdd(product, v) }}><Plus className="size-3" /></button>
      </div>
    )
  },
  ProductCard({ product, onAdd }) {
    const v = product.variants.find((v) => v.isDefault) ?? product.variants[0]
    if (!v) return null
    return (
      <button onClick={() => onAdd(product, v)} className="flex flex-col rounded border bg-card p-1.5 text-left hover:border-primary/50 hover:bg-accent/50 transition-colors active:scale-95 h-full w-full overflow-hidden">
        <div className="flex items-start justify-between gap-0.5 flex-1">
          <p className="text-[9px] font-medium line-clamp-2 flex-1">{product.name}</p>
          {product.isVeg !== null && <div className={cn("size-2 rounded-sm border shrink-0", product.isVeg ? "border-emerald-600 bg-emerald-500" : "border-rose-600 bg-rose-500")} />}
        </div>
        <div className="flex items-center justify-between mt-auto pt-0.5"><span className="text-[9px] font-bold tabular-nums text-primary">{formatCurrency(v.discountPrice ?? v.price)}</span><Plus className="size-2.5 text-primary" /></div>
      </button>
    )
  },
}

// ─── Plugin Registry ──────────────────────────────────────────────────────────
const PLUGIN_REGISTRY: WorkflowPlugin[] = [
  GroceryPlugin, PharmacyPlugin, MeatPlugin, LaundryPlugin,
  CarWashPlugin, HomeServicesPlugin, FoodDeliveryPlugin,
]
function getPlugin(businessType: string): WorkflowPlugin {
  return PLUGIN_REGISTRY.find((p) => p.businessTypes.includes(businessType)) ?? GroceryPlugin
}

// ═════════════════════════════════════════════════════════════════════════════
// CORE POS ENGINE — Shared. Workflow-independent.
// ═════════════════════════════════════════════════════════════════════════════

// ─── Ultra Compact Renderers (density="ultra" overrides plugin renderers) ─────

function UltraRow({ product, onAdd, focused }: ProductRowProps) {
  const v = product.variants.find((v) => v.isDefault) ?? product.variants[0]
  if (!v) return null
  return (
    <div
      className={cn("flex items-center gap-2 px-2 border-b last:border-0 cursor-pointer hover:bg-accent/60 transition-colors h-full", focused && "bg-primary/5")}
      onClick={() => onAdd(product, v)}
    >
      <span className="flex-1 text-[9px] font-medium truncate">{product.name}</span>
      <span className="text-[9px] font-bold tabular-nums text-primary shrink-0">{formatCurrency(v.discountPrice ?? v.price)}</span>
    </div>
  )
}

function UltraCard({ product, onAdd }: ProductCardProps) {
  const v = product.variants.find((v) => v.isDefault) ?? product.variants[0]
  if (!v) return null
  return (
    <button
      onClick={() => onAdd(product, v)}
      className="flex flex-col justify-between rounded border bg-card p-1 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors active:scale-95 h-full w-full overflow-hidden"
    >
      <p className="text-[8px] font-medium leading-tight line-clamp-3">{product.name}</p>
      <p className="text-[8px] font-bold tabular-nums text-primary mt-0.5">{formatCurrency(v.discountPrice ?? v.price)}</p>
    </button>
  )
}

// ─── Touch Mode Card (large tap targets) ──────────────────────────────────────

function TouchCard({ product, onAdd }: ProductCardProps) {
  const v = product.variants.find((v) => v.isDefault) ?? product.variants[0]
  if (!v) return null
  const price = v.discountPrice ?? v.price
  return (
    <button
      onClick={() => onAdd(product, v)}
      className="flex flex-col gap-1 rounded-xl border-2 bg-card p-3 text-left hover:border-primary hover:bg-accent/50 active:scale-95 transition-all h-full w-full"
    >
      {product.isVeg !== null && (
        <div className={cn("size-3 rounded-sm border-2 shrink-0", product.isVeg ? "border-emerald-600 bg-emerald-500" : "border-rose-600 bg-rose-500")} />
      )}
      <p className="text-xs font-semibold leading-tight line-clamp-3 flex-1">{product.name}</p>
      {product.category && <p className="text-[10px] text-muted-foreground">{product.category.name}</p>}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold tabular-nums text-primary">{formatCurrency(price)}</span>
        <div className="size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <Plus className="size-4" />
        </div>
      </div>
    </button>
  )
}

// ─── Virtualized List ─────────────────────────────────────────────────────────

function VirtualList({
  products, plugin, onAdd, focusIdx, rowHeight, density, onNearEnd,
}: {
  products: Product[]; plugin: WorkflowPlugin; onAdd: (p: Product, v: ProductVariant, m?: Record<string, unknown>) => void
  focusIdx: number; rowHeight: number; density: Density; onNearEnd: () => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const RowRenderer = density === "ultra" ? UltraRow : plugin.ProductRow

  const virtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 20,
  })

  // Trigger infinite load when near end
  const virtualItems = virtualizer.getVirtualItems()
  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1]
    if (last && last.index >= products.length - 5) onNearEnd()
  }, [virtualItems, products.length, onNearEnd])

  return (
    <div ref={parentRef} className="flex-1 overflow-auto">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.key}
            style={{ position: "absolute", top: item.start, left: 0, right: 0, height: item.size }}
          >
            <RowRenderer product={products[item.index]} onAdd={onAdd} focused={item.index === focusIdx} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Virtualized Grid ─────────────────────────────────────────────────────────

function VirtualGrid({
  products, plugin, onAdd, columns, tileHeight, tileGap, density, mode, onNearEnd,
}: {
  products: Product[]; plugin: WorkflowPlugin; onAdd: (p: Product, v: ProductVariant, m?: Record<string, unknown>) => void
  columns: number; tileHeight: number; tileGap: number; density: Density; mode: DisplayMode; onNearEnd: () => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const rowCount = Math.ceil(products.length / columns)
  const rowH = tileHeight + tileGap

  const CardRenderer = mode === "touch" ? TouchCard : density === "ultra" ? UltraCard : plugin.ProductCard

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowH,
    overscan: 5,
  })

  const virtualItems = virtualizer.getVirtualItems()
  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1]
    if (last && last.index >= rowCount - 2) onNearEnd()
  }, [virtualItems, rowCount, onNearEnd])

  return (
    <div ref={parentRef} className="flex-1 overflow-auto">
      <div style={{ height: virtualizer.getTotalSize() + tileGap, position: "relative" }}>
        {virtualizer.getVirtualItems().map((vRow) => {
          const start = vRow.index * columns
          const rowProducts = products.slice(start, start + columns)
          return (
            <div
              key={vRow.key}
              style={{
                position: "absolute",
                top: vRow.start + tileGap,
                left: tileGap,
                right: tileGap,
                height: tileHeight,
                display: "grid",
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap: tileGap,
              }}
            >
              {rowProducts.map((p) => (
                <CardRenderer key={p.id} product={p} onAdd={onAdd} />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Cart Item Row ────────────────────────────────────────────────────────────

function CartItemRow({
  item, compact, onIncrease, onDecrease, onRemove, formatMeta,
}: {
  item: CartItem; compact: boolean
  onIncrease: () => void; onDecrease: () => void; onRemove: () => void
  formatMeta?: (m: CartItem["meta"]) => string | null
}) {
  const price = item.discountPrice ?? item.unitPrice
  const metaLabel = formatMeta?.(item.meta) ?? null
  return (
    <div className={cn("flex items-start gap-2 border-b last:border-0", compact ? "py-1" : "py-1.5")}>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium leading-tight truncate">{item.productName}</p>
        <p className="text-[9px] text-muted-foreground truncate">{item.variantName} · {formatCurrency(price)}{metaLabel ? ` · ${metaLabel}` : ""}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onDecrease} className="size-5 rounded bg-muted flex items-center justify-center hover:bg-destructive/20"><Minus className="size-3" /></button>
        <span className="w-5 text-center text-xs font-semibold tabular-nums">{item.quantity}</span>
        <button onClick={onIncrease} className="size-5 rounded bg-muted flex items-center justify-center hover:bg-primary/20"><Plus className="size-3" /></button>
        <button onClick={onRemove} className="size-5 flex items-center justify-center text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
      </div>
      <span className="text-xs font-semibold tabular-nums w-14 text-right shrink-0">{formatCurrency(price * item.quantity)}</span>
    </div>
  )
}

// ─── Payment Dialog ───────────────────────────────────────────────────────────

function PaymentDialog({ open, onClose, total, enabledMethods, onConfirm, defaultPhone }: {
  open: boolean; onClose: () => void; total: number; enabledMethods: PaymentMethod[]
  onConfirm: (m: PaymentMethod, s: SplitEntry[], t: number, lp?: string) => void; defaultPhone?: string
}) {
  const [method, setMethod] = useState<PaymentMethod>("CASH")
  const [tendered, setTendered] = useState("")
  const [splits, setSplits] = useState<SplitEntry[]>([{ method: "CASH", amount: "" }, { method: "UPI", amount: "" }])
  const [ledgerPhone, setLedgerPhone] = useState(defaultPhone ?? "")
  const [qrVisible, setQrVisible] = useState(false)
  const change = method === "CASH" ? Math.max(0, Number(tendered) - total) : 0
  const splitTotal = splits.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const splitRemaining = total - splitTotal
  const handleConfirm = () => {
    if (method === "SPLIT") { if (Math.abs(splitRemaining) > 0.01) { showError("Split must equal total"); return }; onConfirm("SPLIT", splits.filter((s) => Number(s.amount) > 0), total) }
    else if (method === "CASH") onConfirm("CASH", [], Number(tendered) || total)
    else if (method === "LEDGER") { if (!ledgerPhone) { showError("Enter customer phone"); return }; onConfirm("LEDGER", [], 0, ledgerPhone) }
    else onConfirm(method, [], total)
  }
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="size-4" /> Collect Payment — {formatCurrency(total)}</DialogTitle></DialogHeader>
        <Tabs value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
          <TabsList className="flex flex-wrap h-auto gap-1 p-1">
            {enabledMethods.map((m) => { const meta = METHOD_META[m]; return <TabsTrigger key={m} value={m} className="flex items-center gap-1 text-xs h-7 px-2"><meta.icon className={cn("size-3", meta.color)} />{meta.label}</TabsTrigger> })}
          </TabsList>
          <TabsContent value="CASH" className="space-y-3 pt-2">
            <div><label className="text-xs text-muted-foreground">Amount Tendered (₹)</label><Input autoFocus type="number" value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder={String(total)} className="text-lg font-bold mt-1" /></div>
            {change > 0 && <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-center justify-between"><span className="text-sm text-emerald-700 font-medium">Change to Return</span><span className="text-xl font-bold text-emerald-700">{formatCurrency(change)}</span></div>}
          </TabsContent>
          <TabsContent value="CARD" className="pt-2"><div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-center"><CreditCard className="size-8 text-blue-500 mx-auto mb-2" /><p className="text-sm font-medium text-blue-700">Swipe or tap card for {formatCurrency(total)}</p></div></TabsContent>
          <TabsContent value="UPI" className="pt-2"><div className="rounded-lg bg-violet-50 border border-violet-200 p-4 text-center"><Smartphone className="size-8 text-violet-500 mx-auto mb-2" /><p className="text-sm font-medium text-violet-700">UPI — {formatCurrency(total)}</p></div></TabsContent>
          <TabsContent value="QR" className="pt-2">
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-4 text-center space-y-3">
              {qrVisible ? (<><div className="size-28 mx-auto rounded-lg bg-white border-2 border-orange-300 flex items-center justify-center"><QrCode className="size-16 text-orange-600" /></div><p className="text-xs text-orange-600">Scan to pay {formatCurrency(total)}</p></>) : (<><QrCode className="size-8 text-orange-500 mx-auto" /><Button variant="outline" size="sm" onClick={() => setQrVisible(true)}><Eye className="size-3 mr-1" />Show QR</Button></>)}
            </div>
          </TabsContent>
          <TabsContent value="LEDGER" className="space-y-3 pt-2">
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3"><p className="text-xs text-rose-700 font-medium">Pending due: {formatCurrency(total)}</p></div>
            <div><label className="text-xs text-muted-foreground">Customer Phone *</label><Input autoFocus value={ledgerPhone} onChange={(e) => setLedgerPhone(e.target.value)} placeholder="9XXXXXXXXX" className="mt-1" /></div>
          </TabsContent>
          <TabsContent value="SPLIT" className="space-y-3 pt-2">
            <div className="text-xs text-muted-foreground flex justify-between"><span>Split payments</span><span className={cn("font-semibold", Math.abs(splitRemaining) < 0.01 ? "text-emerald-600" : "text-rose-600")}>{splitRemaining > 0.01 ? `${formatCurrency(splitRemaining)} remaining` : splitRemaining < -0.01 ? `Over ${formatCurrency(-splitRemaining)}` : "✓ Balanced"}</span></div>
            {splits.map((e, i) => (
              <div key={i} className="flex gap-2">
                <select value={e.method} onChange={(ev) => setSplits((p) => p.map((s, j) => j === i ? { ...s, method: ev.target.value as PaymentMethod } : s))} className="text-xs border rounded px-2 py-1.5 bg-background flex-1">{["CASH", "CARD", "UPI", "QR"].map((m) => <option key={m} value={m}>{METHOD_META[m as PaymentMethod].label}</option>)}</select>
                <Input type="number" value={e.amount} onChange={(ev) => setSplits((p) => p.map((s, j) => j === i ? { ...s, amount: ev.target.value } : s))} placeholder="₹" className="w-28 text-sm" />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setSplits((p) => [...p, { method: "CASH", amount: "" }])}><Plus className="size-3 mr-1" />Add Method</Button>
          </TabsContent>
        </Tabs>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleConfirm} className="gap-2"><CheckCircle2 className="size-4" />Confirm Payment</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SuccessDialog({ open, onClose, orderId, total, method, change }: {
  open: boolean; onClose: () => void; orderId: string; total: number; method: PaymentMethod; change: number
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xs text-center">
        <CheckCircle2 className="size-14 text-emerald-500 mx-auto" />
        <DialogTitle className="text-emerald-700">Payment Recorded</DialogTitle>
        <p className="text-sm text-muted-foreground">Order #{orderId.slice(-6).toUpperCase()}</p>
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 space-y-1">
          <div className="flex justify-between text-sm"><span>Total</span><span className="font-bold">{formatCurrency(total)}</span></div>
          <div className="flex justify-between text-sm"><span>Method</span><span>{METHOD_META[method].label}</span></div>
          {change > 0 && <div className="flex justify-between text-sm text-emerald-700 font-semibold"><span>Change</span><span>{formatCurrency(change)}</span></div>}
        </div>
        <Button size="sm" onClick={onClose}>New Bill</Button>
      </DialogContent>
    </Dialog>
  )
}

// ─── Data Hooks ───────────────────────────────────────────────────────────────

const POS_PREFS_KEY = "quantix_pos_prefs_v1"

function loadPrefs(): { mode: DisplayMode; density: Density } {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(POS_PREFS_KEY) : null
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { mode: "list", density: "compact" }
}

function savePrefs(prefs: { mode: DisplayMode; density: Density }) {
  try { localStorage.setItem(POS_PREFS_KEY, JSON.stringify(prefs)) } catch { /* ignore */ }
}

function useEnabledGateways(businessId: string) {
  return useQuery<GatewayPlugin[]>({
    queryKey: ["pos-gateways", businessId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/payment-plugins?businessId=${businessId}`, { headers: getAuthHeaders() })
      return ((await res.json()).data ?? []) as GatewayPlugin[]
    },
    enabled: !!businessId, staleTime: 60_000,
  })
}

function useProductsInfinite(businessId: string, search: string) {
  return useInfiniteQuery({
    queryKey: ["pos-products-inf", businessId, search],
    queryFn: async ({ pageParam }) => {
      const p = new URLSearchParams({
        businessId,
        page: String(pageParam),
        limit: "60",
        status: "ACTIVE",
      })
      if (search) p.set("search", search)
      const res = await fetch(`/api/core/storefront/products?${p}`, { headers: getAuthHeaders() })
      const json = await res.json()
      const total = json.pagination?.total ?? json.total ?? 0
      // Debug: log resolved context on first page
      if (pageParam === 1) {
        console.log("[POS] businessId:", businessId, "| total products:", total, "| fetched:", (json.data ?? []).length, "| search:", search || "(none)")
      }
      return { items: (json.data ?? []) as Product[], total: total as number, page: pageParam as number }
    },
    initialPageParam: 1,
    getNextPageParam: (last, _, lp) => {
      const pages = Math.ceil(last.total / 60)
      return (lp as number) < pages ? (lp as number) + 1 : undefined
    },
    enabled: !!businessId,
    staleTime: 30_000,
  })
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function POSEnterprise() {
  const { businessId } = useBusinessContext()
  const { currentBusinessType, currentStoreId } = useAdminStore()
  const queryClient = useQueryClient()

  const businessType = currentBusinessType || "GROCERY"
  const plugin = useMemo(() => getPlugin(businessType), [businessType])

  // ── Display Preferences ───────────────────────────────────────────────────
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    const saved = loadPrefs()
    // Auto-detect: service-heavy workflows → service mode; touch → touch
    const isTouchDevice = typeof window !== "undefined" && window.navigator.maxTouchPoints > 2
    if (saved.mode !== "list") return saved.mode
    if (plugin.ServicePanel && ["laundry", "carwash", "home-services"].includes(plugin.id)) return "service"
    if (isTouchDevice) return "touch"
    return saved.mode
  })
  const [density, setDensity] = useState<Density>(() => loadPrefs().density)

  const setMode = useCallback((m: DisplayMode) => { setDisplayMode(m); savePrefs({ mode: m, density }) }, [density])
  const setDens = useCallback((d: Density)     => { setDensity(d);     savePrefs({ mode: displayMode, density: d }) }, [displayMode])

  const dc = DENSITY_CONFIG[density]

  // ── Search ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [focusIdx, setFocusIdx] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const [catalogOpen, setCatalogOpen] = useState(false) // for service mode

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setFocusIdx(0) }, 200)
    return () => clearTimeout(t)
  }, [search])

  // ── Products (infinite) ───────────────────────────────────────────────────
  const { data: productData, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } = useProductsInfinite(businessId, debouncedSearch)
  const allProducts = useMemo(() => productData?.pages.flatMap((p) => p.items) ?? [], [productData])
  const totalCount = productData?.pages[0]?.total ?? 0

  // Auto-upgrade density for large inventories
  useEffect(() => {
    if (totalCount > 10_000 && density === "comfortable") setDens("ultra")
    else if (totalCount > 3_000 && density === "comfortable") setDens("compact")
  }, [totalCount, density, setDens])

  const handleNearEnd = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // ── Cart ──────────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [orderContext, setOrderContext] = useState<Record<string, unknown>>({})

  useEffect(() => { setCart([]); setOrderContext({}); setSearch("") }, [plugin.id])

  const addToCart = useCallback((product: Product, variant: ProductVariant, meta?: Record<string, unknown>) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productId === product.id && i.variantId === variant.id)
      if (idx >= 0) return prev.map((item, i) => i === idx ? { ...item, quantity: item.quantity + 1 } : item)
      return [...prev, { productId: product.id, variantId: variant.id, productName: product.name, variantName: variant.name, quantity: 1, unitPrice: variant.price, mrp: variant.mrp, discountPrice: variant.discountPrice, gstRate: Number(product.metadata?.tax ?? 0), meta: meta as CartItem["meta"] }]
    })
  }, [])

  const addCustomItem = useCallback((item: Omit<CartItem, "quantity">) => setCart((p) => [...p, { ...item, quantity: 1 }]), [])
  const updateQty = useCallback((idx: number, delta: number) => setCart((p) => p.map((item, i) => i === idx ? { ...item, quantity: item.quantity + delta } : item).filter((item) => item.quantity > 0)), [])
  const removeItem = useCallback((idx: number) => setCart((p) => p.filter((_, i) => i !== idx)), [])
  const clearCart = () => { setCart([]); setCustomerPhone(""); setCustomerName(""); setOrderContext({}) }

  // Keyboard navigation (search input)
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusIdx((i) => Math.min(i + 1, allProducts.length - 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocusIdx((i) => Math.max(i - 1, 0)) }
    else if (e.key === "Enter") {
      e.preventDefault()
      const p = allProducts[focusIdx]
      if (p) { const v = p.variants.find((v) => v.isDefault) ?? p.variants[0]; if (v) addToCart(p, v) }
    }
    else if (e.key === "Escape") { setSearch(""); searchRef.current?.blur() }
  }, [allProducts, focusIdx, addToCart])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchRef.current) { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === "F2" && cart.length > 0) { e.preventDefault(); setPaymentOpen(true) }
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [cart.length])

  // Totals
  const cartSummary = calculatePOSCart({
    items: cart.map(i => ({
      productId: i.productId, variantId: i.variantId,
      productName: i.productName, variantName: i.variantName,
      quantity: i.quantity, unitPrice: i.unitPrice, mrp: i.mrp,
      discountPrice: i.discountPrice ?? undefined, gstRate: i.gstRate ?? 0,
    })),
    isInterState: false,
  })
  const subtotal  = cartSummary.subtotal
  const gstAmount = cartSummary.totalTax
  const grandTotal = cartSummary.totalAmount

  // Payment state
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const [lastOrderId, setLastOrderId] = useState("")
  const [lastMethod, setLastMethod] = useState<PaymentMethod>("CASH")
  const [lastChange, setLastChange] = useState(0)
  const [lastTotal, setLastTotal] = useState(0)

  const { data: gatewayData } = useEnabledGateways(businessId)
  const enabledMethods = useMemo<PaymentMethod[]>(() => {
    const methods: Set<PaymentMethod> = new Set(["CASH", "LEDGER", "SPLIT"])
    gatewayData?.forEach((gp) => { const a = gp.businessAccess?.[0]; if (gp.isGloballyEnabled && a?.isAssigned) { const m = GATEWAY_TO_METHOD[gp.gateway]; if (m) methods.add(m) } })
    return Array.from(methods)
  }, [gatewayData])

  const { data: storesData } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["pos-stores", businessId],
    queryFn: async () => {
      const res = await fetch(`/api/core/stores?businessId=${businessId}`, { headers: getAuthHeaders() })
      const json = await res.json()
      return (json.data ?? []) as { id: string; name: string }[]
    },
    enabled: !!businessId,
    staleTime: 60_000,
  })
  const defaultStoreId = (currentStoreId || storesData?.[0]?.id) ?? ""

  const placeOrderMutation = useMutation({
    mutationFn: async ({ method, splits: _splits, tendered: _tendered, ledgerPhone }: { method: PaymentMethod; splits: SplitEntry[]; tendered: number; ledgerPhone?: string }) => {
      if (!defaultStoreId) throw new Error("No store found for this business. Please set up a store first.")
      const res = await fetch(`/api/core/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          businessId,
          storeId: defaultStoreId,
          orderType: "POS",
          orderSource: "pos",
          customerPhone: ledgerPhone ?? customerPhone ?? undefined,
          customerName: customerName ?? undefined,
          paymentMethod: method,
          items: cart.map((i) => ({
            itemType: "PRODUCT",
            itemId: i.productId,
            itemName: i.productName,
            variantName: i.variantName,
            quantity: i.quantity,
            unitPrice: i.discountPrice ?? i.unitPrice,
            mrp: i.mrp,
            gstRate: i.gstRate,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Order failed")
      return json
    },
    onSuccess: (data, vars) => {
      const orderId = data.data?.id ?? data.id ?? "unknown"
      const change = vars.method === "CASH" ? Math.max(0, vars.tendered - grandTotal) : 0
      setLastOrderId(orderId); setLastMethod(vars.method); setLastChange(change); setLastTotal(grandTotal)
      setPaymentOpen(false); setSuccessOpen(true); clearCart()
      queryClient.invalidateQueries({ queryKey: ["pos-products-inf", businessId] })
      showSuccess("Order placed")
    },
    onError: (err: Error) => showError(err.message),
  })

  // Resolve grid columns from density + mode
  const gridColumns = displayMode === "touch" ? dc.touchCols : dc.gridCols

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">

      {/* ── LEFT: Product Browser ─────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 border-r overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 border-b bg-background/95 backdrop-blur shrink-0">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            {plugin.showBarcodeIcon && <Barcode className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />}
            <Search className={cn("absolute top-1/2 -translate-y-1/2 size-3 text-muted-foreground", plugin.showBarcodeIcon ? "left-5" : "left-2")} />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={plugin.searchPlaceholder}
              className={cn("h-7 text-xs", plugin.showBarcodeIcon ? "pl-8" : "pl-6", "pr-6")}
            />
            {search && <button onClick={() => setSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="size-3" /></button>}
          </div>

          {/* Mode toggle */}
          <div className="flex rounded border overflow-hidden shrink-0">
            {([["list", LayoutList, "List"], ["grid", LayoutGrid, "Grid"], ...(plugin.ServicePanel ? [["service", Rows3, "Service"]] : []), ["touch", MonitorSmartphone, "Touch"]] as [DisplayMode, React.ComponentType<{ className?: string }>, string][]).map(([m, Icon, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                title={`${label} mode`}
                className={cn("px-2 py-1 flex items-center gap-1 text-[10px] transition-colors", displayMode === m ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
              >
                <Icon className="size-3" /><span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Density selector */}
          <div className="flex rounded border overflow-hidden shrink-0">
            {(["comfortable", "compact", "ultra"] as Density[]).map((d) => (
              <button
                key={d}
                onClick={() => setDens(d)}
                title={d}
                className={cn("px-1.5 py-1 text-[9px] font-medium transition-colors capitalize", density === d ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
              >
                {d === "comfortable" ? "Comfy" : d === "compact" ? "Compact" : "Ultra"}
              </button>
            ))}
          </div>

          {/* Count */}
          <span className="text-[9px] text-muted-foreground shrink-0 tabular-nums">
            {isFetching && !isFetchingNextPage ? <Loader2 className="size-3 animate-spin inline" /> : totalCount.toLocaleString()} items
          </span>
        </div>

        {/* Plugin badge + workflow info */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 border-b bg-muted/30 shrink-0">
          <Badge variant="outline" className="text-[9px] h-4 px-1">{plugin.label}</Badge>
          {displayMode === "service" && <span className="text-[9px] text-muted-foreground">Service mode — use panel below to add jobs</span>}
          {density === "ultra" && <span className="text-[9px] text-muted-foreground">Ultra compact — {dc.gridCols} cols, fast billing</span>}
          {isFetchingNextPage && <Loader2 className="size-3 animate-spin ml-auto text-muted-foreground" />}
        </div>

        {/* ── Product area (mode-aware) ─────────────────────────────── */}
        {displayMode === "service" ? (
          // SERVICE MODE: service panel prominent, catalog collapsed
          <div className="flex flex-col flex-1 overflow-hidden">
            {plugin.ServicePanel && (
              <div className="overflow-y-auto max-h-[60%] shrink-0">
                <plugin.ServicePanel onAddItem={addCustomItem} orderContext={orderContext} onSetOrderContext={setOrderContext} />
              </div>
            )}
            {/* Collapsible catalog search */}
            <div className="border-t shrink-0">
              <button
                onClick={() => setCatalogOpen(!catalogOpen)}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              >
                <Search className="size-3" />
                <span>Also search product catalog</span>
                <span className="ml-auto">{catalogOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}</span>
              </button>
            </div>
            {catalogOpen && (
              <VirtualList
                products={allProducts}
                plugin={plugin}
                onAdd={addToCart}
                focusIdx={focusIdx}
                rowHeight={32}
                density="compact"
                onNearEnd={handleNearEnd}
              />
            )}
          </div>
        ) : displayMode === "list" ? (
          <VirtualList
            products={allProducts}
            plugin={plugin}
            onAdd={addToCart}
            focusIdx={focusIdx}
            rowHeight={dc.rowHeight}
            density={density}
            onNearEnd={handleNearEnd}
          />
        ) : (
          // grid or touch
          <VirtualGrid
            products={allProducts}
            plugin={plugin}
            onAdd={addToCart}
            columns={gridColumns}
            tileHeight={dc.tileHeight}
            tileGap={dc.tileGap}
            density={density}
            mode={displayMode}
            onNearEnd={handleNearEnd}
          />
        )}

        {/* Workflow service panel (for non-service display modes) */}
        {displayMode !== "service" && plugin.ServicePanel && (
          <div className="shrink-0 overflow-y-auto max-h-[45%] border-t">
            <plugin.ServicePanel onAddItem={addCustomItem} orderContext={orderContext} onSetOrderContext={setOrderContext} />
          </div>
        )}
      </div>

      {/* ── RIGHT: Cart + Billing ─────────────────────────────────────── */}
      <div className={cn("flex flex-col shrink-0 border-l", displayMode === "touch" ? "w-[360px]" : "w-[300px] lg:w-[340px]")}>

        {/* Customer */}
        <div className="flex gap-1.5 px-2 py-1.5 border-b shrink-0">
          <User className="size-3.5 text-muted-foreground shrink-0 mt-2" />
          <div className="flex-1 flex gap-1">
            <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone" className="h-7 text-xs flex-1" />
            <Input value={customerName}  onChange={(e) => setCustomerName(e.target.value)}  placeholder="Name"  className="h-7 text-xs w-20" />
          </div>
        </div>

        {/* Cart scroll area */}
        <div className="flex-1 overflow-y-auto px-2 pt-1">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <ShoppingCart className="size-7 mb-1.5 opacity-30" />
              <p className="text-xs">Cart empty</p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <CartItemRow
                key={`${item.productId}-${item.variantId}-${idx}`}
                item={item}
                compact={cart.length > 6}
                formatMeta={plugin.formatCartMeta}
                onIncrease={() => updateQty(idx, 1)}
                onDecrease={() => updateQty(idx, -1)}
                onRemove={() => removeItem(idx)}
              />
            ))
          )}
        </div>

        {/* Totals */}
        <div className="border-t px-2 py-1.5 space-y-1 shrink-0">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Subtotal ({cart.reduce((s, i) => s + i.quantity, 0)} items)</span>
            <span className="tabular-nums">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>GST</span>
            <span className="tabular-nums">{formatCurrency(gstAmount)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm font-bold">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(grandTotal)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-2 pb-2 space-y-1.5 shrink-0">
          <Button
            className={cn("w-full gap-2 font-semibold", displayMode === "touch" ? "h-12 text-base" : "h-9 text-sm")}
            disabled={cart.length === 0}
            onClick={() => setPaymentOpen(true)}
          >
            <Receipt className="size-4" />
            Collect Payment
            <span className="ml-auto text-[9px] opacity-60 font-normal">F2</span>
          </Button>
          {cart.length > 0 && (
            <Button variant="ghost" className="w-full h-6 text-[10px] text-muted-foreground" onClick={clearCart}>
              <Trash2 className="size-3 mr-1" />Clear Cart
            </Button>
          )}
        </div>

        {/* Keyboard hints (hidden in touch mode) */}
        {displayMode !== "touch" && (
          <div className="px-2 pb-1.5 flex gap-2 text-[9px] text-muted-foreground/50 shrink-0">
            <span><kbd className="font-mono">/</kbd> Search</span>
            <span><kbd className="font-mono">↑↓</kbd> Nav</span>
            <span><kbd className="font-mono">↵</kbd> Add</span>
            <span><kbd className="font-mono">F2</kbd> Pay</span>
          </div>
        )}
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────── */}
      <PaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        total={grandTotal}
        enabledMethods={enabledMethods}
        onConfirm={(m, s, t, lp) => placeOrderMutation.mutate({ method: m, splits: s, tendered: t, ledgerPhone: lp })}
        defaultPhone={customerPhone}
      />
      <SuccessDialog open={successOpen} onClose={() => setSuccessOpen(false)} orderId={lastOrderId} total={lastTotal} method={lastMethod} change={lastChange} />
    </div>
  )
}
