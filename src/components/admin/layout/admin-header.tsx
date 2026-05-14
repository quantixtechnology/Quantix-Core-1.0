"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Search, Menu } from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { NotificationBell } from "@/components/shared/notification-bell"
import { useResponsive } from "@/hooks/use-responsive"
import { ImpersonationBar } from "@/components/admin/shared/impersonation-bar"
import { UserMenu } from "@/components/auth/user-menu"

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
  "workflow-engine": "Workflow Engine",
  "plan-management": "Plan Management",
  "payment-plugins": "Payment Plugins",
  "platform-users": "User Management",
  "mobile-apps": "Mobile Apps",
  "ops-dashboard": "Operations Dashboard",
  "deployment-pipeline": "Deployment Pipeline",
  "build-automation": "Build Automation",
  "release-management": "Release Management",
  "play-store": "Play Store Management",
  "mobile-versions": "Mobile Version Control",
  "client-assets": "Client Assets",
  "tenant-provisioning": "Tenant Provisioning",
  "product-import": "Product Import",
  "onboarding-checklist": "Onboarding Checklist",
  "platform-analytics": "Analytics & Reports",
  revenue: "Revenue & Payouts",
  support: "Support & Tickets",
  "backup-monitoring": "Backup & Monitoring",
  "security-access": "Security & Access",
  "audit-logs": "Audit Logs",
}

interface AdminHeaderProps {
  onMobileMenuClick?: () => void
}

export function AdminHeader({ onMobileMenuClick }: AdminHeaderProps) {
  const { activePage, searchQuery, setSearchQuery, setActivePage } = useAdminStore()
  const { currentBusinessId } = useAuthStore()
  const { isMobile } = useResponsive()

  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-4">
      {isMobile ? (
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 size-9 text-gray-500 hover:text-gray-900 hover:bg-gray-100"
          onClick={onMobileMenuClick}
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </Button>
      ) : (
        <>
          <SidebarTrigger className="-ml-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100" />
          <Separator orientation="vertical" className="mr-2 !h-4 bg-gray-200" />
        </>
      )}

      <h2 className="text-sm font-semibold text-gray-900 truncate">
        {pageTitles[activePage] || "Dashboard"}
      </h2>

      <div className="ml-auto flex items-center gap-2">
        {/* Search */}
        {isMobile ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-9 text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            aria-label="Search"
          >
            <Search className="size-4" />
          </Button>
        ) : (
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="search"
              placeholder="Search..."
              className="h-9 w-64 rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}

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
