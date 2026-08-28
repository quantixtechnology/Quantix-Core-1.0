// ============================================================================
// Workstation WORKLOAD SUMMARY — a read model, nothing else.
//
// Derives "how much work is in front of this operator" from the EXACT same rows
// the workstation's three columns already render. There is no second tracking
// system, no stored counter and no React state of its own: give it the arrays
// the screen is showing and it returns what those arrays contain. If the
// columns are right, the summary is right, and they refresh together.
//
// Deliberately NOT here: any status write, any weight write, any estimate. A
// garment's weight is whatever was recorded on it; this only adds the numbers up.
// ============================================================================

/** A live garment in this stage's queue — the shape the workstation renders. */
export interface WorkloadItem {
  id: string
  processingStatus?: string | null
  weightKg?: number | null
}

/** A row of this stage's completed history (one per COMPLETE / QC_PASS event). */
export interface WorkloadCompleted {
  itemId: string
  weightKg?: number | null
}

export interface WorkloadBucket {
  /** Physical garments — never orders. One LaundryOrderItem is one garment. */
  garments: number
  /** Sum of the recorded weights, in kg. Excludes garments with none. */
  weightKg: number
  /** Garments in this bucket with NO recorded weight — surfaced, never zeroed. */
  missingWeight: number
}

export interface WorkloadSummary {
  pending: WorkloadBucket
  processing: WorkloadBucket
  completed: WorkloadBucket
}

// The column predicates, in one place, so the summary and the queues cannot
// drift apart. These mirror laundry-workstation.tsx exactly:
//   Waiting     → WAITING
//   In Progress → IN_PROGRESS or PAUSED (a paused garment is still on the bench)
export const isPendingGarment = (i: WorkloadItem) => i.processingStatus === "WAITING"
export const isProcessingGarment = (i: WorkloadItem) =>
  i.processingStatus === "IN_PROGRESS" || i.processingStatus === "PAUSED"

/**
 * Weight is stored on LaundryOrderItem.weightKg — already kilograms, with a
 * schema default of 0. A garment that was never weighed is therefore
 * indistinguishable from one weighed at 0, so "recorded" means a POSITIVE
 * weight. Anything else is reported as missing rather than silently summed as
 * zero, which would understate the load and look like real data.
 */
export const hasRecordedWeight = (w: number | null | undefined): w is number =>
  typeof w === "number" && Number.isFinite(w) && w > 0

const emptyBucket = (): WorkloadBucket => ({ garments: 0, weightKg: 0, missingWeight: 0 })

function bucketOf(weights: (number | null | undefined)[]): WorkloadBucket {
  const b = emptyBucket()
  for (const w of weights) {
    b.garments++
    if (hasRecordedWeight(w)) b.weightKg += w
    else b.missingWeight++
  }
  // Float addition drifts; the display shows 2dp, so settle it here once.
  b.weightKg = Math.round(b.weightKg * 100) / 100
  return b
}

/**
 * Summarise a workstation's current load.
 *
 * `completed` is an EVENT history, so it needs two corrections to stay a count
 * of garments rather than of events:
 *
 *   • de-duplicated by garment — a garment reworked through this stage twice has
 *     two COMPLETE events but is still one garment;
 *   • a garment that is back in this stage's live queue (QC sent it for rework)
 *     counts where it actually is now, not in Completed as well. Nothing may
 *     appear in two buckets at once.
 */
export function summariseWorkload(
  items: WorkloadItem[],
  completed: WorkloadCompleted[],
): WorkloadSummary {
  const live = new Set(items.map((i) => i.id))

  const seen = new Set<string>()
  const completedWeights: (number | null | undefined)[] = []
  for (const c of completed) {
    if (!c.itemId || seen.has(c.itemId) || live.has(c.itemId)) continue
    seen.add(c.itemId)
    completedWeights.push(c.weightKg)
  }

  return {
    pending: bucketOf(items.filter(isPendingGarment).map((i) => i.weightKg)),
    processing: bucketOf(items.filter(isProcessingGarment).map((i) => i.weightKg)),
    completed: bucketOf(completedWeights),
  }
}

/** "42.60 kg" — two decimals, the precision an operator actually reads. */
export const formatKg = (kg: number): string => `${kg.toFixed(2)} kg`
