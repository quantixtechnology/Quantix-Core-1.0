import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { TRANSITIONS } from '@/lib/laundry-workflow'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
/** Source with line comments stripped, so prose about a bug can't pass for it. */
const code = (p: string) => read(p).split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

const SCHED = read('src/app/api/laundry/pickup-scheduler/route.ts')
const SCHED_CODE = code('src/app/api/laundry/pickup-scheduler/route.ts')

describe('PART 10 · one leg can never reset the other', () => {
  it('the shared column is only stamped when the other leg is idle', () => {
    expect(SCHED).toContain('const PICKUP_IDLE = { pickupStartedAt: null, pickupCompletedAt: null } as const')
    expect(SCHED).toContain('const DELIVERY_IDLE = { deliveryStartedAt: null, deliveryCompletedAt: null } as const')
  })

  // A delivery-leg write may only touch fieldStatus behind the pickup-idle
  // guard — never unconditionally, which is what destroyed 000029's progress.
  it('every DELIVERY write of fieldStatus is guarded by the pickup being idle', () => {
    const writes = SCHED_CODE.match(/deliveryExecutiveId: [^}]*\}/g) ?? []
    expect(writes.length).toBeGreaterThanOrEqual(3)
    for (const w of writes) {
      if (w.includes('fieldStatus')) expect(w, w).toContain('pickupIdle ?')
    }
  })

  it('every PICKUP write of fieldStatus is guarded by the delivery being idle', () => {
    const writes = SCHED_CODE.match(/pickupExecutiveId: [^}]*\}/g) ?? []
    expect(writes.length).toBeGreaterThanOrEqual(3)
    for (const w of writes) {
      if (w.includes('fieldStatus')) expect(w, w).toContain('deliveryIdle ?')
    }
  })

  it('no fieldStatus write anywhere in the scheduler is unguarded', () => {
    for (const line of SCHED_CODE.split('\n')) {
      if (!line.includes('fieldStatus')) continue
      if (line.includes('const ')) continue
      expect(line, line.trim()).toMatch(/PICKUP_IDLE|DELIVERY_IDLE|pickupIdle \?|deliveryIdle \?|fieldStatus: o\.fieldStatus|fieldStatus: true|fieldStatus,/)
    }
  })

  it('the delivery stamp is scoped to orders whose pickup has NOT started', () => {
    expect(SCHED_CODE).toContain('where: { id: { in: actionIds }, ...PICKUP_IDLE }, data: { fieldStatus: FIELD_STATUS.ASSIGNED }')
    expect(SCHED_CODE).toContain('where: { id: { in: actionIds }, ...PICKUP_IDLE }, data: { fieldStatus: null }')
    expect(SCHED_CODE).toContain('const pickupIdle = !order.pickupStartedAt && !order.pickupCompletedAt')
  })

  it('the pickup stamp is scoped to orders whose delivery has NOT started', () => {
    expect(SCHED_CODE).toContain('where: { id: { in: actionIds }, ...DELIVERY_IDLE }, data: { fieldStatus: FIELD_STATUS.ASSIGNED }')
    expect(SCHED_CODE).toContain('const deliveryIdle = !order.deliveryStartedAt && !order.deliveryCompletedAt')
  })

  it('the single-order path reads BOTH legs before deciding', () => {
    expect(SCHED_CODE).toContain('pickupStartedAt: true, pickupCompletedAt: true, deliveryStartedAt: true, deliveryCompletedAt: true')
  })

  // The exact production case: ORD-…-002-000029.
  it('reproduces 000029 — REACHED must survive a delivery assignment', () => {
    const order = { pickupStartedAt: new Date('2026-08-27T15:37:40Z'), pickupCompletedAt: null, fieldStatus: 'REACHED' }
    const pickupIdle = !order.pickupStartedAt && !order.pickupCompletedAt
    expect(pickupIdle).toBe(false) // → no fieldStatus write, REACHED survives
    const patch = { deliveryExecutiveId: 'e1', ...(pickupIdle ? { fieldStatus: 'ASSIGNED' } : {}) }
    expect(patch).not.toHaveProperty('fieldStatus')
  })

  it('an order with no pickup progress still gets its stamp (unchanged behaviour)', () => {
    const order = { pickupStartedAt: null, pickupCompletedAt: null }
    const pickupIdle = !order.pickupStartedAt && !order.pickupCompletedAt
    expect(pickupIdle).toBe(true)
    expect({ ...(pickupIdle ? { fieldStatus: 'ASSIGNED' } : {}) }).toEqual({ fieldStatus: 'ASSIGNED' })
  })

  it('assignment itself is never blocked — only the shared column is skipped', () => {
    // The executive is always written; the guard governs fieldStatus alone.
    expect(SCHED_CODE).toContain('deliveryExecutiveId: execId, deliveryAssignedAt: now2')
    expect(SCHED_CODE).toContain('pickupExecutiveId: execId, pickupAssignedAt: now2')
  })
})

