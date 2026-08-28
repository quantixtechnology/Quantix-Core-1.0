import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// PWA + API WIRING for multi-bag delivery and customer bag return.
//
// Transport only. Every rule — tenant, order/customer membership, lifecycle,
// idempotency, the N-of-M gates — already lives in the tested domain layer
// (b1cdcc0, 7259400) and is NOT restated in the routes or the component.
//
// The UI never computes progress: each scan POSTs and the SERVER's view
// replaces local state, so a failed scan leaves the bag unconfirmed.
// ============================================================================

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const DEL_API = read('src/app/api/laundry/executive/jobs/[id]/delivery-bags/route.ts')
const RET_API = read('src/app/api/laundry/executive/jobs/[id]/return-bags/route.ts')
const LIST = read('src/components/laundry/executive/executive-bag-checklist.tsx')
const PWA = read('src/components/laundry/executive/executive-app.tsx')

describe('1-5 · the delivery route is transport over the tested domain', () => {
  it('GET returns the server\'s bag view; POST confirms one bag', () => {
    expect(DEL_API).toContain('await deliveryBags(g.session.businessId, g.order.id)')
    expect(DEL_API).toContain('await confirmDeliveryBag({')
  })

  it('D · it restates no validation of its own', () => {
    for (const w of ['laundryBag.update', 'laundryBagAssignment', 'AVAILABLE', 'HANDED_TO_CUSTOMER']) {
      expect(DEL_API, w).not.toContain(w)
    }
  })

  it('the job must belong to this business AND this executive', () => {
    expect(DEL_API).toContain('where: { id, businessId: session.businessId }')
    expect(DEL_API).toContain('order.deliveryExecutiveId !== session.executiveId')
    expect(DEL_API).toContain('{ status: 403 }')
  })

  it('a completed delivery cannot be re-confirmed', () => {
    expect(DEL_API).toContain('if (g.order.deliveryCompletedAt) return NextResponse.json({ error: "Delivery already completed" }')
  })

  it('the existing singular …/delivery-bag custody route is untouched', () => {
    const OLD = read('src/app/api/laundry/executive/jobs/[id]/delivery-bag/route.ts')
    expect(OLD).toContain('deliveryBagNumber: bagNumber')   // still the custody step
    expect(OLD).not.toContain('confirmDeliveryBag')
  })
})

describe('13-18 · the return route is transport over the tested domain', () => {
  it('GET lists the customer\'s CURRENT holdings; POST returns one', () => {
    expect(RET_API).toContain('await customerReturnBags(g.session.businessId, g.order.customerId, { orderId: g.order.id })')
    expect(RET_API).toContain('await confirmReturnedBag({')
  })

  it('D · it restates no lifecycle of its own', () => {
    for (const w of ['receiveReturnedBag', 'laundryBag.update', 'BAG_STATUS']) expect(RET_API, w).not.toContain(w)
  })

  it('the pickup must belong to this business AND this executive', () => {
    expect(RET_API).toContain('where: { id, businessId: session.businessId }')
    expect(RET_API).toContain('order.pickupExecutiveId !== session.executiveId')
  })

  it('an order with no customer holds nothing', () => {
    expect(RET_API).toContain('if (!g.order.customerId)')
    expect(RET_API).toContain('allReturned: true')
  })

  it('bag return is OPTIONAL — the route gates nothing', () => {
    // A pickup completes whether the customer returns all, some or no bags.
    expect(RET_API).not.toContain('pickupReturnGate')
    expect(RET_API).not.toContain('before completing pickup')
    const LIST_SRC = read('src/components/laundry/executive/executive-bag-checklist.tsx')
    // Only delivery shows a blocking warning; a return states the position.
    expect(LIST_SRC).toContain('const isGated = (kind: ChecklistKind) => kind === "delivery"')
    expect(LIST_SRC).toContain('Still with customer')
  })

  it('the pickup Confirm button is not gated on returns', () => {
    // It still depends only on the EXISTING pickup bag-assignment rule.
    expect(PWA).toContain('disabled={busy || !allBagsDone} onClick={() => setStatus("PICKUP_COMPLETED")}')
    expect(PWA).toContain('<ExecutiveBagChecklist jobId={job.id} kind="return" token={token} />')
  })

  it('the customer comes from the ORDER, never from the request body', () => {
    expect(RET_API).toContain('customerId: g.order.customerId')
    expect(RET_API).not.toContain('b.customerId')
  })
})

