"use client"

// ============================================================================
// Store Counter stage queue — the operational screen for one workflow stage
// (Store Audit / Payment Collection / Dispatch). Lists the orders sitting in
// that stage, opens an order with its full timeline, and advances it to the
// next stage via the workflow engine (real DB transition + audit event).
// One component drives every Store Counter queue.
// ============================================================================

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, RefreshCw, Search, ArrowRight, Clock, Package, User, ListChecks } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"
import { getTransitions, statusLabel, type LaundryOrderStatus } from "@/lib/laundry-workflow"

interface OrderRow {
  id: string
  orderNumber: string
  status: string
  orderType: string
  createdAt: string
  store?: { storeName: string | null; storeCode: string | null } | null
  services?: { id: string; serviceName: string }[]
}
interface OrderEvent {
  id: string; fromStatus: string | null; toStatus: string; action: string
  actorName: string | null; note: string | null; createdAt: string
}
interface OrderDetail extends OrderRow {
  customerId: string | null
  specialInstructions: string | null
  events?: OrderEvent[]
}

export function LaundryCounterQueue({ status, title }: { status: LaundryOrderStatus; title: string }) {
  const { currentBusinessId, user } = useAuthStore()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<OrderDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [acting, setActing] = useState(false)
  const [note, setNote] = useState("")

  const loadQueue = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ businessId: currentBusinessId, status, limit: "100" })
      if (search.trim()) params.set("search", search.trim())
      const res = await fetch(`/api/laundry/orders?${params.toString()}`)
      const json = await res.json()
      setOrders(json.success ? json.data : [])
    } catch {
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [currentBusinessId, status, search])

  useEffect(() => { loadQueue() }, [loadQueue])

  const openOrder = async (id: string) => {
    setDetailLoading(true); setNote("")
    try {
      const res = await fetch(`/api/laundry/orders/${id}`)
      const json = await res.json()
      if (json.success) setSelected(json.data)
      else toast.error("Failed to load order")
    } catch {
      toast.error("Failed to load order")
    } finally {
      setDetailLoading(false)
    }
  }

  const advance = async (toStatus: string, label: string) => {
    if (!selected) return
    setActing(true)
    try {
      const res = await fetch(`/api/laundry/orders/${selected.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus, note: note.trim() || undefined, actorId: user?.id, actorName: user?.name }),
      })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.error || "Transition failed")
      toast.success(`${selected.orderNumber}: ${label} → ${statusLabel(toStatus)}`)
      setSelected(null)
      loadQueue()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transition failed")
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{statusLabel(status)} queue — {orders.length} order{orders.length === 1 ? "" : "s"}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={loadQueue} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4">
        {/* Queue list */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search order #…" className="pl-8 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No orders in this stage</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
              {orders.map((o) => (
                <Card key={o.id} className={`cursor-pointer transition-colors ${selected?.id === o.id ? "ring-2 ring-blue-500" : "hover:bg-accent/50"}`} onClick={() => openOrder(o.id)}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold">{o.orderNumber}</span>
                      <Badge variant="outline" className="text-[10px]">{o.orderType}</Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{o.store?.storeName || o.store?.storeCode || "—"}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(o.createdAt).toLocaleDateString("en-IN")}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Order detail + actions */}
        <div>
          {!selected ? (
            <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Select an order to view its timeline and advance it.</CardContent></Card>
          ) : detailLoading ? (
            <Card><CardContent className="p-10 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm font-bold">{selected.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">{selected.store?.storeName || "—"} · {selected.orderType}</p>
                  </div>
                  <Badge className="bg-blue-100 text-blue-700">{statusLabel(selected.status)}</Badge>
                </div>

                {selected.services && selected.services.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" /> Services</p>
                    <div className="flex flex-wrap gap-1">
                      {selected.services.map((s) => <Badge key={s.id} variant="outline" className="text-[10px]">{s.serviceName}</Badge>)}
                    </div>
                  </div>
                )}

                {selected.specialInstructions && (
                  <p className="text-xs text-muted-foreground"><span className="font-medium">Instructions:</span> {selected.specialInstructions}</p>
                )}

                {/* Timeline */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Timeline</p>
                  <div className="space-y-2">
                    {(selected.events ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">Created — no stage transitions yet.</p>
                    ) : (
                      selected.events!.map((ev) => (
                        <div key={ev.id} className="flex items-start gap-2 text-xs">
                          <div className="mt-0.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                          <div>
                            <span className="font-medium">{statusLabel(ev.fromStatus || "")} → {statusLabel(ev.toStatus)}</span>
                            <span className="text-muted-foreground">
                              {" · "}{new Date(ev.createdAt).toLocaleString("en-IN")}
                              {ev.actorName ? ` · ${ev.actorName}` : ""}
                            </span>
                            {ev.note && <p className="text-muted-foreground">{ev.note}</p>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 border-t space-y-2">
                  <Textarea placeholder="Note (optional)…" value={note} onChange={(e) => setNote(e.target.value)} className="text-sm min-h-[60px]" />
                  <div className="flex flex-wrap gap-2">
                    {getTransitions(selected.status).map((t) => (
                      <Button key={t.to} size="sm" disabled={acting}
                        variant={t.primary ? "default" : "outline"}
                        className={t.primary ? "gap-1 bg-blue-600 hover:bg-blue-700 text-white" : "gap-1"}
                        onClick={() => advance(t.to, t.label)}>
                        {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />} {t.label}
                      </Button>
                    ))}
                    {getTransitions(selected.status).length === 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3.5 w-3.5" /> No further counter actions for this stage.</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
