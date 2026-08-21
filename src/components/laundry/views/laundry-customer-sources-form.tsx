"use client"

// Workspace Settings → Customer Sources.
//
// The list a person picks from when recording how a customer was won. Direct,
// Sales and Event to start with; a business adds its own — Referral, Walk-in,
// Corporate, whatever it actually does.
//
// Retiring is deactivation, not deletion. A source customers already carry has
// to stay readable on their records, so one in use cannot be removed — only
// stopped from appearing on new customers. The server enforces that; this
// screen just explains it when it happens.

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Loader2, Plus, Tag, Check, X, Pencil, ArrowUp, ArrowDown, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/admin-fetch"

interface Source { id: string; name: string; color: string; displayOrder: number; active: boolean }

export function LaundryCustomerSourcesForm({ businessId }: { businessId: string }) {
  const [rows, setRows] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  const base = `/api/laundry/settings/customer-sources`

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const res = await fetch(`${base}?businessId=${encodeURIComponent(businessId)}`, { headers: getAuthHeaders() })
      const j = await res.json()
      if (j?.success) setRows(j.data)
    } catch { /* leave the list as it was */ } finally { setLoading(false) }
  }, [businessId, base])

  useEffect(() => { load() }, [load])

  /** Every mutation reloads, so the screen shows what the server actually holds. */
  const send = async (fn: () => Promise<Response>, okMsg: string) => {
    setBusy(true)
    try {
      const res = await fn()
      const j = await res.json().catch(() => ({}))
      if (!res.ok || j.success === false) throw new Error(j.error || "Could not save")
      toast.success(okMsg)
      await load()
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save")
      return false
    } finally { setBusy(false) }
  }

  const add = async () => {
    const name = adding.trim()
    if (!name) return
    if (await send(() => fetch(base, {
      method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ businessId, name }),
    }), `${name} added`)) setAdding("")
  }

  const rename = async (id: string) => {
    const name = editName.trim()
    if (!name) return
    if (await send(() => fetch(`${base}/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ businessId, name }),
    }), "Renamed")) setEditingId(null)
  }

  const toggle = (r: Source) => send(() => fetch(`${base}/${r.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ businessId, active: !r.active }),
  }), r.active ? `${r.name} deactivated` : `${r.name} activated`)

  const remove = (r: Source) => send(
    () => fetch(`${base}/${r.id}?businessId=${encodeURIComponent(businessId)}`, { method: "DELETE", headers: getAuthHeaders() }),
    `${r.name} removed`)

  /** Move one row and send the whole resulting order — the server stores position. */
  const move = (index: number, dir: -1 | 1) => {
    const next = [...rows]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setRows(next) // optimistic: the arrows should feel immediate
    return send(() => fetch(base, {
      method: "PATCH", headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ businessId, order: next.map((r) => r.id) }),
    }), "Order updated")
  }

  return (
    <Card className="rounded-xl border-slate-200 shadow-sm">
      <CardHeader className="pb-3 border-b border-slate-100">
        <CardTitle className="flex items-center gap-2 text-[15px] font-semibold text-slate-800">
          <Tag className="h-[18px] w-[18px] text-blue-600" /> Customer Sources
        </CardTitle>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
          How your customers were won. Chosen when a customer is created, and reportable afterwards. A source already in use can be deactivated but not deleted — it stays on the records that carry it.
        </p>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
              {rows.map((r, i) => (
                <div key={r.id} className="flex items-center gap-2 px-3 py-2.5">
                  <div className="flex flex-col">
                    <button disabled={busy || i === 0} onClick={() => move(i, -1)}
                      className="h-4 text-slate-300 hover:text-slate-600 disabled:opacity-30" aria-label={`Move ${r.name} up`}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button disabled={busy || i === rows.length - 1} onClick={() => move(i, 1)}
                      className="h-4 text-slate-300 hover:text-slate-600 disabled:opacity-30" aria-label={`Move ${r.name} down`}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />

                  {editingId === r.id ? (
                    <>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 flex-1"
                        onKeyDown={(e) => { if (e.key === "Enter") rename(r.id) }} autoFocus />
                      <Button size="sm" className="h-8 gap-1" disabled={busy} onClick={() => rename(r.id)}>
                        <Check className="h-3.5 w-3.5" /> Save
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className={`flex-1 text-sm ${r.active ? "text-slate-800" : "text-slate-400 line-through"}`}>{r.name}</span>
                      <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${r.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {r.active ? "Active" : "Inactive"}
                      </span>
                      <Switch checked={r.active} disabled={busy} onCheckedChange={() => toggle(r)} aria-label={`${r.name} active`} />
                      <button disabled={busy} onClick={() => { setEditingId(r.id); setEditName(r.name) }}
                        className="h-8 w-8 grid place-items-center rounded-lg text-slate-400 hover:text-slate-700" aria-label={`Edit ${r.name}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button disabled={busy} onClick={() => remove(r)}
                        className="h-8 w-8 grid place-items-center rounded-lg text-slate-300 hover:text-rose-600" aria-label={`Delete ${r.name}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))}
              {rows.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-400">No sources yet.</p>}
            </div>

            <div className="flex gap-2">
              <Input placeholder="Add a source — Referral, Walk-in, Corporate…" value={adding}
                onChange={(e) => setAdding(e.target.value)} className="h-9"
                onKeyDown={(e) => { if (e.key === "Enter") add() }} />
              <Button size="sm" className="h-9 gap-1.5 shrink-0" disabled={busy || !adding.trim()} onClick={add}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
