import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  summariseWorkload, formatKg, hasRecordedWeight,
  isPendingGarment, isProcessingGarment,
  type WorkloadItem, type WorkloadCompleted,
} from '@/lib/laundry-workload'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const g = (id: string, status: string | null, weightKg?: number | null): WorkloadItem => ({ id, processingStatus: status, weightKg })
const done = (itemId: string, weightKg?: number | null): WorkloadCompleted => ({ itemId, weightKg })
/** n garments at the same status/weight. */
const many = (n: number, prefix: string, status: string, w?: number | null) =>
  Array.from({ length: n }, (_, i) => g(`${prefix}${i}`, status, w))

describe('counts', () => {
  it('100 pending / 12 processing / 88 completed', () => {
    const items = [...many(100, 'p', 'WAITING'), ...many(12, 'x', 'IN_PROGRESS')]
    const completed = Array.from({ length: 88 }, (_, i) => done(`c${i}`))
    const s = summariseWorkload(items, completed)
    expect(s.pending.garments).toBe(100)
    expect(s.processing.garments).toBe(12)
    expect(s.completed.garments).toBe(88)
  })

  it('counts garments, never orders — 16 garments of one order are 16', () => {
    const s = summariseWorkload(many(16, 'ord1-', 'WAITING', 1), [])
    expect(s.pending.garments).toBe(16)
  })

  it('a PAUSED garment counts as In Processing, matching the column', () => {
    const s = summariseWorkload([g('a', 'IN_PROGRESS', 1), g('b', 'PAUSED', 2)], [])
    expect(s.processing.garments).toBe(2)
    expect(s.processing.weightKg).toBe(3)
  })

  it('uses the same predicates as the queue columns', () => {
    // The workstation filters with these exact expressions; the helper exports
    // them so the two cannot drift.
    const ws = read('src/components/laundry/views/laundry-workstation.tsx')
    expect(ws).toContain('i.processingStatus === "WAITING"')
    expect(ws).toContain('i.processingStatus === "IN_PROGRESS" || i.processingStatus === "PAUSED"')
    expect(isPendingGarment(g('a', 'WAITING'))).toBe(true)
    expect(isProcessingGarment(g('a', 'PAUSED'))).toBe(true)
    expect(isProcessingGarment(g('a', 'WAITING'))).toBe(false)
  })
})

describe('weight', () => {
  it('sums the recorded kg per bucket', () => {
    const items = [
      ...Array.from({ length: 10 }, (_, i) => g(`p${i}`, 'WAITING', 4.26)),
      g('x1', 'IN_PROGRESS', 2.9), g('x2', 'IN_PROGRESS', 2.9),
    ]
    const s = summariseWorkload(items, [done('c1', 20.4), done('c2', 16.4)])
    expect(s.pending.weightKg).toBe(42.6)
    expect(s.processing.weightKg).toBe(5.8)
    expect(s.completed.weightKg).toBe(36.8)
  })

  it('is already kilograms — it never converts', () => {
    expect(summariseWorkload([g('a', 'WAITING', 42.6)], []).pending.weightKg).toBe(42.6)
  })

  it('settles float drift to 2dp', () => {
    const s = summariseWorkload([g('a', 'WAITING', 0.1), g('b', 'WAITING', 0.2)], [])
    expect(s.pending.weightKg).toBe(0.3)
  })

  it('formats for the operator', () => {
    expect(formatKg(42.6)).toBe('42.60 kg')
    expect(formatKg(0)).toBe('0.00 kg')
  })
})

describe('missing weight is surfaced, never counted as zero', () => {
  it('keeps the count right and reports how many are unweighed', () => {
    const s = summariseWorkload(
      [g('a', 'WAITING', 5), g('b', 'WAITING', 0), g('c', 'WAITING', null), g('d', 'WAITING', undefined)],
      [],
    )
    expect(s.pending.garments).toBe(4)     // count unaffected
    expect(s.pending.weightKg).toBe(5)     // only the real weight
    expect(s.pending.missingWeight).toBe(3)
  })

  it('treats 0 and absent alike — the schema default makes them indistinguishable', () => {
    expect(hasRecordedWeight(0)).toBe(false)
    expect(hasRecordedWeight(null)).toBe(false)
    expect(hasRecordedWeight(undefined)).toBe(false)
    expect(hasRecordedWeight(NaN)).toBe(false)
    expect(hasRecordedWeight(-1)).toBe(false)
    expect(hasRecordedWeight(0.01)).toBe(true)
  })

  it('the UI renders the missing-weight note', () => {
    expect(read('src/components/laundry/workload-summary.tsx')).toContain('weight missing')
  })
})

