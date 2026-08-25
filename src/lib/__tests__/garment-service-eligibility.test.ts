import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { resolveLineRule } from '@/lib/laundry-billing'
import { unavailableCombinationError } from '@/lib/laundry-garment-services'

// ============================================================================
// A garment can only be ordered under a service the Pricing Matrix prices it
// for. Blanket (Single) has Dry Clean at ₹99/KG and NA everywhere else, yet
// New Order let it be added as Wash & Fold and billed ₹0 — the engine returned
// "No pricing rule" and the line was persisted anyway.
//
// Availability and subscription eligibility are separate questions; neither
// implies the other.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const BLANKET = 'g_blanket', SHIRT = 'g_shirt', SUIT = 'g_suit'
const WF = 's_wf', WI = 's_wi', DC = 's_dc', SI = 's_si', OFF = 's_off'

type Rule = Record<string, unknown>
const db = { rules: [] as Rule[], services: [] as Record<string, unknown>[] }

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryPricingRule: { findMany: vi.fn(async () => db.rules.filter((r) => r.isActive)) },
    laundryService: { findMany: vi.fn(async () => db.services.filter((s) => s.isActive)) },
  },
}))

const rule = (garmentId: string, serviceId: string, price: number, isActive = true) =>
  ({ id: `r_${garmentId}_${serviceId}`, businessId: 'lb1', garmentId, serviceId, price, pricingType: 'PER_KG', gstPercent: 0, isActive })

const reset = () => {
  db.services = [WF, WI, DC, SI].map((id) => ({ id, isActive: true })).concat([{ id: OFF, isActive: false }])
  db.rules = [
    rule(BLANKET, DC, 99),                    // Blanket: Dry Clean only
    rule(SHIRT, WF, 35), rule(SHIRT, WI, 45), rule(SHIRT, DC, 99),
    rule(SUIT, DC, 250), rule(SUIT, SI, 80),
    rule(SHIRT, OFF, 10),                     // priced, but the service is off
    rule(BLANKET, WF, 20, false),             // an INACTIVE rule = the matrix's NA
  ]
}

const availability = async () => {
  const { garmentServiceAvailability } = await import('@/lib/laundry-garment-services')
  return garmentServiceAvailability('lb1')
}
/** What the billing engine does for one pair, using its own matcher. */
const matched = (garmentId: string, serviceId: string) =>
  resolveLineRule(db.rules.filter((r) => r.isActive) as never, { serviceId, garmentId, categoryId: null, quantity: 1 } as never)

describe('availability comes from the Pricing Matrix, per garment', () => {
  beforeEach(reset)

  it('1 + 2 + 3. Blanket allows Dry Clean and nothing else', async () => {
    const a = await availability()
    expect(a[BLANKET]).toEqual([DC])
    expect(a[BLANKET]).not.toContain(WF)
    expect(a[BLANKET]).not.toContain(WI)
    expect(a[BLANKET]).not.toContain(SI)
  })

  it('4. a garment priced for Wash & Fold allows it', async () => {
    const a = await availability()
    expect(a[SHIRT]).toContain(WF)
    expect(a[SHIRT]).toContain(WI)
  })

  it('every garment resolves from its own configuration, not its name', async () => {
    const a = await availability()
    expect(new Set(a[SUIT])).toEqual(new Set([DC, SI]))     // Suit: no Wash & Fold
    expect(a[SUIT]).not.toContain(WF)
    expect(new Set(a[SHIRT])).toEqual(new Set([WF, WI, DC]))
  })

  it('5. an NA cell (deactivated rule) is not available', async () => {
    expect(db.rules.some((r) => r.garmentId === BLANKET && r.serviceId === WF)).toBe(true)  // the row exists…
    const a = await availability()
    expect(a[BLANKET]).not.toContain(WF)                                                     // …but is inactive
  })

  it('6. an inactive SERVICE is never offered, even where a rule survives', async () => {
    const a = await availability()
    expect(a[SHIRT]).not.toContain(OFF)
  })

  it('a garment with nothing priced offers nothing', async () => {
    const a = await availability()
    expect(a['g_unpriced']).toBeUndefined()
  })

  it('matches the billing engine exactly — selectable and priceable cannot drift', async () => {
    const a = await availability()
    for (const g of [BLANKET, SHIRT, SUIT]) {
      for (const s of [WF, WI, DC, SI]) {
        expect((a[g] || []).includes(s)).toBe(matched(g, s) !== null)
      }
    }
  })
})

