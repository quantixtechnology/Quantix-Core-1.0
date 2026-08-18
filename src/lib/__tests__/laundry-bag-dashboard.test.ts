import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  bucketFor, tallyInventory, activeTotal, isKnownStatus,
  humanStatus, humanCustodian, humanCondition, humanEvent,
  BAG_STATUS, CUSTODIAN, BAG_CONDITION,
} from '@/lib/laundry-bag-lifecycle'

// ============================================================================
// Slice 2 — Admin Bags dashboard.
//
// The screen must never classify a bag itself. Everything it shows — buckets,
// totals, labels — comes from the lifecycle domain, so the dashboard cannot
// drift from the engine that actually moves the bags. These tests pin the
// classification rules, and guard the API contract the screen depends on.
// ============================================================================

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const LIST_API = read('src/app/api/laundry/bags/route.ts')
const DETAIL_API = read('src/app/api/laundry/bags/[id]/route.ts')
const UI = read('src/components/laundry/views/laundry-bag-management.tsx')
/** Comments explain the rules and often quote the words the UI must NOT use —
 *  match against what a user can actually read. */
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
const UI_TEXT = stripComments(UI)

const bag = (status: string, custodian: string = CUSTODIAN.STORE) => ({ status, currentCustodianType: custodian })

describe('bucket counts come from the lifecycle model', () => {
  it('a customer-held bag counts as With Customers, never Available', () => {
    const inv = tallyInventory([bag(BAG_STATUS.HANDED_TO_CUSTOMER, CUSTODIAN.CUSTOMER)])
    expect(inv.withCustomers).toBe(1)
    expect(inv.available).toBe(0)
  })

  it('damaged, lost and retired bags are each separated and none is Available', () => {
    const inv = tallyInventory([
      bag(BAG_STATUS.DAMAGED), bag(BAG_STATUS.LOST, CUSTODIAN.CUSTOMER), bag(BAG_STATUS.RETIRED),
    ])
    expect(inv).toMatchObject({ damaged: 1, lost: 1, retired: 1, available: 0 })
  })

  it('inspection-required bags are their own bucket, not stock', () => {
    const inv = tallyInventory([bag(BAG_STATUS.INSPECTION_REQUIRED)])
    expect(inv.inspectionRequired).toBe(1)
    expect(inv.available).toBe(0)
  })

  it('out-for-delivery is not Available even though nobody has kept it', () => {
    const inv = tallyInventory([bag(BAG_STATUS.OUT_FOR_DELIVERY, CUSTODIAN.DELIVERY_EXECUTIVE)])
    expect(inv.outForDelivery).toBe(1)
    expect(inv.available).toBe(0)
  })

  it('retired bags are excluded from ACTIVE inventory but still registered', () => {
    const inv = tallyInventory([bag(BAG_STATUS.AVAILABLE), bag(BAG_STATUS.RETIRED), bag(BAG_STATUS.RETIRED)])
    expect(inv.total).toBe(3)
    expect(activeTotal(inv)).toBe(1)
  })

  // §17 — a state the model cannot place must be surfaced, not absorbed.
  it('an unrecognised status is Unclassified rather than quietly Available', () => {
    const inv = tallyInventory([bag('SOME_STATUS_FROM_THE_FUTURE')])
    expect(inv.unclassified).toBe(1)
    expect(inv.available).toBe(0)
    expect(bucketFor(bag('SOME_STATUS_FROM_THE_FUTURE'))).toBe('unclassified')
    expect(isKnownStatus('SOME_STATUS_FROM_THE_FUTURE')).toBe(false)
  })

  it('known legacy statuses still classify by custody', () => {
    expect(bucketFor(bag('CLEANING'))).toBe('atStore')
    expect(isKnownStatus('CLEANING')).toBe(true)
  })

  it('the buckets always reconcile against the registered total', () => {
    const bags = [
      bag(BAG_STATUS.AVAILABLE), bag(BAG_STATUS.COLLECTED, CUSTODIAN.DELIVERY_EXECUTIVE),
      bag(BAG_STATUS.PROCESSING, CUSTODIAN.PROCESSING_CENTER), bag(BAG_STATUS.OUT_FOR_DELIVERY, CUSTODIAN.DELIVERY_EXECUTIVE),
      bag(BAG_STATUS.HANDED_TO_CUSTOMER, CUSTODIAN.CUSTOMER), bag(BAG_STATUS.INSPECTION_REQUIRED),
      bag(BAG_STATUS.DAMAGED), bag(BAG_STATUS.LOST), bag(BAG_STATUS.RETIRED), bag('WHO_KNOWS'),
    ]
    const inv = tallyInventory(bags)
    const { total, ...rest } = inv
    expect(total).toBe(bags.length)
    expect(Object.values(rest).reduce((a, b) => a + b, 0)).toBe(total)
  })
})