describe('zero and empty states', () => {
  it('0 pending / 0 processing / 10 completed', () => {
    const s = summariseWorkload([], Array.from({ length: 10 }, (_, i) => done(`c${i}`, 1)))
    expect(s.pending).toEqual({ garments: 0, weightKg: 0, missingWeight: 0 })
    expect(s.processing).toEqual({ garments: 0, weightKg: 0, missingWeight: 0 })
    expect(s.completed.garments).toBe(10)
  })

  it('an empty stage is all zeros, and reports no missing weight', () => {
    const s = summariseWorkload([], [])
    expect(s.pending.missingWeight).toBe(0)
    expect(s.completed.missingWeight).toBe(0)
  })

  it('loading shows a skeleton, not a misleading zero', () => {
    const ui = read('src/components/laundry/workload-summary.tsx')
    expect(ui).toContain('if (loading)')
    expect(ui).toContain('animate-pulse')
  })
})

describe('reclassification moves count AND weight together', () => {
  it('Pending → Processing', () => {
    const before = summariseWorkload([g('a', 'WAITING', 3.5), g('b', 'WAITING', 1)], [])
    expect(before.pending).toMatchObject({ garments: 2, weightKg: 4.5 })
    const after = summariseWorkload([g('a', 'IN_PROGRESS', 3.5), g('b', 'WAITING', 1)], [])
    expect(after.pending).toMatchObject({ garments: 1, weightKg: 1 })
    expect(after.processing).toMatchObject({ garments: 1, weightKg: 3.5 })
  })

  it('Processing → Completed', () => {
    const after = summariseWorkload([g('b', 'WAITING', 1)], [done('a', 3.5)])
    expect(after.processing.garments).toBe(0)
    expect(after.completed).toMatchObject({ garments: 1, weightKg: 3.5 })
  })
})

describe('a garment is never in two buckets', () => {
  it('de-duplicates a garment completed twice through this stage (rework)', () => {
    const s = summariseWorkload([], [done('a', 2), done('a', 2), done('b', 3)])
    expect(s.completed.garments).toBe(2)
    expect(s.completed.weightKg).toBe(5)
  })

  it('a garment sent back for rework counts where it is now, not in Completed', () => {
    const s = summariseWorkload([g('a', 'WAITING', 2)], [done('a', 2), done('b', 3)])
    expect(s.pending.garments).toBe(1)
    expect(s.completed.garments).toBe(1) // only b
    const ids = ['a']
    expect(ids.length).toBe(1)
  })

  it('every live garment appears in exactly one of the two live buckets', () => {
    const items = [g('a', 'WAITING'), g('b', 'IN_PROGRESS'), g('c', 'PAUSED')]
    const s = summariseWorkload(items, [])
    expect(s.pending.garments + s.processing.garments).toBe(items.length)
    for (const i of items) expect(Number(isPendingGarment(i)) + Number(isProcessingGarment(i))).toBe(1)
  })
})

describe('it is a read model — no workflow surface', () => {
  it('the helper performs no writes and knows nothing about transitions', () => {
    const lib = read('src/lib/laundry-workload.ts')
    for (const forbidden of ['prisma', 'fetch(', 'update', 'status:', 'DELIVERED', 'PACKED']) {
      expect(lib, `workload helper must not reference ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('the summary is derived per render, never stored in state', () => {
    const ws = read('src/components/laundry/views/laundry-workstation.tsx')
    expect(ws).toContain('const workload = summariseWorkload(items, completed')
    expect(ws).not.toContain('setWorkload')
    expect(ws).not.toContain('useState<WorkloadSummary')
  })

  it('shows on Washing and Dry Cleaning, and the queue columns are untouched', () => {
    const ws = read('src/components/laundry/views/laundry-workstation.tsx')
    expect(ws).toContain('const SHOW_WORKLOAD_SUMMARY = new Set(["WASH", "DRYCLEAN"])')
    expect(ws).toContain('md:grid-cols-3') // the three columns still there
    expect(ws).toContain('Nothing waiting.')
  })

  it('the API exposes the stored weight and writes nothing', () => {
    const api = read('src/app/api/laundry/processing/route.ts')
    expect(api).toContain('weightKg: r.weightKg')
    expect(api).toContain('weightKg: it?.weightKg ?? null')
    expect(api).not.toContain('laundryOrderItem.update')
    expect(api).not.toContain('laundryOrder.update')
  })
})
