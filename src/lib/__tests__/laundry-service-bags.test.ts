import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  accountBagsByService, pickServiceForBag, normaliseRequired,
  type ServiceRequirement,
} from '@/lib/laundry-service-bags'
import type { OrderBag } from '@/lib/laundry-order-bags'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
/** Source with line comments stripped — so prose ABOUT the old bug can't pass
 *  for the bug itself. */
const code = (p: string) => read(p).split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

const svc = (serviceId: string | null, serviceName: string, requiredBags = 1): ServiceRequirement =>
  ({ serviceId, serviceName, requiredBags })

let seq = 0
const bag = (bagNumber: string, serviceId: string | null, serviceName: string | null): OrderBag => ({
  assignmentId: `as${++seq}`, bagId: `b-${bagNumber}`, bagNumber, qrValue: bagNumber,
  status: 'COLLECTED', custodian: 'LAUNDRY', open: true, assignedAt: new Date(), index: seq,
  // Bag ACCOUNTING is about physical transport and counts every bag on the
  // order whatever its role, so these fixtures deliberately leave it unrecorded.
  purpose: null,
  serviceId, serviceName,
})

const WF = svc('s-wf', 'Wash & Fold', 2)
const DC = svc('s-dc', 'Dry Clean', 2)

describe('the shapes the business actually books', () => {
  it('1 service × 1 bag → complete', () => {
    const a = accountBagsByService([svc('s1', 'Wash & Fold', 1)], [bag('V8BAG001', 's1', 'Wash & Fold')])
    expect(a.services[0].label).toBe('1 / 1')
    expect(a.complete).toBe(true)
    expect(a.summary).toBe('1 / 1 bags')
  })

  it('1 service × 2 bags → 2/2', () => {
    const a = accountBagsByService([svc('s1', 'Wash & Fold', 2)], [bag('A', 's1', 'Wash & Fold'), bag('B', 's1', 'Wash & Fold')])
    expect(a.services[0].label).toBe('2 / 2')
    expect(a.complete).toBe(true)
  })

  it('2 services × 1 bag each → 1/1 + 1/1', () => {
    const a = accountBagsByService(
      [svc('s-wf', 'Wash & Fold', 1), svc('s-dc', 'Dry Clean', 1)],
      [bag('A', 's-wf', 'Wash & Fold'), bag('C', 's-dc', 'Dry Clean')],
    )
    expect(a.services.map((s) => s.label)).toEqual(['1 / 1', '1 / 1'])
    expect(a.complete).toBe(true)
    expect(a.summary).toBe('2 / 2 bags')
  })

  // Order 000033.
  it('2 services × 2 bags each → 2/2 + 2/2, total 4/4', () => {
    const a = accountBagsByService([WF, DC], [
      bag('V8BAG051', 's-wf', 'Wash & Fold'), bag('V8BAG052', 's-wf', 'Wash & Fold'),
      bag('V8BAG047', 's-dc', 'Dry Clean'), bag('V8BAG048', 's-dc', 'Dry Clean'),
    ])
    expect(a.services.map((s) => `${s.serviceName} ${s.label}`)).toEqual(['Wash & Fold 2 / 2', 'Dry Clean 2 / 2'])
    expect(a.totalRequired).toBe(4)
    expect(a.totalAssigned).toBe(4)
    expect(a.complete).toBe(true)
    expect(a.summary).toBe('4 / 4 bags')
  })

  it('different counts per service — 3 + 1 → 4/4', () => {
    const a = accountBagsByService(
      [svc('s-wf', 'Wash & Fold', 3), svc('s-dc', 'Dry Clean', 1)],
      [bag('A', 's-wf', 'Wash & Fold'), bag('B', 's-wf', 'Wash & Fold'), bag('C', 's-wf', 'Wash & Fold'), bag('D', 's-dc', 'Dry Clean')],
    )
    expect(a.services.map((s) => s.label)).toEqual(['3 / 3', '1 / 1'])
    expect(a.complete).toBe(true)
  })
})

