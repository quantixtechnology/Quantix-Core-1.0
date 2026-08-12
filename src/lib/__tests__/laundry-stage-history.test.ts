import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const HIST = read('src/components/laundry/stage-history.tsx')
const STAGES = read('src/components/laundry/views/laundry-store-stages.tsx')
const BAGS = read('src/components/laundry/views/laundry-bag-management.tsx')

describe('Store Receive has Current / History', () => {
  it('uses the EXISTING transport history log, not a new one', () => {
    expect(HIST).toContain('/api/laundry/transport/history?')
    expect(STAGES).toContain('stage="RETURN_RECEIVED" timeLabel="Received"')
  })

  it('search works and is debounced', () => {
    expect(HIST).toContain("p.set('search', q.trim())".replace(/'/g, '"'))
    expect(HIST).toContain('setTimeout(load, q ? 250 : 0)')
  })

  it('shows what a receive log needs', () => {
    for (const col of ['Order', 'Bag / Packet', 'Customer', 'Garments', 'By']) expect(HIST).toContain(col)
  })
})

describe('Ready for Delivery has Current / History', () => {
  it('reads orders that left the stage', () => {
    expect(STAGES).toContain('const DELIVERY_HISTORY_STATUSES = ["DELIVERED", "OUT_FOR_DELIVERY"]')
    expect(STAGES).toContain('<DeliveryStageHistory businessId={currentBusinessId} statuses={DELIVERY_HISTORY_STATUSES} />')
  })

  it('shows the promise, executive and delivered time', () => {
    for (const col of ['Promised', 'Executive', 'Delivered', 'Address']) expect(HIST).toContain(col)
  })

  // Dispatch Center stays the assignment screen.
  it('is a record only — it assigns nothing', () => {
    const fn = HIST.slice(HIST.indexOf('export function DeliveryStageHistory'))
    expect(fn).not.toContain('method: "POST"')
    expect(fn).not.toContain('executiveId')
  })

  it('shows the customer promise, not just the operational date', () => {
    expect(HIST).toContain('r.promisedDeliveryDate || r.deliveryDate')
  })
})

describe('the toggle is shared, and optional', () => {
  it('one control for both stages', () => {
    expect(HIST).toContain('export function HistoryToggle')
    expect(HIST).toContain('>Current<')
    expect(HIST).toContain('>History<')
  })

  // Stages without a history pane must be untouched.
  it('QueueShell only shows it when a history is supplied', () => {
    expect(STAGES).toContain('history?: React.ReactNode')
    expect(STAGES).toContain('{history && <HistoryToggle')
  })
})

describe('Bag Management uses one Actions menu', () => {
  it('every action lives in the menu', () => {
    for (const item of ['View History', 'Print QR', 'Release Bag', 'Mark Damaged', 'Mark Lost', 'Reactivate Bag']) {
      expect(BAGS).toContain(item)
    }
  })

  it('the loose icon buttons are gone', () => {
    expect(BAGS).not.toContain('title="Mark damaged"')
    expect(BAGS).not.toContain('title="Mark lost"')
    expect(BAGS).not.toContain('title="Return to available"')
  })

  it('destructive actions still confirm', () => {
    expect(BAGS).toContain('Mark Bag as Damaged?')
    expect(BAGS).toContain('Mark Bag as Lost?')
    expect(BAGS).toContain('Reactivate Bag?')
    expect(BAGS).toContain('if (c && !window.confirm(')
  })

  it('release keeps its own reason dialog', () => {
    expect(BAGS).toContain('setManualReleaseTarget(b)')
  })
})

describe('the rules we already established still hold', () => {
  it('history never locks a bag — occupancy decides', () => {
    const FIN = read('src/lib/laundry-finishing.ts')
    expect(FIN).toContain('let occupied = bag.status !== "AVAILABLE"')
    expect(FIN).not.toContain('belongs to a different order — each finishing bag is used for one order only')
  })

  it('Assign Bags stays out of the default navigation', () => {
    expect(read('src/lib/laundry-nav-config.ts')).not.toContain('displayName: "Assign Bags"')
  })
})
