'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronDown, Store, Check } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useAdminStore } from '@/stores/admin-store'
import { useAuthStore } from '@/stores/auth-store'
import { getAuthHeaders } from '@/lib/admin-fetch'

interface StoreOption {
  id: string
  name: string
  isMainStore: boolean
}

export function StoreSelector() {
  const {
    currentBusinessId,
    currentStoreId,
    currentStoreName,
    setCurrentStoreId,
    setCurrentStoreName,
    storeRefreshKey,
  } = useAdminStore()
  const { currentRole } = useAuthStore()
  const [stores, setStores] = useState<StoreOption[]>([])

  const isFixed = currentRole === 'STORE_MANAGER'

  const fetchStores = useCallback(async () => {
    if (!currentBusinessId) return
    try {
      const res = await fetch(
        `/api/core/stores?businessId=${currentBusinessId}`,
        { headers: getAuthHeaders() },
      )
      const json = await res.json()
      if (!json.success || !Array.isArray(json.data)) return

      const opts: StoreOption[] = json.data.map((s: { id: string; name: string; isMainStore: boolean }) => ({
        id: s.id,
        name: s.name,
        isMainStore: s.isMainStore ?? false,
      }))
      setStores(opts)

      if (!currentStoreId && opts.length > 0) {
        const main = opts.find(s => s.isMainStore) ?? opts[0]
        setCurrentStoreId(main.id)
        setCurrentStoreName(main.name)
      }
    } catch {
      // non-critical
    }
  }, [currentBusinessId, currentStoreId, setCurrentStoreId, setCurrentStoreName])

  useEffect(() => { fetchStores() }, [fetchStores, storeRefreshKey])

  if (!currentBusinessId || stores.length === 0) return null

  const displayName = currentStoreName || stores[0]?.name || 'Select Store'

  if (isFixed || stores.length === 1) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border bg-muted/30 text-foreground">
        <Store className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="max-w-[140px] truncate">{displayName}</span>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 max-w-[200px] text-xs">
          <Store className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{displayName}</span>
          <ChevronDown className="size-3 shrink-0 opacity-50 ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {stores.map(store => (
          <DropdownMenuItem
            key={store.id}
            onClick={() => {
              setCurrentStoreId(store.id)
              setCurrentStoreName(store.name)
            }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <span className="flex-1 truncate">{store.name}</span>
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
  )
}
