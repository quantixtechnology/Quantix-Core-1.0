import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const MATRIX = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-pricing-matrix.tsx'), 'utf8')
const API = readFileSync(join(process.cwd(), 'src/app/api/laundry/pricing-matrix/route.ts'), 'utf8')

// Coverage is an AND: LaundryService.subscriptionEligible AND
// LaundryGarment.subscriptionIncluded.
//
// A garment-wide switch on its own could only say "included everywhere" or
// "nowhere", so turning it off for Express Wash & Fold turned it off for Wash &
// Fold too. That is why the SERVICE flag exists and why it is what varies per
// service. It is not a reason for the garment half to be uneditable — with the
// AND in place, per-service granularity survives either way, and leaving the
// garment half unreachable meant a garment at the schema default (false) could
// never be included again except by bulk import.
describe('subscription eligibility is an AND over service and garment', () => {
  it('the service flag is what varies per service — the granularity is preserved', () => {
    expect(MATRIX).toContain('Subscription: {s.subscriptionEligible ? "Included" : "Not included"}')
  })

  it('the decision is made per PAIR, on the service row of the editor', () => {
    expect(MATRIX).toContain('Included in Subscription')
    expect(MATRIX).toContain('setCell(s.id, { sub: e.target.checked })')
    expect(MATRIX).toContain('subscriptionIncluded: cells[s.id].sub')
  })

  it('no garment-wide control remains', () => {
    expect(MATRIX).not.toContain('setSubIncluded')
    expect(MATRIX).not.toContain('Not Included in Subscription')
  })

  it('there is still no garment-level Subscription column in the table', () => {
    expect(MATRIX).not.toMatch(/"Category", "Subscription"/)
  })

  it('the table still has four fixed columns', () => {
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

describe('the coverage engine decides per garment x service pair', () => {
  it('reads the decision off the pricing rule — the row that IS the pair', () => {
    expect(ENGINE).toContain('subscriptionIncluded: true')
    expect(ENGINE).toContain('r.subscriptionIncluded ??')
  })

  // Superseded twice. Keying on the GARMENT alone could not express "covered
  // under Wash & Fold, not under Express". Keying on service AND garment could
  // not express it either — it only made both halves all-or-nothing. The pair
  // itself is the only thing that can, and the legacy AND survives as the
  // fallback for pairs nobody has decided.
  it('falls back to the legacy service AND garment rule when undecided', () => {
    expect(ENGINE).toContain('serviceEligible.get(r.serviceId)')
    expect(ENGINE).toContain('garmentIncluded.get(r.garmentId)')
  })

  it('still derives PER_KG / PER_PIECE from the pricing rule — billing unchanged', () => {
    expect(ENGINE).toContain('mode: r.pricingType === "PER_KG" ? "PER_KG" : "PER_PIECE"')
  })
})

// ── Coverage needs the SERVICE and the GARMENT to agree ─────────────────────
// The money bug: Wash & Fold eligible meant every garment under it consumed
// allowance, including a Blanket the plan never covered.
describe('coverage cannot be granted by either legacy flag alone', () => {
  const ENGINE2 = readFileSync(join(process.cwd(), 'src/lib/laundry-subscription-server.ts'), 'utf8')

  it('an undecided pair still needs BOTH legacy flags', () => {
    expect(ENGINE2).toContain('!!serviceEligible.get(r.serviceId) && !!garmentIncluded.get(r.garmentId)')
  })

  it('an explicit per-pair value wins over both of them', () => {
    expect(ENGINE2).toContain('const covered = r.subscriptionIncluded ??')
    expect(ENGINE2).toContain('if (!covered) continue')
  })

  it('still derives the mode from the pricing rule — billing unchanged', () => {
    expect(ENGINE2).toContain('mode: r.pricingType === "PER_KG" ? "PER_KG" : "PER_PIECE"')
  })

  // Mixed orders must not be blocked — only the ineligible line stays payable.
  it('returns a per-pair list, so eligible and ineligible lines coexist', () => {
    expect(ENGINE2).toContain('{ serviceId: string; garmentId: string | null; mode: AllowanceMode }[]')
  })
})

describe('Return to Audit is reachable again', () => {
  const PANEL2 = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-payment-details-panel.tsx'), 'utf8')

  it('uses the existing transition endpoint and edge', () => {
    expect(PANEL2).toContain('/transition')
    expect(PANEL2).toContain('toStatus: "PENDING_STORE_AUDIT"')
  })

  it('requires a reason', () => {
    expect(PANEL2).toContain('if (!returnReason.trim())')
    expect(PANEL2).toContain('disabled={busy === "return" || !returnReason.trim()}')
  })

  it('creates no duplicate order', () => {
    expect(PANEL2).not.toMatch(/orders`,\s*\{\s*method:\s*"POST"/)
  })

  it('adds no new permission', () => {
    expect(PANEL2).not.toMatch(/laundry\.(audit_reopen|return_to_audit)/)
  })
})
