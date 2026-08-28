import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// PICKUP / DELIVERY OTP ON THE ORDER — display only.
//
// Every part of the lifecycle already existed and is reused unchanged:
// the code lives on LaundryOrder.pickupOtp / deliveryOtp, regenerateOtp()
// rewrites that one field (so an old code is never left valid), and
// verifyPickup / verifyDelivery CLEAR it on success — which is what "confirmed
// and frozen" means. These tests pin that no second OTP source was introduced
// and that no workflow gate was added.
// ============================================================================

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const BLOCK = read('src/components/laundry/order-otp-block.tsx')
const DETAIL = read('src/components/laundry/views/laundry-order-detail.tsx')
const OTP_API = read('src/app/api/laundry/orders/[id]/otp/route.ts')
const VERIFY = read('src/lib/laundry-verification.ts')

describe('P,S · the OTP appears on both cards when scheduled', () => {
  it('the Pickup card renders the block', () => {
    expect(DETAIL).toContain('kind="pickup"')
    expect(DETAIL).toContain('leg={otp?.pickup}')
  })

  it('the Delivery card renders the block', () => {
    expect(DETAIL).toContain('kind="delivery"')
    expect(DETAIL).toContain('leg={otp?.delivery}')
  })

  it('both are labelled unambiguously', () => {
    expect(BLOCK).toContain('kind === "pickup" ? "Pickup OTP" : "Delivery OTP"')
  })

  it('the value is read from the EXISTING endpoint, not recomputed', () => {
    expect(BLOCK).toContain('`/api/laundry/orders/${orderId}/otp?businessId=')
    expect(BLOCK).not.toContain('Math.random')
    expect(BLOCK).not.toContain('generateDeliveryOtp')
  })
})

describe('Q,T · refreshable until confirmed', () => {
  it('refresh posts to the existing endpoint with the leg', () => {
    expect(BLOCK).toContain('method: "POST"')
    expect(BLOCK).toContain('JSON.stringify({ businessId, kind })')
  })

  it('that endpoint regenerates through the existing engine', () => {
    expect(OTP_API).toContain('regenerateOtp(biz.id, id, kind)')
    expect(OTP_API).toContain('notifyPickupOtpGenerated')
    expect(OTP_API).toContain('notifyDeliveryOtpGenerated')
  })

  it('a refresh invalidates the previous code — one field, overwritten', () => {
    expect(VERIFY).toContain('data: kind === "pickup" ? { pickupOtp: otp, pickupVerificationMethod: "OTP" } : { deliveryOtp: otp, deliveryVerificationMethod: "OTP" }')
    expect(BLOCK).toContain('the previous code no longer works')
  })

  it('the button is disabled while the request is in flight', () => {
    expect(BLOCK).toContain('disabled={busy}')
  })
})

describe('R,U · frozen once confirmed', () => {
  it('a confirmed leg shows the confirmation and NO refresh button', () => {
    const branch = BLOCK.slice(BLOCK.indexOf('if (confirmed) {'), BLOCK.indexOf('const refresh ='))
    expect(branch).toContain('OTP Confirmed')
    expect(branch).not.toContain('Refresh OTP')
    expect(branch).not.toContain('onClick')
  })

  it('confirmation is driven by the existing completion flags', () => {
    expect(DETAIL).toContain('confirmed={pickupCompleted}')
    expect(DETAIL).toContain('confirmed={deliveryCompleted}')
    expect(DETAIL).toContain('const pickupCompleted = !!order?.pickupCompletedAt')
    expect(DETAIL).toContain('const deliveryCompleted = !!order?.deliveryCompletedAt || !!order?.deliveredAt')
  })

  it('the engine clears the code on successful verification — nothing to reuse', () => {
    // The confirmed branch therefore has no code to print, by design.
    expect(VERIFY).toContain('pickupOtp: null')
    expect(BLOCK).toContain('can no longer be used or refreshed')
  })
})

describe('V,W · existing verification, permissions and isolation intact', () => {
  it('verifyPickup / verifyDelivery are untouched', () => {
    expect(VERIFY).toContain('export async function verifyPickup(')
    expect(VERIFY).toContain('export async function verifyDelivery(')
  })

  it('reading needs orders.view; refreshing needs orders.edit', () => {
    expect(OTP_API).toContain('requireLaundryPermission(request, businessId, "laundry.orders.view")')
    expect(OTP_API).toContain('requireLaundryPermission(request, b.businessId, "laundry.orders.edit")')
  })

  it('the refresh button is hidden without the edit permission', () => {
    expect(DETAIL).toContain('canRefresh={can("laundry.orders.edit")}')
    expect(BLOCK).toContain('{canRefresh && (')
  })

  it('both endpoints stay tenant-scoped', () => {
    expect(OTP_API).toContain('resolveLaundryBusiness(businessId)')
    expect(OTP_API).toContain('where: { id, businessId: biz.id }')
  })

  it('a NAME-verification order is described, not shown a blank box', () => {
    expect(BLOCK).toContain('verified by name, not an OTP')
  })
})

describe('§3 · no new workflow gate was introduced', () => {
  it('the block only reads and regenerates — it drives no transition', () => {
    for (const w of ['/transition', 'toStatus', 'PAYMENT', 'PENDING_STORE_AUDIT', 'READY_FOR_PROCESSING']) {
      expect(BLOCK, w).not.toContain(w)
    }
  })

  it('it is display-only: no second OTP store, no verification of its own', () => {
    // Code only — the header comment names the engine functions it relies on.
    const code = BLOCK.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')
    for (const w of ['verifyPickup(', 'verifyDelivery(', 'prisma']) expect(code, w).not.toContain(w)
  })

  it('the OTP endpoint itself remains free of workflow side-effects', () => {
    // It writes the OTP and an audit row — never an order status or a workflow
    // event. (`{ status: 4xx }` below are HTTP codes, not order statuses.)
    expect(OTP_API).not.toContain('laundryOrderEvent')
    expect(OTP_API).not.toContain('laundryOrder.update')
    expect(OTP_API).not.toContain('toStatus')
  })
})
