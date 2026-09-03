import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { activeBagForService, sortingBagViews } from '@/lib/laundry-sorting-bags'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+\/\/.*$/gm, '')

const SORT = 'src/components/laundry/views/laundry-sorting-workstation.tsx'
const PROCESS = 'src/app/api/laundry/processing/route.ts'

// ============================================================================
// BUG 1 — A PARTIALLY SCANNED ORDER MUST STAY ON "ORDERS AT SORTING".
//
// THE BUG: the workstation's queue is read from /api/laundry/processing
// ?stage=SORTING, whose per-status-bucket queries were capped at take 200,
// oldest first. Once the stage holds more than 200 garments (sorting items are
// all WAITING), the NEWEST orders silently dropped off the payload — exactly
// the orders being scanned — while Sorting's own rehydration endpoint reads the
// stage UNCAPPED, so their scans still showed in LAST 5 SCANS. The last five
// scans must stay informational; the actual queue must never truncate it.
//
// THE FIX: Sorting reads the full stage (rowsTake 5000); every other stage
// keeps the 200 page cap.
// ============================================================================

// A model of the route's queue assembly: one query per status bucket, each
// ordered oldest-first and sliced by its take.
type Row = { orderId: string; processingStatus: string; receivedAt: number }
const QUEUE_STATUSES = ['WAITING', 'IN_PROGRESS', 'PAUSED']
function fetchQueue(rows: Row[], take: number): Row[] {
  const oldest = (xs: Row[]) => [...xs].sort((a, b) => a.receivedAt - b.receivedAt)
  const active = oldest(rows.filter((r) => r.processingStatus === 'IN_PROGRESS' || r.processingStatus === 'PAUSED'))
  const waiting = oldest(rows.filter((r) => r.processingStatus === 'WAITING'))
  const other = oldest(rows.filter((r) => !QUEUE_STATUSES.includes(r.processingStatus)))
  return [...active.slice(0, take), ...waiting.slice(0, take), ...other.slice(0, take)]
}

