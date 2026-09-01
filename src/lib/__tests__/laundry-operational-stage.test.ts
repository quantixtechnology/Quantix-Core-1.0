import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  operationalStage, operationalStageLabel, operationalQueues,
  PROCESSING_QUEUES, STATUS_QUEUES, UNASSIGNED, stagesBefore, stagesForKey,
} from '@/lib/laundry-operational-stage'
import { STORE_COUNTER_QUEUES } from '@/lib/laundry-workflow'

// ============================================================================
// OPERATIONAL STAGE — the queue an order is actually waiting in.
//
// LaundryOrder.status cannot answer that: PROCESSING is true of a garment being
// washed, one at Quality Check and one waiting for a barcode. The queue lives in
// the garments' processingStage inside the Processing Centre and in the status
// everywhere else — and ONE rule serves the row label, the dropdown and the
// filter so they cannot drift apart.
// ============================================================================

const at = (status: string, ...itemStages: (string | null)[]) => ({ status, itemStages })

describe('store-side queues come from the order status', () => {
  const cases: [string, string][] = [
    ['PENDING_STORE_AUDIT', 'Store Audit'],
    ['PAYMENT_PENDING', 'Payment Collection'],
    ['READY_FOR_PROCESSING', 'Packing & QR'],
    ['IN_TRANSIT_TO_PROCESSING', 'Console & Receive'],
    ['RETURN_IN_TRANSIT', 'Store Receive'],
    ['READY_FOR_DELIVERY', 'Ready for Delivery'],
    ['DELIVERED', 'Delivered'],
    ['CANCELLED', 'Cancelled'],
  ]
  for (const [status, label] of cases) {
    it(`${status} → ${label}`, () => {
      expect(operationalStageLabel(at(status))).toBe(label)
    })
  }

  it('the names are the workflow\'s own, not a second vocabulary', () => {
    for (const q of STORE_COUNTER_QUEUES) {
      const mapped = STATUS_QUEUES.find((s) => s.status === q.status)
      if (mapped) expect(mapped.label).toBe(q.title)
    }
  })
})

describe('inside the Processing Centre the GARMENTS decide, not the status', () => {
  it('PROCESSING + RECEIVED → Barcode Generation, never "In Processing"', () => {
    expect(operationalStageLabel(at('PROCESSING', 'RECEIVED'))).toBe('Barcode Generation')
  })

  it('PROCESSING + WASH → Washing', () => {
    expect(operationalStageLabel(at('PROCESSING', 'WASH'))).toBe('Washing')
  })

  it('PROCESSING + DRYCLEAN → Dry Cleaning', () => {
    expect(operationalStageLabel(at('PROCESSING', 'DRYCLEAN'))).toBe('Dry Cleaning')
  })

  it('PROCESSING + IRON → Ironing, + FOLD → Folding, + SORTING → Sorting', () => {
    expect(operationalStageLabel(at('PROCESSING', 'IRON'))).toBe('Ironing')
    expect(operationalStageLabel(at('PROCESSING', 'FOLD'))).toBe('Folding')
    expect(operationalStageLabel(at('PROCESSING', 'SORTING'))).toBe('Sorting')
  })

  it('DRY and QC are one screen and read as one queue', () => {
    expect(operationalStageLabel(at('PROCESSING', 'QC'))).toBe('Dry & Quality Check')
    expect(operationalStageLabel(at('PROCESSING', 'DRY'))).toBe('Dry & Quality Check')
  })

  it('THE POINT: the generic status never wins over a real queue', () => {
    for (const st of ['RECEIVED', 'WASH', 'DRYCLEAN', 'QC', 'SORTING', 'IRON', 'FOLD']) {
      const label = operationalStageLabel(at('PROCESSING', st))
      expect(label).not.toBe('In Processing')
      expect(label).not.toBe('Processing')
    }
  })

  it('a garment barcoded while the order still says in-transit shows the real queue', () => {
    expect(operationalStageLabel(at('IN_TRANSIT_TO_PROCESSING', 'RECEIVED'))).toBe('Barcode Generation')
  })
})