// §13 — staff read business language; the stored enum is untouched.
describe('status vocabulary is presentation only', () => {
  it('renders business-friendly labels', () => {
    expect(humanStatus(BAG_STATUS.HANDED_TO_CUSTOMER)).toBe('With Customer')
    expect(humanStatus(BAG_STATUS.RETURNED_BY_CUSTOMER)).toBe('Returned by Customer')
    expect(humanStatus(BAG_STATUS.INSPECTION_REQUIRED)).toBe('Inspection Required')
    expect(humanStatus(BAG_STATUS.OUT_FOR_DELIVERY)).toBe('Out for Delivery')
    expect(humanCustodian(CUSTODIAN.DELIVERY_EXECUTIVE)).toBe('Delivery Executive')
    expect(humanCondition(BAG_CONDITION.MINOR_DAMAGE)).toBe('Minor Damage')
    expect(humanEvent('RETURNED_BY_CUSTOMER')).toBe('Customer returned the bag')
  })

  it('never blanks out an unknown value', () => {
    expect(humanStatus('NEW_THING')).toBe('NEW THING')
    expect(humanStatus(null)).toBe('—')
  })
})

// §2 / §23 security — the screen and its API must agree on one permission.
describe('RBAC — the guard key matches the screen key', () => {
  it('the list API guards on laundry.bags.view', () => {
    expect(LIST_API).toContain('"laundry.bags.view"')
    expect(LIST_API).not.toContain('"laundry.orders.view"')
  })

  it('the detail API guards on laundry.bags.view', () => {
    expect(DETAIL_API).toContain('"laundry.bags.view"')
  })

  it('every bag route requires a permission before returning data', () => {
    for (const src of [LIST_API, DETAIL_API]) {
      expect(src).toContain('requireLaundryPermission')
      expect(src).toContain('if (!guard.ok) return guard.res')
    }
  })

  it('customer lookup for search stays inside the tenant', () => {
    // A search must never widen into another tenant's customers.
    expect(LIST_API).toContain('biz.platformBusinessId')
  })
})

