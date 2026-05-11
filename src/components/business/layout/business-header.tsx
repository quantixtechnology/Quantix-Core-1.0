"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, ShoppingBag, Menu } from "lucide-react"
import { useAdminStore, type ViewMode } from "@/stores/admin-store"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NotificationBell } from "@/components/shared/notification-bell"
import { useResponsive } from "@/hooks/use-responsive"
import { DemoSwitcher } from "@/components/workflow/demo-switcher"
import { UserMenu } from "@/components/auth/user-menu"

const pageTitles: Record<string, string> = {
  dashboard: "Dashboard",
  orders: "Orders",
  products: "Products",
  pos: "POS Billing",
  customers: "Customers",
  reports: "Reports",
  settings: "Store Settings",
  "workflow-config": "Workflow Configuration",
  workflows: "Workflows",
}

interface BusinessHeaderProps {
  onMobileMenuClick?: () => void
}

export function BusinessHeader({ onMobileMenuClick }: BusinessHeaderProps) {
  const { businessPage, searchQuery, setSearchQuery, viewMode, setViewMode, setActivePage } = useAdminStore()
  const { isMobile } = useResponsive()

  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      {isMobile ? (
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 size-10"
          onClick={onMobileMenuClick}
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </Button>
      ) : (
        <>
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 !h-5" />
        </>
      )}
      <h2 className="text-sm font-semibold truncate">{pageTitles[businessPage] || "Dashboard"}</h2>

      <div className="ml-auto flex items-center gap-2">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            onClick={() => setSearchQuery("")}
            aria-label="Search"
          >
            <Search className="size-4" />
          </Button>
        )}
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search products, orders..."
            className="w-64 pl-8 h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <NotificationBell
          businessId="biz_1"
          onViewAll={() => setActivePage("notifications")}
        />
        <DemoSwitcher />
        <UserMenu />
      </div>
    </header>
  )
}
