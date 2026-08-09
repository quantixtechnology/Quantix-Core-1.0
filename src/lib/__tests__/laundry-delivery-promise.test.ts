import { describe, it, expect } from 'vitest'
import {
  deliveryPromise, freezePromise, dayKey, formatPromiseLine, statusesForFilter,
} from '@/lib/laundry-delivery-promise'

// ============================================================================
// An order carries two delivery dates and conflating them is the whole problem:
//
//   promisedDeliveryDate  what the CUSTOMER was told. Frozen at confirmation.
//   deliveryDate          what the BUSINESS is working to. Rewritten on every
//                         reschedule.
//
// One function decides the status for the badge, the order page and the report
// filter, so those three can never disagree about whether an order is late.
// ============================================================================

const d = (s: string) => new Date(`${s}T10:00:00`)
const TODAY = d('2026-08-10')

const order = (o: Record<string, unknown> = {}) => ({
  promisedDeliveryDate: d('2026-08-12'),
  promisedDeliveryTimeSlot: '2:00 PM - 4:00 PM',
  promisedBackupDeliveryDate: d('2026-08-13'),
  promisedBackupDeliveryTimeSlot: '10:00 AM - 12:00 PM',
  ...o,
})

describe('live orders', () => {
  it('is on schedule before the promised date', () => {
    const p = deliveryPromise(order(), TODAY)
    expect(p.status).toBe('ON_SCHEDULE')
    expect(p.breached).toBe(false)
  })

  it('is due today on the promised date', () => {
    expect(deliveryPromise(order({ promisedDeliveryDate: d('2026-08-10') }), TODAY).status).toBe('DUE_TODAY')
  })

  it('is due today regardless of the time of day within it', () => {
    const p = deliveryPromise(order({ promisedDeliveryDate: new Date('2026-08-10T23:30:00') }), new Date('2026-08-10T00:05:00'))
    expect(p.status).toBe('DUE_TODAY')
  })

  it('reports the primary missed once the date has passed', () => {
    const p = deliveryPromise(order({ promisedDeliveryDate: d('2026-08-09') }), TODAY)
    expect(p.status).toBe('PRIMARY_MISSED')
    expect(p.breached).toBe(true)
    expect(p.daysLate).toBe(1)
  })

  // The backup day is still a chance to recover, so it does not escalate yet.
  it('stays at primary-missed while the backup day is still running', () => {
    const p = deliveryPromise(order({ promisedDeliveryDate: d('2026-08-09'), promisedBackupDeliveryDate: d('2026-08-10') }), TODAY)
    expect(p.status).toBe('PRIMARY_MISSED')
  })

  it('escalates to backup-missed only once the backup has passed', () => {
    const p = deliveryPromise(order({ promisedDeliveryDate: d('2026-08-08'), promisedBackupDeliveryDate: d('2026-08-09') }), TODAY)
    expect(p.status).toBe('BACKUP_MISSED')
    expect(p.breached).toBe(true)
  })

  it('treats an order with no backup as primary-missed indefinitely', () => {
    const p = deliveryPromise(order({ promisedDeliveryDate: d('2026-08-01'), promisedBackupDeliveryDate: null }), TODAY)
    expect(p.status).toBe('PRIMARY_MISSED')
    expect(p.daysLate).toBe(9)
  })
})

describe('delivered orders', () => {
  it('records delivery on the primary date as on time', () => {
    const p = deliveryPromise(order({ promisedDeliveryDate: d('2026-08-09'), deliveredAt: d('2026-08-09') }), TODAY)
    expect(p.status).toBe('DELIVERED_ON_PRIMARY')
    expect(p.breached).toBe(false)
  })

  it('counts early delivery as on time', () => {
    const p = deliveryPromise(order({ promisedDeliveryDate: d('2026-08-09'), deliveredAt: d('2026-08-07') }), TODAY)
    expect(p.status).toBe('DELIVERED_ON_PRIMARY')
  })

  it('records delivery on the backup date separately', () => {
    const p = deliveryPromise(order({ promisedDeliveryDate: d('2026-08-08'), promisedBackupDeliveryDate: d('2026-08-09'), deliveredAt: d('2026-08-09') }), TODAY)
    expect(p.status).toBe('DELIVERED_ON_BACKUP')
    expect(p.daysLate).toBe(1)
  })

  it('records delivery after both dates as late', () => {
    const p = deliveryPromise(order({ promisedDeliveryDate: d('2026-08-07'), promisedBackupDeliveryDate: d('2026-08-08'), deliveredAt: d('2026-08-10') }), TODAY)
    expect(p.status).toBe('DELIVERED_LATE')
    expect(p.daysLate).toBe(3)
    expect(p.breached).toBe(true)
  })

  it('is late against the primary when no backup was offered', () => {
    const p = deliveryPromise(order({ promisedDeliveryDate: d('2026-08-07'), promisedBackupDeliveryDate: null, deliveredAt: d('2026-08-09') }), TODAY)
    expect(p.status).toBe('DELIVERED_LATE')
  })
})