// §20 — the browser must never be handed the whole inventory.
describe('performance contract', () => {
  it('the list API paginates and caps the page size', () => {
    expect(LIST_API).toContain('skip: (page - 1) * pageSize')
    expect(LIST_API).toMatch(/Math\.min\(200,/)
    expect(LIST_API).toContain('totalPages')
  })

  it('filtering and search happen server-side', () => {
    for (const key of ['status', 'custodian', 'condition', 'bucket', 'search']) {
      expect(LIST_API).toContain(`searchParams.get("${key}")`)
    }
  })

  it('search covers bag code, QR, order number and customer', () => {
    expect(LIST_API).toContain('bagNumber: { contains: search }')
    expect(LIST_API).toContain('qrValue: { contains: search }')
    expect(LIST_API).toContain('currentOrderNumber: { contains: search }')
    expect(LIST_API).toContain('currentCustomerName: { contains: search }')
    expect(LIST_API).toContain('phone: { contains: search }')
  })

  it('event history is loaded on the DETAIL route only, never per list row', () => {
    expect(DETAIL_API).toContain('laundryBagEvent.findMany')
    expect(LIST_API).not.toContain('laundryBagEvent')
  })

  it('the dashboard does not recompute buckets in the browser', () => {
    expect(LIST_API).toContain('getBagInventory')
    expect(UI).toContain('inventory?.[b.key]')
    expect(UI).not.toContain('bags.filter((b) => b.status ===')
  })
})

// §18 — state is the record of what happened; it cannot be typed over.
describe('no arbitrary status editing', () => {
  it('only Lost and Retired may be recorded by an admin', () => {
    expect(DETAIL_API).toContain('b.status !== "LOST" && b.status !== "RETIRED"')
    expect(DETAIL_API).toContain('LIFECYCLE_ONLY')
  })

  it('those two go through the lifecycle service, so they land in history', () => {
    expect(DETAIL_API).toContain('setTerminalState')
  })

  it('a customer-held bag cannot be flipped back to Available by hand', () => {
    expect(DETAIL_API).toContain('is with the customer. Receive it back with a condition')
    // The old bypass — clearing the customer links on a manual AVAILABLE — is gone.
    expect(DETAIL_API).not.toContain('ADMIN_STATUSES')
    expect(DETAIL_API).not.toMatch(/data\.status = b\.status/)
  })

  it('the UI offers no generic status dropdown', () => {
    expect(UI_TEXT).not.toMatch(/Edit Status/i)
  })
})

// §15 — inspection reuses the one lifecycle rule rather than copying it.
describe('inspection action', () => {
  const INSPECT = read('src/app/api/laundry/bags/[id]/inspect/route.ts')

  it('delegates to the lifecycle service', () => {
    expect(INSPECT).toContain('inspectBag')
    // The condition→status mapping must not be reimplemented in the route.
    expect(INSPECT).not.toContain('INSPECTION_REQUIRED:')
    expect(INSPECT).not.toContain('conditionToStatus')
  })

  it('is gated on a management permission, not a read one', () => {
    expect(INSPECT).toContain('"laundry.bags.manual_release"')
  })
})

// §5 / §9 / §10 — what the dashboard and detail view must show.
describe('dashboard and detail surface the model honestly', () => {
  it('status and custodian are separate columns', () => {
    expect(UI).toContain('<TableHead>Status</TableHead>')
    expect(UI).toContain('<TableHead>Custodian</TableHead>')
  })

  it('shows all ten operational buckets', () => {
    for (const k of ['available', 'withExecutives', 'atStore', 'atProcessingCenter', 'outForDelivery',
      'withCustomers', 'inspectionRequired', 'damaged', 'lost', 'retired']) {
      expect(UI).toContain(`key: "${k}"`)
    }
  })

  it('surfaces unclassified bags for review instead of hiding them', () => {
    expect(UI).toContain('unclassified')
    expect(UI).toContain('data review required')
  })

  it('states active vs registered totals rather than implying them', () => {
    expect(UI).toContain('active bags')
    expect(UI).toContain('retired (excluded from active)')
  })

  it('customer-held bags are never labelled lost or missing', () => {
    expect(UI_TEXT).not.toMatch(/Missing|Unaccounted/i)
    // They are shown as a normal, accounted-for state.
    expect(UI).toContain('With Customers')
  })

  it('detail shows usage history and movement history separately', () => {
    expect(UI).toContain('Usage History')
    expect(UI).toContain('Movement History')
    expect(UI).toContain('Reuse adds a row; nothing is overwritten')
  })

  it('reuses existing customer and order navigation rather than rebuilding them', () => {
    expect(UI).toContain('setLaundryFocusCustomerId')
    expect(UI).toContain('setSelectedOrderId')
    expect(UI).toContain('setLaundryPage("order-detail")')
  })

  it('shows the QR and flags a damaged one', () => {
    expect(UI).toContain('QR Damaged')
    expect(UI).toContain('QRCode.toDataURL')
  })
})

// The detail route returns history newest-first; the usage table renders it as
// given, so ordering is the API's contract.
describe('history ordering', () => {
  it('events and assignments come back newest first', () => {
    expect(DETAIL_API).toContain('orderBy: { createdAt: "desc" }')
    expect(DETAIL_API).toContain('assignments: { orderBy: { assignedAt: "desc" }')
  })
})
