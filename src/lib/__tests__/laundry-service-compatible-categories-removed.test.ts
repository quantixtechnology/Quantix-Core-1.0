import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// Compatible Categories is gone; Pricing is the single source of truth.
//
// The concept was a SECOND answer to "which garments can this service be
// offered for", editable independently of Pricing — so a service could claim
// Men/Women/Kids while Pricing held Household → Blanket → Wash & Fold → ₹80.
// One relationship survives: Garment Category → Garment → Service → Price.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
// Comments legitimately explain what was removed, so the "it is gone" checks run
// against code with comments stripped.
const codeOf = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '')).join('\n')

const SERVICES_GET = read('src/app/api/laundry/services/route.ts')
const SERVICE_PUT = read('src/app/api/laundry/services/[id]/route.ts')
const SERVICE_UI = read('src/components/laundry/views/pricing/laundry-services-pricing.tsx')
const STOREFRONT = read('src/app/api/core/storefront/laundry-home/route.ts')
const SCHEMA = read('prisma/schema.prisma')

describe('the Service screen no longer configures categories', () => {
  it('the Compatible Categories section is removed, not hidden', () => {
    const code = codeOf(SERVICE_UI)
    expect(code).not.toContain('Compatible Categories')
    expect(code).not.toContain('compatCats')
    expect(code).not.toContain('setCompatCats')
    expect(code).not.toContain('toggleCat')
    expect(code).not.toContain('compatibleCategoryIds')
    // Not merely display:none / hidden.
    expect(code).not.toMatch(/Compatible[\s\S]{0,80}hidden/)
  })

  it('the service form still configures the service and its workflow', () => {
    // What a Service SHOULD define is untouched.
    for (const kept of ['name', 'description', 'isActive', 'displayOnWebsite', 'processFlow', 'orderMode', 'subscriptionEligible', 'tatEnabled']) {
      expect(SERVICE_UI).toContain(kept)
    }
  })
})

describe('the API stops reading and writing it', () => {
  it('GET /api/laundry/services no longer includes or exposes it', () => {
    const code = codeOf(SERVICES_GET)
    expect(code).not.toContain('compatibleCategories')
    expect(code).not.toContain('compatibleCategoryIds')
  })

  it('PUT /api/laundry/services/[id] no longer writes the join table', () => {
    const code = codeOf(SERVICE_PUT)
    expect(code).not.toContain('laundryServiceGarmentCategory')
    expect(code).not.toContain('compatibleCategoryIds')
  })

  it('no code path anywhere still touches the join table', () => {
    // The one grep that matters: if this fails, a second source of truth is back.
    for (const f of [SERVICES_GET, SERVICE_PUT, SERVICE_UI, STOREFRONT]) {
      expect(codeOf(f)).not.toContain('laundryServiceGarmentCategory')
    }
  })
})

describe('no replacement relationship was introduced', () => {
  it('no compatibility matrix, mapping or eligibility table appears', () => {
    const code = codeOf(SERVICE_UI) + codeOf(SERVICE_PUT) + codeOf(SERVICES_GET)
    for (const banned of [
      'ServiceCategoryMapping', 'CompatibilityMatrix', 'ServiceCategoryRule',
      'garmentEligibility', 'serviceCompatibility',
    ]) {
      expect(code).not.toContain(banned)
    }
  })

  it('the garment picker filters by search only — no category scope', () => {
    const code = codeOf(SERVICE_UI)
    expect(code).not.toContain('isCompatible')
    expect(code).not.toContain('compatSet')
    expect(code).not.toContain('Show all garments')
    // It offers every garment that has no price yet for this service.
    expect(SERVICE_UI).toContain('garments.filter((g) => !existingIds.has(g.id))')
  })
})

describe('Pricing is the source of truth for availability', () => {
  it('the customer catalogue is built from active pricing rules', () => {
    // This was already true — the storefront never consulted Compatible
    // Categories — which is why removing it changes nothing customer-facing.
    expect(STOREFRONT).toContain('prisma.laundryPricingRule.findMany')
    expect(STOREFRONT).toContain('isActive: true')
    expect(STOREFRONT).toContain('computeQuote(')
    expect(STOREFRONT).toContain('targetsGarment')
    expect(codeOf(STOREFRONT)).not.toContain('compatibleCategories')
  })

  it('only services with a configured price are offered', () => {
    expect(STOREFRONT).toContain('s.pricedCount > 0')
  })

  it('inactive services and inactive pricing stay unavailable', () => {
    // Both filters are on the same query that builds the catalogue.
    expect(STOREFRONT).toContain('prisma.laundryService.findMany({ where: { businessId: lbId, isActive: true, displayOnWebsite: true }')
  })

  it('per-piece and per-kg both remain available', () => {
    // A Per-KG service is defined by its service-scoped PER_KG rule.
    expect(STOREFRONT).toContain('pricingType === "PER_KG"')
    expect(STOREFRONT).toContain('perKgRule')
  })
})

describe('nothing else was disturbed', () => {
  it('the pricing engine still resolves one rule per service + garment', () => {
    const billing = read('src/lib/laundry-billing.ts')
    expect(billing).toContain('r.serviceId === line.serviceId && r.garmentId === line.garmentId')
    expect(codeOf(billing)).not.toContain('compatible')
  })

  it('subscription eligibility is untouched', () => {
    // Service-level subscriptionEligible + the plan coverage rules, as before.
    expect(SERVICE_UI).toContain('subscriptionEligible')
    const active = read('src/app/api/laundry/subscriptions/active/route.ts')
    expect(active).toContain('coverageRules')
    expect(codeOf(active)).not.toContain('compatibleCategories')
  })

  it('the processing workflow config is untouched', () => {
    expect(SERVICE_PUT).toContain('processFlow')
    expect(SERVICE_UI).toContain('parseRoute')
  })

  it('editing a service deletes no categories, garments or prices', () => {
    // Sliced at the DELETE handler: deleting a never-ordered service removing
    // its own pricing config is pre-existing, deliberate and out of scope here.
    const putOnly = SERVICE_PUT.split('export async function DELETE')[0]
    for (const f of [putOnly, SERVICES_GET, SERVICE_UI]) {
      expect(f).not.toContain('laundryCategory.delete')
      expect(f).not.toContain('laundryGarment.delete')
      expect(f).not.toContain('laundryPricingRule.delete')
    }
  })
})

describe('the retired table is kept, not dropped', () => {
  it('the model still exists so no production rows are destroyed', () => {
    // Deleting real tenant configuration to remove a UI section would be
    // destructive with nothing to gain.
    expect(SCHEMA).toContain('model LaundryServiceGarmentCategory {')
    expect(SCHEMA).toContain('RETIRED — no longer read or written')
  })
})
