"use client"

// Authoritative Product selector for Business Setup — the FIRST platform
// classification, chosen before Business Category. Driven by the PlatformProduct
// master (/api/admin/products); only ACTIVE + enabled products are assignable.
//
// Lifecycle (Phase 3 correction §4): Product is far more sensitive than
// category. It is editable only while the business is a DRAFT / not yet
// provisioned (no productCode assigned and status not ACTIVE). Once a product is
// assigned or the business is ACTIVE, Product is read-only here — a product
// migration is a separate platform workflow, not a casual wizard edit.
import { useEffect, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"

interface Product { code: string; name: string; status: string; isEnabled: boolean; productType?: string }

export function ProductSelector({
  value, onChange, locked,
}: {
  value: string
  onChange: (code: string) => void
  locked?: boolean // provisioned/active business → read-only
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const res = await fetch("/api/admin/products?limit=100", { headers: await getAuthHeaders() })
        const j = await res.json()
        const list: Product[] = (Array.isArray(j?.data) ? j.data : []).filter((p: Product) => p.status === "ACTIVE" && p.isEnabled)
        if (live) setProducts(list)
      } catch { if (live) setProducts([]) } finally { if (live) setLoading(false) }
    })()
    return () => { live = false }
  }, [])

  const current = products.find((p) => p.code === value)

  if (locked) {
    return (
      <div className="flex items-center gap-2">
        <Badge className="bg-indigo-100 text-indigo-700">{current?.name || value || "—"}</Badge>
        <span className="text-[11px] text-muted-foreground">Locked after provisioning</span>
      </div>
    )
  }

  if (loading) return <div className="flex items-center gap-2 h-9 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading products…</div>

  return (
    <div className="space-y-1">
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue placeholder="Select a product…" /></SelectTrigger>
        <SelectContent>
          {products.map((p) => (
            <SelectItem key={p.code} value={p.code}>{p.name} <span className="text-muted-foreground text-xs">· {p.code}</span></SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[11px] text-muted-foreground">The Quantix product/workspace. Determines the available business categories.</p>
    </div>
  )
}
