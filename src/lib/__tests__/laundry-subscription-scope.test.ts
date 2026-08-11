import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const MATRIX = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-pricing-matrix.tsx'), 'utf8')
const API = readFileSync(join(process.cwd(), 'src/app/api/laundry/pricing-matrix/route.ts'), 'utf8')

// One garment-wide switch could only say "included everywhere" or "nowhere", so
// turning it off for Express Wash & Fold turned it off for Wash & Fold too.
describe('subscription eligibility is per SERVICE, not per garment', () => {
  it('the garment editor no longer writes a garment-wide flag', () => {
    expect(MATRIX).not.toContain('subscriptionIncluded: sub')
    expect(MATRIX).not.toContain('const [sub, setSub]')
  })

  it('the garment modal carries only a note, never a control', () => {
    expect(MATRIX).toContain('configured per service in Services')
    expect(MATRIX).not.toContain('onCheckedChange={setSub}')
  })

  it('each service column states its own status', () => {
    expect(MATRIX).toContain('Subscription: {s.subscriptionEligible ? "Included" : "Not included"}')
  })

  it('the garment-level Subscription column is gone from the table and export', () => {
    expect(MATRIX).not.toContain('g.subscriptionIncluded ? "Yes" : "No"')
    expect(MATRIX).not.toMatch(/"Category", "Subscription"/)
  })

  it('column count matches the removed column', () => {
    expect(MATRIX).toContain('colSpan={4 + services.length}')
  })

  it('the API supplies the service flag it now reads', () => {
    expect(API).toContain('subscriptionEligible: true')
  })

  // No new field, and the existing service-level source of truth is untouched.
  it('introduces no second eligibility field', () => {
    expect(MATRIX).not.toMatch(/subscriptionEligible\s*[:=]\s*(true|false)/)
  })
})

const CREATOR = readFileSync(join(process.cwd(), 'src/components/laundry/views/pricing/laundry-services-pricing.tsx'), 'utf8')
const ENGINE = readFileSync(join(process.cwd(), 'src/lib/laundry-subscription-server.ts'), 'utf8')

describe('the Service Creator is where eligibility is set', () => {
  it('has a Subscription section with the specified helper text', () => {
    expect(CREATOR).toContain('title="Subscription"')
    expect(CREATOR).toContain('Subscription Eligible')
    expect(CREATOR).toContain('Allow customers to use subscription plans for this service.')
  })

  it('defaults new services to OFF', () => {
    expect(CREATOR).toContain('subscriptionEligible: false, tatEnabled: false')
  })

  it('loads the stored value when editing, so it is preserved', () => {
    expect(CREATOR).toContain('subscriptionEligible: !!s.subscriptionEligible')
  })

  it('saves it per service through the existing service API', () => {
    expect(CREATOR).toContain('subscriptionEligible: form.subscriptionEligible,')
  })
})

describe('the coverage engine keys on the SERVICE', () => {
  it('reads LaundryService.subscriptionEligible', () => {
    expect(ENGINE).toContain('prisma.laundryService.findMany({ where: { businessId: laundryBusinessId, subscriptionEligible: true }')
  })

  // The decisive change: the same shirt can be covered under Wash & Fold and
  // excluded under Express Wash & Fold, which a garment flag cannot express.
  it('no longer selects coverage by garment', () => {
    expect(ENGINE).not.toContain('subscriptionIncluded: true')
  })

  it('still derives PER_KG / PER_PIECE from the pricing rule — billing unchanged', () => {
    expect(ENGINE).toContain('mode: r.pricingType === "PER_KG" ? "PER_KG" : "PER_PIECE"')
  })
})
