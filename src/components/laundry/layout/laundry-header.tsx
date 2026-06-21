"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { useAdminStore, type LaundryBusinessPage } from "@/stores/admin-store"

const pageTitles: Record<LaundryBusinessPage, string> = {
  dashboard: "Dashboard",
  inbox: "My Inbox",
  orders: "Orders",
  "new-order": "New Order",
  customers: "Customers",
  stores: "Stores",
  "processing-centers": "Processing Centers",
  reports: "Reports",
  settings: "Settings",
}

export function LaundryHeader({ onMobileMenuClick }: { onMobileMenuClick?: () => void }) {
  const { laundryPage } = useAdminStore()
  const title = pageTitles[laundryPage] || "Laundry OS"

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-background px-4">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMobileMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>
      <SidebarTrigger className="hidden md:flex" />
      <Separator orientation="vertical" className="h-6" />
      <h1 className="text-base font-semibold tracking-tight">{title}</h1>
    </header>
  )
}
