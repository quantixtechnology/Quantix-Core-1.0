import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  assertSingleServiceOrder, assertServiceAllowedOnOrder, distinctServices,
  conflictMessage, oneServiceError, serviceKey,
} from '@/lib/laundry-one-service'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
/** Source with comments stripped — prose ABOUT bags is not bag code. */
const code = (p: string) => read(p).split('\n').filter((x) => !x.trim().startsWith('//') && !x.trim().startsWith('*') && !x.trim().startsWith('/*')).join('\n')
const l = (serviceId: string | null, serviceName: string) => ({ serviceId, serviceName })

const WI = l('s-wi', 'Wash & Iron')
const DC = l('s-dc', 'Dry Clean')
const WF = l('s-wf', 'Wash & Fold')

describe('a NEW order carries exactly one service', () => {
  it('an empty order establishes nothing yet', () => {
    expect(assertSingleServiceOrder([])).toEqual({ ok: true, service: null })
  })

  it('one service is allowed', () => {
    const r = assertSingleServiceOrder([WI])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.service?.serviceName).toBe('Wash & Iron')
  })

  it('many garments of the SAME service are allowed', () => {
    const r = assertSingleServiceOrder([
      { ...WI, garmentName: 'Shirt' }, { ...WI, garmentName: 'Pant' },
      { ...WI, garmentName: 'Bedsheet' }, { ...WI, garmentName: 'T-Shirt' },
    ] as never)
    expect(r.ok).toBe(true)
  })

  it('a second, different service is refused', () => {
    const r = assertSingleServiceOrder([WI, DC])
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('MULTIPLE_SERVICES')
      expect(r.existingService).toBe('Wash & Iron')
      expect(r.rejectedService).toBe('Dry Clean')
    }
  })

  it('the message names both services and says what to do', () => {
    const r = assertSingleServiceOrder([WI, DC])
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toBe('This order already contains garments for Wash & Iron. Different services cannot be added to the same order. Please create a new order for Dry Clean.')
      expect(r.error).toContain('create a new order')
    }
  })

  it('a THIRD service is refused just the same', () => {
    expect(assertSingleServiceOrder([WI, WF]).ok).toBe(false)
    expect(assertSingleServiceOrder([WI, DC, WF]).ok).toBe(false)
  })

  it('services are matched by id, and by name when there is no id', () => {
    expect(serviceKey({ serviceId: 's1', serviceName: 'X' })).toBe('s1')
    expect(serviceKey({ serviceId: null, serviceName: 'Wash & Iron' })).toBe('WASH & IRON')
    // same service, two spellings of case → still one service
    expect(distinctServices([{ serviceId: null, serviceName: 'wash & iron' }, { serviceId: null, serviceName: 'WASH & IRON' }])).toHaveLength(1)
  })
})

describe('adding garments to an order that already exists', () => {
  it('the first garment establishes the service on an empty order', () => {
    const r = assertServiceAllowedOnOrder([], [WI])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.service?.serviceName).toBe('Wash & Iron')
  })

  it('an empty order still cannot take two services at once', () => {
    expect(assertServiceAllowedOnOrder([], [WI, DC]).ok).toBe(false)
  })

  it('the same service can add more garments', () => {
    expect(assertServiceAllowedOnOrder([WI], [WI]).ok).toBe(true)
    expect(assertServiceAllowedOnOrder([WI], [WI, WI]).ok).toBe(true)
  })

  it('a different service is refused', () => {
    const r = assertServiceAllowedOnOrder([WI], [DC])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('Please create a new order for Dry Clean')
  })

  // PART 5 — the rule must never disturb an order that already has two.
  it('an EXISTING multi-service order keeps working for BOTH its services', () => {
    expect(assertServiceAllowedOnOrder([WF, DC], [WF]).ok).toBe(true)
    expect(assertServiceAllowedOnOrder([WF, DC], [DC]).ok).toBe(true)
  })

  it('…but a third service can never appear on it', () => {
    const r = assertServiceAllowedOnOrder([WF, DC], [WI])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.rejectedService).toBe('Wash & Iron')
  })

  it('an emptied order has no stale lock — the next garment establishes afresh', () => {
    expect(assertServiceAllowedOnOrder([], [DC]).ok).toBe(true)
  })

  it('adding nothing is not a violation', () => {
    expect(assertServiceAllowedOnOrder([WI], []).ok).toBe(true)
  })
})

