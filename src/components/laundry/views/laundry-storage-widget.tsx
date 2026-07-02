"use client"

// Storage Usage widget — tenant storage consumption, limit and per-category
// breakdown from /api/laundry/storage (read-only; usage is tracked in the
// FileUpload ledger). Isolation is per tenant (businessId).

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { HardDrive, AlertTriangle, Loader2, FileStack, CalendarClock, CalendarDays } from "lucide-react"

interface Usage {
  usedGB: number; usedMB: number; usedBytes: number
  limitGB: number | null; remainingBytes: number | null
  percentUsed: number; nearingLimit: boolean; exceeded: boolean
  fileCount: number; uploadsToday: number; uploadsThisMonth: number
  byCategory: { category: string; label: string; bytes: number; mb: number; count: number }[]
}

const fmt = (bytes: number) => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

const CAT_COLORS: Record<string, string> = {
  customers: "bg-blue-500", garments: "bg-violet-500", audit: "bg-amber-500",
  invoice: "bg-emerald-500", documents: "bg-slate-400", branding: "bg-pink-500",
  orders: "bg-cyan-500", processing: "bg-indigo-500", delivery: "bg-teal-500",
  temp: "bg-slate-300", other: "bg-slate-400",
}

export function LaundryStorageWidget({ businessId }: { businessId: string }) {
  const [usage, setUsage] = useState<Usage | null>(null)
  const [plan, setPlan] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!businessId) return
    fetch(`/api/laundry/storage?businessId=${encodeURIComponent(businessId)}`).then((r) => r.json())
      .then((j) => { if (j.success) { setUsage(j.data); setPlan(j.plan) } })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [businessId])

  const barColor = usage?.exceeded ? "bg-red-500" : usage?.nearingLimit ? "bg-amber-500" : "bg-blue-600"

  return (
    <Card className="rounded-xl border-slate-200 shadow-sm">
      <CardHeader className="pb-3 border-b border-slate-100">
        <CardTitle className="flex items-center justify-between text-[15px] font-semibold text-slate-800">
          <span className="flex items-center gap-2"><HardDrive className="h-[18px] w-[18px] text-blue-600" /> Storage Usage</span>
          {plan && <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-500">{plan} Plan</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400 gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : !usage ? (
          <p className="text-sm text-slate-400 py-6 text-center">Storage data unavailable.</p>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="flex items-end justify-between mb-1.5">
                <p className="text-2xl font-bold text-slate-800">{fmt(usage.usedBytes)} <span className="text-sm font-normal text-slate-400">/ {usage.limitGB != null ? `${usage.limitGB} GB` : "Unlimited"}</span></p>
                <span className="text-sm font-semibold text-slate-500">{usage.limitGB != null ? `${usage.percentUsed}%` : ""}</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${usage.limitGB != null ? Math.max(2, usage.percentUsed) : 4}%` }} />
              </div>
              {usage.remainingBytes != null && !usage.exceeded && (
                <p className="text-[11px] text-slate-400 mt-1.5">{fmt(usage.remainingBytes)} remaining</p>
              )}
              {usage.exceeded && (
                <p className="text-[12px] text-red-600 mt-2 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Storage limit exceeded — new uploads are blocked. Upgrade your plan.</p>
              )}
              {usage.nearingLimit && !usage.exceeded && (
                <p className="text-[12px] text-amber-600 mt-2 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> You&apos;ve used over 90% of your storage.</p>
              )}
            </div>

            {/* Analytics */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: FileStack, label: "Total Files", value: usage.fileCount },
                { icon: CalendarDays, label: "Uploads Today", value: usage.uploadsToday },
                { icon: CalendarClock, label: "This Month", value: usage.uploadsThisMonth },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-slate-200 p-2.5 flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><s.icon className="h-4 w-4" /></div>
                  <div><p className="text-lg font-bold text-slate-800 leading-none">{s.value}</p><p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p></div>
                </div>
              ))}
            </div>

            {/* Breakdown */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Breakdown by Category</p>
              {usage.byCategory.length === 0 ? (
                <p className="text-sm text-slate-400">No files uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {usage.byCategory.map((c) => (
                    <div key={c.category} className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${CAT_COLORS[c.category] || "bg-slate-400"}`} />
                      <span className="text-sm text-slate-700 flex-1">{c.label}</span>
                      <span className="text-xs text-slate-400">{c.count} file{c.count === 1 ? "" : "s"}</span>
                      <span className="text-sm font-medium text-slate-700 w-20 text-right tabular-nums">{fmt(c.bytes)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
