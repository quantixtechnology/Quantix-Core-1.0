"use client"

// Laundry OS shell — enterprise white sidebar. Presentation only: navigation is
// built from a config with per-item role tier + optional route. Items whose
// destination doesn't exist yet render as "Soon" (disabled) rather than being
// hidden, giving the full enterprise nav without inventing backend modules.
// Branding is the logged-in tenant's Business Name (never hardcoded).

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
import {
  LayoutDashboard, ShoppingBag, Users, Store, Factory, BarChart3, Settings,
  Plus, ClipboardCheck, CreditCard, Truck, IndianRupee, Wallet,
  UsersRound, Shirt, Droplets, Wind, Layers, ShieldCheck, Barcode, Repeat,
  Target, CheckSquare, ClipboardList, PieChart, SlidersHorizontal, Gauge,
  PackageCheck, CheckCheck, Sparkles, Package, Shield,
  Megaphone, Ticket, BadgePercent, Gift, Crown, UserPlus, Coins, ShoppingCart,
  WashingMachine, Calculator, Tags, ChevronDown, Bike,
} from "lucide-react"
import { useCrmEnabled } from "@/components/laundry/views/crm/crm-shared"
import { useMarketingEnabled } from "@/components/laundry/views/marketing/marketing-shared"

type NavCfg = {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  page?: LaundryBusinessPage
  comingSoon?: boolean
  minRank: number // 1=operator+, 2=manager+, 3=admin/owner
  perm?: string // RBAC permission key required to see this item (owner sees all)
}

// A nav group. `sectionHeader` renders a top-level separator (e.g. "Processing
// Center") ABOVE the group's own `label` sub-heading (e.g. "Inbound"), giving the
// two-tier hierarchy without changing the sidebar design system.
type NavGroup = { label: string | null; sectionHeader?: string; items: NavCfg[] }

const PROCESSING_ROLES = new Set(["PROCESSING_MANAGER", "PROCESSING_STAFF", "QC_EXECUTIVE"])
const ADMIN_ROLES = new Set(["LAUNDRY_OWNER", "QUANTIX_SUPER_ADMIN", "PLATFORM_ADMIN"])
const MANAGER_ROLES = new Set(["LAUNDRY_STORE_MANAGER"])
const OPERATOR_ROLES = new Set(["STORE_EXECUTIVE", "AUDIT_EXECUTIVE"])

// Unknown role → admin tier so the owner is never locked out; operators/managers
// have known roles and are correctly restricted.
function rankOf(role: string | null): number {
  if (!role) return 3
  if (ADMIN_ROLES.has(role)) return 3
  if (MANAGER_ROLES.has(role)) return 2
  if (OPERATOR_ROLES.has(role)) return 1
  return 3
}

// Optional CRM module — rendered ABOVE the Laundry OS sections, only when the
// tenant's CRM feature is enabled (Super Admin controlled; APIs enforce too).
const CRM_GROUP: { label: string | null; items: NavCfg[] } = {
  label: "CRM",
  items: [
    { key: "crm-dashboard", label: "Dashboard", icon: Gauge, page: "crm-dashboard", minRank: 2, perm: "crm.dashboard.view" },
    { key: "crm-leads", label: "Leads", icon: UsersRound, page: "crm-leads", minRank: 2, perm: "crm.leads.view" },
    { key: "crm-opportunities", label: "Opportunities", icon: Target, page: "crm-opportunities", minRank: 2, perm: "crm.opportunity.view" },
    { key: "crm-activities", label: "Activities", icon: ClipboardList, page: "crm-activities", minRank: 2, perm: "crm.activities.view" },
    { key: "crm-tasks", label: "Tasks", icon: CheckSquare, page: "crm-tasks", minRank: 2, perm: "crm.activities.view" },
    { key: "crm-reports", label: "CRM Reports", icon: PieChart, page: "crm-reports", minRank: 3, perm: "crm.reports.view" },
    { key: "crm-settings", label: "CRM Settings", icon: SlidersHorizontal, page: "crm-settings", minRank: 3, perm: "crm.settings.view" },
  ],
}

