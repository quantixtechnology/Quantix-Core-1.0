"use client"

import { useState } from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { LaundrySidebar } from "./laundry-sidebar"
import { LaundryHeader } from "./laundry-header"

export function LaundryLayout({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <SidebarProvider>
      <LaundrySidebar
        mobileOpen={mobileSidebarOpen}
        onMobileOpenChange={setMobileSidebarOpen}
      />
      <SidebarInset>
        <LaundryHeader onMobileMenuClick={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
