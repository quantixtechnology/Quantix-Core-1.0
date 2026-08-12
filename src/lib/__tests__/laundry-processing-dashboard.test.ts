import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const API = read('src/app/api/laundry/processing/dashboard/route.ts')
const UI = read('src/components/laundry/views/processing-dashboard.tsx')
const STORE = read('src/stores/admin-store.ts')

describe('two clocks: activity is windowed, workload is not', () => {
  it('activity counts events inside the window', () => {
    expect(API).toContain('action: "RECEIVE_AT_PROCESSING", createdAt: inWindow')
    expect(API).toContain('action: "COMPLETE_PROCESSING", createdAt: inWindow')
    expect(API).toContain('action: "DISPATCH_TO_STORE", createdAt: inWindow')
  })

  // An order received yesterday and still washing today must appear today.
  it('workload counts are NOT date-filtered', () => {
    const wl = API.slice(API.indexOf('workloadNow: {'), API.indexOf('flow: FLOW'))
    expect(wl).not.toContain('inWindow')
  })

  // processingStage is only set after Barcode Generation, so stage counts alone
  // reported zeros while the console plainly showed work waiting.
  it('counts the two order-level buckets that have no stage yet', () => {
    expect(API).toContain('status: "IN_TRANSIT_TO_PROCESSING"')
    expect(API).toContain('processingStage: "RECEIVED", barcodeGenerated: false')
  })

  it('the UI keeps the two sections apart and says so', () => {
    expect(UI).toContain('Activity · {win.label}')
    expect(UI).toContain('current state, any arrival date')
  })

  it('completion is read from events, not an incidental updatedAt', () => {
    expect(API).not.toContain('updatedAt: inWindow')
  })
})

describe('the custom range is a real range', () => {
  it('takes a start and an end', () => {
    expect(UI).toContain('Start Date')
    expect(UI).toContain('End Date')
    expect(UI).toContain('setCustomFrom(draft.from); setCustomTo(draft.to)')
  })

  it('refuses an inverted or incomplete range', () => {
    expect(UI).toContain('draft.from > draft.to')
    expect(UI).toContain('Both dates are required.')
    expect(UI).toContain('The start date cannot be after the end date.')
    expect(UI).toContain('disabled={draftInvalid}')
  })

  it('only Apply commits it — a half-typed range never refetches', () => {
    expect(UI).toContain('const [draft, setDraft]')
    expect(UI).toContain('>Apply<')
    expect(UI).toContain('>Cancel<')
  })

  it('includes the end day, since `to` is exclusive', () => {
    expect(UI).toContain('addDays(startOfDay(b), 1)')
  })

  it('shows the range in words', () => {
    expect(UI).toContain('`${longDate(f)} – ${longDate(addDays(t, -1))}`')
  })
})

describe('the date selector drives everything', () => {
  it('defaults to Today', () => {
    expect(UI).toContain('useState<RangeKey>("TODAY")')
    expect(UI).toContain('label: `Today · ${longDate(today)}`')
  })

  it('offers the five ranges', () => {
    for (const r of ['TODAY', 'YESTERDAY', 'TOMORROW', 'WEEK', 'CUSTOM']) expect(UI).toContain(`"${r}"`)
  })

  it('states which window is being shown', () => {
    expect(UI).toContain('{win.label}')
  })

  // The window is computed client-side, so "today" is the operator's day.
  it('sends the window to the API and refetches when it changes', () => {
    expect(UI).toContain('from: win.from.toISOString(), to: win.to.toISOString()')
    expect(UI).toContain('}, [currentBusinessId, win.from, win.to])')
  })

  it('Today remains the default', () => {
    expect(UI).toContain('useState<RangeKey>("TODAY")')
  })

  it('the API honours the window and falls back to today', () => {
    expect(API).toContain('const inWindow = { gte: from, lt: to }')
    expect(API).toContain('const parse = (v: string | null, fallback: Date)')
  })
})

