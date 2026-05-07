"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bell, Search, ShoppingBag, ArrowLeftRight } from "lucide-react"
import { useAdminStore, type ViewMode } from "@/stores/admin-store"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const pageTitles: Record<string, string> = {
  dashboard: "Dashboard",
  orders: "Orders",
  products: "Products",
  pos: "POS Billing",
  customers: "Customers",
  reports: "Reports",
  settings: "Store Settings",
}

export function BusinessHeader() {
  const { businessPage, searchQuery, setSearchQuery, viewMode, setViewMode } = useAdminStore()

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 !h-5" />
      <h2 className="text-sm font-semibold hidden sm:block">{pageTitles[businessPage] || "Dashboard"}</h2>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search products, orders..."
            className="w-64 pl-8 h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-red-500 text-white border-0">
            5
          </Badge>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-8">
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Switch View</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setViewMode("super_admin")} className="gap-2">
              <ShoppingBag className="h-4 w-4" />
              Super Admin
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setViewMode("business_owner")} className="gap-2">
              <ShoppingBag className="h-4 w-4" />
              Business Owner
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
