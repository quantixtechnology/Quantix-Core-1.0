"use client"

import { useState, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Barcode as BarcodeIcon, Search, Loader2, ArrowLeft, User, MapPin, ShoppingBag, Clock, CheckCircle, XCircle, AlertTriangle, Camera, Image } from "lucide-react"
import { Barcode } from "./barcode"

interface ScanResult {
  item: {
    id: string; itemNumber: string; barcode: string; garmentName: string; serviceName: string;
    quantity: number; processingStage: string; processingStatus: string; processFlow: string;
    qcFailCount: number; department: string; stageLabel: string;
    condition: string | null; defects: string | null;
  }
  business: { businessName: string; businessCode: string } | null
  store: { storeName: string; storeCode: string } | null
  customer: { name: string; phone: string | null } | null
  order: { id: string; orderNumber: string; status: string; grandTotal: number; expectedDeliveryDate: string | null }
  currentDepartment: string
  timeline: Array<{ id: string; action: string; department: string; fromStage: string | null; toStage: string | null; actorName: string | null; note: string | null; createdAt: string }>
}

export function LaundryGarmentLookup() {
  const { toast } = useToast()
  const [code, setCode] = useState("")
  const [result, setResult] = useState<ScanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const search = useCallback(async () => {
    const q = code.trim()
    if (!q) return
    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch(`/api/laundry/scan?barcode=${encodeURIComponent(q)}`)
      const j = await res.json()
      if (j.success) {
        setResult(j.data)
      } else {
        setResult(null)
        toast({ title: "Not found", description: j.error || "No garment matches this code.", variant: "destructive" })
      }
    } catch {
      setResult(null)
      toast({ title: "Search failed", description: "Could not reach the server.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [code, toast])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") search()
  }

  const stageColor = (stage: string) => {
    const map: Record<string, string> = {
      RECEIVED: "bg-slate-100 text-slate-700", WASH: "bg-blue-100 text-blue-700",
      DRY: "bg-cyan-100 text-cyan-700", DRYCLEAN: "bg-purple-100 text-purple-700",
      IRON: "bg-orange-100 text-orange-700", FOLD: "bg-green-100 text-green-700",
      QC: "bg-amber-100 text-amber-700", PACKED: "bg-teal-100 text-teal-700",
      DISPATCHED: "bg-indigo-100 text-indigo-700", DELIVERED: "bg-emerald-100 text-emerald-700",
    }
    return map[stage] || "bg-slate-100 text-slate-600"
  }

  return (
    <div className="px-4 lg:px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-600" /> Garment Lookup
          </h1>
          <p className="text-sm text-slate-500">Search by GAR code, barcode, or item number</p>
        </div>
      </div>

      <div className="flex items-center gap-2 max-w-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9 h-11 font-mono"
            placeholder="GAR000000000028 or ITM-ORD-..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <Button className="h-11 gap-2" onClick={search} disabled={loading || !code.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Lookup
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Looking up garment…</div>
      )}

      {!loading && searched && !result && (
        <Card className="rounded-xl border-slate-200 bg-slate-50">
          <CardContent className="p-12 text-center">
            <XCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No garment found</p>
            <p className="text-xs text-slate-400 mt-1">Try scanning the barcode or entering the GAR code</p>
          </CardContent>
        </Card>
      )}

      {result && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="rounded-xl border-slate-200 shadow-sm lg:col-span-2">
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2">
                  <BarcodeIcon className="h-[18px] w-[18px] text-blue-600" /> Garment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-center py-2">
                  <div className="flex flex-col items-center gap-1">
                    <Barcode value={result.item.barcode} height={40} />
                    <span className="text-[10px] font-mono text-slate-400 mt-0.5">{result.item.barcode}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-slate-400 text-xs">Garment</span><p className="font-semibold text-slate-800">{result.item.garmentName}</p></div>
                  <div><span className="text-slate-400 text-xs">GAR Number</span><p className="font-mono font-bold text-blue-700">{result.item.barcode}</p></div>
                  <div><span className="text-slate-400 text-xs">Item Number</span><p className="font-mono text-xs text-slate-600">{result.item.itemNumber}</p></div>
                  <div><span className="text-slate-400 text-xs">Service</span><p className="font-medium text-slate-800">{result.item.serviceName}</p></div>
                  <div><span className="text-slate-400 text-xs">Quantity</span><p className="font-medium text-slate-800">{result.item.quantity}</p></div>
                  <div>
                    <span className="text-slate-400 text-xs">Stage</span>
                    <p><Badge className={stageColor(result.item.processingStage)} variant="outline">{result.item.stageLabel || result.item.processingStage}</Badge></p>
                  </div>
                  {result.item.condition && <div><span className="text-slate-400 text-xs">Condition</span><p className="text-slate-800">{result.item.condition}</p></div>}
                  {result.item.defects && <div><span className="text-slate-400 text-xs">Defects</span><p className="text-amber-700">{result.item.defects}</p></div>}
                  <div><span className="text-slate-400 text-xs">QC Failures</span><p className="font-medium">{result.item.qcFailCount > 0 ? <span className="text-red-600">{result.item.qcFailCount}×</span> : "—"}</p></div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="rounded-xl border-slate-200 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5"><User className="h-4 w-4 text-blue-500" /> Customer</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="font-medium text-slate-800">{result.customer?.name || "—"}</p>
                  {result.customer?.phone && <p className="font-mono text-xs text-slate-500">{result.customer.phone}</p>}
                </CardContent>
              </Card>

              <Card className="rounded-xl border-slate-200 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5"><MapPin className="h-4 w-4 text-blue-500" /> Store</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="font-medium text-slate-800">{result.store?.storeName || "—"}</p>
                  {result.store?.storeCode && <p className="font-mono text-xs text-slate-500">{result.store.storeCode}</p>}
                </CardContent>
              </Card>

              <Card className="rounded-xl border-slate-200 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5"><ShoppingBag className="h-4 w-4 text-blue-500" /> Order</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="font-mono font-bold text-slate-800">{result.order.orderNumber}</p>
                  <Badge variant="outline" className="text-[10px]">{result.order.status}</Badge>
                  {result.order.expectedDeliveryDate && <p className="text-xs text-slate-500">Expected: {new Date(result.order.expectedDeliveryDate).toLocaleDateString()}</p>}
                </CardContent>
              </Card>

              <Card className="rounded-xl border-slate-200 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-blue-500" /> Business</CardTitle></CardHeader>
                <CardContent className="text-sm">
                  <p className="font-medium text-slate-800">{result.business?.businessName || "—"}</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><Clock className="h-4 w-4 text-blue-600" /> Timeline / QC History</CardTitle></CardHeader>
            <CardContent>
              {result.timeline.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No events recorded yet.</p>
              ) : (
                <div className="space-y-0">
                  {result.timeline.map((ev) => (
                    <div key={ev.id} className="flex gap-3 py-2 border-b border-slate-50 last:border-0">
                      <div className="mt-0.5">
                        {ev.action === "QC_PASS" ? <CheckCircle className="h-4 w-4 text-emerald-500" /> :
                         ev.action === "QC_FAIL" ? <XCircle className="h-4 w-4 text-red-500" /> :
                         <div className="h-4 w-4 rounded-full bg-slate-200" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-slate-700">{ev.action.replace(/_/g, " ")}</span>
                          {ev.department && <Badge variant="outline" className="text-[9px] px-1 py-0">{ev.department}</Badge>}
                          {ev.actorName && <span className="text-[10px] text-slate-400">by {ev.actorName}</span>}
                        </div>
                        {ev.note && <p className="text-[11px] text-slate-500 mt-0.5">{ev.note}</p>}
                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(ev.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