describe('every number is real', () => {
  it('garment counts come from the same table the workstations read', () => {
    expect(API).toContain('prisma.laundryOrderItem.groupBy')
    // Now grouped by stage AND status so each card can split completed/pending.
    expect(API).toContain('by: ["processingStage", "processingStatus"]')
  })

  it('receives are counted from the actual handover events', () => {
    expect(API).toContain('action: "RECEIVE_AT_PROCESSING", createdAt: inWindow')
  })

  it('no hardcoded or demo values', () => {
    expect(API).not.toMatch(/=\s*\[\s*\{[^}]*orderNumber:\s*"(ORD|DEMO)/)
    expect(UI).not.toMatch(/orderNumber:\s*"ORD-/)
  })

  it('the UI renders only what the API returned', () => {
    expect(UI).toContain('if (j.success) setData(j.data)')
    expect(UI).toContain('Could not load the dashboard.')
  })
})

describe('the flow matches the real route through the centre', () => {
  it('uses the existing stage keys', () => {
    for (const s of ['RECEIVED', 'SORTING', 'WASH', 'DRYCLEAN', 'QC', 'IRON', 'FOLD']) {
      expect(API).toContain(`key: "${s}"`)
    }
  })

  // Received → Washing|Dry Cleaning → Dry & Quality Check → Sorting →
  // Ironing|Folding → Return to Store. QC comes BEFORE Sorting.
  it('renders the stages in the operational order, not a straight line', () => {
    const at = (k: string) => UI.indexOf(`byKey(data.flow, "${k}")`)
    expect(at("RECEIVED")).toBeLessThan(at("WASH"))
    expect(at("WASH")).toBeLessThan(at("QC"))
    expect(at("QC")).toBeLessThan(at("SORTING"))
    expect(at("SORTING")).toBeLessThan(at("IRON"))
  })

  it('pairs the parallel branches side by side', () => {
    expect(UI).toMatch(/grid-cols-2[\s\S]{0,220}"WASH"[\s\S]{0,220}"DRYCLEAN"/)
    expect(UI).toMatch(/grid-cols-2[\s\S]{0,220}"IRON"[\s\S]{0,220}"FOLD"/)
  })

  it('splits and merges around each pair', () => {
    expect(UI.match(/<Split \/>/g)).toHaveLength(2)
    expect(UI.match(/<Merge \/>/g)).toHaveLength(2)
  })

  it('ends at Return to Store, counted from orders not garments', () => {
    expect(UI).toContain('label: "Return to Store"')
    expect(UI).toContain('completed: data.returnToStore.completed')
    // Superseded: completion is the RECEIVE_AT_STORE transition, not a status.
    expect(API).toContain('returnToStore: { completed: returnedToStore, pending: inReturnTransit }')
  })

  it('every stage links to a page that exists', () => {
    const pages = [...API.matchAll(/page: "([a-z-]+)"/g)].map((m) => m[1])
    expect(pages.length).toBeGreaterThan(5)
    for (const p of pages) expect(STORE).toContain(`"${p}"`)
  })

  it('the tiles are clickable', () => {
    // Each node opens the screen that clears its stage.
    expect(UI).toContain('onClick={() => go(stage.page as never)}')
    expect(UI).toContain('go={setLaundryPage}')
  })
})

describe('the workload is ordered by what is due', () => {
  it('sorts on the promise, not creation time', () => {
    expect(API).toContain('return a.due.localeCompare(b.due)')
    expect(API).not.toContain('orderBy: { createdAt:')
  })

  it('orders without a promise sort last rather than looking urgent', () => {
    expect(API).toContain('if (!a.due) return 1')
  })

  // An order is only as far along as its slowest garment.
  it('reports the earliest stage still present as the current stage', () => {
    expect(API).toContain('FLOW.find((f) => stages.includes(f.key))?.label')
  })

  it('flags overdue rows', () => {
    expect(API).toContain('overdue: !!due && due < now')
    expect(UI).toContain('o.overdue ? "bg-rose-50/40" : ""')
  })
})

describe('Needs Attention shows only derivable conditions', () => {
  it('overdue is computed from the promise', () => {
    expect(API).toContain('promisedDeliveryDate: { lt: now }')
  })

  it('a zero condition is omitted, not shown as reassurance', () => {
    expect(UI).toContain('{a!.overdue > 0 &&')
    expect(UI).toContain('{a!.qcPending > 0 &&')
  })
})

describe('quick actions reuse existing screens', () => {
  it('links only to pages that exist', () => {
    for (const p of ['processing-centers', 'audit-barcode', 'ws-sorting', 'ws-qc', 'orders', 'reports']) {
      expect(UI).toContain(`"${p}"`)
      expect(STORE).toContain(`"${p}"`)
    }
  })
})


// ── Completed vs Pending on every card ──────────────────────────────────────
describe('each stage card splits completed from pending', () => {
  it('pending reads the existing processingStatus, inventing nothing', () => {
    expect(API).toContain('st === "WAITING" || st === "IN_PROGRESS"')
  })

  // THE 0/0 BUG. processingStage says where a garment is NOW, so once it
  // finishes Washing it has left that stage — "at WASH and DONE" is empty, and
  // every Completed read zero.
  it('completed comes from the item EVENT log, not the current stage', () => {
    expect(API).toContain('prisma.laundryItemEvent.groupBy')
    // Superseded: COMPLETE/QC_PASS alone missed Sorting. See FORWARD_ACTIONS.
    expect(API).toContain('action: { in: FORWARD_ACTIONS }')
    expect(API).toContain('by: ["fromStage"]')
    expect(API).toContain('completedEvents.find((e) => e.fromStage === s)')
  })

  // Which also makes Completed genuinely date-filtered.
  it('completions are counted inside the selected window', () => {
    const q = API.slice(API.indexOf('prisma.laundryItemEvent.groupBy'))
    expect(q.slice(0, 400)).toContain('createdAt: inWindow')
  })

  // Superseded: production stages are garment-level (§9), and
  // MOVED_TO_PROCESSING carries fromStage RECEIVED, so one rule covers it.
  it('Received to PC is counted like every other stage', () => {
    expect(API).toContain('completed: done(f.key)')
  })

  it('no new model or duplicate stage tracking was added', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
    expect(schema).not.toContain('model LaundryProductionFlow')
    expect(schema).not.toContain('model ProcessingStageCount')
  })

  // REJECTED is an exception the QC screens handle; counting it as pending
  // would overstate the work left.
  it('excludes REJECTED from both figures', () => {
    const fn = API.slice(API.indexOf('const pending ='), API.indexOf('\n', API.indexOf('const pending =')))
    expect(fn).not.toContain('REJECTED')
  })

  it('every stage carries both numbers', () => {
    expect(API).toContain('pending: pending(f.key)')
    expect(API).toContain('done(f.key)')
  })

  // Superseded: PROCESSING has not entered the return leg, so it is not pending
  // return. Completion is now the RECEIVE_AT_STORE event.
  it('Return to Store uses existing statuses and actions, not a new one', () => {
    expect(API).toContain('status: "RETURN_IN_TRANSIT"')
    expect(API).toContain('action: "RECEIVE_AT_STORE"')
  })

  it('the card shows two figures, not a ratio or a percentage', () => {
    expect(UI).toContain('>Completed<')
    expect(UI).toContain('>Pending<')
    // Scoped to the card itself — % appears elsewhere in the file legitimately.
    const card = UI.slice(UI.indexOf('function Node('), UI.indexOf('const byKey'))
    expect(card).not.toMatch(/\{stage\.completed\}\s*\/\s*\{/)
    expect(card).not.toContain('%')
    expect(card).not.toContain('progress')
  })

  // Superseded: solid saturated blocks replaced by tinted panels with strong
  // text, so the NUMBER carries the signal and the fill recedes.
  it('uses subtle success/warning tints with strong text', () => {
    expect(UI).toContain('bg-emerald-50')
    expect(UI).toContain('text-emerald-700')
    expect(UI).toContain('bg-amber-50')
    expect(UI).toContain('text-amber-700')
  })

  it('no longer paints large saturated blocks', () => {
    const card = UI.slice(UI.indexOf('function Node('), UI.indexOf('const byKey'))
    expect(card).not.toContain('bg-emerald-600')
    expect(card).not.toContain('bg-amber-500')
  })

  it('connectors stay subtle and brand-aligned', () => {
    expect(UI).toContain('bg-blue-200')
    expect(UI).not.toContain('bg-slate-300')
  })

  it('keeps the closing explanation', () => {
    expect(UI).toContain('passed through that stage during the selected period')
  })
})


describe('loading never shows a false zero', () => {
  it('waits for the query rather than rendering 0/0', () => {
    expect(UI).toContain('{loading ? (')
    expect(UI).toContain('Loading…')
  })

  it('a real zero is still shown once the query returns', () => {
    expect(UI).toContain('{stage.completed}')
    expect(UI).toContain('{stage.pending}')
  })
})

// ── The reported case: Sorting showed 0 while Washing/Dry Cleaning had work ──
describe('stage completion is counted from every forward action, not just COMPLETE', () => {
  // TRACED from the actual writes, not assumed:
  //   RECEIVED → MOVED_TO_PROCESSING   (items/[id]/process)
  //   SORTING  → SORTING_BAG_ASSIGNED  (processing/sorting)
  //   WASH/DRYCLEAN/IRON/FOLD → COMPLETE
  //   QC       → QC_PASS
  it('includes the action each workstation actually writes', () => {
    for (const a of ['COMPLETE', 'QC_PASS', 'SORTING_BAG_ASSIGNED', 'MOVED_TO_PROCESSING']) {
      expect(API).toContain(`"${a}"`)
    }
  })

  it('Sorting is no longer invisible', () => {
    expect(API).toContain('SORTING_BAG_ASSIGNED')
    // The old filter, which caused the reported zero.
    expect(API).not.toContain('action: { in: ["COMPLETE", "QC_PASS"] }')
  })

  it('failed work is never counted as completed', () => {
    const set = API.slice(API.indexOf('const FORWARD_ACTIONS'), API.indexOf('\n', API.indexOf('const FORWARD_ACTIONS')))
    for (const a of ['REJECT', 'QC_FAIL', 'START', 'PAUSE', 'RESUME']) expect(set).not.toContain(a)
  })

  it('fromStage identifies the stage in every case', () => {
    expect(API).toContain('by: ["fromStage"]')
    expect(API).toContain('fromStage: { not: null }')
  })

  // §9 — production stages are garment-level, including Received.
  it('Received to PC counts garments, via its own exit event', () => {
    expect(API).toContain('completed: done(f.key)')
    expect(API).not.toContain('f.key === "RECEIVED" ? receivedOrders')
  })
})

describe('the two-garment case behaves correctly', () => {
  // Shirt → Sorting → Washing; Blanket → Sorting → Dry Cleaning.
  // Both left Sorting, so Sorting completed = 2 even though neither is there now.
  const events = [
    { fromStage: 'RECEIVED', action: 'MOVED_TO_PROCESSING' }, { fromStage: 'RECEIVED', action: 'MOVED_TO_PROCESSING' },
    { fromStage: 'SORTING', action: 'SORTING_BAG_ASSIGNED' }, { fromStage: 'SORTING', action: 'SORTING_BAG_ASSIGNED' },
    { fromStage: 'WASH', action: 'COMPLETE' },
    { fromStage: 'DRYCLEAN', action: 'COMPLETE' },
    { fromStage: 'WASH', action: 'REJECT' },   // must not count
  ]
  const FORWARD = ['COMPLETE', 'QC_PASS', 'SORTING_BAG_ASSIGNED', 'MOVED_TO_PROCESSING']
  const completed = (s: string) => events.filter((e) => e.fromStage === s && FORWARD.includes(e.action)).length

  it('Received to PC = 2', () => expect(completed('RECEIVED')).toBe(2))
  it('Sorting = 2, though both garments have moved on', () => expect(completed('SORTING')).toBe(2))
  it('Washing = 1', () => expect(completed('WASH')).toBe(1))
  it('Dry Cleaning = 1', () => expect(completed('DRYCLEAN')).toBe(1))
  it('a rejected garment is not counted', () => expect(completed('WASH')).not.toBe(2))
  it('stages nothing reached stay at 0', () => expect(completed('FOLD')).toBe(0))

  // §7 — pending must come from current state, never received-minus-completed,
  // because branches make that arithmetic wrong.
  it('pending is not derived by subtraction', () => {
    expect(API).toContain('const pending = (s: string) => at(s,')
    expect(API).not.toMatch(/pending[^\n]*received[^\n]*-[^\n]*completed/i)
  })
})

// ── Return to Store ─────────────────────────────────────────────────────────
// Traced from the two endpoints that own the leg:
//   return-dispatch  PROCESSING → RETURN_IN_TRANSIT       action DISPATCH_TO_STORE
//   store-receive    RETURN_IN_TRANSIT → READY_FOR_DELIVERY  action RECEIVE_AT_STORE
describe('Return to Store counts the transition, not a resting state', () => {
  it('completed reads the RECEIVE_AT_STORE event', () => {
    expect(API).toContain('action: "RECEIVE_AT_STORE", createdAt: inWindow')
  })

  // The 0/0 bug: once the store received it the order became
  // READY_FOR_DELIVERY and matched neither old condition.
  it('no longer treats RETURN_IN_TRANSIT as completed', () => {
    expect(API).not.toContain('returnToStore: { completed: returnInTransit')
  })

  it('completed is date-filtered, so a return is counted on the day it happened', () => {
    const q = API.slice(API.indexOf('action: "RECEIVE_AT_STORE"'))
    expect(q.slice(0, 120)).toContain('inWindow')
  })

  // Superseded: pending is now the GARMENTS in orders still travelling.
  it('pending is the garments still travelling', () => {
    expect(API).toContain('status: "RETURN_IN_TRANSIT" }')
  })

  it('an order still in PROCESSING is not pending return', () => {
    const block = API.slice(API.indexOf('// RETURN TO STORE'), API.indexOf('// Past its promise'))
    expect(block).not.toContain('status: "PROCESSING"')
  })

  // Superseded: an order can carry several services, so this card counts
  // garments like every other stage. The order is never split.
  it('it is service-level, matching the other stages', () => {
    expect(API).toContain('returnToStore: { completed: returnedToStore, pending: inReturnTransit }')
    const block = API.slice(API.indexOf('// RETURN TO STORE'), API.indexOf('// Past its promise'))
    expect(block).toContain('laundryOrderItem')
  })
})

describe('Return to Store — the scenarios', () => {
  // Modelled on the real records: an event log for completions, current status
  // for pending.
  const completedIn = (events: { action: string; day: string }[], day: string) =>
    events.filter((e) => e.action === 'RECEIVE_AT_STORE' && e.day === day).length
  const pendingNow = (orders: { status: string }[]) =>
    orders.filter((o) => o.status === 'RETURN_IN_TRANSIT').length

  it('1 — one order returned today → 1 / 0', () => {
    expect(completedIn([{ action: 'RECEIVE_AT_STORE', day: 'today' }], 'today')).toBe(1)
    expect(pendingNow([{ status: 'READY_FOR_DELIVERY' }])).toBe(0)
  })

  it('2 — one order in return transit → 0 / 1', () => {
    expect(completedIn([], 'today')).toBe(0)
    expect(pendingNow([{ status: 'RETURN_IN_TRANSIT' }])).toBe(1)
  })

  it('3 — one completed and one pending → 1 / 1', () => {
    expect(completedIn([{ action: 'RECEIVE_AT_STORE', day: 'today' }], 'today')).toBe(1)
    expect(pendingNow([{ status: 'RETURN_IN_TRANSIT' }, { status: 'READY_FOR_DELIVERY' }])).toBe(1)
  })

  it('4 — returned yesterday counts yesterday, not today', () => {
    const ev = [{ action: 'RECEIVE_AT_STORE', day: 'yesterday' }]
    expect(completedIn(ev, 'today')).toBe(0)
    expect(completedIn(ev, 'yesterday')).toBe(1)
  })

  // 5 — the order's CURRENT status is READY_FOR_DELIVERY, yet it still counts
  // for the day its return transition happened.
  it('5 — a store-received order still counts historically', () => {
    expect(completedIn([{ action: 'RECEIVE_AT_STORE', day: 'today' }], 'today')).toBe(1)
  })

  it('7 — an order still PROCESSING is not pending return', () => {
    expect(pendingNow([{ status: 'PROCESSING' }])).toBe(0)
  })
})

// ── The flow counts SERVICES/GARMENTS, never orders ─────────────────────────
// One customer order routinely carries several services after Store Audit — a
// shirt to Wash & Fold, a blanket to Dry Cleaning. The order is never split;
// only the reporting unit matters here.
describe('Return to Store is counted in services, not orders', () => {
  it('resolves the returned orders, then counts their garments', () => {
    expect(API).toContain('action: "RECEIVE_AT_STORE", createdAt: inWindow')
    expect(API).toContain('prisma.laundryOrderItem.count({ where: { orderId: { in: returnedOrderIds')
  })

  it('pending counts garments in orders still travelling back', () => {
    expect(API).toContain('order: { businessId: biz.id, status: "RETURN_IN_TRANSIT" }')
  })

  it('no longer counts LaundryOrder records for this card', () => {
    const block = API.slice(API.indexOf('// RETURN TO STORE'), API.indexOf('// Past its promise'))
    expect(block).not.toContain('laundryOrder.count')
  })

  it('the card no longer claims a different unit from the rest', () => {
    expect(UI).not.toContain('unit="orders"')
  })

  it('the section says what it counts', () => {
    expect(UI).toContain('Service Processing Flow')
    expect(UI).toContain('Counted in garments/services — one order may carry several')
  })

  it('distinct orders, so one order is not counted twice', () => {
    expect(API).toContain('distinct: ["orderId"]')
  })
})

describe('a two-service order reports 2 everywhere, including Return', () => {
  // Shirt → Wash & Fold, Blanket → Dry Cleaning. ONE order, TWO services.
  const ORDER = 'ord-1'
  const items = [
    { id: 'i1', orderId: ORDER, service: 'Wash & Fold' },
    { id: 'i2', orderId: ORDER, service: 'Dry Cleaning' },
  ]
  const returnedOrderIds = [{ orderId: ORDER }]
  const returnedGarments = items.filter((i) => returnedOrderIds.some((r) => r.orderId === i.orderId)).length

  it('Return to Store completed = 2, not 1', () => {
    expect(returnedGarments).toBe(2)
    expect(returnedGarments).not.toBe(returnedOrderIds.length)
  })

  it('two services in one order never collapse to 1', () => {
    expect(new Set(items.map((i) => i.orderId)).size).toBe(1)
    expect(items.length).toBe(2)
  })

  // Matches the garment stages, which already count this way.
  it('the flow adds up: Received 2 → Wash 1 + Dry Clean 1 → Return 2', () => {
    const wash = items.filter((i) => i.service === 'Wash & Fold').length
    const dry = items.filter((i) => i.service === 'Dry Cleaning').length
    expect(wash).toBe(1)
    expect(dry).toBe(1)
    expect(wash + dry).toBe(returnedGarments)
  })

  it('a return outside the window contributes nothing', () => {
    const outOfWindow: { orderId: string }[] = []
    expect(items.filter((i) => outOfWindow.some((r) => r.orderId === i.orderId)).length).toBe(0)
  })
})

describe('the other stages are untouched', () => {
  it('still read their own event history', () => {
    expect(API).toContain('action: { in: FORWARD_ACTIONS }')
    expect(API).toContain('by: ["fromStage"]')
  })

  it('and no new model was introduced', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
    expect(schema).not.toContain('model LaundryServiceFlow')
    expect(schema).not.toContain('model LaundryReturnEvent')
  })
})
