"use client"

import { useState } from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { LaundrySidebar } from "./laundry-sidebar"
import { LaundryHeader } from "./laundry-header"
import { LaundryAuthBridge } from "@/components/laundry/laundry-auth-bridge"
import { RuntimeAuthProvider } from "@/components/auth/runtime-auth-provider"
import { LaundryWorkspaceGate } from "@/components/laundry/laundry-workspace-gate"

export function LaundryLayout({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <RuntimeAuthProvider>
      <LaundryAuthBridge />
      <LaundryWorkspaceGate>
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
      </LaundryWorkspaceGate>
    </RuntimeAuthProvider>
  )
}
