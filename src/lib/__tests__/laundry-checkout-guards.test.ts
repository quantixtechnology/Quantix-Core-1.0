import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const CO = readFileSync(join(process.cwd(), 'src/components/storefront/web/storefront-laundry-home.tsx'), 'utf8')

describe('the TAT cannot be bypassed through the picker', () => {
  it('the floor is built from the pickup SLOT, not midnight', () => {
    expect(CO).toContain('const startStr = String(slot || "00:00").split("-")[0].trim()')
    expect(CO).toContain('return earliestDeliveryAt(base, cartTat)')
  })

  it('slot options are disabled when they start too early', () => {
    expect(CO).toContain('const tooEarly = slotTooEarly(s, deliveryDate)')
    expect(CO).toContain('disabled={isFull || tooEarly}')
    expect(CO).toContain('" — too early"')
  })

  it('reuses slotIsPast rather than inventing a second rule', () => {
    expect(CO).toContain('slotIsPast(s, forDate, earliestAt)')
    expect(CO).toContain('from "@/lib/laundry-slots"')
  })

  // Not only visual: a stale selection must be refused at submit.
  it('submit refuses an early slot', () => {
    expect(CO).toContain('if (deliverySlot && slotTooEarly(deliverySlot, deliveryDate))')
  })

  it('submit still refuses an early DATE', () => {
    expect(CO).toContain('if (minDeliveryDate && deliveryDate < minDeliveryDate)')
  })

  it('auto-selection skips slots that are too early as well as full', () => {
    expect(CO).toContain('!full.includes(s) && !slotTooEarly(s, deliveryDate)')
  })

  // Capacity, closures and the workspace slot list are the existing engine.
  it('capacity remains a separate, untouched condition', () => {
    expect(CO).toContain('const isFull = (fullSlotsByDate[deliveryDate] || []).includes(s)')
  })
})

describe('subscription checkbox follows the service', () => {
  it('is disabled when no service in the cart is eligible', () => {
    expect(CO).toContain('disabled={checkingSub || !subEligible}')
    expect(CO).toContain('cursor-not-allowed')
  })

  it('shows the helper text', () => {
    expect(CO).toContain('Subscription is not available for this service.')
  })

  it('cannot report itself ticked while ineligible', () => {
    expect(CO).toContain('checked={useSub && subEligible}')
  })

  it('reads eligibility from the SERVICE, not the garment', () => {
    expect(CO).toContain('liveTat.get(String(i.serviceId))?.subscriptionEligible')
    expect(CO).not.toContain('subscriptionIncluded')
  })

  it('leaves the existing entitlement check to decide actual coverage', () => {
    expect(CO).toContain('onToggleSub')
  })
})
