"use client"

import { ArrowLeft, Building2, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAdminStore, BUSINESS_TYPE_UI } from "@/stores/admin-store"

export function ImpersonationBar() {
  const {
    isImpersonating,
    currentBusinessName,
    currentBusinessType,
    currentBusinessSlug,
    clearCurrentBusiness,
  } = useAdminStore()

  if (!isImpersonating) return null

  const typeUI = BUSINESS_TYPE_UI[currentBusinessType]

  return (
    <div className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 dark:bg-amber-950/30 dark:border-amber-800">
      <ShieldAlert className="size-3.5 text-amber-600 shrink-0" />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-xs text-amber-700 dark:text-amber-400 whitespace-nowrap">
          Logged in as
        </span>
        <div className="flex items-center gap-1.5 min-w-0">
          <Building2 className="size-3 text-amber-700 shrink-0" />
          <span className="text-xs font-semibold text-amber-900 dark:text-amber-200 truncate">
            {currentBusinessName || "Business"}
          </span>
          {typeUI && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-300 text-amber-700 shrink-0">
              {typeUI.label}
            </Badge>
          )}
          {currentBusinessSlug && (
            <span className="text-[10px] font-mono text-amber-600 truncate hidden sm:inline">
              #{currentBusinessSlug}
            </span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-100 dark:hover:bg-amber-900/50 shrink-0 font-medium"
        onClick={clearCurrentBusiness}
      >
        <ArrowLeft className="size-3 mr-1" />
        Exit to Super Admin
      </Button>
    </div>
  )
}