describe('Bug 1 — the Sorting queue never drops a partially scanned order', () => {
  it('with the old 200-per-bucket cap, the newest order falls off the payload while its scans stay', () => {
    // 24 orders × 10 garments, all WAITING at Sorting, received oldest → newest.
    const rows: Row[] = []
    for (let i = 0; i < 24; i++)
      for (let g = 0; g < 10; g++)
        rows.push({ orderId: `ord-${String(i + 1).padStart(4, '0')}`, processingStatus: 'WAITING', receivedAt: i * 10 + g })

    // A scan writes a LaundryItemEvent only — the garment stays WAITING at
    // SORTING, so the queue predicate is identical before and after the scan.
    // That is why the drop cannot be a scan side effect: it is the page cap.
    const beforeScan = fetchQueue(rows, 200)
    const afterScan = fetchQueue(rows, 200)
    expect(afterScan).toEqual(beforeScan)
    expect(afterScan.some((r) => r.orderId === 'ord-0024')).toBe(false)   // the newest order is gone…
    expect(afterScan.some((r) => r.orderId === 'ord-0001')).toBe(true)    // …only the OLDEST 200 render
  })

  it('the fix — Sorting reads the full stage, so every order stays, newest included', () => {
    const rows: Row[] = []
    for (let i = 0; i < 24; i++)
      for (let g = 0; g < 10; g++)
        rows.push({ orderId: `ord-${String(i + 1).padStart(4, '0')}`, processingStatus: 'WAITING', receivedAt: i * 10 + g })

    const all = fetchQueue(rows, 5000)
    expect(all.map((r) => r.orderId)).toContain('ord-0024')
    expect(new Set(all.map((r) => r.orderId)).size).toBe(24)
  })

  it('Sorting reads the whole stage via a stage-aware take; other stages keep the page cap', () => {
    const src = code(PROCESS)
    expect(src).toContain('const rowsTake = stage === "SORTING" ? 5000 : 200')
    // the stage-aware take is used for every status bucket, and the old
    // hardcoded cap is gone
    expect((src.match(/take: rowsTake/g) || []).length).toBe(3)
    expect(src).not.toContain('take: 200')
  })

  it('the payload is GARMENTS; the screen groups them into orders itself', () => {
    // 5000 rows is not 5000 orders. The queue returns items and the workstation
    // folds them by orderId — which is why a 200-row cap read as ~10 orders.
    const src = code(SORT)
    expect(src).toContain('const byOrder = new Map<string, OrderGroup>()')
    expect(src).toContain('for (const it of j.items || [])')
    expect(src).toContain('setOrders([...byOrder.values()])')
    // and every grouped order is rendered — no display cap on the queue
    // every grouped order is rendered — the collection is the filtered one,
    // which is `orders` itself whenever no filter is applied
    expect(src).toContain('visibleOrders.map((o) =>')
    expect(src).toContain('if (!q) return orders')
    expect(src).not.toMatch(/orders\s*\.slice\(/)
  })

  it('Complete Sorting derives from the SAME order set, so one cap moves both', () => {
    const src = code(SORT)
    expect(src).toContain('const readyOrders = visibleOrders.filter((o) => scannedFor(o.orderId).length >= o.expected)')
    // …and with no filter that collection IS `orders`, so the unfiltered
    // behaviour is byte-for-byte what it was.
    expect(src).toContain('if (!q) return orders')
    expect(src).not.toMatch(/readyOrders\s*\.slice\(/)
  })
})

// ============================================================================
// BUG 2 — THE BAG SEQUENCE IS DETERMINED BY ACTUAL ASSIGNMENTS, NEVER BY THE
// "+ ADD NEW BAG" PANEL, AND A BAGLESS ORDER MUST NEVER READ "NEXT BAG".
//
// THE BUG: the add-bag panel blindly said "Scan the next physical bag — the
// current one becomes FULL…" even for an order with NO bag yet. Bag 2 language
// must not exist before Bag 1 is actually assigned.
//
// THE FIX: the panel and the button are context-sensitive on the ACTUAL
// assignment rows (activeBagForService). No bag → "Assign first bag", "Scan the
// bag this order will use"; a bag present → the original close-and-add-next
// copy. Opening the panel marks nothing; a bag is assigned ONLY when its
// barcode is scanned and the server binding returns success.
// ============================================================================

describe('Bug 2 — bag sequencing is driven by real assignments, not the button', () => {
  it('A/B — before any bag is assigned, the active bag is null (BAG REQUIRED state)', () => {
    // New order, 0 garments scanned, no bag — and even after ONE garment is
    // scanned, with no assignment rows, the answer is still "no bag".
    expect(activeBagForService([], 's-wf', 'Wash & Fold')).toBeNull()
  })

  it('C — Bag 1 becomes the current bag only once assigned', () => {
    const bag1 = { bagNumber: 'VBBAG001', serviceId: 's-wf', serviceName: 'Wash & Fold', purpose: 'SORTING', assignedAt: '2026-08-30T09:00:00Z' }
    expect(activeBagForService([bag1], 's-wf', 'Wash & Fold')?.bagNumber).toBe('VBBAG001')
    expect(sortingBagViews([bag1], 's-wf', 'Wash & Fold')).toEqual([
      { bagNumber: 'VBBAG001', index: 1, state: 'ACTIVE', garments: 0 },
    ])
  })

  it('D/E — only after Bag 1 is closed (another assignment) does Bag 2 become current', () => {
    const bag1 = { bagNumber: 'VBBAG001', serviceId: 's-wf', serviceName: 'Wash & Fold', purpose: 'SORTING', assignedAt: '2026-08-30T09:00:00Z' }
    const bag2 = { bagNumber: 'VBBAG002', serviceId: 's-wf', serviceName: 'Wash & Fold', purpose: 'SORTING', assignedAt: '2026-08-30T10:00:00Z' }
    // the SECOND row is what closes bag 1 and promotes bag 2 — no button did this
    expect(sortingBagViews([bag1, bag2], 's-wf', 'Wash & Fold').map((v) => [v.bagNumber, v.index, v.state])).toEqual([
      ['VBBAG001', 1, 'FULL'],
      ['VBBAG002', 2, 'ACTIVE'],
    ])
    expect(activeBagForService([bag1, bag2], 's-wf', 'Wash & Fold')?.bagNumber).toBe('VBBAG002')
  })

  it('the panel copy is chosen from the assignment rows, never from the button click', () => {
    const src = code(SORT)
    expect(src).toContain('const bagPanelExisting = addBagFor')
    expect(src).toContain('activeBagForService(bagsByOrder[addBagFor.orderId] || [], addBagFor.serviceId, addBagFor.serviceName)')
  })

  it('a bagless order reads FIRST-bag language and never "next bag" / "becomes FULL" / Bag 2', () => {
    const src = code(SORT)
    // the no-bag branch is its own literal — no next / FULL vocabulary
    expect(src).toContain('"Scan the bag this order will use — it becomes this service\'s Sorting bag."')
    expect(src).toContain('"No Sorting bag is assigned to this order for this service yet — the bag you scan becomes Bag 1."')
    // the ONLY "next / becomes FULL" copy lives in the active-bag branch
    expect(src).toContain('"Scan the next physical bag — the current one becomes FULL and every later garment of this service goes into the new bag."')
    // title follows the same context
    expect(src).toContain('{bagPanelExisting ? "Add new bag" : "Assign first bag"}')
  })

  it('the "+ Add New Bag" button is relabelled to bind the FIRST bag when none exists', () => {
    const raw = read(SORT)
    // Anchored on the current handler; a stale anchor returned -1 and sliced the
    // file down to one character, so the assertions below silently covered
    // nothing. The length check makes that impossible to repeat.
    const button = raw.slice(raw.indexOf('const hasBag = bagsForService(bags, svc.id, svc.name).length > 0'))
    expect(button.length).toBeGreaterThan(200)
    expect(button).toMatch(/hasBag \?[\s\S]{0,160}Assign First Bag/)
    expect(button).toContain('Add New Bag') // still the label once a bag exists
  })

  it('the BAG REQUIRED banner still demands the first bag until an assignment row exists', () => {
    const src = code(SORT)
    // The "adding another bag" branch is now keyed on the order being the one
    // the operator chose to add a bag for — it no longer needs an ACTIVE row to
    // describe, because it asks for the next bag rather than labelling the last.
    expect(src).toContain("if (addBagFor?.orderId === order.orderId) {")
    // The no-bag branch names the required ACTION, so an operator is not left
    // wondering whether a bag is already attached.
    expect(src).toContain('Attach a sorting bag before completing sorting.')
    // …and it is still driven by the canonical status, not a local rule.
    expect(src).toContain('if (!status.ready) {')
  })

  it('opening the panel marks nothing — assignment flows only through the server binding', () => {
    const src = code(SORT)
    // nothing in the scan path or in opening the panel assigns a bag
    const assign = src.slice(src.indexOf('const assignOrderBag'), src.indexOf('const scannedFor'))
    expect(assign).toContain('await fetch(`/api/laundry/orders/${rec.orderId}/bags`')
    // the add-bag panel's button / scanner both call the same single writer
    const pAt = src.indexOf('{addBagFor?.orderId === o.orderId && (')
    expect(pAt).toBeGreaterThan(-1)
    const panel = src.slice(pAt, src.indexOf('</CardContent>', pAt))
    expect(panel.length).toBeGreaterThan(200)
    expect(panel).toContain('assignOrderBag')
  })
})