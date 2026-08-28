"use client"

// Workstation workload summary — the operator's at-a-glance load.
//
// Presentational only. It receives the summary computed from the very rows the
// three queue columns render (see src/lib/laundry-workload.ts) and displays
// them; it holds no state, fetches nothing and can never disagree with the
// columns below it.

import { Clock, Loader2, CheckCircle2 } from "lucide-react"
import { formatKg, type WorkloadBucket, type WorkloadSummary } from "@/lib/laundry-workload"

const TILES = [
  { key: "pending", label: "Pending", icon: Clock, accent: "text-amber-600", ring: "border-amber-200", tint: "bg-amber-50/50" },
  { key: "processing", label: "In Processing", icon: Loader2, accent: "text-blue-600", ring: "border-blue-200", tint: "bg-blue-50/50" },
  { key: "completed", label: "Completed", icon: CheckCircle2, accent: "text-emerald-600", ring: "border-emerald-200", tint: "bg-emerald-50/50" },
] as const

function Tile({ label, icon: Icon, accent, ring, tint, bucket }: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  accent: string; ring: string; tint: string
  bucket: WorkloadBucket
}) {
  return (
    <div className={`rounded-xl border ${ring} ${tint} px-4 py-3`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wider ${accent} flex items-center gap-1.5`}>
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      {/* tabular-nums so the figures don't jitter as they refresh */}
      <p className="mt-1 text-4xl font-bold leading-none tabular-nums text-slate-900">{bucket.garments}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">garment{bucket.garments === 1 ? "" : "s"}</p>
      <p className="mt-1.5 text-lg font-semibold tabular-nums text-slate-700">{formatKg(bucket.weightKg)}</p>
      {/* Never presented as a complete total when it isn't one. */}
      {bucket.missingWeight > 0 && (
        <p className="text-[11px] font-medium text-amber-700 mt-0.5">
          {bucket.missingWeight} weight missing
        </p>
      )}
    </div>
  )
}

const Skeleton = () => (
  <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 animate-pulse">
    <div className="h-3 w-20 rounded bg-slate-200" />
    <div className="mt-2 h-9 w-16 rounded bg-slate-200" />
    <div className="mt-2 h-3 w-14 rounded bg-slate-200" />
    <div className="mt-2 h-5 w-20 rounded bg-slate-200" />
  </div>
)

export function LaundryWorkloadSummary({ summary, loading }: { summary: WorkloadSummary; loading?: boolean }) {
  // A skeleton, never zeros — "0 garments" during a load reads as an empty
  // department and would send an operator away from real work.
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Skeleton /><Skeleton /><Skeleton />
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {TILES.map((t) => <Tile key={t.key} label={t.label} icon={t.icon} accent={t.accent} ring={t.ring} tint={t.tint} bucket={summary[t.key]} />)}
    </div>
  )
}
