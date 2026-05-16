"use client"

import {
  LayoutDashboard, ShoppingBag, Package, Monitor, Users, BarChart3,
  Settings, ShoppingCart, Warehouse, Megaphone, UserCog,
  Receipt, Heart, MapPin, Upload, Eye, Truck, Calendar, CreditCard,
  Workflow, Zap, Droplets, Car, Beef, Wrench, Sparkles, Sofa, Store,
  DatabaseZap,
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

// Map workflow types to sidebar navigation items
const workflowNavMap: Record<WorkflowType, { key: BusinessPage; label: string; icon: React.ComponentType<{ className?: string }> }[]> = {
  ECOMMERCE: [
    { key: "orders", label: "Orders", icon: ShoppingBag },
    { key: "products", label: "Products", icon: Package },
    { key: "inventory", label: "Inventory", icon: Warehouse },
  ],
  PICKUP_DELIVERY: [
    { key: "orders", label: "Pickup Orders", icon: Truck },
    { key: "delivery-zones", label: "Delivery Zones", icon: MapPin },
  ],
  APPOINTMENT: [
    { key: "orders", label: "Appointments", icon: Calendar },
    { key: "staff", label: "Technicians", icon: UserCog },
  ],
  SUBSCRIPTION: [
    { key: "customers", label: "Customers", icon: Users },
    { key: "offers", label: "Subscription Plans", icon: CreditCard },
  ],
  POST_SERVICE_BILLING: [
    { key: "orders", label: "Service Orders", icon: Receipt },
    { key: "reports", label: "Billing Reports", icon: BarChart3 },
  ],
}

const managementNavItems: { key: BusinessPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "stores", label: "Stores", icon: Store },
  { key: "customers", label: "Customers", icon: Users },
  { key: "product-import",      label: "Product Import",       icon: Upload },
  { key: "business-data-import", label: "Business Data Upload", icon: DatabaseZap },
  { key: "pos", label: "POS Billing", icon: Monitor },
  { key: "gateway-config", label: "Payment Gateways", icon: CreditCard },
  { key: "marketing", label: "Marketing", icon: Megaphone },
  { key: "tax", label: "Tax & GST", icon: Receipt },
  { key: "loyalty", label: "Loyalty Program", icon: Heart },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "settings", label: "Settings", icon: Settings },
]

const storefrontNavItems: { key: BusinessPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "storefront", label: "Storefront Preview", icon: Eye },
]

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
  const { businessPage, setBusinessPage, currentBusinessName, currentBusinessType } = useAdminStore()
  const { isMobile } = useResponsive()

  const typeUI = BUSINESS_TYPE_UI[currentBusinessType] || BUSINESS_TYPE_UI["GROCERY"]
  const activeWorkflows = BUSINESS_TYPE_WORKFLOWS[currentBusinessType] || ["ECOMMERCE"]

  // Build workflow-specific nav items (deduplicate by page key)
  const workflowNavItems: { key: BusinessPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = []
  const seen = new Set<string>()
  activeWorkflows.forEach((wf) => {
    workflowNavMap[wf]?.forEach((item) => {
      if (!seen.has(item.key)) {
        seen.add(item.key)
        workflowNavItems.push(item)
      }
    })
  })

  const workflowConfigItem: { key: BusinessPage; label: string; icon: React.ComponentType<{ className?: string }> } = {
    key: "workflow-config",
    label: "Workflow Config",
    icon: Workflow,
  }

  const handleNavigate = (page: BusinessPage) => {
    setBusinessPage(page)
    if (isMobile && onMobileOpenChange) {
      onMobileOpenChange(false)
    }
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
                    {activeWorkflows.length} workflows
                  </Badge>
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 px-1 py-3">
            <NavSection title="Overview" items={[{ key: "dashboard", label: "Dashboard", icon: LayoutDashboard }]} activePage={businessPage} onNavigate={handleNavigate} compact />
            <NavSection title="Workflows" items={[workflowConfigItem, ...workflowNavItems]} activePage={businessPage} onNavigate={handleNavigate} compact badge={`${activeWorkflows.length} active`} />
            <NavSection title="Management" items={managementNavItems} activePage={businessPage} onNavigate={handleNavigate} compact />
            <NavSection title="Store" items={storefrontNavItems} activePage={businessPage} onNavigate={handleNavigate} compact />
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
            Workflows
            <Badge variant="outline" className="text-[8px] px-1 py-0 h-3 ml-auto">{activeWorkflows.length}</Badge>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={businessPage === "workflow-config"} onClick={() => setBusinessPage("workflow-config")} tooltip="Workflow Config">
                  <Workflow className="size-4" />
                  <span>Workflow Config</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
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

        <SidebarGroup>
          <SidebarGroupLabel>Store</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {storefrontNavItems.map((item) => (
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