describe('I · progress is never manufactured on the client', () => {
  it('each scan replaces local state with the server view', () => {
    expect(LIST).toContain('setView(j.data)')
    // No local increment anywhere.
    for (const w of ['confirmed + 1', 'returned + 1', 'prev + 1', '++']) expect(LIST, w).not.toContain(w)
  })

  it('a failed scan leaves the view untouched', () => {
    const fn = LIST.slice(LIST.indexOf('const scan ='), LIST.indexOf('if (!view'))
    // The early return on failure happens BEFORE setView.
    expect(fn.indexOf('toast.error(j.error')).toBeLessThan(fn.indexOf('setView(j.data)'))
    expect(fn).toContain('return')
  })

  it('both routes answer with the freshly-read server view', () => {
    expect(DEL_API).toContain('data: { ...await deliveryBags(')
    expect(RET_API).toContain('data: { ...await customerReturnBags(')
  })
})

describe('J · the server\'s reason is surfaced verbatim', () => {
  it('no generic fallback masks a real error', () => {
    expect(LIST).toContain('toast.error(j.error ||')
    expect(LIST).not.toContain('Something went wrong')
  })

  it('the blocking message is shown on the card', () => {
    expect(LIST).toContain('{view.message}')
  })
})

describe('A1-A5, B1-B5 · the checklist renders and gates', () => {
  it('bags are listed as Bag N of M with per-bag state', () => {
    expect(LIST).toContain('Bag {b.index} of {view.total}')
    expect(LIST).toContain('Waiting for scan…')
  })

  it('progress reads N / M', () => {
    expect(LIST).toContain('{done} / {view.total} {copy.verb}')
  })

  it('scanning stops once every listed bag is done', () => {
    // Keyed on the count, not on a "complete" gate — a return has no such gate.
    expect(LIST).toContain('disabled={busy || done === view.total}')
  })

  it('it reuses the existing scanner, not a new one', () => {
    expect(LIST).toContain('import { BagScanButton } from "@/components/laundry/bag-scanner"')
  })
})

describe('A5, A7, B5 · the PWA', () => {
  it('shows the delivery bag set and gates Confirm Delivery on it', () => {
    expect(PWA).toContain('<ExecutiveBagChecklist jobId={job.id} kind="delivery" token={token} onProgress={setBagsComplete} />')
    expect(PWA).toContain('disabled={busy || !bagsComplete}')
    expect(PWA).toContain('scan all bags')
  })

  it('shows the customer return list at the pickup', () => {
    expect(PWA).toContain('<ExecutiveBagChecklist jobId={job.id} kind="return" token={token} />')
  })

  it('A7 · the legacy single-bag display is retained for old orders', () => {
    expect(PWA).toContain('job.deliveryBagNumber ?')
    expect(PWA).toContain('give it to the customer')
  })

  it('A6 · the OTP path is untouched by this wiring', () => {
    for (const w of ['regenerateOtp', 'verifyDelivery(']) expect(PWA, w).not.toContain(w)
  })
})

describe('A5, B5 · the server gate remains authoritative', () => {
  it('the UI gate is advisory — the routes still enforce it', () => {
    const DELIVER = read('src/app/api/laundry/orders/[id]/deliver/route.ts')
    const EXEC_DELIVER = read('src/app/api/laundry/executive/jobs/[id]/deliver/route.ts')
    for (const src of [DELIVER, EXEC_DELIVER]) expect(src).toContain('deliveryBagGate(')
  })
})

describe('H · nothing else was touched', () => {
  it('Sorting and Packing & QR are unchanged', () => {
    expect(read('src/app/api/laundry/processing/sorting/route.ts')).toContain('allowMultiple: true')
    expect(read('src/components/laundry/views/laundry-store-stages.tsx')).toContain('useOrderBags(selected?.id ?? null, currentBusinessId)')
  })

  it('no payment field appears in the new routes or component', () => {
    for (const src of [DEL_API, RET_API, LIST]) {
      for (const w of ['balanceDue', 'paymentStatus', 'PAY_LATER', 'amountPaid']) expect(src, w).not.toContain(w)
    }
  })

  it('no GAR or garment barcode logic appears', () => {
    for (const src of [DEL_API, RET_API, LIST]) {
      for (const w of ['garmentScanCode', 'GAR0', 'barcodeGenerated']) expect(src, w).not.toContain(w)
    }
  })

  it('no bag id is generated in the wiring layer', () => {
    for (const src of [DEL_API, RET_API, LIST]) {
      for (const w of ['generateBagCode', 'issueBagId']) expect(src, w).not.toContain(w)
    }
  })
})