describe('9 + 11. the backend refuses what it cannot price', () => {
  it('names the service and the garment, dynamically', () => {
    const msg = unavailableCombinationError([
      { serviceId: DC, serviceName: 'Dry Clean', garmentName: 'Blanket (Single)', pricingRuleId: 'r1' },
      { serviceId: WF, serviceName: 'Wash & Fold', garmentName: 'Blanket (Single)', pricingRuleId: null },
    ])
    expect(msg).toBe('Wash & Fold is not available for Blanket (Single). Please select an available service.')
  })

  it('passes when every line matched a rule', () => {
    expect(unavailableCombinationError([
      { serviceId: DC, serviceName: 'Dry Clean', garmentName: 'Blanket (Single)', pricingRuleId: 'r1' },
    ])).toBeNull()
  })

  it('a genuinely FREE service is priced by a real rule and stays allowed', () => {
    // The test is the matched rule, not a zero total — ₹0 with a rule is a
    // deliberate price; ₹0 with no rule is an unconfigured combination.
    expect(unavailableCombinationError([
      { serviceId: WF, serviceName: 'Wash & Fold', garmentName: 'Shirt', pricingRuleId: 'r_free' },
    ])).toBeNull()
  })

  it('both creation paths enforce it', () => {
    for (const f of ['src/app/api/laundry/orders/route.ts', 'src/app/api/laundry/orders/[id]/items/route.ts']) {
      const src = read(f)
      expect(src).toContain('unavailableCombinationError')
      expect(src).toContain('SERVICE_NOT_AVAILABLE_FOR_GARMENT')
    }
  })
})

describe('7 + 8. subscription eligibility is a separate question', () => {
  it('availability is decided without reading the subscription flag', () => {
    const src = read('src/lib/laundry-garment-services.ts')
    expect(src).not.toContain('subscriptionIncluded')
    // A priced-but-excluded pair is available; it simply bills normally.
    expect(unavailableCombinationError([
      { serviceId: DC, serviceName: 'Dry Clean', garmentName: 'Blanket (Single)', pricingRuleId: 'r_dc' },
    ])).toBeNull()
  })

  it('the coverage engine still decides subscription separately', () => {
    const src = read('src/lib/laundry-subscription-server.ts')
    expect(src).toContain('subscriptionIncluded')
  })
})

describe('the New Order screen offers only what is priced', () => {
  const UI = read('src/components/laundry/views/laundry-new-order.tsx')

  it('the service list is derived from the selected garment', () => {
    expect(UI).toContain('servicesForGarment')
    expect(UI).toContain('options={mServices.map(')
    expect(UI).not.toContain('options={availableServices.map(')
  })

  it('changing the garment clears a service that no longer applies', () => {
    expect(UI).toContain('if (!mServices.some((s) => s.id === mService)) setMService(mServices[0]?.id || "")')
  })

  it('says why, rather than showing an empty box', () => {
    expect(UI).toContain('has no service priced in the Pricing Matrix')
    expect(UI).toContain('Only services priced for this garment are listed.')
  })

  it('refuses to add an ineligible pair even from stale state', () => {
    expect(UI).toContain('is not available for ${grmById(mGarment)?.name || "this garment"}. Please select an available service.')
  })

  it('reads availability from the pricing data, never a hardcoded pairing', () => {
    expect(UI).toContain('/api/laundry/garment-services?businessId=')
    expect(read('src/lib/laundry-garment-services.ts')).toContain('laundryPricingRule.findMany')
  })
})
