import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const API = readFileSync(join(process.cwd(), 'src/app/api/laundry/orders/[id]/items/[itemId]/route.ts'), 'utf8')

describe('audit corrections are financially safe', () => {
  it('never touches a payment row', () => {
    expect(API).not.toContain('laundryPayment')
    // Reading amountPaid is required to compute the balance; WRITING it would
    // rewrite history, so assert on the data: blocks only.
    // amountPaid is read (for the balance) and returned (for the caller) but
    // never written: assert on the order UPDATE payload itself.
    const upd = API.slice(API.indexOf('tx.laundryOrder.update'))
    const payload = upd.slice(0, upd.indexOf('})'))
    expect(payload).toContain('balanceDue')
    expect(payload).not.toContain('amountPaid:')
  })

  it('recomputes totals from the CURRENT items, not by a delta', () => {
    expect(API).toContain('laundryOrderItem.findMany')
    expect(API).toContain('resolveOrderBilling')
    expect(API).toMatch(/subtotal,\s*gstTotal,\s*grandTotal,\s*totalWeightKg/)
  })

  it('moves only the balance on a paid order', () => {
    expect(API).toContain('balanceDue: r2(Math.max(0, grandTotal - (order.amountPaid || 0)))')
  })

  it('reuses the existing billing engine — no second pricing path', () => {
    expect(API).toContain('from "@/lib/laundry-billing-server"')
    expect(API).not.toMatch(/pricingRule\.findMany|unitPrice\s*=\s*\d/)
  })
})

describe('validation happens before anything is written', () => {
  it('refuses an inactive or unknown service and garment', () => {
    expect(API).toContain('That service is not available.')
    expect(API).toContain('That garment is not available.')
    expect(API).toMatch(/isActive: true/)
  })

  it('refuses an NA combination by name, before the update', () => {
    expect(API).toContain('is not available for')
    // Scoped to PATCH: recomputeOrder() above it also updates items.
    const patch = API.slice(API.indexOf('export async function PATCH'))
    expect(patch.indexOf('const probe = await resolveOrderBilling')).toBeLessThan(patch.indexOf('laundryOrderItem.update'))
  })
})

describe('history reuses the existing order timeline', () => {
  it('writes LaundryOrderEvent, not a new model', () => {
    expect(API).toContain('laundryOrderEvent.create')
    expect(API).toContain('AUDIT_ITEM_CHANGED')
    expect(API).toContain('AUDIT_ITEM_REMOVED')
  })

  it('records before → after', () => {
    expect(API).toContain('`${before} → ${after}`')
  })

  // A correction is not a transition; the event must not imply the order moved.
  it('stamps the order CURRENT status, so no transition is implied', () => {
    expect(API).toContain('toStatus: order.status')
  })

  it('never blocks a correction on the timeline write', () => {
    expect(API).toMatch(/catch \{ \/\* the timeline is diagnostic/)
  })
})

describe('permissions reuse the audit screen', () => {
  it('editing requires store_audit edit', () => {
    expect(API.match(/store_ops\.store_audit\.edit/g)?.length).toBe(2)
  })
  it('adds no new permission key', () => {
    expect(API).not.toMatch(/laundry\.(audit_edit|item_edit)/)
  })
})
