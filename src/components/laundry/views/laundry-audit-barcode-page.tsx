"use client"

// Audit & Barcode Generation — dedicated operational page. Lists packages
// awaiting audit; selecting one (or arriving here from "Receive Package")
// opens the full-screen Audit & Barcode workflow for that package.

import { useEffect, useState, useCallback } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Barcode as BarcodeIcon, Loader2, ArrowRight } from "lucide-react"
import { LaundryAuditBarcode } from "./laundry-audit-barcode"

export function LaundryAuditBarcodePage() {
  const { currentBusinessId } = useAuthStore()
  const { processingOrderId, setProcessingOrderId } = useAdminStore()
  const [awaiting, setAwaiting] = useState<{ id: string; orderNumber: string; customer: string | null; items: number; barcoded: number }[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const j = await fetch(`/api/laundry/processing?businessId=${currentBusinessId}`).then((r) => r.json())
      setAwaiting(j.awaitingBarcode || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }, [currentBusinessId])
  useEffect(() => { load() }, [load])

  if (processingOrderId) {
    return <LaundryAuditBarcode orderId={processingOrderId} onBack={() => { setProcessingOrderId(null); load() }} onMoved={() => { setProcessingOrderId(null); load() }} />
  }

  return (
    <div className="px-4 lg:px-6 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><BarcodeIcon className="h-5 w-5 text-blue-600" /> Audit &amp; Barcode Generation</h1>
        <p className="text-sm text-slate-500">Re-audit received packages and generate garment barcodes before processing.</p>
      </div>
      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><BarcodeIcon className="h-[18px] w-[18px] text-blue-600" /> Packages Awaiting Audit <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">{awaiting.length}</Badge></CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="py-10 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div> : awaiting.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No packages awaiting audit. Receive a package from the Processing Center console.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead className="text-center">Garments</TableHead><TableHead>Barcodes</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>{awaiting.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                  <TableCell className="text-sm">{o.customer || "—"}</TableCell>
                  <TableCell className="text-center">{o.items}</TableCell>
                  <TableCell><Badge variant="outline" className={o.barcoded === o.items ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-amber-300 text-amber-700 bg-amber-50"}>{o.barcoded}/{o.items} barcoded</Badge></TableCell>
                  <TableCell className="text-right"><Button size="sm" onClick={() => setProcessingOrderId(o.id)} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"><BarcodeIcon className="h-3.5 w-3.5" /> Open Audit &amp; Barcode <ArrowRight className="h-3 w-3" /></Button></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
