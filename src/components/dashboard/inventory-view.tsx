'use client'

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Package, CheckCircle2, AlertTriangle, XCircle,
  RefreshCw, Eye, TrendingDown, Warehouse,
} from 'lucide-react'

const stats = [
  { label: 'Products', value: '1,247', icon: Package, color: 'text-slate-600 bg-slate-50' },
  { label: 'In Stock', value: '892', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Low Stock', value: '45', icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
  { label: 'Out of Stock', value: '18', icon: XCircle, color: 'text-red-600 bg-red-50' },
]

const inventory = [
  { sku: 'FM-001', name: 'Basmati Rice 5kg', category: 'Grocery', stock: 120, minStock: 30, price: '₹450', warehouse: 'WH-A', status: 'in_stock' },
  { sku: 'FM-002', name: 'Olive Oil 1L', category: 'Grocery', stock: 8, minStock: 15, price: '₹680', warehouse: 'WH-A', status: 'low_stock' },
  { sku: 'FM-003', name: 'Organic Honey 500g', category: 'Organic', stock: 0, minStock: 10, price: '₹350', warehouse: 'WH-B', status: 'out_of_stock' },
  { sku: 'FM-004', name: 'Green Tea 50 bags', category: 'Beverages', stock: 89, minStock: 20, price: '₹220', warehouse: 'WH-A', status: 'in_stock' },
  { sku: 'FM-005', name: 'Almond Butter 250g', category: 'Organic', stock: 5, minStock: 10, price: '₹490', warehouse: 'WH-B', status: 'low_stock' },
  { sku: 'FM-006', name: 'Whole Wheat Flour 10kg', category: 'Grocery', stock: 200, minStock: 50, price: '₹380', warehouse: 'WH-A', status: 'in_stock' },
  { sku: 'FM-007', name: 'Coconut Water 1L', category: 'Beverages', stock: 0, minStock: 25, price: '₹120', warehouse: 'WH-A', status: 'out_of_stock' },
  { sku: 'FM-008', name: 'Dark Chocolate 100g', category: 'Snacks', stock: 45, minStock: 15, price: '₹180', warehouse: 'WH-B', status: 'in_stock' },
  { sku: 'FM-009', name: 'Quinoa 500g', category: 'Organic', stock: 3, minStock: 8, price: '₹520', warehouse: 'WH-A', status: 'low_stock' },
  { sku: 'FM-010', name: 'Peanut Butter 500g', category: 'Snacks', stock: 67, minStock: 20, price: '₹290', warehouse: 'WH-B', status: 'in_stock' },
]

const stockStatus: Record<string, string> = {
  in_stock: 'bg-emerald-100 text-emerald-700',
  low_stock: 'bg-amber-100 text-amber-700',
  out_of_stock: 'bg-red-100 text-red-700',
}

const warehouses = [
  { name: 'WH-A (Main)', products: 845, capacity: 85, lastSync: '2 min ago' },
  { name: 'WH-B (Secondary)', products: 402, capacity: 62, lastSync: '5 min ago' },
]

export function InventoryView() {
  return (
    <div className="animate-in fade-in duration-300 space-y-6">
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
            <Badge className="text-[10px] bg-red-100 text-red-700">18 out · 45 low</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {inventory.filter(i => i.status !== 'in_stock').map(i => (
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
                  <th className="text-left p-2 font-medium text-muted-foreground">Category</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Stock</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Min</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Price</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Warehouse</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {inventory.map(i => (
                  <tr key={i.sku} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-mono">{i.sku}</td>
                    <td className="p-2 font-medium">{i.name}</td>
                    <td className="p-2"><Badge variant="outline" className="text-[10px]">{i.category}</Badge></td>
                    <td className="p-2">{i.stock}</td>
                    <td className="p-2 text-muted-foreground">{i.minStock}</td>
                    <td className="p-2">{i.price}</td>
                    <td className="p-2">{i.warehouse}</td>
                    <td className="p-2"><Badge className={`text-[10px] ${stockStatus[i.status]}`}>{i.status.replace('_', ' ')}</Badge></td>
                    <td className="p-2"><Button variant="ghost" size="sm" className="h-6 w-6 p-0"><Eye className="size-3" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Warehouse Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {warehouses.map(w => (
              <div key={w.name} className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-3">
                  <Warehouse className="size-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{w.name}</span>
                </div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>{w.products} products</span>
                  <span>{w.capacity}% capacity</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                  <div className={`h-full rounded-full ${w.capacity > 80 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${w.capacity}%` }} />
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <RefreshCw className="size-3" />Last sync: {w.lastSync}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
