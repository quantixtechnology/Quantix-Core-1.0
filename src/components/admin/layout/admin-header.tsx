"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, ArrowLeftRight, ShoppingBag, Menu } from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NotificationBell } from "@/components/shared/notification-bell"
import { useResponsive } from "@/hooks/use-responsive"

const pageTitles: Record<string, string> = {
  dashboard: "Dashboard",
  leads: "Leads Management",
  businesses: "Business Management",
  subscriptions: "Subscriptions",
  onboarding: "Onboarding Tracker",
  domains: "Domains & Deployment",
  "demo-tenants": "Demo Tenants",
  sales: "Sales Team",
  notifications: "Notifications",
  settings: "Settings",
}

interface AdminHeaderProps {
  onMobileMenuClick?: () => void
}

export function AdminHeader({ onMobileMenuClick }: AdminHeaderProps) {
  const { activePage, searchQuery, setSearchQuery, setActivePage, setViewMode } = useAdminStore()
  const { isMobile } = useResponsive()

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
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
      <h2 className="text-sm font-semibold truncate">{pageTitles[activePage] || "Dashboard"}</h2>

      <div className="ml-auto flex items-center gap-2">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label="Search"
          >
            <Search className="size-4" />
          </Button>
        )}
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-64 pl-8 h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <NotificationBell
          businessId="biz_1"
          onViewAll={() => setActivePage("notifications")}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-8">
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Switch View</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="gap-2 font-medium">
              <ShoppingBag className="h-4 w-4" />
              Super Admin (Current)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setViewMode("business_owner")} className="gap-2">
              <ShoppingBag className="h-4 w-4" />
              Business Owner
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
