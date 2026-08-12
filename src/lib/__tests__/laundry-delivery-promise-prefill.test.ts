import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const SRC = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-store-stages.tsx'), 'utf8')

// Ready for Delivery opened with today's date and "Select slot…" even though the
// customer had already been promised 12 Aug 20:00–21:00.
describe('Ready for Delivery inherits the customer promise', () => {
  it('seeds the date and slot from the order, not from today', () => {
    expect(SRC).toContain('const promisedDate = o?.deliveryDate || o?.promisedDeliveryDate || null')
    expect(SRC).toContain('const promisedSlot = o?.deliveryTimeSlot || o?.promisedDeliveryTimeSlot || ""')
  })

  // A business reschedule is the newer decision and must win over the booking.
  it('prefers a business reschedule over the original promise', () => {
    expect(SRC).toContain('o?.deliveryDate || o?.promisedDeliveryDate')
    expect(SRC).toContain('o?.deliveryTimeSlot || o?.promisedDeliveryTimeSlot')
  })

  it('falls back to today only when neither exists', () => {
    expect(SRC).toContain('promisedDate ? String(promisedDate).split("T")[0] : new Date().toISOString().split("T")[0]')
  })

  it('carries the promise fields on the row type', () => {
    expect(SRC).toContain('promisedDeliveryDate?: string | null; promisedDeliveryTimeSlot?: string | null')
    expect(SRC).toContain('promisedBackupDeliveryDate?: string | null')
  })

  // Slot config can change after booking; the inherited value must survive it.
  it('keeps the promised slot selectable even if it is no longer generated', () => {
    expect(SRC).toContain('delForm.timeSlot && !deliverySlots.includes(delForm.timeSlot)')
    expect(SRC).toContain("customer&apos;s promised slot")
  })

  it('the operator can still change it deliberately', () => {
    expect(SRC).toContain('onChange={(e) => setDelForm((f) => ({ ...f, timeSlot: e.target.value }))}')
  })
})
