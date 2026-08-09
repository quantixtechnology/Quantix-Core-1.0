"use client"

// Hardware health at a glance, in the shell header.
//
// Reads the same hardwareHealth() rollup the Hardware dashboard uses, so the
// two can never disagree — a green chip above a red dashboard would destroy
// trust in both. Clicking opens the Hardware Manager.
//
// Presentation only: this never touches a workflow, and if the hardware layer
// has nothing to report it renders the quiet healthy state.

import { useEffect, useState } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { ScanEngine, PrintEngine, eventLog, hardwareHealth } from "@/lib/hardware"
import type { HardwareHealth } from "@/lib/hardware"

export function HardwareHealthChip() {
  const { setLaundryPage } = useAdminStore()
  const [health, setHealth] = useState<HardwareHealth | null>(null)

  useEffect(() => {
    const sync = () => setHealth(hardwareHealth())
    sync()
    ScanEngine.start()
    const offScan = ScanEngine.subscribe(sync)
    const offPrint = PrintEngine.subscribe(sync)
    const offLog = eventLog.subscribe(sync)
    // The scanner rung expires on a timer rather than an event, so poll slowly
    // enough to be invisible and still catch "Scanner Missing".
    const id = setInterval(sync, 30000)
    return () => { offScan(); offPrint(); offLog(); clearInterval(id) }
  }, [])

  if (!health) return null

  const tone = health.level === "HEALTHY"
    ? { dot: "bg-emerald-500", cls: "text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100" }
    : health.level === "DEGRADED"
      ? { dot: "bg-amber-400", cls: "text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100" }
      : { dot: "bg-rose-500", cls: "text-rose-700 border-rose-200 bg-rose-50 hover:bg-rose-100" }

  return (
    <button
      onClick={() => setLaundryPage("hardware-manager")}
      title={health.issues.length ? health.issues.join(" · ") : "All hardware healthy"}
      className={`hidden md:flex items-center gap-1.5 h-7 px-2 rounded-lg border text-[11px] font-medium transition-colors ${tone.cls}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {health.label}
    </button>
  )
}
