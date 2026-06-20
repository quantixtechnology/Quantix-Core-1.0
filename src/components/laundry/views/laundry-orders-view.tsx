"use client"

import { ShoppingBag } from "lucide-react"

export function LaundryOrdersView() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
      <ShoppingBag className="h-12 w-12 mb-4" />
      <h2 className="text-lg font-semibold">Order Management</h2>
      <p className="text-sm mt-1">Orders will appear here once Order Management is enabled.</p>
    </div>
  )
}
