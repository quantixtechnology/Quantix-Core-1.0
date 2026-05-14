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
  // Workflow Engine
  "workflow-engine": "Workflow Engine",
  "plan-management": "Plan Management",
  // Phase 6
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
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 backdrop-blur-sm px-4">
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
          businessId={currentBusinessId || ""}
          onViewAll={() => setActivePage("notifications")}
        />
        <ImpersonationBar />
        <UserMenu />
      </div>
    </header>
  )
}