describe('multi-garment orders are deterministic — slowest garment wins', () => {
  // The rule is the Processing dashboard's own: "The EARLIEST stage still
  // present is where the order really is."
  it('WASH + FOLD reads as Washing, not Folding', () => {
    expect(operationalStageLabel(at('PROCESSING', 'FOLD', 'WASH'))).toBe('Washing')
  })

  it('the answer does not depend on garment order', () => {
    expect(operationalStageLabel(at('PROCESSING', 'WASH', 'FOLD')))
      .toBe(operationalStageLabel(at('PROCESSING', 'FOLD', 'WASH')))
  })

  it('RECEIVED beats everything downstream', () => {
    expect(operationalStageLabel(at('PROCESSING', 'FOLD', 'QC', 'RECEIVED'))).toBe('Barcode Generation')
  })

  it('nulls are ignored rather than treated as a queue', () => {
    expect(operationalStageLabel(at('PROCESSING', null, 'IRON'))).toBe('Ironing')
  })
})

describe('the generic fallback is used ONLY when nothing more specific exists', () => {
  it('PROCESSING with no garment stage falls back, and says so plainly', () => {
    const q = operationalStage(at('PROCESSING'))
    expect(q.key).toBe(UNASSIGNED.key)
    expect(q.label).toBe('In Processing (no queue yet)')
  })

  it('the fallback disappears the moment a garment has a stage', () => {
    expect(operationalStage(at('PROCESSING', 'WASH')).key).not.toBe(UNASSIGNED.key)
  })
})

