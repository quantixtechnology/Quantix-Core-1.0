'use client'

import { useMemo } from 'react'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Package, CheckCircle2, AlertTriangle, XCircle,
  RefreshCw, Eye, TrendingDown, Warehouse,
} from 'lucide-react'
import { useAdminStore } from '@/stores/admin-store'
import { getDemoProducts, getDemoCategories } from '@/lib/demo-data'
import { PageHeader } from '@/components/admin/shared/page-header'

const stockStatus: Record<string, string> = {
  in_stock: 'bg-emerald-100 text-emerald-700',
  low_stock: 'bg-amber-100 text-amber-700',
  out_of_stock: 'bg-red-100 text-red-700',
}

export function InventoryView() {
  const { demoBusinessId } = useAdminStore()

  // Build inventory from context-aware demo products
  const { inventory, stats } = useMemo(() => {
    const products = getDemoProducts(demoBusinessId)

    // Map products to inventory items
    const items = products.map((p) => {
      const defaultVariant = p.variants.find(v => v.isDefault) || p.variants[0]
      const stock = defaultVariant?.stock ?? 0
      const minStock = stock > 0 ? Math.max(Math.round(stock * 0.2), 5) : 10
      const status = stock === 0 ? 'out_of_stock' : stock < minStock ? 'low_stock' : 'in_stock'
      return {
        sku: defaultVariant?.sku || p.slug,
        name: p.name,
        variant: defaultVariant?.name || 'Default',
        category: p.category,
        stock,
        minStock,
        price: `₹${(defaultVariant?.price ?? 0).toLocaleString('en-IN')}`,
        warehouse: stock > 50 ? 'Main' : 'Secondary',
        status,
      }
    })

    const totalProducts = items.length
    const inStock = items.filter(i => i.status === 'in_stock').length
    const lowStock = items.filter(i => i.status === 'low_stock').length
    const outOfStock = items.filter(i => i.status === 'out_of_stock').length

    const computedStats = [
      { label: 'Products', value: String(totalProducts), icon: Package, color: 'text-slate-600 bg-slate-50' },
      { label: 'In Stock', value: String(inStock), icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
      { label: 'Low Stock', value: String(lowStock), icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
      { label: 'Out of Stock', value: String(outOfStock), icon: XCircle, color: 'text-red-600 bg-red-50' },
    ]

    return { inventory: items, stats: computedStats }
  }, [demoBusinessId])

  const lowStockItems = inventory.filter(i => i.status !== 'in_stock')

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <PageHeader
        title="Inventory"
        description="Track stock levels, manage warehouses, and monitor alerts"
        icon={Warehouse}
        action={
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Sync
          </Button>
        }
      />

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

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Stock Alerts</CardTitle>
            <Badge className="text-[10px] bg-red-100 text-red-700">
              {inventory.filter(i => i.status === 'out_of_stock').length} out · {inventory.filter(i => i.status === 'low_stock').length} low
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {lowStockItems.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              All items are well-stocked!
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {lowStockItems.map(i => (
                <div key={i.sku} className="p-2 rounded-lg border">
                  <div className="flex items-center gap-1 mb-1">
                    {i.status === 'out_of_stock' ? <XCircle className="size-3 text-red-500" /> : <TrendingDown className="size-3 text-amber-500" />}
                    <span className="text-xs font-medium truncate">{i.name}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Stock: {i.stock} / Min: {i.minStock}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Inventory</CardTitle>
            <Button variant="outline" size="sm" className="text-xs h-7"><RefreshCw className="size-3 mr-1" />Sync</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">SKU</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Variant</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Category</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Stock</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Min</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Price</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {inventory.map(i => (
                  <tr key={i.sku} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-mono">{i.sku}</td>
                    <td className="p-2 font-medium">{i.name}</td>
                    <td className="p-2 text-muted-foreground">{i.variant}</td>
                    <td className="p-2"><Badge variant="outline" className="text-[10px]">{i.category}</Badge></td>
                    <td className="p-2">{i.stock}</td>
                    <td className="p-2 text-muted-foreground">{i.minStock}</td>
                    <td className="p-2">{i.price}</td>
                    <td className="p-2"><Badge className={`text-[10px] ${stockStatus[i.status]}`}>{i.status.replace('_', ' ')}</Badge></td>
                    <td className="p-2"><Button variant="ghost" size="sm" className="h-6 w-6 p-0"><Eye className="size-3" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
