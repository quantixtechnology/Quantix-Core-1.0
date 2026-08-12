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
    expect(API).toContain('returnToStore: { completed: returnInTransit, pending: stillProcessing }')
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
  it('reads the existing processingStatus, inventing nothing', () => {
    expect(API).toContain("st === \"DONE\"")
    expect(API).toContain('st === "WAITING" || st === "IN_PROGRESS"')
  })

  // REJECTED is an exception the QC screens handle; counting it as pending
  // would overstate the work left.
  it('excludes REJECTED from both figures', () => {
    const fn = API.slice(API.indexOf('const pending ='), API.indexOf('\n', API.indexOf('const pending =')))
    expect(fn).not.toContain('REJECTED')
  })

  it('every stage carries both numbers', () => {
    expect(API).toContain('completed: done(f.key), pending: pending(f.key)')
  })

  it('Return to Store uses order statuses, not a new one', () => {
    expect(API).toContain('status: "RETURN_IN_TRANSIT"')
    expect(API).toContain('status: "PROCESSING"')
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

  it('uses the application success and warning colours', () => {
    expect(UI).toContain('bg-emerald-600')
    expect(UI).toContain('bg-amber-500')
    expect(UI).toContain('text-white')
  })
})
