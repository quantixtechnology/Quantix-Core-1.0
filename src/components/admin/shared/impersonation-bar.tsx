"use client"

import { ArrowLeft, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAdminStore, BUSINESS_TYPE_UI } from "@/stores/admin-store"

export function ImpersonationBar() {
  const {
    isImpersonating,
    currentBusinessName,
    currentBusinessType,
    clearCurrentBusiness,
  } = useAdminStore()

  if (!isImpersonating) return null

  const typeUI = BUSINESS_TYPE_UI[currentBusinessType]

  return (
    <div className="flex items-center gap-2 rounded-md border bg-amber-50 px-3 py-1.5 dark:bg-amber-950/30 dark:border-amber-900">
      <Building2 className="size-3.5 text-amber-600 shrink-0" />
      <span className="text-xs font-medium text-amber-800 dark:text-amber-300 truncate max-w-[140px]">
        {currentBusinessName || "Business"}
      </span>
      {typeUI && (
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-300 text-amber-700">
          {typeUI.label}
        </Badge>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-100 dark:hover:bg-amber-900/50"
        onClick={clearCurrentBusiness}
      >
        <ArrowLeft className="size-3 mr-1" />
        Exit
      </Button>
    </div>
  )
}