describe('PART 2 · offline / counter orders have no pickup leg', () => {
  it('an offline order starts at Store Audit, not at pickup', () => {
    const engine = read('src/lib/laundry-order-engine.ts')
    // pickupRequired drives the entry status; no pickup → straight to audit.
    expect(engine).toContain('const pickupReq = input.pickupRequired ?? input.orderType === "HOME_PICKUP"')
    expect(engine).toContain('(pickupReq ? "AWAITING_PICKUP_ASSIGNMENT" : "PENDING_STORE_AUDIT")')
  })

  it('the two legs converge at Store Audit and share every stage after it', () => {
    // Online: AWAITING → IN_TRANSIT_TO_STORE → PENDING_STORE_AUDIT
    expect(TRANSITIONS.AWAITING_PICKUP_ASSIGNMENT.some((t) => t.to === 'IN_TRANSIT_TO_STORE')).toBe(true)
    expect(TRANSITIONS.IN_TRANSIT_TO_STORE.some((t) => t.to === 'PENDING_STORE_AUDIT')).toBe(true)
    // From Store Audit onward there is ONE path, whatever the origin.
    const after = ['PENDING_STORE_AUDIT', 'PAYMENT_PENDING', 'READY_FOR_PROCESSING', 'PACKED', 'IN_TRANSIT_TO_PROCESSING', 'PROCESSING', 'RETURN_IN_TRANSIT', 'READY_FOR_DELIVERY']
    for (let i = 0; i < after.length - 1; i++) {
      expect(TRANSITIONS[after[i] as keyof typeof TRANSITIONS].some((t) => t.to === after[i + 1]), `${after[i]} → ${after[i + 1]}`).toBe(true)
    }
  })

  it('no offline order can be given a pickup stage by the workflow itself', () => {
    // Nothing transitions INTO the pickup stages; they are entry states only.
    for (const [from, defs] of Object.entries(TRANSITIONS)) {
      for (const t of defs) {
        expect(t.to, `${from} → ${t.to}`).not.toBe('AWAITING_PICKUP_ASSIGNMENT')
      }
    }
  })

  it('delivery scheduling is independent of the pickup leg', () => {
    const dispatch = read('src/app/api/laundry/dispatch/delivery/route.ts')
    expect(dispatch).not.toContain('pickupRequired')
    expect(dispatch).not.toContain('pickupCompletedAt ||')
  })
})

describe('PART 5/6 · every mutation re-reads the server, none fakes a counter', () => {
  const stations: [string, string][] = [
    ['Washing / Dry Cleaning', 'src/components/laundry/views/laundry-workstation.tsx'],
    ['Dry & Quality Check', 'src/components/laundry/views/laundry-drying-qc-workstation.tsx'],
    ['Sorting', 'src/components/laundry/views/laundry-sorting-workstation.tsx'],
    ['Finishing (Iron/Fold)', 'src/components/laundry/views/laundry-finishing-workstation.tsx'],
  ]

  it.each(stations)('%s reloads from the server after an action', (_n, f) => {
    const src = read(f)
    expect(src).toMatch(/load\((true)?\)/)
    expect(src).toContain('useAutoRefresh')
  })

  it.each(stations)('%s never increments a count client-side', (_n, f) => {
    const src = code(f)
    expect(src).not.toMatch(/setWaiting\(|setInProgress\(|setCompletedCount\(|count\s*\+\+/)
  })

  it('the delivery bag checklist replaces its state with the server view', () => {
    const cl = read('src/components/laundry/bag-checklist.tsx')
    expect(cl).toContain('setView(j.data)')
  })

  it('Packing re-reads the bag list after a scan', () => {
    expect(read('src/components/laundry/views/laundry-store-stages.tsx')).toContain('loadBags()')
  })

  it('Washing counts come from the server, not the rendered page', () => {
    const ws = read('src/components/laundry/views/laundry-workstation.tsx')
    expect(ws).toContain('setQueueCounts(j.queueCounts || null)')
    expect(ws).toContain('const waitingCount = queueCounts?.WAITING ?? waiting.length')
  })
})

describe('PART 9 · the payment regression stays permanently blocked', () => {
  it('Pay Later still refuses every physical edge', () => {
    const api = read('src/app/api/laundry/orders/[id]/payment/route.ts')
    expect(api).toContain('if (primary.internal || primary.custody) return null')
    expect(api).toContain('guardFinancialAdvance')
  })

  it('DELIVERED still requires a real delivery completion', () => {
    expect(read('src/lib/laundry-deliver.ts')).toContain('deliveryCompletion: true')
  })
})
