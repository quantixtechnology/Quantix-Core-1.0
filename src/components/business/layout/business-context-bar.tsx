"use client"

import { useState, useEffect, useCallback } from "react"
import { Building2, Store, ChevronDown, Check } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAdminStore } from "@/stores/admin-store"
import { getAuthHeaders } from "@/lib/admin-fetch"

interface StoreInfo {
  id: string
  name: string
  storeCode: string | null
  isMainStore: boolean
}

export function BusinessContextBar() {
  const {
    currentBusinessId,
    currentBusinessName,
    currentStoreId,
    currentStoreName,
    setCurrentStoreId,
    setCurrentStoreName,
    setCurrentStoreCode,
  } = useAdminStore()

  const [businessCode, setBusinessCode] = useState<string | null>(null)
  const [stores, setStores] = useState<StoreInfo[]>([])

  const fetchBusiness = useCallback(async () => {
    if (!currentBusinessId) return
    try {
      const res = await fetch(`/api/core/businesses/${currentBusinessId}`, {
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (json.success && json.data?.businessCode) {
        setBusinessCode(json.data.businessCode)
      }
    } catch {
      // non-critical
    }
  }, [currentBusinessId])

  const fetchStores = useCallback(async () => {
    if (!currentBusinessId) return
    try {
      const res = await fetch(`/api/core/stores?businessId=${currentBusinessId}`, {
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        const opts: StoreInfo[] = json.data.map((s: {
          id: string; name: string; storeCode?: string | null; isMainStore?: boolean
        }) => ({
          id: s.id,
          name: s.name,
          storeCode: s.storeCode ?? null,
          isMainStore: s.isMainStore ?? false,
        }))
        setStores(opts)
        // Auto-select main store if none selected
        if (!currentStoreId && opts.length > 0) {
          const main = opts.find(s => s.isMainStore) ?? opts[0]
          setCurrentStoreId(main.id)
          setCurrentStoreName(main.name)
          setCurrentStoreCode(main.storeCode ?? '')
        }
      }
    } catch {
      // non-critical
    }
  }, [currentBusinessId, currentStoreId, setCurrentStoreId, setCurrentStoreName, setCurrentStoreCode])

  useEffect(() => {
    setBusinessCode(null)
    setStores([])
    fetchBusiness()
    fetchStores()
  }, [fetchBusiness, fetchStores])

  if (!currentBusinessId) return null

  const currentStore = stores.find(s => s.id === currentStoreId)
  const storeCode = currentStore?.storeCode ?? null
  const displayStoreName = currentStoreName || currentStore?.name || "—"

  const switchStore = (store: StoreInfo) => {
    setCurrentStoreId(store.id)
    setCurrentStoreName(store.name)
    setCurrentStoreCode(store.storeCode ?? '')
  }

  return (
    <div className="sticky top-14 z-40 flex items-center gap-0 border-b bg-muted/20 px-4 py-1.5 text-xs shrink-0">
      {/* Business */}
      <div className="flex items-center gap-1.5 min-w-0 pr-3">
        <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="font-semibold text-foreground truncate max-w-[180px]">
          {currentBusinessName || "—"}
        </span>
        {businessCode && (
          <span className="font-mono text-muted-foreground shrink-0">· {businessCode}</span>
        )}
      </div>

      <span className="text-border border-l h-4 mx-1" />

      {/* Store — dropdown when multiple stores, plain label when single */}
      {stores.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 pl-3 text-muted-foreground hover:text-foreground transition-colors focus:outline-none">
              <Store className="size-3.5 shrink-0" />
              <span className="font-medium truncate max-w-[150px]">{displayStoreName}</span>
              {storeCode && (
                <span className="font-mono shrink-0">· {storeCode}</span>
              )}
              <ChevronDown className="size-3 shrink-0 opacity-60 ml-0.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            {stores.map(store => (
              <DropdownMenuItem
                key={store.id}
                onClick={() => switchStore(store)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Store className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{store.name}</div>
                  {store.storeCode && (
                    <div className="text-[10px] text-muted-foreground font-mono">{store.storeCode}</div>
                  )}
                </div>
                {store.isMainStore && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                    Main
                  </span>
                )}
                {store.id === currentStoreId && (
                  <Check className="size-3.5 text-emerald-500 shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center gap-1.5 pl-3 text-muted-foreground">
          <Store className="size-3.5 shrink-0" />
          <span className="font-medium truncate max-w-[150px]">{displayStoreName}</span>
          {storeCode && (
            <span className="font-mono shrink-0">· {storeCode}</span>
          )}
        </div>
      )}
    </div>
  )
}
