import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Tests for the Laundry Pickup/Delivery verification engine — the server-side
// enforcement of "no pickup / no delivery without successful verification".
//   · OTP method: value must match the stored OTP; the OTP is cleared on success
//     (single-use) and rejected on mismatch ("Invalid Pickup OTP.").
//   · NAME method: identity confirmation is recorded; delivery requires the
//     method to match so completion can never switch to a weaker check.
//   · Generation is best-effort and idempotent (existing OTP never overwritten).
// ============================================================================

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryWorkflowQualityConfig: { findUnique: vi.fn() },
    laundryOrder: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('@/lib/core/delivery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/core/delivery')>()
  return { ...actual, generateDeliveryOtp: vi.fn(() => '4717') }
})

import {
  getVerificationMethods,
  effectiveMethod,
  initPickupVerification,
  ensureDeliveryVerification,
  regenerateOtp,
  verifyPickup,
  verifyDelivery,
} from '../laundry-verification'
import { prisma } from '@/lib/prisma'
import { generateDeliveryOtp } from '@/lib/core/delivery'

const mockCfg = prisma.laundryWorkflowQualityConfig.findUnique as ReturnType<typeof vi.fn>
const mockOrderFindUnique = prisma.laundryOrder.findUnique as ReturnType<typeof vi.fn>
const mockOrderUpdate = prisma.laundryOrder.update as ReturnType<typeof vi.fn>

const LB = 'lb-1'

const otpOrder = { id: 'ord-1', pickupOtp: '1234', pickupVerificationMethod: 'OTP', deliveryOtp: '5678', deliveryVerificationMethod: 'OTP' }
const nameOrder = { id: 'ord-2', pickupOtp: null, pickupVerificationMethod: 'NAME', deliveryOtp: null, deliveryVerificationMethod: 'NAME' }

