"use client"

import { useState } from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { AdminHeader } from "./admin-header"

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <SidebarProvider>
      <AppSidebar
        mobileOpen={mobileSidebarOpen}
        onMobileOpenChange={setMobileSidebarOpen}
      />
      <SidebarInset>
        <AdminHeader onMobileMenuClick={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
