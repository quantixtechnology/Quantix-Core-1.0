import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const ORDER = read('src/components/laundry/views/laundry-new-order.tsx')
const PANEL = read('src/components/laundry/views/customer-360-panel.tsx')

describe('the two distracting sections are gone', () => {
  it('Laundry Instructions is removed', () => {
    expect(ORDER).not.toContain('title="Laundry Instructions"')
    for (const n of ['Separate Whites', 'Steam Press', 'Hanger Required', 'Other Instructions']) {
      expect(ORDER).not.toContain(n)
    }
  })

  it('Attachments is removed, with no empty card left behind', () => {
    expect(ORDER).not.toContain('title="Attachments"')
    for (const n of ['Upload Garment Photos', 'Upload Pickup Photo', 'Upload Other Files']) {
      expect(ORDER).not.toContain(n)
    }
  })

  // Only this screen — upload remains available to other workflows.
  it('the shared upload endpoint is untouched', () => {
    expect(read('src/components/laundry/views/pricing/laundry-image-upload.tsx')).toContain('/api/core/upload')
  })
})

describe('Customer 360 uses existing data', () => {
  it('reads the existing customer endpoint — no new API', () => {
    expect(PANEL).toContain('/api/laundry/customers/${customerId}')
  })

  it('no new model was introduced', () => {
    const schema = read('prisma/schema.prisma')
    expect(schema).not.toContain('model Customer360')
    expect(schema).not.toContain('model LaundryCustomerStats')
  })

  it('shows the required fields', () => {
    for (const f of ['Total Orders', 'Completed', 'Total Spend', 'Outstanding', 'Last Order', 'Default Address', 'Recent Orders']) {
      expect(PANEL).toContain(f)
    }
  })

  // Real data or an em dash — never a plausible-looking invention.
  it('falls back to a dash rather than a fake value', () => {
    expect(PANEL).toContain('?? "—"')
    expect(PANEL).toContain('n == null ? "—"')
    expect(PANEL).toContain('No previous orders.')
  })

  it('recent orders show number, date, amount and status', () => {
    expect(PANEL).toContain('{o.orderNumber}')
    expect(PANEL).toContain('day(o.createdAt)')
    expect(PANEL).toContain('inr(o.grandTotal)')
    expect(PANEL).toContain('o.status.replace')
  })
})

describe('switching customer never shows the previous one', () => {
  // Clearing BEFORE the fetch is the whole point: otherwise the old figures sit
  // on screen while the new request is in flight.
  it('clears before loading', () => {
    const load = PANEL.slice(PANEL.indexOf('const load = useCallback'), PANEL.indexOf('useEffect(() => { load() }'))
    expect(load.indexOf('setData(null)')).toBeLessThan(load.indexOf('fetch('))
  })

  it('reloads whenever the selected customer changes', () => {
    expect(PANEL).toContain('}, [customerId, businessId])')
    expect(ORDER).toContain('customerId={selectedCustomer?.id || null}')
  })

  it('renders nothing when no customer is selected', () => {
    expect(PANEL).toContain('if (!customerId) return null')
  })
})

describe('order logic is untouched', () => {
  it('creation, pricing and subscription calls remain', () => {
    // Superseded: `specialInstructions` was still sent (always empty) when the
    // Instructions card was first removed. The New Order simplification dropped
    // the field from the payload entirely, so it is no longer expected here.
    // See laundry-fulfilment.test.ts for what the screen sends now.
    for (const k of ['subscriptions/active', 'laundry/orders']) {
      expect(ORDER).toContain(k)
    }
  })

  // Superseded: `quickNotes` was retained as empty state because the express
  // check still read it. The simplification removed that check with the
  // Instructions card, so the state is gone rather than emptied — which is the
  // same guarantee (no instruction is attached to any order) with less to
  // maintain. Express is now the explicit Delivery Speed toggle.
  it('no instruction is seeded, and no instruction state survives', () => {
    expect(ORDER).not.toContain('quickNotes')
    expect(ORDER).not.toContain('Separate Whites')
  })
})
