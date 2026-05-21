'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Package, CheckCircle2, AlertTriangle, XCircle,
  RefreshCw, Eye, TrendingDown, Warehouse, Building2, Store,
} from 'lucide-react'
import { useAdminStore } from '@/stores/admin-store'
import { getAuthHeaders } from '@/lib/admin-fetch'
import { PageHeader } from '@/components/admin/shared/page-header'

const statusStyle: Record<string, string> = {
  IN_STOCK:    'bg-emerald-100 text-emerald-700',
  LOW_STOCK:   'bg-amber-100 text-amber-700',
  OUT_OF_STOCK:'bg-red-100 text-red-700',
}

const statusLabel: Record<string, string> = {
  IN_STOCK:    'In Stock',
  LOW_STOCK:   'Low Stock',
  OUT_OF_STOCK:'Out of Stock',
}

interface RawInventory {
  id: string
  quantity: number
  minStock: number
  status: string
  product: { id: string; name: string; sku: string; status: string }
  variant: { id: string; name: string; sku: string } | null
  store:   { id: string; name: string; storeCode: string }
}

export function InventoryView() {
  const { currentBusinessId, currentStoreId, currentStoreName, currentStoreCode, currentBusinessName } = useAdminStore()
  const [items, setItems]   = useState<RawInventory[]>([])
  const [loading, setLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '500' })
      if (currentStoreId) params.set('storeId', currentStoreId)

      const res = await fetch(
        `/api/core/businesses/${currentBusinessId}/inventory?${params}`,
        { headers: getAuthHeaders() },
      )
      const json = await res.json()
      if (json.success) {
        setItems(json.data ?? [])
        setTotalCount(json.pagination?.total ?? (json.data?.length ?? 0))
      }
    } finally {
      setLoading(false)
    }
  }, [currentBusinessId, currentStoreId])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    const inStock    = items.filter(i => i.status === 'IN_STOCK').length
    const lowStock   = items.filter(i => i.status === 'LOW_STOCK').length
    const outOfStock = items.filter(i => i.status === 'OUT_OF_STOCK').length
    return [
      { label: 'Products',     value: String(totalCount || items.length), icon: Package,     color: 'text-slate-600 bg-slate-50' },
      { label: 'In Stock',     value: String(inStock),                    icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
      { label: 'Low Stock',    value: String(lowStock),                   icon: AlertTriangle,color: 'text-amber-600 bg-amber-50' },
      { label: 'Out of Stock', value: String(outOfStock),                 icon: XCircle,      color: 'text-red-600 bg-red-50' },
    ]
  }, [items, totalCount])

  const alertItems = items.filter(i => i.status !== 'IN_STOCK')

  const subtitle = currentStoreName
    ? `${currentStoreName} — stock levels and alerts`
    : 'Track stock levels and monitor alerts'

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      {/* Store context strip */}
      {(currentStoreCode || currentStoreName) && (
        <div className="flex items-center gap-4 rounded-lg border bg-muted/30 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Building2 className="size-3.5 shrink-0" />
            <span className="font-medium text-foreground">{currentBusinessName || '—'}</span>
          </div>
          <span className="text-border">·</span>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Store className="size-3.5 shrink-0" />
            <span className="font-medium text-foreground">{currentStoreName || '—'}</span>
          </div>
          {currentStoreCode && (
            <>
              <span className="text-border">·</span>
              <span className="font-mono font-semibold text-emerald-700">{currentStoreCode}</span>
            </>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground">Stock is store-scoped</span>
        </div>
      )}

      <PageHeader
        title="Inventory"
        description={subtitle}
        icon={Warehouse}
        action={
          <Button variant="outline" size="sm" className="gap-2" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.color}`}><s.icon className="size-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Stock alerts */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Stock Alerts</CardTitle>
            <Badge className="text-[10px] bg-red-100 text-red-700">
              {items.filter(i => i.status === 'OUT_OF_STOCK').length} out · {items.filter(i => i.status === 'LOW_STOCK').length} low
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-6 text-sm text-muted-foreground">Loading…</div>
          ) : alertItems.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              {items.length === 0 ? 'No inventory data yet.' : 'All items are well-stocked!'}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {alertItems.map(i => (
                <div key={i.id} className="p-2 rounded-lg border">
                  <div className="flex items-center gap-1 mb-1">
                    {i.status === 'OUT_OF_STOCK'
                      ? <XCircle className="size-3 text-red-500" />
                      : <TrendingDown className="size-3 text-amber-500" />}
                    <span className="text-xs font-medium truncate">{i.product.name}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Stock: {i.quantity} / Min: {i.minStock}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full inventory table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Inventory</CardTitle>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={load} disabled={loading}>
              <RefreshCw className={`size-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading inventory…</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No inventory records found{currentStoreName ? ` for ${currentStoreName}` : ''}.
              Add products with stock to see them here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium text-muted-foreground">SKU</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Variant</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Store</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Stock</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Min</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(i => (
                    <tr key={i.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-mono">{i.variant?.sku || i.product.sku}</td>
                      <td className="p-2 font-medium">{i.product.name}</td>
                      <td className="p-2 text-muted-foreground">{i.variant?.name || '—'}</td>
                      <td className="p-2">
                        <div className="text-muted-foreground">{i.store.name}</div>
                        {i.store.storeCode && (
                          <div className="font-mono text-[10px] text-emerald-700">{i.store.storeCode}</div>
                        )}
                      </td>
                      <td className="p-2">{i.quantity}</td>
                      <td className="p-2 text-muted-foreground">{i.minStock}</td>
                      <td className="p-2">
                        <Badge className={`text-[10px] ${statusStyle[i.status] ?? 'bg-slate-100 text-slate-700'}`}>
                          {statusLabel[i.status] ?? i.status}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Eye className="size-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
