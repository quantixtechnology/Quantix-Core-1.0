// Garment processing stage engine — routes each garment through the correct
// department sequence based on its service, so scanning a barcode automatically
// moves it into the right queue (no manual reassignment).

export const STAGE_LABELS: Record<string, string> = {
  RECEIVED: "Received", SORTING: "Sorting", WASH: "Wash", DRYCLEAN: "Dry Clean",
  DRY: "Dry", STEAM: "Steam", IRON: "Iron", FOLD: "Folding", CLEAN: "Cleaning",
  QC: "Quality Check", PACKED: "Packed", DISPATCHED: "Dispatched to Store",
}
export const DEPARTMENT: Record<string, string> = {
  WASH: "Washing", DRYCLEAN: "Dry Clean", DRY: "Drying", STEAM: "Steam",
  IRON: "Ironing", FOLD: "Folding", CLEAN: "Cleaning", QC: "Quality Check", PACKED: "Packing",
}
// Department workstations shown as separate queues.
export const WORKSTATIONS = ["WASH", "DRYCLEAN", "DRY", "STEAM", "IRON", "FOLD", "QC", "PACKED"] as const

// Service name → ordered processing stages.
export function getFlow(serviceName: string | null | undefined): string[] {
  const s = (serviceName || "").toLowerCase()
  if (s.includes("dry clean")) return ["DRYCLEAN", "IRON", "QC", "PACKED"]
  if (s.includes("steam")) return ["STEAM", "QC", "PACKED"]
  if (s.includes("iron") && !s.includes("wash")) return ["IRON", "QC", "PACKED"]
  if (s.includes("shoe")) return ["CLEAN", "QC", "PACKED"]
  if (s.includes("wash") && s.includes("iron")) return ["WASH", "DRY", "IRON", "QC", "PACKED"]
  if (s.includes("wash") && s.includes("fold")) return ["WASH", "DRY", "FOLD", "QC", "PACKED"]
  if (s.includes("wash")) return ["WASH", "DRY", "QC", "PACKED"]
  if (s.includes("curtain") || s.includes("blanket")) return ["WASH", "DRY", "QC", "PACKED"]
  return ["WASH", "DRY", "IRON", "QC", "PACKED"]
}
export const firstStage = (serviceName: string | null | undefined) => getFlow(serviceName)[0]
export function nextStage(serviceName: string | null | undefined, current: string | null | undefined): string | null {
  const flow = getFlow(serviceName)
  const i = current ? flow.indexOf(current) : -1
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null
}
export const departmentFor = (stage: string | null | undefined) => (stage ? DEPARTMENT[stage] || stage : "")
export const stageLabel = (stage: string | null | undefined) => (stage ? STAGE_LABELS[stage] || stage : "—")
