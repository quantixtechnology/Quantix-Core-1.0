"use client"

import { useState, useEffect } from "react"
import {
  LayoutDashboard, ShoppingBag, Package, Monitor, Users, BarChart3,
  Settings, ShoppingCart, Warehouse, Megaphone, UserCog,
  Receipt, Heart, MapPin, Upload, Eye, Truck, Calendar, CreditCard,
  Zap, Droplets, Car, Beef, Wrench, Sparkles, Sofa, Store,
  Tag, Palette, Smartphone, Globe, Shield,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  useAdminStore,
  BUSINESS_TYPE_WORKFLOWS,
  BUSINESS_TYPE_UI,
  type BusinessPage,
  type WorkflowType,
} from "@/stores/admin-store"
import { useResponsive } from "@/hooks/use-responsive"

// ── Workflow → nav items (derived from business type, owned by platform admin) ──
const workflowNavMap: Record<WorkflowType, { key: BusinessPage; label: string; icon: React.ComponentType<{ className?: string }> }[]> = {
  ECOMMERCE: [
    { key: "orders",    label: "Orders",    icon: ShoppingBag },
    { key: "products",  label: "Products",  icon: Package },
    { key: "inventory", label: "Inventory", icon: Warehouse },
  ],
  PICKUP_DELIVERY: [
    { key: "orders",         label: "Pickup Orders",  icon: Truck },
    { key: "delivery-zones", label: "Delivery Zones", icon: MapPin },
  ],
  APPOINTMENT: [
    { key: "orders", label: "Appointments", icon: Calendar },
    { key: "staff",  label: "Technicians",  icon: UserCog },
  ],
  SUBSCRIPTION: [
    { key: "customers", label: "Customers",          icon: Users },
    { key: "offers",    label: "Subscription Plans", icon: CreditCard },
  ],
  POST_SERVICE_BILLING: [
    { key: "orders",   label: "Service Orders", icon: Receipt },
    { key: "reports",  label: "Billing Reports", icon: BarChart3 },
  ],
}

// ── Core management items — always visible ────────────────────────────────────
const coreManagementItems: { key: BusinessPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "stores",              label: "Stores",               icon: Store },
  { key: "customers",           label: "Customers",            icon: Users },
  { key: "categories",          label: "Categories",           icon: Tag },
  { key: "product-import",      label: "Product Import",       icon: Upload },
  { key: "customer-import",      label: "Bulk Customer Upload", icon: Users },
  { key: "tax",                 label: "Tax & GST",            icon: Receipt },
  { key: "gateway-config",      label: "Payment Gateways",     icon: CreditCard },
  { key: "reports",             label: "Reports",              icon: BarChart3 },
  { key: "settings",            label: "Settings",             icon: Settings },
]

// ── Flag-gated items — hidden when flag is disabled ───────────────────────────
const flagGatedItems: { key: BusinessPage; label: string; icon: React.ComponentType<{ className?: string }>; flag: string }[] = [
  { key: "pos",       label: "POS Billing",     icon: Monitor,  flag: "pos_enabled" },
  { key: "marketing", label: "Marketing",        icon: Megaphone, flag: "promo_codes_enabled" },
  { key: "loyalty",   label: "Loyalty Program",  icon: Heart,    flag: "loyalty_enabled" },
]

// ── Storefront — shown only when online_orders is enabled ─────────────────────
const storefrontItem: { key: BusinessPage; label: string; icon: React.ComponentType<{ className?: string }> } = {
  key: "storefront", label: "Storefront Preview", icon: Eye,
}

// ── Platform section — always visible, read-only for business owner ───────────
const platformNavItems: { key: BusinessPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "branding",            label: "Branding",       icon: Palette },
  { key: "feature-flags",       label: "Feature Flags",  icon: Zap },
  { key: "subscription-view",   label: "Subscription",   icon: CreditCard },
  { key: "customer-app",        label: "Customer App",   icon: Smartphone },
  { key: "delivery-app",        label: "Delivery App",   icon: Truck },
  { key: "admin-app",           label: "Admin App",      icon: Globe },
  { key: "onboarding-progress", label: "Onboarding",     icon: LayoutDashboard },
]