describe('the dropdown and the row label are the same mapping', () => {
  const queues = operationalQueues()

  it('offers real queues, never a raw workflow status', () => {
    const labels = queues.map((q) => q.label)
    expect(labels).toContain('Store Audit')
    expect(labels).toContain('Console & Receive')
    expect(labels).toContain('Barcode Generation')
    expect(labels).toContain('Washing')
    expect(labels).toContain('Dry Cleaning')
    expect(labels).toContain('Ironing')
    expect(labels).toContain('Folding')
    expect(labels).toContain('Packing & QR')
    expect(labels).toContain('Ready for Delivery')
    expect(labels).not.toContain('In Processing')
    expect(labels).not.toContain('Processing')
  })

  it('every option is unique — Dry & Quality Check appears once, not twice', () => {
    const labels = queues.map((q) => q.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('EVERY label a row can show is an option in the dropdown', () => {
    // The invariant that stops the table and the filter drifting apart.
    const options = new Set(queues.map((q) => q.label))
    const rows = [
      at('PENDING_STORE_AUDIT'), at('PAYMENT_PENDING'), at('READY_FOR_PROCESSING'),
      at('IN_TRANSIT_TO_PROCESSING'), at('RETURN_IN_TRANSIT'), at('READY_FOR_DELIVERY'),
      at('DELIVERED'), at('CANCELLED'), at('PROCESSING'),
      ...PROCESSING_QUEUES.map((q) => at('PROCESSING', q.stage!)),
    ]
    for (const r of rows) expect(options, operationalStageLabel(r)).toContain(operationalStageLabel(r))
  })
})

describe('selecting a queue returns that queue and no other', () => {
  // stagesBefore is what the server turns into the `none` clause that makes
  // "earliest wins" hold in SQL as well as in the label.
  it('Washing excludes anything still at Barcode Generation', () => {
    expect(stagesBefore('WASH')).toContain('RECEIVED')
  })

  it('Folding excludes every earlier station', () => {
    const earlier = stagesBefore('FOLD')
    for (const st of ['RECEIVED', 'WASH', 'DRYCLEAN', 'QC', 'SORTING', 'IRON']) {
      expect(earlier, st).toContain(st)
    }
  })

  it('Barcode Generation is first, so nothing precedes it', () => {
    expect(stagesBefore('RECEIVED')).toEqual([])
  })

  it('an order at WASH + FOLD answers to Washing but NOT to Folding', () => {
    // Label side.
    expect(operationalStageLabel(at('PROCESSING', 'WASH', 'FOLD'))).toBe('Washing')
    // Filter side: Folding excludes WASH, so the same order is not returned.
    expect(stagesBefore('FOLD')).toContain('WASH')
  })

  it('the QC queue covers both stages it owns', () => {
    expect(stagesForKey('PC_QC').sort()).toEqual(['DRY', 'QC'])
  })
})

// ── the wiring ──────────────────────────────────────────────────────────────
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const API = read('src/app/api/laundry/orders/route.ts')
const VIEW = read('src/components/laundry/views/laundry-orders-view.tsx')
const PREFS = read('src/app/api/laundry/user-preferences/route.ts')
const LIB = read('src/lib/laundry-operational-stage.ts')

describe('one rule, three consumers', () => {
  it('the API derives the row stage from the shared rule', () => {
    expect(API).toContain('from "@/lib/laundry-operational-stage"')
    expect(API).toContain('operationalStage({ status: o.status as string, itemStages:')
  })

  it('the API filter is built from the same rule, not a second list', () => {
    expect(API).toContain('stagesForKey(opStage)')
    expect(API).toContain('stagesBefore(st)')
  })

  it('the dropdown is built from the same rule', () => {
    expect(VIEW).toContain('const OP_FILTERS = operationalQueues()')
    expect(VIEW).toContain('All Operational Stages')
  })

  it('the row shows the server-derived stage rather than recomputing it', () => {
    expect(VIEW).toContain('{o.operationalStage || statusLabel(o.status)}')
    expect(VIEW).toContain('<TableHead>Operational Stage</TableHead>')
  })

  it('the list no longer filters on raw status', () => {
    expect(VIEW).not.toContain('params.set("status", status)')
    expect(VIEW).toContain('params.set("opStage", opStage)')
  })

  it('garment stages are fetched once per page, never per order', () => {
    expect(API).toContain('groupBy({')
    expect(API).toContain('by: ["orderId", "processingStage"]')
  })
})

describe('saved filters belong to one staff member', () => {
  it('the user comes from the session, never from the request', () => {
    expect(PREFS).toContain('guard.ctx.userId')
    // No path by which a caller can name someone else.
    expect(PREFS).not.toMatch(/body\.userId|searchParams\.get\("userId"\)/)
  })

  it('every read and write is keyed by business + user + key', () => {
    for (const op of ['findUnique', 'upsert', 'deleteMany']) expect(PREFS, op).toContain(op)
    expect(PREFS).toContain('businessId_userId_key')
  })

  it('only known keys are stored', () => {
    expect(PREFS).toContain('ALLOWED_KEYS')
    expect(PREFS).toContain('"orders.filter"')
  })

  it('the screen restores, saves and clears', () => {
    expect(VIEW).toContain('const saveFilter = async ()')
    expect(VIEW).toContain('const clearSavedFilter = async ()')
    expect(VIEW).toContain('method: "DELETE"')
  })

  it('clearing returns the screen to the default', () => {
    expect(VIEW).toContain('setOpStage("ALL"); setSearch(""); setPage(0)')
  })

  it('the first load waits for the saved filter, so the list is not fetched twice', () => {
    expect(VIEW).toContain('if (prefLoaded) load()')
  })
})

describe('it is read-only — no workflow was touched', () => {
  it('the rule writes nothing and knows nothing about transitions', () => {
    const code = LIB.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const w of ['prisma', 'fetch(', 'update', 'create', 'transition', 'TRANSITIONS', 'custody']) {
      expect(code, w).not.toContain(w)
    }
  })

  it('the preference endpoint never touches an order', () => {
    expect(PREFS).not.toContain('laundryOrder')
    // "status" appears only as the HTTP response code; no ORDER status, no
    // transition, no workflow vocabulary of any kind.
    expect(PREFS).not.toMatch(/toStatus|fromStatus|LaundryOrderStatus|PENDING_STORE_AUDIT|PROCESSING|DELIVERED/)
  })

  it('the orders API change is confined to reading and filtering', () => {
    // The GET handler gained a filter and a derived field; it still performs no
    // write of its own.
    const get = API.slice(API.indexOf('export async function GET'))
    expect(get).not.toContain('laundryOrder.update')
    expect(get).not.toContain('laundryOrderItem.update')
  })
})
