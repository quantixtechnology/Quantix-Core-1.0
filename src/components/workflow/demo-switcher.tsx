"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, Truck, Calendar, CreditCard, Receipt, Zap, Droplets, Car, ChevronDown } from "lucide-react"
import { useAdminStore, DEMO_BUSINESSES, type DemoBusiness } from "@/stores/admin-store"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap,
  ShoppingCart,
  Droplets,
  Car,
  Truck,
  Calendar,
  CreditCard,
  Receipt,
}

export function DemoSwitcher() {
  const { demoBusinessId, setDemoBusinessId, setViewMode, setCurrentBusinessId } = useAdminStore()

  const currentBusiness = DEMO_BUSINESSES.find((b) => b.id === demoBusinessId) || DEMO_BUSINESSES[0]
  const CurrentIcon = iconMap[currentBusiness.icon] || Zap

  const handleSelect = (business: DemoBusiness) => {
    // Clear cached ID so useBusinessContext re-resolves from the new slug
    setCurrentBusinessId("")
    setDemoBusinessId(business.id)
    if (business.id === "super_admin") {
      setViewMode("super_admin")
    } else {
      setViewMode("business_owner")
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9">
          <div className={`flex h-5 w-5 items-center justify-center rounded ${currentBusiness.color}`}>
            <CurrentIcon className="h-3 w-3" />
          </div>
          <span className="hidden sm:inline text-xs font-medium max-w-[120px] truncate">
            {currentBusiness.name}
          </span>
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
            {currentBusiness.planTier}
          </Badge>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[300px]">
        <DropdownMenuLabel className="text-xs">Demo Business Views</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {DEMO_BUSINESSES.map((business) => {
          const Icon = iconMap[business.icon] || Zap
          const isSelected = business.id === demoBusinessId
          return (
            <DropdownMenuItem
              key={business.id}
              onClick={() => handleSelect(business)}
              className={`flex items-start gap-3 py-3 px-3 cursor-pointer ${
                isSelected ? "bg-primary/5" : ""
              }`}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${business.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{business.name}</p>
                  {isSelected && (
                    <Badge className="text-[8px] px-1 py-0 h-3.5 bg-primary text-primary-foreground">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{business.description}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                    {business.planTier === "PRO" ? "⭐ Pro" : "Standard"}
                  </Badge>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                    {business.activeWorkflows.length} workflows
                  </Badge>
                </div>
              </div>
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <div className="px-3 py-2">
          <p className="text-[10px] text-muted-foreground">
            Switch between demo views to see how different businesses use different workflow combinations
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