// The reason the promise had to become its own field: the operational date is
// rewritten by dispatch, so it cannot be the record of what was promised.
describe('a business reschedule never touches the promise', () => {
  it('surfaces the reschedule separately from the promise', () => {
    const p = deliveryPromise(order({
      deliveryDate: d('2026-08-15'), deliveryTimeSlot: '5:00 PM - 7:00 PM',
      deliveryRescheduledAt: d('2026-08-10'), deliveryRescheduleReason: 'Machine breakdown',
    }), TODAY)
    expect(p.primary.date).toContain('2026-08-12')
    expect(p.rescheduled?.date).toContain('2026-08-15')
    expect(p.rescheduled?.reason).toBe('Machine breakdown')
  })

  it('still judges lateness against the CUSTOMER promise, not the new date', () => {
    // Rescheduled into the future, but the promised date has already passed.
    const p = deliveryPromise(order({
      promisedDeliveryDate: d('2026-08-08'), promisedBackupDeliveryDate: null,
      deliveryDate: d('2026-08-20'),
    }), TODAY)
    expect(p.status).toBe('PRIMARY_MISSED')
  })

  it('is not treated as rescheduled when the operational date matches the promise', () => {
    expect(deliveryPromise(order({ deliveryDate: d('2026-08-12') }), TODAY).rescheduled).toBeNull()
  })
})

describe('orders created before promises were captured', () => {
  it('reports "not captured" rather than inventing a promise', () => {
    const p = deliveryPromise({ deliveryDate: d('2026-08-12'), deliveryTimeSlot: '2-4' }, TODAY)
    expect(p.status).toBe('NOT_CAPTURED')
    expect(p.captured).toBe(false)
    expect(p.breached).toBe(false)
  })

  // Inferring from the operational date would show a rescheduled legacy order a
  // promise the customer never made.
  it('never derives the promise from the operational delivery date', () => {
    const p = deliveryPromise({ deliveryDate: d('2026-08-01') }, TODAY)
    expect(p.primary.date).toBeNull()
    expect(p.status).not.toBe('PRIMARY_MISSED')
  })

  it('handles an order with no dates at all', () => {
    expect(deliveryPromise({}, TODAY).status).toBe('NOT_CAPTURED')
  })
})

describe('freezing the promise at confirmation', () => {
  it('copies the customer selection', () => {
    const f = freezePromise({
      deliveryDate: d('2026-08-12'), deliveryTimeSlot: '2-4',
      backupDeliveryDate: d('2026-08-13'), backupDeliveryTimeSlot: '10-12',
    })
    expect(f.promisedDeliveryDate).toEqual(d('2026-08-12'))
    expect(f.promisedBackupDeliveryTimeSlot).toBe('10-12')
    expect(f.promiseCapturedAt).toBeInstanceOf(Date)
  })

  it('writes nothing when delivery was never promised', () => {
    expect(freezePromise({ deliveryDate: null })).toEqual({})
  })

  it('accepts a primary with no backup', () => {
    const f = freezePromise({ deliveryDate: d('2026-08-12'), deliveryTimeSlot: '2-4' })
    expect(f.promisedBackupDeliveryDate).toBeNull()
  })
})

describe('helpers', () => {
  it('dayKey uses the local calendar day', () => {
    expect(dayKey(new Date('2026-08-10T23:59:00'))).toBe('2026-08-10')
    expect(dayKey(null)).toBeNull()
    expect(dayKey('not a date')).toBeNull()
  })

  it('formats a promise line with and without a slot', () => {
    expect(formatPromiseLine(d('2026-08-10').toISOString(), '2:00 PM - 4:00 PM')).toContain('2:00 PM - 4:00 PM')
    expect(formatPromiseLine(null, null)).toBe('—')
  })

  it('maps filter keys to the statuses the UI shows', () => {
    expect(statusesForFilter('missed_backup')).toEqual(['BACKUP_MISSED'])
    expect(statusesForFilter('late')).toContain('DELIVERED_LATE')
    expect(statusesForFilter('nonsense')).toEqual([])
  })
})
