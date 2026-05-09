"use client"

import {
  LayoutDashboard, ShoppingBag, Package, Monitor, Users, BarChart3,
  Settings, ShoppingCart, Warehouse, Megaphone, Tag, Star, UserCog,
  Receipt, Heart, MapPin, Upload, Eye,
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAdminStore, type BusinessPage } from "@/stores/admin-store"
import { useResponsive } from "@/hooks/use-responsive"

const opsNavItems: { key: BusinessPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "orders", label: "Orders", icon: ShoppingBag },
  { key: "products", label: "Products", icon: Package },
  { key: "inventory", label: "Inventory", icon: Warehouse },
  { key: "customers", label: "Customers", icon: Users },
  { key: "product-import", label: "Product Import", icon: Upload },
]

const commerceNavItems: { key: BusinessPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "pos", label: "POS Billing", icon: Monitor },
  { key: "marketing", label: "Marketing", icon: Megaphone },
  { key: "offers", label: "Offers & Coupons", icon: Tag },
  { key: "reviews", label: "Reviews", icon: Star },
]

const mgmtNavItems: { key: BusinessPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "staff", label: "Staff & Roles", icon: UserCog },
  { key: "tax", label: "Tax & GST", icon: Receipt },
  { key: "loyalty", label: "Loyalty Program", icon: Heart },
  { key: "delivery-zones", label: "Delivery Zones", icon: MapPin },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "settings", label: "Settings", icon: Settings },
]

const storefrontNavItems: { key: BusinessPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "storefront", label: "Storefront Preview", icon: Eye },
]

/** Shared navigation items renderer */
function NavSection({
  title,
  items,
  activePage,
  onNavigate,
  compact = false,
}: {
  title?: string
  items: { key: BusinessPage; label: string; icon: React.ComponentType<{ className?: string }> }[]
  activePage: BusinessPage
  onNavigate: (page: BusinessPage) => void
  compact?: boolean
}) {
  return (
    <div className="mb-1">
      {title && (
        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
      )}
      <div className="flex flex-col gap-0.5 px-2">
        {items.map((item) => {
          const isActive = activePage === item.key
          return (
            <button
              key={item.key}
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
  const { businessPage, setBusinessPage } = useAdminStore()
  const { isMobile } = useResponsive()

  const handleNavigate = (page: BusinessPage) => {
    setBusinessPage(page)
    if (isMobile && onMobileOpenChange) {
      onMobileOpenChange(false)
    }
  }

  // Mobile: Sheet-based sidebar
  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="border-b p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <ShoppingCart className="size-5" />
              </div>
              <div>
                <SheetTitle className="text-left text-base font-bold">FreshMart</SheetTitle>
                <SheetDescription className="text-left text-xs">Business Admin</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 px-1 py-3">
            <NavSection title="Operations" items={opsNavItems} activePage={businessPage} onNavigate={handleNavigate} compact />
            <NavSection title="Commerce" items={commerceNavItems} activePage={businessPage} onNavigate={handleNavigate} compact />
            <NavSection title="Management" items={mgmtNavItems} activePage={businessPage} onNavigate={handleNavigate} compact />
            <NavSection title="Store" items={storefrontNavItems} activePage={businessPage} onNavigate={handleNavigate} compact />
          </ScrollArea>

          <div className="border-t p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-emerald-600 text-white text-sm">FM</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold">Amit Patel</p>
                <p className="truncate text-xs text-muted-foreground">Owner</p>
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
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <ShoppingCart className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-bold">FreshMart</span>
                <span className="truncate text-xs text-muted-foreground">Business Admin</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {opsNavItems.map((item) => (
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
          <SidebarGroupLabel>Commerce</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {commerceNavItems.map((item) => (
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
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mgmtNavItems.map((item) => (
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
                <AvatarFallback className="bg-emerald-600 text-white text-xs">FM</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Amit Patel</span>
                <span className="truncate text-xs text-muted-foreground">Owner</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
