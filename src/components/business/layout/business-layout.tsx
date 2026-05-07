"use client"

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { BusinessSidebar } from "./business-sidebar"
import { BusinessHeader } from "./business-header"

export function BusinessLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <BusinessSidebar />
      <SidebarInset>
        <BusinessHeader />
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