// Optional Marketing module — rendered when the tenant's MARKETING feature is
// enabled. Phase 1 ships Dashboard/Discounts/Coupons/Reports; the rest are
// placeholders. Admin/owner only (gated by laundry.settings.view; owner sees all).
const MARKETING_GROUP: { label: string | null; items: NavCfg[] } = {
  label: "Marketing",
  items: [
    { key: "marketing-dashboard", label: "Dashboard", icon: Megaphone, page: "marketing-dashboard", minRank: 3, perm: "laundry.settings.view" },
    { key: "marketing-discounts", label: "Discounts", icon: BadgePercent, page: "marketing-discounts", minRank: 3, perm: "laundry.settings.view" },
    { key: "marketing-coupons", label: "Coupons / Vouchers", icon: Ticket, page: "marketing-coupons", minRank: 3, perm: "laundry.settings.view" },
    { key: "marketing-loyalty", label: "Loyalty Program", icon: Sparkles, page: "marketing-loyalty", minRank: 3, perm: "laundry.settings.view" },
    { key: "marketing-membership", label: "Membership Levels", icon: Crown, page: "marketing-membership", minRank: 3, perm: "laundry.settings.view" },
    { key: "marketing-giftcards", label: "Gift Cards", icon: Gift, page: "marketing-giftcards", minRank: 3, perm: "laundry.settings.view" },
    { key: "marketing-referral", label: "Referral Program", icon: UserPlus, page: "marketing-referral", minRank: 3, perm: "laundry.settings.view" },
    { key: "marketing-credits", label: "Promotional Credits", icon: Coins, page: "marketing-credits", minRank: 3, perm: "laundry.settings.view" },
    { key: "marketing-cart-recovery", label: "Cart Recovery", icon: ShoppingCart, page: "marketing-cart-recovery", minRank: 3, perm: "laundry.settings.view" },
    { key: "marketing-campaigns", label: "Campaigns", icon: Target, page: "marketing-campaigns", minRank: 3, perm: "laundry.settings.view" },
    { key: "marketing-reports", label: "Reports", icon: BarChart3, page: "marketing-reports", minRank: 3, perm: "laundry.settings.view" },
  ],
}

