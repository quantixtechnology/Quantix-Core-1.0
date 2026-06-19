"use client"

import { useState } from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { BusinessSidebar } from "./business-sidebar"
import { BusinessHeader } from "./business-header"
import { BusinessContextBar } from "./business-context-bar"
import { NewOrderAlert } from "@/components/business/orders/new-order-alert"

export function BusinessLayout({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <SidebarProvider>
      <BusinessSidebar
        mobileOpen={mobileSidebarOpen}
        onMobileOpenChange={setMobileSidebarOpen}
      />
      <SidebarInset>
        <BusinessHeader onMobileMenuClick={() => setMobileSidebarOpen(true)} />
        <BusinessContextBar />
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </SidebarInset>
      {/* Listens for order:created across all business dashboard pages */}
      <NewOrderAlert />
    </SidebarProvider>
  )
}