describe('laundry-verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCfg.mockResolvedValue(null) // unset → default OTP
    mockOrderUpdate.mockResolvedValue({})
  })

  describe('getVerificationMethods', () => {
    it('defaults to OTP when no config row exists', async () => {
      mockCfg.mockResolvedValue(null)
      await expect(getVerificationMethods(LB)).resolves.toEqual({ pickup: 'OTP', delivery: 'OTP' })
    })
    it('reads the configured methods', async () => {
      mockCfg.mockResolvedValue({ pickupVerificationMethod: 'NAME', deliveryVerificationMethod: 'OTP' })
      await expect(getVerificationMethods(LB)).resolves.toEqual({ pickup: 'NAME', delivery: 'OTP' })
    })
  })

  describe('effectiveMethod', () => {
    it('prefers the order snapshot over the current business setting', () => {
      expect(effectiveMethod('NAME', 'OTP')).toBe('NAME')
      expect(effectiveMethod('OTP', 'NAME')).toBe('OTP')
    })
    it('falls back to the configured method when the snapshot is missing', () => {
      expect(effectiveMethod(null, 'NAME')).toBe('NAME')
      expect(effectiveMethod(undefined, 'OTP')).toBe('OTP')
    })
  })

  describe('initPickupVerification', () => {
    it('generates a pickup OTP + snapshots OTP method', async () => {
      const r = await initPickupVerification(LB, 'ord-1')
      expect(r?.method).toBe('OTP')
      expect(r?.otp).toBe('4717')
      expect(mockOrderUpdate).toHaveBeenCalledWith({ where: { id: 'ord-1' }, data: { pickupVerificationMethod: 'OTP', pickupOtp: '4717' } })
    })
    it('snapshots NAME with no OTP', async () => {
      mockCfg.mockResolvedValue({ pickupVerificationMethod: 'NAME' })
      const r = await initPickupVerification(LB, 'ord-1')
      expect(r).toEqual({ method: 'NAME', otp: null })
      expect(generateDeliveryOtp).not.toHaveBeenCalled()
    })
    it('never throws — best-effort on failure', async () => {
      mockOrderUpdate.mockRejectedValue(new Error('db down'))
      await expect(initPickupVerification(LB, 'ord-1')).resolves.toBeNull()
    })
  })

  describe('ensureDeliveryVerification', () => {
    it('generates a fresh delivery OTP when the order first becomes ready', async () => {
      mockOrderFindUnique.mockResolvedValue({ deliveryVerificationMethod: null, deliveryOtp: null })
      const r = await ensureDeliveryVerification(LB, 'ord-1')
      expect(r).toEqual({ method: 'OTP', otp: '4717', generated: true })
    })
    it('is idempotent — never overwrites an existing delivery OTP', async () => {
      mockOrderFindUnique.mockResolvedValue({ deliveryVerificationMethod: 'OTP', deliveryOtp: '9999' })
      const r = await ensureDeliveryVerification(LB, 'ord-1')
      expect(r).toEqual({ method: 'OTP', otp: '9999', generated: false })
      expect(mockOrderUpdate).not.toHaveBeenCalled()
    })
  })

  describe('regenerateOtp', () => {
    it('returns a fresh OTP and snapshots the method to OTP', async () => {
      mockOrderFindUnique.mockResolvedValue({ pickupVerificationMethod: 'OTP', deliveryVerificationMethod: 'OTP' })
      const r = await regenerateOtp(LB, 'ord-1', 'delivery')
      expect(r).toEqual({ ok: true, otp: '4717' })
      expect(mockOrderUpdate).toHaveBeenCalledWith({ where: { id: 'ord-1' }, data: { deliveryOtp: '4717', deliveryVerificationMethod: 'OTP' } })
    })
    it('rejects regeneration for NAME-method orders', async () => {
      mockOrderFindUnique.mockResolvedValue({ pickupVerificationMethod: 'NAME', deliveryVerificationMethod: 'NAME' })
      const r = await regenerateOtp(LB, 'ord-1', 'delivery')
      expect(r.ok).toBe(false)
    })
  })

  describe('verifyPickup', () => {
    it('rejects a wrong OTP', async () => {
      const r = await verifyPickup(LB, otpOrder, '0000', 'Exec')
      expect(r).toEqual({ ok: false, status: 400, error: 'Invalid Pickup OTP.' })
      expect(mockOrderUpdate).not.toHaveBeenCalled()
    })
    it('accepts the matching OTP and clears it (single use)', async () => {
      const r = await verifyPickup(LB, otpOrder, ' 1234 ', 'Exec')
      expect(r.ok).toBe(true)
      expect(mockOrderUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ pickupOtp: null, pickupVerifiedAt: expect.any(Date) }) }))
    })
    it('rejects when the OTP is missing (recovery needed)', async () => {
      const r = await verifyPickup(LB, { ...otpOrder, pickupOtp: null }, '1234', 'Exec')
      expect(r.ok).toBe(false)
      expect(r).toMatchObject({ status: 409 })
    })
    it('records a NAME confirmation without an OTP', async () => {
      const r = await verifyPickup(LB, nameOrder, 'Mukhtar', 'Exec')
      expect(r).toEqual({ ok: true, method: 'NAME' })
      expect(mockOrderUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ pickupVerifiedAt: expect.any(Date) }) }))
    })
  })

  describe('verifyDelivery', () => {
    it('rejects a wrong delivery OTP', async () => {
      const r = await verifyDelivery(LB, otpOrder, 'OTP', '0000')
      expect(r).toEqual({ ok: false, status: 400, error: 'Invalid delivery OTP.' })
      expect(mockOrderUpdate).not.toHaveBeenCalled()
    })
    it('accepts the matching delivery OTP and clears it', async () => {
      const r = await verifyDelivery(LB, otpOrder, 'OTP', '5678')
      expect(r.ok).toBe(true)
      expect(mockOrderUpdate).toHaveBeenCalledWith({ where: { id: otpOrder.id }, data: { deliveryOtp: null } })
    })
    it('blocks OTP completion with a missing delivery OTP', async () => {
      const r = await verifyDelivery(LB, { ...otpOrder, deliveryOtp: null }, 'OTP', '5678')
      expect(r.ok).toBe(false)
      expect(r).toMatchObject({ status: 409 })
    })
    it('NAME-method order refuses an OTP attempt (cannot weaken the check)', async () => {
      const r = await verifyDelivery(LB, nameOrder, 'OTP', '1234')
      if (r.ok) throw new Error('expected failure')
      expect(r.error).toContain('Name verification')
    })
    it('NAME-method order accepts an explicit name confirmation', async () => {
      const r = await verifyDelivery(LB, nameOrder, 'NAME', null)
      expect(r).toEqual({ ok: true, method: 'NAME' })
    })
  })
})
