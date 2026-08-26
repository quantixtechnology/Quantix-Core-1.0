import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// The slot dropdowns must never sit on "Loading…" forever.
//
// Both storefront slot pickers rendered `slots.length === 0 ? "Loading…"`, so a
// date that genuinely has no slots was indistinguishable from a request still
// in flight — and under 24/7 ordering a weekly closed day produced exactly
// that: a permanent "Loading…" with nothing selectable.
//
// These are source assertions because the components are large client trees
// whose data comes from the network; what is worth pinning is that the empty
// state and the loading state are two DIFFERENT things.
// ============================================================================

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const HOME = read('src/components/storefront/web/storefront-laundry-home.tsx')
const CHECKOUT = read('src/components/storefront/web/storefront-laundry-checkout.tsx')

describe('F · the dropdown distinguishes loading from empty', () => {
  it('neither picker renders an unconditional "Loading…" for an empty list', () => {
    for (const src of [HOME, CHECKOUT]) {
      expect(src).not.toContain('<option>Loading…</option>')
      expect(src).not.toContain('<option>Loading...</option>')
    }
  })

  it('the home picker asks a loading flag before calling a list empty', () => {
    expect(HOME).toContain('const [slotsLoading, setSlotsLoading] = useState(false)')
    expect(HOME).toContain('slotsLoading ? "Loading…" : `No ${noun} slots available for this date`')
    // All three dropdowns (pickup, standard delivery, backup) use it.
    expect(HOME.split('emptySlotLabel(').length - 1).toBe(3)
  })

  it('the home picker keeps the flag set while a superseded request aborts', () => {
    // Clearing it on an aborted fetch flashes the empty state between dates.
    expect(HOME).toContain('.finally(() => { if (!ctl.signal.aborted) setSlotsLoading(false) })')
  })

  it('the checkout picker says why the list is empty', () => {
    expect(CHECKOUT).toContain('const [slotsLoading, setSlotsLoading] = useState(false)')
    expect(CHECKOUT).toContain('slotsLoading ? "Loading…" : pickupSlots.length === 0 ? "No pickup slots available for this date" : "Select slot"')
    expect(CHECKOUT).toContain('No pickup slots available for this date. Please choose another date.')
  })

  it('the checkout always clears the loading flag, whatever the response', () => {
    expect(CHECKOUT).toContain('.finally(() => setSlotsLoading(false))')
  })
})

describe('E · changing the pickup date refetches the slots', () => {
  it('the checkout effect is keyed on the pickup date', () => {
    expect(CHECKOUT).toContain('}, [currentBusinessId, pickupDate, assignedStore?.kind, assignedStore?.id])')
  })

  it('the checkout refreshes the list on EVERY successful response', () => {
    // The early `return` on an unavailable date left the previous date's slots
    // on screen, so the dropdown disagreed with the date beside it.
    const effect = CHECKOUT.slice(
      CHECKOUT.indexOf('/api/core/storefront/laundry-slots?businessId='),
      CHECKOUT.indexOf('}, [currentBusinessId, pickupDate'),
    )
    expect(effect).toContain('setPickupSlots(slots)')
    expect(effect).not.toMatch(/setPickupSlot\(""\)\s*\n\s*return\b/)
  })

  it('the home effect is keyed on all three dates it resolves', () => {
    expect(HOME).toContain('}, [businessId, date, deliveryDate, backupDate])')
  })
})