describe('the server is the final authority', () => {
  it('the single creation path enforces it for every channel', () => {
    const engine = read('src/lib/laundry-order-engine.ts')
    expect(engine).toContain('assertSingleServiceOrder([...(input.serviceLines ?? []), ...input.lines])')
    // thrown, because the engine has no NextResponse of its own
    expect(engine).toContain('code: oneService.code')
  })

  it.each([
    'src/app/api/laundry/orders/route.ts',
    'src/app/api/core/storefront/laundry-checkout/route.ts',
    'src/app/api/core/storefront/laundry-order/route.ts',
  ])('%s answers 400, not 500', (f) => {
    const src = read(f)
    expect(src).toContain('const oneSvc = oneServiceError(')
    expect(src).toContain('{ status: 400 }')
  })

  it('the add-garment endpoint refuses BEFORE anything is persisted', () => {
    const api = read('src/app/api/laundry/orders/[id]/items/route.ts')
    const checkAt = api.indexOf('assertServiceAllowedOnOrder')
    expect(checkAt).toBeGreaterThan(-1)
    // nothing is written before the check
    expect(checkAt).toBeLessThan(api.indexOf('laundryOrderItem.create'))
    expect(checkAt).toBeLessThan(api.indexOf('resolveOrderBilling('))
    expect(checkAt).toBeLessThan(api.indexOf('nextGarScanCode()'))
  })

  it('a refusal creates no item, no service row and no bag', () => {
    const api = read('src/app/api/laundry/orders/[id]/items/route.ts')
    const upTo = api.slice(0, api.indexOf('assertServiceAllowedOnOrder'))
    for (const w of ['laundryOrderItem.create', 'laundryOrderService.create', 'laundryBag', 'laundryOrder.update']) {
      expect(upTo, `nothing may write ${w} before the check`).not.toContain(w)
    }
  })

  // PART 14 — two requests must not race a mixed-service order into existence.
  it('re-checks inside the transaction against authoritative state', () => {
    const api = read('src/app/api/laundry/orders/[id]/items/route.ts')
    const tx = api.slice(api.indexOf('prisma.$transaction(async (tx)'))
    expect(tx).toContain('tx.laundryOrderService.findMany')
    expect(tx).toContain('tx.laundryOrderItem.findMany')
    expect(tx).toContain('assertServiceAllowedOnOrder')
    // and the re-check runs before any create in that transaction
    expect(tx.indexOf('assertServiceAllowedOnOrder')).toBeLessThan(tx.indexOf('laundryOrderItem.create'))
  })

  it('the concurrent loser gets a conflict, not a 500', () => {
    expect(read('src/app/api/laundry/orders/[id]/items/route.ts')).toContain('{ status: 409 }')
  })

  it('oneServiceError only recognises this rule', () => {
    expect(oneServiceError({ code: 'MULTIPLE_SERVICES', message: 'x' })?.code).toBe('MULTIPLE_SERVICES')
    expect(oneServiceError(new Error('anything else'))).toBeNull()
    expect(oneServiceError(null)).toBeNull()
  })
})

describe('both entry surfaces refuse it, and explain', () => {
  it('offline New Order derives the lock from the lines, so it cannot go stale', () => {
    const ui = read('src/components/laundry/views/laundry-new-order.tsx')
    expect(ui).toContain('const orderService = useMemo(')
    expect(ui).toContain('const first = lineItems[0]')
    expect(ui).toContain('if (orderService && mService !== orderService.id)')
    expect(ui).toContain('conflictMessage(orderService.name')
    // the service is shown as a compact line rather than the old banner card
    expect(ui).toContain('Order service')
  })

  it('the storefront cart refuses a second service with the same message', () => {
    const ui = read('src/components/storefront/web/storefront-laundry-home.tsx')
    expect(ui).toContain("l.kind === \"laundry\" && l.serviceId && l.serviceId !== service.id")
    expect(ui).toContain('conflictMessage(')
  })

  it('both surfaces use ONE message, not two wordings', () => {
    expect(conflictMessage('A', 'B')).toContain('Please create a new order for B')
    for (const f of ['src/components/laundry/views/laundry-new-order.tsx', 'src/components/storefront/web/storefront-laundry-home.tsx']) {
      expect(read(f)).toContain('conflictMessage')
    }
  })
})

