"use client"

import { BusinessSidebar } from "./business-sidebar"

export function BusinessLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BusinessSidebar />
      <div style={{ padding: 40 }}>
        SIDEBAR TEST
      </div>
    </>
  )
}