// Sidebar organised to follow the real Laundry Operations Engine flow. This is
// navigation ORDER only — it does not change garment routing. Garments follow
// their own service/processFlow route (see lib/laundry-processing.ts); the
// Processing section is not a mandatory linear sequence.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Laundry OS",
    items: [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, page: "dashboard", minRank: 1, perm: "laundry.dashboard.view" },
      { key: "new-order", label: "New Order", icon: Plus, page: "new-order", minRank: 1, perm: "laundry.orders.create" },
    ],
  },
  {
    label: "Store Operations",
    items: [
      { key: "pickup-scheduler", label: "Pickup Scheduler", icon: Truck, page: "pickup-scheduler", minRank: 2, perm: "laundry.orders.view" },
      { key: "pickup-bags", label: "Assign Bags", icon: Package, page: "pickup-bags", minRank: 1, perm: "store_ops.store_audit.view" },
      { key: "bag-management", label: "Bag Management", icon: Package, page: "bag-management", minRank: 2, perm: "store_ops.store_audit.view" },
      { key: "audit-queue", label: "Store Audit", icon: ClipboardCheck, page: "audit-queue", minRank: 1, perm: "store_ops.store_audit.view" },
      { key: "payment-queue", label: "Payment Collection", icon: CreditCard, page: "payment-queue", minRank: 2, perm: "store_ops.payment_collection.view" },
      { key: "packing-queue", label: "Packing & QR", icon: Barcode, page: "packing-queue", minRank: 1, perm: "store_ops.packing_qr.view" },
      { key: "dispatch-queue", label: "Transit to Processing", icon: Truck, page: "dispatch-queue", minRank: 2, perm: "store_ops.transit.view" },
      { key: "store-receive-queue", label: "Store Receive", icon: PackageCheck, page: "store-receive-queue", minRank: 2, perm: "store_ops.store_receive.view" },
      { key: "ready-delivery-queue", label: "Ready for Delivery", icon: CheckCheck, page: "ready-delivery-queue", minRank: 2, perm: "store_ops.ready_for_delivery.view" },
    ],
  },
  {
    label: "Orders & Customers",
    items: [
      { key: "orders", label: "Orders", icon: ShoppingBag, page: "orders", minRank: 2, perm: "laundry.orders.view" },
      { key: "customers", label: "Customers", icon: Users, page: "customers", minRank: 2, perm: "laundry.customers.view" },
    ],
  },
  {
    // Master data is kept SEPARATE from pricing. Each master (Services,
    // Categories, Garments) is its own screen; the Pricing Matrix manages only
    // prices. Subscription Plans / Charges & Rules / Pricing Simulator are the
    // pricing sub-tools that used to live as tabs here.
    label: "Services & Pricing",
    items: [
      { key: "services", label: "Services", icon: WashingMachine, page: "services", minRank: 3, perm: "laundry.pricing.view" },
      { key: "categories", label: "Categories", icon: Tags, page: "categories", minRank: 3, perm: "laundry.pricing.view" },
      { key: "garments", label: "Garments", icon: Shirt, page: "garments", minRank: 3, perm: "laundry.pricing.view" },
      { key: "pricing", label: "Pricing Matrix", icon: IndianRupee, page: "pricing", minRank: 3, perm: "laundry.pricing.view" },
      { key: "subscription-plans", label: "Subscription Plans", icon: Repeat, page: "subscription-plans", minRank: 3, perm: "laundry.pricing.view" },
      { key: "charges-rules", label: "Charges & Rules", icon: SlidersHorizontal, page: "charges-rules", minRank: 3, perm: "laundry.pricing.view" },
      { key: "pricing-simulator", label: "Pricing Simulator", icon: Calculator, page: "pricing-simulator", minRank: 3, perm: "laundry.pricing.view" },
    ],
  },
  {
    label: "Business Management",
    items: [
      { key: "stores", label: "Stores", icon: Store, page: "stores", minRank: 3, perm: "laundry.stores.view" },
      { key: "staff", label: "Staff", icon: UsersRound, page: "staff", minRank: 3, perm: "laundry.staff.view" },
      { key: "delivery-executives", label: "Delivery Executives", icon: Bike, page: "delivery-executives", minRank: 3, perm: "laundry.staff.view" },
      { key: "roles", label: "Roles & Permissions", icon: Shield, page: "roles", minRank: 3, perm: "laundry.staff.assign_role" },
      { key: "subscriptions", label: "Subscriptions", icon: Repeat, page: "subscriptions", minRank: 3, perm: "laundry.subscriptions.view" },
      { key: "reports", label: "Reports", icon: BarChart3, page: "reports", minRank: 3, perm: "laundry.reports.view" },
      { key: "payments", label: "Payments", icon: Wallet, comingSoon: true, minRank: 3 },
      // "Invoices" list menu intentionally removed — invoices are managed on the
      // Order Detail screen (single operational place). Re-add only if a genuine
      // standalone invoice list is needed later.
      { key: "settings", label: "Settings", icon: Settings, page: "settings", minRank: 3, perm: "laundry.settings.view" },
    ],
  },
  {
    sectionHeader: "Processing Center",
    label: "Inbound",
    items: [
      { key: "processing-centers", label: "Console & Receive", icon: Factory, page: "processing-centers", minRank: 3, perm: "processing.console_receive.view" },
      { key: "audit-barcode", label: "Barcode Generation", icon: Barcode, page: "audit-barcode", minRank: 3, perm: "processing.audit_barcode.view" },
    ],
  },
  {
    label: "Processing",
    items: [
      { key: "ws-wash", label: "Washing", icon: Droplets, page: "ws-wash", minRank: 3, perm: "processing.washing.view" },
      { key: "ws-dry", label: "Drying", icon: Wind, page: "ws-dry", minRank: 3, perm: "processing.drying.view" },
      { key: "ws-dryclean", label: "Dry Cleaning", icon: Sparkles, page: "ws-dryclean", minRank: 3, perm: "processing.dry_cleaning.view" },
      { key: "ws-iron", label: "Ironing", icon: Shirt, page: "ws-iron", minRank: 3, perm: "processing.ironing.view" },
      { key: "ws-fold", label: "Folding", icon: Layers, page: "ws-fold", minRank: 3, perm: "processing.folding.view" },
    ],
  },
  {
    label: "Outbound",
    items: [
      { key: "ws-qc", label: "Quality Check", icon: ShieldCheck, page: "ws-qc", minRank: 3, perm: "processing.quality_check.view" },
      // Garment-level packing completion. Packet/order-level transit back to the
      // store is a separate action in Processing Center → Dispatch to Store.
      { key: "ws-pack", label: "Packing", icon: Package, page: "ws-pack", minRank: 3, perm: "processing.packing.view" },
    ],
  },
]

