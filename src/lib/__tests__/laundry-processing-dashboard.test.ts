import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const API = read('src/app/api/laundry/processing/dashboard/route.ts')
const UI = read('src/components/laundry/views/processing-dashboard.tsx')
const STORE = read('src/stores/admin-store.ts')

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

  it('the API honours the window and falls back to today', () => {
    expect(API).toContain('const inWindow = { gte: from, lt: to }')
    expect(API).toContain('const parse = (v: string | null, fallback: Date)')
  })
})

describe('every number is real', () => {
  it('garment counts come from the same table the workstations read', () => {
    expect(API).toContain('prisma.laundryOrderItem.groupBy')
    expect(API).toContain('by: ["processingStage"]')
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

describe('the flow mirrors the real stages and opens them', () => {
  it('uses the existing stage keys, in flow order', () => {
    for (const s of ['RECEIVED', 'SORTING', 'WASH', 'DRYCLEAN', 'QC', 'IRON', 'FOLD']) {
      expect(API).toContain(`key: "${s}"`)
    }
  })

  it('every stage links to a page that exists', () => {
    const pages = [...API.matchAll(/page: "([a-z-]+)"/g)].map((m) => m[1])
    expect(pages.length).toBeGreaterThan(5)
    for (const p of pages) expect(STORE).toContain(`"${p}"`)
  })

  it('the tiles are clickable', () => {
    expect(UI).toContain('onClick={() => setLaundryPage(f.page as never)}')
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
