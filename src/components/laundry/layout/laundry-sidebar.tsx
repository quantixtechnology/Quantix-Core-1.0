"use client"

import {
  Sidebar, SidebarContent, SidebarFooter,
  SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { useEffect, useRef, useState } from "react"
import { useAdminStore, type LaundryBusinessPage } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { useResponsive } from "@/hooks/use-responsive"
import { useRuntimeAuth } from "@/hooks/use-runtime-auth"
import {
  LayoutDashboard, ShoppingBag, Users, Store, Factory, BarChart3, Settings,
  Plus, ClipboardCheck, CreditCard, Truck, IndianRupee, Wallet,
  UsersRound, Shirt, Droplets, Wind, Layers, ShieldCheck, Barcode, Repeat,
  Target, CheckSquare, ClipboardList, PieChart, SlidersHorizontal, Gauge,
  PackageCheck, CheckCheck, Sparkles, Package, Shield,
  Megaphone, Ticket, BadgePercent, Gift, Crown, UserPlus, Coins, ShoppingCart,
  WashingMachine, Calculator, Tags, ChevronDown, Bike, Smartphone, Search,
  type LucideIcon,
} from "lucide-react"
import { useCrmEnabled } from "@/components/laundry/views/crm/crm-shared"
import { useMarketingEnabled } from "@/components/laundry/views/marketing/marketing-shared"

const VIEW_LEVEL = 1

type NavCfg = {
  key: string
  label: string
  icon: LucideIcon
  page?: LaundryBusinessPage
  comingSoon?: boolean
  perm?: string
}

type NavGroup = { label: string | null; sectionHeader?: string; items: NavCfg[] }

// ── Screen key → Icon mapping (client concern, not registry metadata) ─────
const SCREEN_ICONS: Record<string, LucideIcon> = {
  "laundry.dashboard": LayoutDashboard,
  "laundry.orders": ShoppingBag,
  "laundry.customers": Users,
  "laundry.subscriptions": Repeat,
  "laundry.pricing": IndianRupee,
  "laundry.stores": Store,
  "laundry.staff": UsersRound,
  "laundry.bags": Package,
  "laundry.reports": BarChart3,
  "laundry.settings": Settings,
  "crm.dashboard": Gauge,
  "crm.leads": UsersRound,
  "crm.opportunity": Target,
  "crm.activities": ClipboardList,
  "crm.pipeline": CheckSquare,
  "crm.templates": SlidersHorizontal,
  "crm.reports": PieChart,
  "crm.settings": SlidersHorizontal,
  "processing.console_receive": Factory,
  "processing.audit_barcode": Barcode,
  "processing.washing": Droplets,
  "processing.drying": Wind,
  "processing.dry_cleaning": Sparkles,
  "processing.ironing": Shirt,
  "processing.folding": Layers,
  "processing.quality_check": ShieldCheck,
  "processing.packing": Package,
  "store_ops.store_audit": ClipboardCheck,
  "store_ops.payment_collection": CreditCard,
  "store_ops.packing_qr": Barcode,
  "store_ops.transit": Truck,
  "store_ops.store_receive": PackageCheck,
  "store_ops.ready_for_delivery": CheckCheck,
  "customer_app.customers": Users,
  "customer_app.invitation": UserPlus,
  "customer_app.subscription": Repeat,
  "customer_app.orders": ShoppingBag,
}

// ── Screen key → LaundryBusinessPage mapping ──────────────────────────────
const SCREEN_PAGES: Record<string, LaundryBusinessPage | undefined> = {
  "laundry.dashboard": "dashboard",
  "laundry.orders": "orders",
  "laundry.customers": "customers",
  "laundry.subscriptions": "subscriptions",
  "laundry.pricing": "pricing",
  "laundry.stores": "stores",
  "laundry.staff": "staff",
  "laundry.bags": "bag-management",
  "laundry.reports": "reports",
  "laundry.settings": "settings",
  "crm.dashboard": "crm-dashboard",
  "crm.leads": "crm-leads",
  "crm.opportunity": "crm-opportunities",
  "crm.activities": "crm-activities",
  "crm.pipeline": "crm-tasks",
  "crm.templates": "crm-settings",
  "crm.reports": "crm-reports",
  "crm.settings": "crm-settings",
  "processing.console_receive": "processing-centers",
  "processing.audit_barcode": "audit-barcode",
  "processing.washing": "ws-wash",
  "processing.drying": "ws-dry",
  "processing.dry_cleaning": "ws-dryclean",
  "processing.ironing": "ws-iron",
  "processing.folding": "ws-fold",
  "processing.quality_check": "ws-qc",
  "processing.packing": "ws-pack",
  "store_ops.store_audit": "audit-queue",
  "store_ops.payment_collection": "payment-queue",
  "store_ops.packing_qr": "packing-queue",
  "store_ops.transit": "dispatch-queue",
  "store_ops.store_receive": "store-receive-queue",
  "store_ops.ready_for_delivery": "ready-delivery-queue",
}

// ── Extra nav items that share a parent screen's permission ────────────────
const EXTRA_ITEMS: NavCfg[] = [
  { key: "new-order", label: "New Order", icon: Plus, page: "new-order", perm: "laundry.orders" },
  { key: "garment-lookup", label: "Garment Lookup", icon: Search, page: "garment-lookup", perm: "laundry.orders" },
  { key: "dispatch-center", label: "Dispatch Center", icon: Truck, page: "dispatch-center", perm: "laundry.orders" },
  { key: "pickup-scheduler", label: "Dispatch Center", icon: Truck, page: "dispatch-center", perm: "laundry.orders" },
  { key: "delivery-assignments", label: "Dispatch Center", icon: Truck, page: "dispatch-center", perm: "laundry.orders" },
  { key: "pickup-bags", label: "Assign Bags", icon: Package, page: "pickup-bags", perm: "store_ops.store_audit" },
  { key: "bag-management", label: "Bag Management", icon: Package, page: "bag-management", perm: "store_ops.store_audit" },
  { key: "delivery-executives", label: "Delivery Executives", icon: Bike, page: "delivery-executives", perm: "laundry.staff" },
  { key: "mobile-apps", label: "Mobile Apps", icon: Smartphone, page: "mobile-apps", perm: "laundry.staff" },
  { key: "roles", label: "Roles & Permissions", icon: Shield, page: "roles", perm: "laundry.staff" },
  { key: "payments", label: "Payments", icon: Wallet, comingSoon: true },
]

// ── Catalog type matching the registry ────────────────────────────────────
interface CatalogScreen {
  key: string
  label: string
}
interface CatalogModule {
  key: string
  label: string
  screens: CatalogScreen[]
}

type CatalogSnapshot = CatalogModule[]

const catalogCache: { data: CatalogSnapshot | null; promise: Promise<CatalogSnapshot> | null } = {
  data: null,
  promise: null,
}

function fetchCatalog(): Promise<CatalogSnapshot> {
  if (catalogCache.data) return Promise.resolve(catalogCache.data)
  if (catalogCache.promise) return catalogCache.promise
  const p = fetch("/api/laundry/rbac/catalog")
    .then((r) => r.json())
    .then((j) => {
      const modules = (j.data?.modules || []) as CatalogSnapshot
      catalogCache.data = modules
      return modules
    })
  catalogCache.promise = p
  return p
}

const WHITE_THEME = {
  "--sidebar": "#FFFFFF",
  "--sidebar-foreground": "#475569",
  "--sidebar-accent": "#EFF6FF",
  "--sidebar-accent-foreground": "#1D4ED8",
  "--sidebar-border": "#E2E8F0",
  "--sidebar-primary": "#2563EB",
  "--sidebar-primary-foreground": "#FFFFFF",
  "--sidebar-ring": "#2563EB",
} as React.CSSProperties

interface LaundrySidebarProps {
  mobileOpen?: boolean
  onMobileOpenChange?: (open: boolean) => void
}

const COLLAPSE_KEY = "quantix_nav_collapsed"
const SCROLL_KEY = "quantix_nav_scroll"
function loadCollapsed(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try { return new Set(JSON.parse(sessionStorage.getItem(COLLAPSE_KEY) || "[]") as string[]) } catch { return new Set() }
}
function persistCollapsed(s: Set<string>) {
  try { sessionStorage.setItem(COLLAPSE_KEY, JSON.stringify([...s])) } catch {}
}
const groupKey = (g: { sectionHeader?: string; label: string | null }) => `${g.sectionHeader ?? ""}::${g.label ?? ""}`

export function LaundrySidebar({ mobileOpen = false, onMobileOpenChange }: LaundrySidebarProps) {
  const { laundryPage, setLaundryPage } = useAdminStore()
  const { user } = useAuthStore()
  const { isMobile } = useResponsive()
  const { screenLevels, isOwner, isLoaded } = useRuntimeAuth()

  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed)
  const toggleGroup = (key: string) => setCollapsed((s) => {
    const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); persistCollapsed(n); return n
  })
  const scrollRef = useRef<HTMLDivElement>(null)
  const onNavScroll = (e: React.UIEvent<HTMLDivElement>) => {
    try { sessionStorage.setItem(SCROLL_KEY, String(e.currentTarget.scrollTop)) } catch {}
  }
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const saved = Number(sessionStorage.getItem(SCROLL_KEY) || "0")
    if (saved > 0) el.scrollTop = saved
  }, [])

  const [catalog, setCatalog] = useState<CatalogSnapshot | null>(catalogCache.data)
  useEffect(() => {
    if (catalogCache.data) { setCatalog(catalogCache.data); return }
    fetchCatalog().then(setCatalog)
  }, [])

  const permAllows = (i: NavCfg) => !isLoaded || isOwner || !i.perm || (screenLevels[i.perm] ?? 0) >= VIEW_LEVEL

  const crmState = useCrmEnabled()
  const crmEnabled = crmState === true
  const marketingEnabled = useMarketingEnabled() === true

  // ── Build nav groups from catalog + extra items ────────────────────────────
  const groups: NavGroup[] = []

  if (catalog) {
    for (const mod of catalog) {
      // Skip CRM/Marketing modules — handled separately as feature gates
      if (mod.key === "crm" && !crmEnabled) continue
      if (mod.key === "customer_app") continue

      const items: NavCfg[] = []
      for (const screen of mod.screens) {
        const screenKey = `${mod.key}.${screen.key}`
        const icon = SCREEN_ICONS[screenKey]
        const page = SCREEN_PAGES[screenKey]
        if (!icon) continue // skip screens without frontend nav
        items.push({
          key: screenKey,
          label: screen.label,
          icon,
          page,
          perm: screenKey,
        })
      }

      // Append extra items whose perm matches this module
      for (const extra of EXTRA_ITEMS) {
        const extraPermModule = extra.perm?.split(".")[0]
        if (extraPermModule === mod.key) {
          items.push(extra)
        }
      }

      if (items.length > 0) {
        groups.push({ label: mod.label, items })
      }
    }
  }

  // Filter by permissions
  const filteredGroups = groups
    .map((g) => ({ ...g, items: g.items.filter(permAllows) }))
    .filter((g) => g.items.length > 0)

  const PROGRAMMATIC_PAGES = new Set<LaundryBusinessPage>(["order-detail", "audit-barcode", "garment-lookup"])
  const validPages = new Set([
    ...filteredGroups.flatMap((g) => g.items).filter((i) => i.page && !i.comingSoon).map((i) => i.page),
    ...PROGRAMMATIC_PAGES,
  ])

  useEffect(() => {
    if (crmState === null) return
    if (!validPages.has(laundryPage)) setLaundryPage("dashboard")
  }, [laundryPage, crmState])

  const navigate = (page?: LaundryBusinessPage) => {
    if (!page) return
    setLaundryPage(page)
    if (isMobile && onMobileOpenChange) onMobileOpenChange(false)
  }

  const brand = user?.businessName || "Laundry OS"
  const brandInitials = brand.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()

  const Brand = (
    <div className="flex items-center gap-2.5 px-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shrink-0 shadow-sm">
        <Shirt className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[15px] font-bold text-slate-800">{brand}</p>
        <p className="text-[10px] font-semibold tracking-[0.15em] text-blue-500 uppercase">Laundry</p>
      </div>
    </div>
  )

  const renderNav = (collapsedTooltips = true) => (
    <>
      {filteredGroups.map((section, gi) => {
        const gk = groupKey(section)
        const canCollapse = !!section.label
        const isCollapsed = canCollapse && collapsed.has(gk)
        return (
        <div key={`${gk}-${gi}`}>
          {section.sectionHeader && (
            <div className="px-3 pt-2.5 pb-0.5 mt-2 border-t border-slate-100">
              <p className="text-[10px] font-extrabold tracking-widest uppercase text-slate-500">{section.sectionHeader}</p>
            </div>
          )}
          <SidebarGroup className="px-2 py-0">
          {section.label && (
            <SidebarGroupLabel asChild className="text-[10px] font-bold tracking-widest uppercase px-2 mb-1 mt-2 h-auto py-1 text-slate-400">
              <button type="button" onClick={() => toggleGroup(gk)} className="w-full flex items-center justify-between gap-2 hover:text-slate-600 transition-colors">
                <span>{section.label}</span>
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
              </button>
            </SidebarGroupLabel>
          )}
          {!isCollapsed && (
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {section.items.map((item) => {
                const isActive = item.page === laundryPage
                if (item.comingSoon) {
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton disabled tooltip={collapsedTooltips ? `${item.label} (Coming Soon)` : undefined}
                        className="font-medium text-[13px] h-9 !text-slate-400 cursor-not-allowed opacity-70">
                        <item.icon className="size-[18px] shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-semibold border-slate-200 text-slate-400 bg-slate-50">Soon</Badge>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                }
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton isActive={isActive} onClick={() => navigate(item.page)}
                      tooltip={collapsedTooltips ? item.label : undefined}
                      className={`font-medium text-[13px] h-9 ${isActive ? "!bg-blue-600 !text-white shadow-sm" : "!text-slate-600 hover:!bg-blue-50 hover:!text-blue-700"}`}>
                      <item.icon className="size-[18px] shrink-0" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
          )}
        </SidebarGroup>
        </div>
      )})}
    </>
  )

  const Footer = (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 text-xs font-bold shrink-0">{brandInitials}</div>
        <div className="min-w-0"><p className="truncate text-[13px] font-semibold text-slate-700">{brand}</p><p className="text-[11px] text-slate-400">Workspace</p></div>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-[280px] p-0 flex flex-col bg-white">
          <SheetHeader className="p-0 shrink-0 border-b border-slate-200">
            <SheetTitle className="sr-only">Laundry Workspace</SheetTitle>
            <SheetDescription className="sr-only">Navigation</SheetDescription>
            <div className="flex items-center h-16 px-4">{Brand}</div>
          </SheetHeader>
          <ScrollArea className="flex-1 min-h-0 py-3" style={WHITE_THEME}>{renderNav(false)}</ScrollArea>
          <div className="p-3 shrink-0 border-t border-slate-200">{Footer}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-200" style={WHITE_THEME}>
      <SidebarHeader className="p-0 shrink-0 border-b border-slate-200">
        <div className="flex items-center h-16 px-2">{Brand}</div>
      </SidebarHeader>
      <SidebarContent ref={scrollRef} onScroll={onNavScroll} className="py-3 gap-0">
        {renderNav()}
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-slate-200">{Footer}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
