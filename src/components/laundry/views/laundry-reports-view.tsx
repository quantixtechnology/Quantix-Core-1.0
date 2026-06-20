"use client"

import { BarChart3 } from "lucide-react"

export function LaundryReportsView() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
      <BarChart3 className="h-12 w-12 mb-4" />
      <h2 className="text-lg font-semibold">Reports</h2>
      <p className="text-sm mt-1">Operational reports will be generated after order processing begins.</p>
    </div>
  )
}
