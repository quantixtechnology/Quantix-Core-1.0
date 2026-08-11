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

  it('the editor states eligibility per service instead', () => {
    expect(MATRIX).toContain('Subscription eligibility')
    expect(MATRIX).toContain('s.subscriptionEligible ? "Included" : "Not included"')
  })

  it('it points the owner at the one place it is configured', () => {
    expect(MATRIX).toContain('Set per service in Services')
    expect(MATRIX).toContain('Changing one service never affects another')
  })

  it('the matrix marks eligibility on the SERVICE column', () => {
    expect(MATRIX).toContain('{s.subscriptionEligible && <span')
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
