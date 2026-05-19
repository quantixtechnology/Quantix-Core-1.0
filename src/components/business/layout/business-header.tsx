"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Menu } from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { NotificationBell } from "@/components/shared/notification-bell"
import { useResponsive } from "@/hooks/use-responsive"
import { ImpersonationBar } from "@/components/admin/shared/impersonation-bar"
import { UserMenu } from "@/components/auth/user-menu"
import { StoreSelector } from "@/components/business/layout/store-selector"

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
  "product-import": "Product Import",
  "customer-import": "Bulk Customer Upload",
  categories: "Categories",
  tax: "Tax & GST",
  "gateway-config": "Payment Gateways",
  "delivery-zones": "Delivery Zones",
  stores: "Stores",
  storefront: "Storefront Preview",
  marketing: "Marketing",
  offers: "Offers",
  reviews: "Reviews",
  staff: "Staff",
  loyalty: "Loyalty Program",
  inventory: "Inventory",
  branding: "Branding",
  "feature-flags": "Feature Flags",
  "subscription-view": "Subscription",
  "customer-app": "Customer App",
  "delivery-app": "Delivery App",
  "admin-app": "Admin App",
  website: "Website",
  "onboarding-progress": "Onboarding",
}

interface BusinessHeaderProps {
  onMobileMenuClick?: () => void
}

export function BusinessHeader({ onMobileMenuClick }: BusinessHeaderProps) {
  const { businessPage, searchQuery, setSearchQuery, setActivePage } = useAdminStore()
  const { currentBusinessId } = useAuthStore()
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

      <div className="ml-4 hidden md:block">
        <StoreSelector />
      </div>

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
          businessId={currentBusinessId || ""}
          onViewAll={() => setActivePage("notifications")}
        />
        <ImpersonationBar />
        <UserMenu />
      </div>
    </header>
  )
}
