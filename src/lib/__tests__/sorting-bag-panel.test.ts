import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { sortingBagStatus, activeBagForService, type SortingBagRow } from '@/lib/laundry-sorting-bags'

// ============================================================================
// THE COMPLETE SORTING CARD ANSWERS ONE QUESTION.
//
// "Which bag is attached to this order?" — and when none is, "stop and attach
// one". It used to render the shared bag-management panel instead: Bags 2,
// Bag 1 of 2, Closed, On this order, Add Another Bag. Every line true, none of
// it the question, and staff were left interpreting a lifecycle.
//
// sortingBagStatus reads the SAME canonical assignment rows the rest of Sorting
// reads, through bagsForService — so a closed bag, a pickup bag, a delivery bag
// and a row whose role was never recorded are excluded by one rule, not by a
// second opinion invented for this panel.
// ============================================================================

const bag = (over: Partial<SortingBagRow> & { bagNumber: string }): SortingBagRow => ({
  serviceId: 's1', serviceName: 'Wash & Fold', open: true,
  assignedAt: '2026-09-01T10:00:00Z', purpose: 'SORTING', ...over,
})
const SVC = [{ id: 's1', name: 'Wash & Fold' }]

describe('1 · one attached sorting bag', () => {
  it('reports the bag number and is ready', () => {
    const st = sortingBagStatus([bag({ bagNumber: 'V8BAG044' })], SVC)
    expect(st.attached).toEqual(['V8BAG044'])
    expect(st.missingFor).toEqual([])
    expect(st.ready).toBe(true)
  })

  it('agrees with the canonical active-bag reader', () => {
    const rows = [bag({ bagNumber: 'V8BAG044' })]
    expect(activeBagForService(rows, 's1', 'Wash & Fold')?.bagNumber).toBe('V8BAG044')
    expect(sortingBagStatus(rows, SVC).attached).toContain('V8BAG044')
  })
})

describe('2 · no attached sorting bag', () => {
  it('is not ready and names what is missing', () => {
    const st = sortingBagStatus([], SVC)
    expect(st.attached).toEqual([])
    expect(st.ready).toBe(false)
    expect(st.missingFor).toEqual(['Wash & Fold'])
  })

  it('an order with no services at all still reports not-ready', () => {
    expect(sortingBagStatus([], []).ready).toBe(false)
  })
})

describe('7 · historical, closed and unrelated bags are never the attached bag', () => {
  it('a CLOSED sorting bag does not count as attached', () => {
    const st = sortingBagStatus([bag({ bagNumber: 'OLD1', open: false })], SVC)
    expect(st.attached).toEqual([])
    expect(st.ready).toBe(false)
  })

  it('a PICKUP bag is not a sorting bag', () => {
    const st = sortingBagStatus([bag({ bagNumber: 'PICK1', purpose: 'PICKUP' })], SVC)
    expect(st.attached).toEqual([])
    expect(st.ready).toBe(false)
  })

  it('a DELIVERY bag is not a sorting bag', () => {
    expect(sortingBagStatus([bag({ bagNumber: 'DEL1', purpose: 'DELIVERY' })], SVC).ready).toBe(false)
  })

  it('a row whose purpose was never recorded cannot claim to be one', () => {
    expect(sortingBagStatus([bag({ bagNumber: 'UNK1', purpose: null })], SVC).ready).toBe(false)
  })

  it('the open sorting bag is reported even when history sits beside it', () => {
    const st = sortingBagStatus([
      bag({ bagNumber: 'OLD1', open: false, assignedAt: '2026-08-01T10:00:00Z' }),
      bag({ bagNumber: 'PICK1', purpose: 'PICKUP' }),
      bag({ bagNumber: 'V8BAG044', assignedAt: '2026-09-01T12:00:00Z' }),
    ], SVC)
    expect(st.attached).toEqual(['V8BAG044'])
    expect(st.ready).toBe(true)
  })
})

