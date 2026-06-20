"use client"

import { Users } from "lucide-react"

export function LaundryCustomersView() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
      <Users className="h-12 w-12 mb-4" />
      <h2 className="text-lg font-semibold">Customers</h2>
      <p className="text-sm mt-1">Customer management will be available after orders are created.</p>
    </div>
  )
}
