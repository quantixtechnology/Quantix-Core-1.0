"use client"

import { Menu, Shield } from "lucide-react"
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
  const { laundryPage, supportMode, clearSupportMode } = useAdminStore()
  const title = pageTitles[laundryPage] || "Laundry OS"

  return (
    <>
      {supportMode.active && (
        <div className="flex h-9 items-center justify-center gap-2 bg-amber-500 px-4 text-xs font-medium text-white">
          <Shield className="h-3.5 w-3.5" />
          <span>
            Logged in as <strong>{supportMode.platformAdminName}</strong> (Support Mode)
          </span>
          <span className="mx-2 opacity-50">|</span>
          <span className="opacity-80">{supportMode.laundryBusinessName}</span>
          <button
            onClick={() => {
              clearSupportMode()
              window.location.href = "/"
            }}
            className="ml-2 rounded bg-white/20 px-2 py-0.5 text-[11px] font-semibold hover:bg-white/30"
          >
            Exit Support Mode
          </button>
        </div>
      )}
      <header className="flex h-14 items-center gap-3 border-b bg-background px-4">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMobileMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        <SidebarTrigger className="hidden md:flex" />
        <Separator orientation="vertical" className="h-6" />
        <h1 className="text-base font-semibold tracking-tight">{title}</h1>
      </header>
    </>
  )
}
