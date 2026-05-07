"use client"

import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Monitor,
  Users,
  BarChart3,
  Settings,
  ShoppingCart,
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

const navItems: { key: BusinessPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "orders", label: "Orders", icon: ShoppingBag },
  { key: "products", label: "Products", icon: Package },
  { key: "pos", label: "POS Billing", icon: Monitor },
  { key: "customers", label: "Customers", icon: Users },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "settings", label: "Store Settings", icon: Settings },
]

/** Shared navigation items renderer for both mobile and desktop */
function NavItems({
  activePage,
  onNavigate,
  compact = false,
}: {
  activePage: BusinessPage
  onNavigate: (page: BusinessPage) => void
  compact?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 px-2">
      {navItems.map((item) => {
        const isActive = activePage === item.key
        return (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={`flex items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
              compact ? "py-2.5" : "py-2"
            } ${
              isActive
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <item.icon className={`shrink-0 ${compact ? "size-5" : "size-4"}`} />
            <span>{item.label}</span>
          </button>
        )
      })}
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
            <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Management
            </div>
            <NavItems
              activePage={businessPage}
              onNavigate={handleNavigate}
              compact
            />
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
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    isActive={businessPage === item.key}
                    onClick={() => setBusinessPage(item.key)}
                    tooltip={item.label}
                  >
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