// Plan & Workflows info item (read-only for business owner, managed by platform)
const planWorkflowsItem: { key: BusinessPage; label: string; icon: React.ComponentType<{ className?: string }> } = {
  key: "workflow-config", label: "Plan & Workflows", icon: Shield,
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingCart, ShoppingBag, Zap, Droplets, Car, Truck, Calendar, CreditCard,
  Receipt, Beef, Wrench, Sparkles, Sofa, MapPin,
}

function NavSection({
  title,
  items,
  activePage,
  onNavigate,
  compact = false,
  badge,
}: {
  title?: string
  items: { key: BusinessPage; label: string; icon: React.ComponentType<{ className?: string }> }[]
  activePage: BusinessPage
  onNavigate: (page: BusinessPage) => void
  compact?: boolean
  badge?: string
}) {
  return (
    <div className="mb-1">
      {title && (
        <div className="flex items-center gap-2 px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          {badge && (
            <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5">
              {badge}
            </Badge>
          )}
        </div>
      )}
      <div className="flex flex-col gap-0.5 px-2">
        {items.map((item) => {
          const isActive = activePage === item.key
          return (
            <button
              key={item.key + item.label}
              onClick={() => onNavigate(item.key)}
              className={`flex items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                compact ? "py-2" : "py-1.5"
              } ${
                isActive
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <item.icon className={`shrink-0 ${compact ? "size-4" : "size-3.5"}`} />
              <span className="text-xs">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface BusinessSidebarProps {
  mobileOpen?: boolean
  onMobileOpenChange?: (open: boolean) => void
}

export function BusinessSidebar({ mobileOpen = false, onMobileOpenChange }: BusinessSidebarProps) {
  const { businessPage, setBusinessPage, currentBusinessName, currentBusinessType, currentBusinessId } = useAdminStore()
  const { isMobile } = useResponsive()

  const typeUI = BUSINESS_TYPE_UI[currentBusinessType] || BUSINESS_TYPE_UI["GROCERY"]
  const activeWorkflows = BUSINESS_TYPE_WORKFLOWS[currentBusinessType] || ["ECOMMERCE"]

  // Feature flags — fetched to control which management items are visible
  const [enabledFlags, setEnabledFlags] = useState<Set<string>>(new Set(["pos_enabled", "promo_codes_enabled", "loyalty_enabled", "online_orders_enabled"]))

  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/core/businesses/${currentBusinessId}/feature-flags`, {
      headers: { "x-business-id": currentBusinessId },
    })
      .then(r => r.json())
      .then(json => {
        if (!json.success) return
        const flags = new Set<string>()
        for (const f of (json.data ?? [])) {
          if (f.enabled) flags.add(f.key)
        }
        setEnabledFlags(flags)
      })
      .catch(() => {/* non-fatal — keep defaults */})
  }, [currentBusinessId])

  // Build workflow-specific nav items (dedup by page key)
  const workflowNavItems: { key: BusinessPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = []
  const seen = new Set<string>()
  activeWorkflows.forEach((wf) => {
    workflowNavMap[wf as WorkflowType]?.forEach((item) => {
      if (!seen.has(item.key)) {
        seen.add(item.key)
        workflowNavItems.push(item)
      }
    })
  })

  // Management = core items + flag-gated items (only those whose flag is enabled)
  const managementNavItems = [
    ...coreManagementItems,
    ...flagGatedItems.filter(item => enabledFlags.has(item.flag)),
  ].sort((a, b) => {
    // preserve deterministic order: core first, then flag-gated in original order
    const coreOrder = coreManagementItems.findIndex(c => c.key === a.key)
    const bCoreOrder = coreManagementItems.findIndex(c => c.key === b.key)
    if (coreOrder !== -1 && bCoreOrder !== -1) return coreOrder - bCoreOrder
    if (coreOrder !== -1) return -1
    if (bCoreOrder !== -1) return 1
    return 0
  })

  // Storefront — only if online_orders_enabled
  const showStorefront = enabledFlags.has("online_orders_enabled")

  const handleNavigate = (page: BusinessPage) => {
    setBusinessPage(page)
    if (isMobile && onMobileOpenChange) onMobileOpenChange(false)
  }

  const displayName = currentBusinessName || typeUI.label || "Business"
  const businessInitials = displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
  const BusinessIcon = iconMap[typeUI.icon] || ShoppingCart

  // Mobile: Sheet-based sidebar
  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="border-b p-4">
            <div className="flex items-center gap-3">
              <div className={`flex size-10 items-center justify-center rounded-lg ${typeUI.color}`}>
                <BusinessIcon className="size-5" />
              </div>
              <div>
                <SheetTitle className="text-left text-base font-bold">{displayName}</SheetTitle>
                <SheetDescription className="text-left text-xs flex items-center gap-1.5">
                  {typeUI.label} Admin
                  <Badge variant="outline" className="text-[8px] px-1 py-0 h-3">
                    {activeWorkflows.length} workflow{activeWorkflows.length !== 1 ? "s" : ""}
                  </Badge>
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 px-1 py-3">
            <NavSection title="Overview" items={[{ key: "dashboard", label: "Dashboard", icon: LayoutDashboard }]} activePage={businessPage} onNavigate={handleNavigate} compact />
            <NavSection
              title="Operations"
              items={[...workflowNavItems]}
              activePage={businessPage}
              onNavigate={handleNavigate}
              compact
              badge={`${activeWorkflows.length}`}
            />
            <NavSection title="Management" items={managementNavItems} activePage={businessPage} onNavigate={handleNavigate} compact />
            {showStorefront && (
              <NavSection title="Store" items={[storefrontItem]} activePage={businessPage} onNavigate={handleNavigate} compact />
            )}
            <NavSection title="Platform" items={[planWorkflowsItem, ...platformNavItems]} activePage={businessPage} onNavigate={handleNavigate} compact />
          </ScrollArea>

          <div className="border-t p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className={`${typeUI.color} text-sm`}>{businessInitials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold">Business Owner</p>
                <p className="truncate text-xs text-muted-foreground">{displayName}</p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  // Desktop: Persistent sidebar
  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="hover:bg-sidebar-accent">
              <div className={`flex aspect-square size-8 items-center justify-center rounded-lg ${typeUI.color}`}>
                <BusinessIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-bold">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">{typeUI.label} Admin</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={businessPage === "dashboard"} onClick={() => setBusinessPage("dashboard")} tooltip="Dashboard">
                  <LayoutDashboard className="size-4" />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-1.5">
            Operations
            <Badge variant="outline" className="text-[8px] px-1 py-0 h-3 ml-auto">{activeWorkflows.length}</Badge>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workflowNavItems.map((item) => (
                <SidebarMenuItem key={item.key + item.label}>
                  <SidebarMenuButton isActive={businessPage === item.key} onClick={() => setBusinessPage(item.key)} tooltip={item.label}>
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementNavItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton isActive={businessPage === item.key} onClick={() => setBusinessPage(item.key)} tooltip={item.label}>
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showStorefront && (
          <SidebarGroup>
            <SidebarGroupLabel>Store</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={businessPage === "storefront"} onClick={() => setBusinessPage("storefront")} tooltip="Storefront Preview">
                    <Eye className="size-4" />
                    <span>Storefront Preview</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Plan & Workflows — read-only, managed by platform admin */}
              <SidebarMenuItem>
                <SidebarMenuButton isActive={businessPage === "workflow-config"} onClick={() => setBusinessPage("workflow-config")} tooltip="Plan & Workflows">
                  <Shield className="size-4" />
                  <span>Plan &amp; Workflows</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {platformNavItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton isActive={businessPage === item.key} onClick={() => setBusinessPage(item.key)} tooltip={item.label}>
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <Avatar className="h-8 w-8">
                <AvatarFallback className={`${typeUI.color} text-xs`}>{businessInitials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Business Owner</span>
                <span className="truncate text-xs text-muted-foreground">{displayName}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