describe('nothing else changed', () => {
  it('Express/Normal is a separate constraint and untouched', () => {
    const ui = read('src/components/laundry/views/laundry-new-order.tsx')
    expect(ui).toContain('express')
    const lib = read('src/lib/laundry-one-service.ts')
    expect(lib).not.toContain('express')
    expect(lib).not.toContain('isExpress')
  })

  it('the rule touches no bag, status, payment or lifecycle code', () => {
    const lib = code('src/lib/laundry-one-service.ts')
    for (const w of ['prisma', 'bag', 'Bag', 'status', 'DELIVERED', 'payment']) {
      expect(lib, `the rule must not reference ${w}`).not.toContain(w)
    }
  })

  it('no schema change was needed', () => {
    // The order's service is already recorded on LaundryOrderService and on
    // each item; the rule is a constraint over data that already exists.
    const schema = read('prisma/schema.prisma')
    expect(schema).toContain('model LaundryOrderService {')
    expect(read('src/lib/laundry-one-service.ts')).not.toContain('@default')
  })
})

// ============================================================================
// The operator picks the garment and the quantity. The service is already known.
// ============================================================================
describe('Add Garment inherits the order service', () => {
  const UI = read('src/components/laundry/views/laundry-new-order.tsx')

  it('reopening the modal preselects the established service', () => {
    expect(UI).toContain('setMService(orderService?.id || "")')
    // …and blanks it only when the order has none yet
    expect(UI).not.toContain('const openAddGarment = () => { setMGarment(""); setMService("");')
  })

  it('changing the garment keeps the inherited service instead of re-picking', () => {
    expect(UI).toContain('if (orderService) {')
    expect(UI).toContain('setMService(mServices.some((sv) => sv.id === orderService.id) ? orderService.id : "")')
  })

  it('the effect re-runs when the order service appears or clears', () => {
    expect(UI).toContain('}, [mGarment, mServices, orderService])')
  })

  it('the established service is ONE compact line, not a card or a field', () => {
    expect(UI).toContain('{orderService.name} · {turnaroundLabel(orderService.turnaroundHours)}')
    expect(UI).toContain('Order service')
    // the dropdown is only for the FIRST garment
    expect(UI).toContain('{orderService ? (')
    expect(UI).toContain('<SearchableSelect value={mService}')
    // the large information card is gone
    expect(UI).not.toContain('rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2')
    expect(UI).not.toContain('Order Service: {orderService.name}')
  })

  it('"Add another service" only explains the rule — it can never add one', () => {
    expect(UI).toContain('Add another service')
    expect(UI).toContain('setSvcNote((v) => !v)')
    expect(UI).toContain('One service per order. For a different service, save this order and create a new one.')
    // it toggles a note and nothing else: no line, no service, no submit
    const btn = UI.slice(UI.indexOf('onClick={() => setSvcNote'), UI.indexOf('Add another service') + 40)
    for (const forbidden of ['setLineItems', 'setMService', 'confirmAddGarment', 'fetch(']) {
      expect(btn, `the action must not ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('the disclaimer resets each time the modal opens', () => {
    expect(UI).toContain('setSvcNote(false); setAddOpen(true)')
  })

  it('an inherited service not priced for the garment is explained, not silently failed', () => {
    expect(UI).toContain('const lockedServiceUnavailable =')
    expect(UI).toContain('is not priced for')
    expect(UI).toContain('create a separate order for another service')
  })

  it('emptying the order clears the inheritance — the lock is derived, not stored', () => {
    // orderService reads lineItems[0]; with no lines it is null, so the next
    // first garment establishes afresh. There is no separate state to reset.
    expect(UI).toContain('const first = lineItems[0]')
    expect(UI).toContain('if (!first) return null')
    expect(UI).not.toContain('setOrderService(')
  })

  it('the restriction itself is unchanged — a different service is still refused', () => {
    expect(UI).toContain('if (orderService && mService !== orderService.id)')
    expect(UI).toContain('conflictMessage(orderService.name')
  })

  it('the server rules are untouched by this UX change', () => {
    expect(read('src/lib/laundry-order-engine.ts')).toContain('assertSingleServiceOrder')
    expect(read('src/app/api/laundry/orders/[id]/items/route.ts')).toContain('assertServiceAllowedOnOrder')
  })

  it('the online flow was not touched', () => {
    const store = read('src/components/storefront/web/storefront-laundry-home.tsx')
    expect(store).not.toContain('orderService')
    expect(store).toContain('conflictMessage(')
  })
})
