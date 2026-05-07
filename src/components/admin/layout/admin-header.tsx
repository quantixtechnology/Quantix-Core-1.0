"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Bell, Search } from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { Badge } from "@/components/ui/badge"

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

export function AdminHeader() {
  const { activePage, searchQuery, setSearchQuery, setActivePage } = useAdminStore()

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 !h-5" />
      <h2 className="text-sm font-semibold hidden sm:block">{pageTitles[activePage] || "Dashboard"}</h2>

      <div className="ml-auto flex items-center gap-2">
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
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => setActivePage("notifications")}
        >
          <Bell className="h-4 w-4" />
          <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-red-500 text-white border-0">
            3
          </Badge>
        </Button>
      </div>
    </header>
  )
}