// Processing-center roles get a focused view — same Inbound/Processing/Outbound
// grouping, all items at operator tier.
const PROCESSING_GROUPS: NavGroup[] = [
  { label: null, items: [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, page: "dashboard", minRank: 1 },
  ] },
  { sectionHeader: "Processing Center", label: "Inbound", items: [
    { key: "processing-centers", label: "Console & Receive", icon: Factory, page: "processing-centers", minRank: 1 },
    { key: "audit-barcode", label: "Barcode Generation", icon: Barcode, page: "audit-barcode", minRank: 1 },
  ] },
  { label: "Processing", items: [
    { key: "ws-wash", label: "Washing", icon: Droplets, page: "ws-wash", minRank: 1 },
    { key: "ws-dry", label: "Drying", icon: Wind, page: "ws-dry", minRank: 1 },
    { key: "ws-dryclean", label: "Dry Cleaning", icon: Sparkles, page: "ws-dryclean", minRank: 1 },
    { key: "ws-iron", label: "Ironing", icon: Shirt, page: "ws-iron", minRank: 1 },
    { key: "ws-fold", label: "Folding", icon: Layers, page: "ws-fold", minRank: 1 },
  ] },
  { label: "Outbound", items: [
    { key: "ws-qc", label: "Quality Check", icon: ShieldCheck, page: "ws-qc", minRank: 1 },
    { key: "ws-pack", label: "Packing", icon: Package, page: "ws-pack", minRank: 1 },
  ] },
]

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

// ── Session-scoped nav UX state (survives page switches; resets on tab close) ──
// Collapsed group keys + last sidebar scroll position. Kept in sessionStorage so
// the sidebar remembers exactly where the user was, feeling like a desktop ERP.
const COLLAPSE_KEY = "quantix_nav_collapsed"
const SCROLL_KEY = "quantix_nav_scroll"
function loadCollapsed(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try { return new Set(JSON.parse(sessionStorage.getItem(COLLAPSE_KEY) || "[]") as string[]) } catch { return new Set() }
}
function persistCollapsed(s: Set<string>) {
  try { sessionStorage.setItem(COLLAPSE_KEY, JSON.stringify([...s])) } catch { /* private mode */ }
}
const groupKey = (g: { sectionHeader?: string; label: string | null }) => `${g.sectionHeader ?? ""}::${g.label ?? ""}`