describe('THE regression — a service is never covered by another service\'s bags', () => {
  it('2/2 + 1/2 stays incomplete and names the short service', () => {
    const a = accountBagsByService([WF, DC], [
      bag('V8BAG051', 's-wf', 'Wash & Fold'), bag('V8BAG052', 's-wf', 'Wash & Fold'),
      bag('V8BAG047', 's-dc', 'Dry Clean'),
    ])
    expect(a.services[0]).toMatchObject({ serviceName: 'Wash & Fold', label: '2 / 2', complete: true })
    expect(a.services[1]).toMatchObject({ serviceName: 'Dry Clean', label: '1 / 2', complete: false })
    expect(a.complete).toBe(false)
    expect(a.summary).toBe('3 / 4 bags')
    expect(a.message).toContain('Dry Clean has 1 bag outstanding')
  })

  it('four Wash & Fold bags do NOT complete an order that also needs Dry Clean', () => {
    // The total is 4 and the requirement total is 4 — and it is still incomplete,
    // because the totals were never the question.
    const a = accountBagsByService([WF, DC], [
      bag('A', 's-wf', 'Wash & Fold'), bag('B', 's-wf', 'Wash & Fold'),
      bag('C', 's-wf', 'Wash & Fold'), bag('D', 's-wf', 'Wash & Fold'),
    ])
    expect(a.totalAssigned).toBe(4)
    expect(a.totalRequired).toBe(4)
    expect(a.complete).toBe(false)
    expect(a.services[1]).toMatchObject({ serviceName: 'Dry Clean', label: '0 / 2', complete: false })
  })

  it('a bag for a service not on the order is surfaced, never counted', () => {
    const a = accountBagsByService([WF], [bag('A', 's-wf', 'Wash & Fold'), bag('X', 's-other', 'Ironing')])
    expect(a.unmatched.map((b) => b.bagNumber)).toEqual(['X'])
    expect(a.services[0].label).toBe('1 / 2')
    expect(a.complete).toBe(false)
  })
})

describe('a scanned bag is filed against the operator\'s service, never services[0]', () => {
  it('one service needs no choice — the existing flow is unchanged', () => {
    const r = pickServiceForBag([svc('s1', 'Wash & Fold', 1)], null)
    expect(r).toEqual({ ok: true, service: svc('s1', 'Wash & Fold', 1) })
  })

  it('two services with no choice is REFUSED, not guessed', () => {
    const r = pickServiceForBag([WF, DC], null)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.needsChoice).toBe(true)
      expect(r.error).toContain('choose which one')
    }
  })

  it('the operator\'s choice is honoured — including the second service', () => {
    const r = pickServiceForBag([WF, DC], 's-dc')
    expect(r.ok && r.service.serviceName).toBe('Dry Clean')
  })

  it('a service not on the order is refused', () => {
    const r = pickServiceForBag([WF, DC], 's-elsewhere')
    expect(r.ok).toBe(false)
  })

  it('an order with no booked services still accepts a bag (offline/store)', () => {
    const r = pickServiceForBag([], null)
    expect(r.ok).toBe(true)
  })
})

describe('offline / store orders and other zero cases', () => {
  it('a store order with services but zero bags is incomplete, not crashing', () => {
    const a = accountBagsByService([svc('s1', 'Wash & Fold', 1)], [])
    expect(a.services[0].label).toBe('0 / 1')
    expect(a.complete).toBe(false)
    expect(a.totalAssigned).toBe(0)
  })

  it('an order with no services at all has nothing to account for', () => {
    const a = accountBagsByService([], [])
    expect(a.services).toEqual([])
    expect(a.complete).toBe(false)
    expect(a.totalRequired).toBe(0)
  })

  it('the delivery gate keeps a bagless order deliverable', () => {
    // total === 0 short-circuits before the requirement is consulted.
    const src = read('src/lib/laundry-delivery-bags.ts')
    expect(src).toContain('const complete = total === 0 ? true : allBagsAccounted && requirementMet')
  })

  it('an order with bags but NO booked services is not blocked by a requirement it never had', () => {
    // "no requirement" must never read as "requirement failed" — that would
    // make such an order permanently undeliverable.
    const a = accountBagsByService([], [bag('A', null, null)])
    expect(a.applicable).toBe(false)
    expect(read('src/lib/laundry-delivery-bags.ts')).toContain('accounting.applicable ? accounting.complete : true')
  })
})

