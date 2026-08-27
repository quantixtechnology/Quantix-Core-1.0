import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ALL_ORDER_STATUSES, STATUS_META, statusLabel, type LaundryOrderStatus } from '@/lib/laundry-workflow'

// ============================================================================
// ORDERS STAGE FILTER — the dropdown must offer every stage the table shows.
//
// The Orders page kept its own hand-written list of statuses while the table
// rendered whatever the API returned. The two drifted: six real statuses,
// "Awaiting Pickup Assignment" among them, were displayed in the table but
// absent from the filter, so those orders could not be filtered for at all.
//
// The filter is now derived from STATUS_META — the same definition statusLabel()
// and the workflow already use — so a status added there cannot silently go
// missing from the filter again.
// ============================================================================

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const VIEW = read('src/components/laundry/views/laundry-orders-view.tsx')
const API = read('src/app/api/laundry/orders/route.ts')

describe('the filter list is derived, not hand-written', () => {
  it('offers every status in STATUS_META', () => {
    expect(ALL_ORDER_STATUSES).toEqual(Object.keys(STATUS_META))
    expect(ALL_ORDER_STATUSES.length).toBe(Object.keys(STATUS_META).length)
  })

  it('the view builds FILTERS from it, with no literal status list', () => {
    expect(VIEW).toContain('const FILTERS = ["ALL", ...ALL_ORDER_STATUSES]')
    // The old hand-maintained array is gone.
    expect(VIEW).not.toContain('"ALL", "PENDING_STORE_AUDIT"')
  })

  it('keeps All Stages as the first option', () => {
    expect(VIEW).toContain('s === "ALL" ? "All Stages" : statusLabel(s)')
  })
})

describe('the previously missing stages are now offered', () => {
  // The six the literal omitted.
  const wasMissing: LaundryOrderStatus[] = [
    'DRAFT', 'AWAITING_PICKUP_ASSIGNMENT', 'IN_TRANSIT_TO_STORE',
    'UNDER_AUDIT', 'QC_PENDING', 'CANCELLED',
  ]

  it('Awaiting Pickup Assignment appears in the filter', () => {
    expect(ALL_ORDER_STATUSES).toContain('AWAITING_PICKUP_ASSIGNMENT')
    expect(statusLabel('AWAITING_PICKUP_ASSIGNMENT')).toBe('Awaiting Pickup Assignment')
  })

  it('all six recovered stages are present and labelled', () => {
    for (const s of wasMissing) {
      expect(ALL_ORDER_STATUSES, s).toContain(s)
      expect(statusLabel(s), s).toBeTruthy()
      expect(statusLabel(s), s).not.toBe(s) // a real label, not the raw enum
    }
  })

  it('the stages that already worked still do', () => {
    for (const s of ['PENDING_STORE_AUDIT', 'PAYMENT_PENDING', 'READY_FOR_PROCESSING', 'PACKED',
                     'IN_TRANSIT_TO_PROCESSING', 'PROCESSING', 'RETURN_IN_TRANSIT',
                     'READY_FOR_DELIVERY', 'DELIVERED'] as LaundryOrderStatus[]) {
      expect(ALL_ORDER_STATUSES, s).toContain(s)
    }
  })

  it('every stage the user named is represented by its ACTUAL enum value', () => {
    // Their wording → the terminology this codebase already uses.
    const expected: Record<string, LaundryOrderStatus> = {
      'Awaiting Pickup Assignment': 'AWAITING_PICKUP_ASSIGNMENT',
      'Awaiting Store Receive': 'IN_TRANSIT_TO_STORE',   // labelled "In Transit to Store"
      'Awaiting Store Audit': 'PENDING_STORE_AUDIT',     // labelled "Pending Store Audit"
      'Payment Pending': 'PAYMENT_PENDING',
      'Ready for Processing': 'READY_FOR_PROCESSING',    // labelled "Ready for Packing"
      'In Processing': 'PROCESSING',
      'Ready for Delivery': 'READY_FOR_DELIVERY',
      'Delivered': 'DELIVERED',
      'Cancelled': 'CANCELLED',
    }
    for (const [, key] of Object.entries(expected)) expect(ALL_ORDER_STATUSES, key).toContain(key)
  })
})

describe('no invalid stage is introduced', () => {
  it('every filter value is a real status the workflow knows', () => {
    for (const s of ALL_ORDER_STATUSES) expect(STATUS_META[s], s).toBeDefined()
  })

  it('the list has no duplicates and no ALL sentinel inside it', () => {
    expect(new Set(ALL_ORDER_STATUSES).size).toBe(ALL_ORDER_STATUSES.length)
    expect(ALL_ORDER_STATUSES).not.toContain('ALL' as LaundryOrderStatus)
  })

  it('it matches the persisted status union exactly', () => {
    const src = read('src/lib/laundry-workflow.ts')
    const union = src.slice(src.indexOf('export type LaundryOrderStatus ='), src.indexOf('// Department that owns a status'))
    for (const s of ALL_ORDER_STATUSES) expect(union, s).toContain(`"${s}"`)
  })
})

describe('filtering behaviour is unchanged', () => {
  it('a chosen stage is sent to the server; ALL sends nothing', () => {
    expect(VIEW).toContain('if (status !== "ALL") params.set("status", status)')
  })

  it('the server filters on that exact status — so any valid stage works', () => {
    expect(API).toContain('const status = searchParams.get("status")')
    expect(API).toContain('if (status) where.status = status')
  })

  it('search, pagination, customer and tenant filtering are untouched', () => {
    expect(VIEW).toContain('const [search, setSearch] = useState("")')
    expect(VIEW).toContain('const [page, setPage] = useState(0)')
    expect(VIEW).toContain('custFilter')
    expect(VIEW).toContain('currentBusinessId')
  })

  it('badges and stage labels still come from the same central source', () => {
    expect(VIEW).toContain('statusLabel(o.status)')
    expect(VIEW).toContain('STATUS_STYLE[o.status]')
  })
})