export function LaundrySidebar({ mobileOpen = false, onMobileOpenChange }: LaundrySidebarProps) {
  const { laundryPage, setLaundryPage } = useAdminStore()
  const { user, currentRole, currentBusinessId } = useAuthStore()
  const { isMobile } = useResponsive()

  // §3/§4 nav UX: collapsible groups + remembered scroll position.
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed)
  const toggleGroup = (key: string) => setCollapsed((s) => {
    const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); persistCollapsed(n); return n
  })
  const scrollRef = useRef<HTMLDivElement>(null)
  const onNavScroll = (e: React.UIEvent<HTMLDivElement>) => {
    try { sessionStorage.setItem(SCROLL_KEY, String(e.currentTarget.scrollTop)) } catch { /* noop */ }
  }
  // Restore the saved scroll once the list is mounted so switching pages never
  // bounces the sidebar back to the top.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const saved = Number(sessionStorage.getItem(SCROLL_KEY) || "0")
    if (saved > 0) el.scrollTop = saved
  }, [])

  // RBAC: the user's effective permissions drive left-menu security. While it
  // loads (null) only rank-based visibility applies; once resolved, items whose
  // `perm` the user lacks are hidden (owner sees everything).
  const [rbac, setRbac] = useState<{ isOwner: boolean; perms: Set<string> } | null>(null)
  useEffect(() => {
    if (!currentBusinessId) return
    let cancel = false
    fetch(`/api/laundry/rbac/me?businessId=${currentBusinessId}`).then((r) => r.json())
      .then((j) => { if (!cancel && j.success) setRbac({ isOwner: !!j.data.isOwner, perms: new Set<string>(j.data.permissions) }) })
      .catch(() => {})
    return () => { cancel = true }
  }, [currentBusinessId])
  const permAllows = (i: NavCfg) => rbac === null || rbac.isOwner || !i.perm || rbac.perms.has(i.perm)

  const isProcessing = currentRole ? PROCESSING_ROLES.has(currentRole) : false
  const rank = rankOf(currentRole)
  const brand = user?.businessName || "Laundry OS"
  const brandInitials = brand.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  const crmState = useCrmEnabled() // null while loading
  const crmEnabled = crmState === true
  const marketingEnabled = useMarketingEnabled() === true

  // CRM section first, then the Laundry OS sections (first laundry group gets
  // the "Laundry OS" header so the two products read as separate sections).
  // When CRM is disabled nothing changes — no empty headings or spacing.
  const baseGroups: NavGroup[] = isProcessing
    ? PROCESSING_GROUPS
    : [
        ...(crmEnabled ? [CRM_GROUP] : []),
        ...(marketingEnabled ? [MARKETING_GROUP] : []),
        ...NAV_GROUPS,
      ]

  const groups = baseGroups
    .map((g) => ({ label: g.label, sectionHeader: g.sectionHeader, items: g.items.filter((i) => rank >= i.minRank && permAllows(i)) }))
    .filter((g) => g.items.length > 0) // no empty menu groups

  // Pages reached programmatically (drill-downs), not from a nav item — these
  // must not be bounced back to the dashboard by the guard below.
  const PROGRAMMATIC_PAGES = new Set<LaundryBusinessPage>(["order-detail", "audit-barcode"])
  const validPages = new Set([
    ...groups.flatMap((g) => g.items).filter((i) => i.page && !i.comingSoon).map((i) => i.page),
    ...PROGRAMMATIC_PAGES,
  ])

  // Redirect to dashboard if the current page isn't visible for this role.
  // Waits for the CRM entitlement to resolve so a refresh on a CRM page
  // doesn't bounce to the dashboard while the check is in flight.
  useEffect(() => {
    if (crmState === null) return
    if (!validPages.has(laundryPage)) setLaundryPage("dashboard")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laundryPage, currentRole, crmState])

  const navigate = (page?: LaundryBusinessPage) => {
    if (!page) return
    setLaundryPage(page)
    if (isMobile && onMobileOpenChange) onMobileOpenChange(false)
  }

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

  // Rendered inline (NOT as <NavList/>) so the scroll container is never
  // remounted on navigation — that remount was what reset the scroll to the top.
  const renderNav = (collapsedTooltips = true) => (
    <>
      {groups.map((section, gi) => {
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
          <ScrollArea className="flex-1 py-3" style={WHITE_THEME}>{renderNav(false)}</ScrollArea>
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