describe('requiredBags is a requirement, not a guess', () => {
  it('defaults to 1 and never to 0 or a negative', () => {
    expect(normaliseRequired(undefined)).toBe(1)
    expect(normaliseRequired(null)).toBe(1)
    expect(normaliseRequired(0)).toBe(1)
    expect(normaliseRequired(-3)).toBe(1)
    expect(normaliseRequired(2)).toBe(2)
  })

  it('is never derived from the number of services or bags', () => {
    // Two services, four bags, requirement still 1 each → complete at 2.
    const a = accountBagsByService(
      [svc('s-wf', 'Wash & Fold', 1), svc('s-dc', 'Dry Clean', 1)],
      [bag('A', 's-wf', 'Wash & Fold'), bag('B', 's-wf', 'Wash & Fold'), bag('C', 's-dc', 'Dry Clean'), bag('D', 's-dc', 'Dry Clean')],
    )
    expect(a.totalRequired).toBe(2)
    expect(a.complete).toBe(true)
  })

  it('the schema carries it on the service order, defaulted to 1', () => {
    const schema = read('prisma/schema.prisma')
    expect(schema).toContain('requiredBags    Int      @default(1)')
  })
})

describe('single-service orders keep working exactly as before', () => {
  it('one service, one bag, no operator choice, complete', () => {
    const services = [svc('s1', 'Wash & Fold', 1)]
    expect(pickServiceForBag(services, null).ok).toBe(true)
    expect(accountBagsByService(services, [bag('A', 's1', 'Wash & Fold')]).complete).toBe(true)
  })

  it('Packing only asks for a service when there is more than one', () => {
    const ui = read('src/components/laundry/views/laundry-store-stages.tsx')
    expect(ui).toContain('packServices.length > 1 &&')
    expect(ui).toContain('const needsServicePick = packServices.length > 1 && !bagServiceId')
  })
})

describe('no second bag system, no lost identity', () => {
  it('the service comes off the existing assignment row', () => {
    const lib = read('src/lib/laundry-order-bags.ts')
    expect(lib).toContain('serviceId: r.serviceId ?? null')
    expect(lib).toContain('serviceName: r.serviceName ?? null')
  })

  it('re-scanning the same bag is still idempotent', () => {
    const assign = read('src/lib/laundry-bag-assign.ts')
    expect(assign).toContain('if (bag.currentOrderId === orderId) {')  // still idempotent: the early
      // return is now a block, because re-scanning also records a role that was
      // never captured. It still creates no second assignment row.
    expect(assign).toContain('return { ok: true, bag }')
  })

  it('the services[0] collapse is gone from both sites', () => {
    expect(code('src/app/api/laundry/orders/[id]/bags/route.ts')).not.toContain('services[0]')
    expect(code('src/components/laundry/views/laundry-store-stages.tsx')).not.toContain('services?.[0]')
  })

  it('the bags endpoint reads every service, not just the first', () => {
    const api = code('src/app/api/laundry/orders/[id]/bags/route.ts')
    expect(api).not.toContain('take: 1')
    expect(api).toContain('requiredBags: true')
    expect(api).toContain('pickServiceForBag')
  })

  it('processing and delivery still read the one assignment list', () => {
    expect(read('src/lib/laundry-delivery-bags.ts')).toContain('orderBags(lbId, orderId)')
  })

  it('partial pickup return is untouched — no gate was added', () => {
    const ret = read('src/app/api/laundry/bags/delivery-return/route.ts')
    expect(ret).not.toContain('requiredBags')
    expect(ret).not.toContain('accountBagsByService')
  })
})