describe('6 · existing multi-bag behaviour is preserved', () => {
  it('two open sorting bags for one service are BOTH listed, oldest first', () => {
    const st = sortingBagStatus([
      bag({ bagNumber: 'V8BAG044', assignedAt: '2026-09-01T10:00:00Z' }),
      bag({ bagNumber: 'V8BAG118', assignedAt: '2026-09-01T11:00:00Z' }),
    ], SVC)
    expect(st.attached).toEqual(['V8BAG044', 'V8BAG118'])
    expect(st.ready).toBe(true)
  })

  it('the newest is still the ACTIVE bag for scanning — unchanged', () => {
    const rows = [
      bag({ bagNumber: 'V8BAG044', assignedAt: '2026-09-01T10:00:00Z' }),
      bag({ bagNumber: 'V8BAG118', assignedAt: '2026-09-01T11:00:00Z' }),
    ]
    expect(activeBagForService(rows, 's1', 'Wash & Fold')?.bagNumber).toBe('V8BAG118')
  })

  it('two services each need their own bag', () => {
    const two = [{ id: 's1', name: 'Wash & Fold' }, { id: 's2', name: 'Dry Clean' }]
    const partial = sortingBagStatus([bag({ bagNumber: 'V8BAG044' })], two)
    expect(partial.ready).toBe(false)
    expect(partial.missingFor).toEqual(['Dry Clean'])
    const both = sortingBagStatus([
      bag({ bagNumber: 'V8BAG044' }),
      bag({ bagNumber: 'V8BAG200', serviceId: 's2', serviceName: 'Dry Clean' }),
    ], two)
    expect(both.ready).toBe(true)
    expect(both.attached).toEqual(['V8BAG044', 'V8BAG200'])
  })

  it('one bag serving both services is listed once, not twice', () => {
    const two = [{ id: 's1', name: 'Wash & Fold' }, { id: 's2', name: 'Dry Clean' }]
    const st = sortingBagStatus([
      bag({ bagNumber: 'SHARED', serviceId: null, serviceName: null }),
    ], two)
    expect(st.attached).toEqual(['SHARED'])
  })
})

// ── The workstation wiring ──────────────────────────────────────────────────
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const WS = read('src/components/laundry/views/laundry-sorting-workstation.tsx')
const SHARED_PANEL = 'src/components/laundry/order-bag-list.tsx'

describe('3-4 · the card states the bag, or stops the operator', () => {
  it('the Complete Sorting card renders the simple panel, not the bag manager', () => {
    // Takes the rows the workstation already holds — no per-card fetch.
    expect(WS).toContain('<SortingBagPanel bags={bagsByOrder[o.orderId] || []}')
    expect(WS).not.toContain('<SortingOrderBags')
    // The shared bag-management panel is no longer rendered on this screen,
    // and this screen no longer imports it at all.
    expect(WS).not.toMatch(/<OrderBagList[\s\n]/)
    expect(WS).not.toContain('order-bag-list')
  })

  it('4 · an attached bag shows the number and Ready for Sorting', () => {
    expect(WS).toContain('Sorting Bag{many ? "s" : ""}')
    expect(WS).toContain('Bag{many ? "s" : ""} attached:')
    expect(WS).toContain('✓ Ready for Sorting')
    expect(WS).toContain('{status.attached.map((code) =>')
  })

  it('2 · no bag shows the BAG REQUIRED warning with the required action', () => {
    expect(WS).toContain('⚠ Bag Required')
    expect(WS).toContain('No sorting bag is attached to this order.')
    expect(WS).toContain('Attach a sorting bag before completing sorting.')
    expect(WS).toContain('if (!status.ready)')
  })

  it('the lifecycle vocabulary is gone from this card', () => {
    const panel = WS.slice(WS.indexOf('function SortingBagPanel'), WS.indexOf('export function LaundrySortingWorkstation'))
    for (const noise of ['Bag 1 of', 'Closed', 'On this order', 'Add Another Bag', 'ACTIVE', 'FULL']) {
      expect(panel, noise).not.toContain(noise)
    }
  })

  it('the status comes from the canonical reader, not a local rule', () => {
    expect(WS).toContain('sortingBagStatus(bags, services)')
  })
})

describe('LEFT queue card keeps its prompt, with the action named', () => {
  it('still says BAG REQUIRED and now says what to do', () => {
    expect(WS).toContain('⚠ BAG REQUIRED')
    expect(WS).toContain('ATTACH A SORTING BAG BEFORE COMPLETING SORTING')
    expect(WS).not.toContain('SCAN THE BAG THIS ORDER WILL USE')
  })

  it('the left banner still reads the canonical active bag', () => {
    expect(WS).toContain('const active = activeBagForService(bags, svc.id, svc.name)')
  })
})

describe('5, 8, 9 · nothing else changed', () => {
  it('the shared OrderBagList component itself is untouched', () => {
    const shared = read(SHARED_PANEL)
    expect(shared).toContain('export function OrderBagList')
    // Packing still renders it.
    expect(read('src/components/laundry/views/laundry-store-stages.tsx')).toContain('<OrderBagList')
  })

  it('bag assignment still goes through the same handler and endpoint', () => {
    expect(WS).toContain('onScan={(code) => handleAssignBag(code, o)}')
    expect(WS).toContain('/api/laundry/orders/${orderId}/bags')
  })

  it('garment scanning and the scan trail are unchanged', () => {
    expect(WS).toContain('/api/laundry/processing?businessId=')
    expect(WS).toContain('const scannedIds')
    expect(WS).toContain('g.expected++')
  })

  it('sorting completion is still driven by the bag scan — no new completion path', () => {
    expect(WS).toContain('to complete Sorting')
    expect(WS).not.toMatch(/fetch\([^)]*sorting\/complete/)
  })

  it('the garment count and weight summary still render on both cards', () => {
    expect((WS.match(/sortingOrderSummary\(/g) || []).length).toBe(2)
  })
})
