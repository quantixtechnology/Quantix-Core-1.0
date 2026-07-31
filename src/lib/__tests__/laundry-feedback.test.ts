import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Tests for the Customer Rating & Feedback engine. One feedback record per
// delivered order (@@unique(orderId)): rating 1–5 is mandatory, comment is
// optional, a second submission is rejected, and only the order's own customer
// can ever reach the engine (ownership scoping). Business-owner view only.
// ============================================================================

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryOrder: { findFirst: vi.fn(), findMany: vi.fn() },
    laundryOrderFeedback: { findUnique: vi.fn(), create: vi.fn() },
  },
}))

import { submitOrderFeedback, sanitizeRating, getFeedbackSummary, getOrderFeedback } from '../laundry-feedback'
import { prisma } from '@/lib/prisma'

const mockOrderFindFirst = prisma.laundryOrder.findFirst as ReturnType<typeof vi.fn>
const mockOrderFindMany = prisma.laundryOrder.findMany as ReturnType<typeof vi.fn>
const mockFindUnique = prisma.laundryOrderFeedback.findUnique as ReturnType<typeof vi.fn>
const mockCreate = prisma.laundryOrderFeedback.create as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('sanitizeRating', () => {
  it('accepts integers 1..5', () => {
    expect(sanitizeRating(1)).toBe(1)
    expect(sanitizeRating(5)).toBe(5)
    expect(sanitizeRating('4')).toBe(4)
  })
  it('rejects out-of-range, non-integer and missing values', () => {
    expect(sanitizeRating(0)).toBeNull()
    expect(sanitizeRating(6)).toBeNull()
    expect(sanitizeRating(2.5)).toBeNull()
    expect(sanitizeRating('abc')).toBeNull()
    expect(sanitizeRating(undefined)).toBeNull()
  })
})

describe('submitOrderFeedback', () => {
  it('returns 400 when the rating is invalid', async () => {
    const r = await submitOrderFeedback({ orderId: 'o1', customerId: 'c1', rating: 0 })
    expect(r).toMatchObject({ ok: false, status: 400 })
    expect(mockOrderFindFirst).not.toHaveBeenCalled()
  })

  it('returns 404 when the order does not belong to the customer', async () => {
    mockOrderFindFirst.mockResolvedValue(null)
    const r = await submitOrderFeedback({ orderId: 'o1', customerId: 'c1', rating: 5 })
    expect(r).toMatchObject({ ok: false, status: 404 })
  })

  it('rejects feedback on non-delivered orders', async () => {
    mockOrderFindFirst.mockResolvedValue({ id: 'o1', businessId: 'b1', status: 'PROCESSING' })
    const r = await submitOrderFeedback({ orderId: 'o1', customerId: 'c1', rating: 4 })
    expect(r).toMatchObject({ ok: false, status: 409 })
    expect((r as { error: string }).error).toContain('delivered')
  })

  it('rejects a second submission for the same order', async () => {
    mockOrderFindFirst.mockResolvedValue({ id: 'o1', businessId: 'b1', status: 'DELIVERED' })
    mockFindUnique.mockResolvedValue({ id: 'fb-1' })
    const r = await submitOrderFeedback({ orderId: 'o1', customerId: 'c1', rating: 5 })
    expect(r).toMatchObject({ ok: false, status: 409 })
    expect((r as { error: string }).error).toContain('already been submitted')
  })

  it('creates feedback for a delivered order owned by the customer', async () => {
    mockOrderFindFirst.mockResolvedValue({ id: 'o1', businessId: 'b1', status: 'DELIVERED' })
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue({ id: 'fb-1', businessId: 'b1', orderId: 'o1', customerId: 'c1', rating: 5, comment: 'Great service', submittedAt: new Date('2026-01-01') })
    const r = await submitOrderFeedback({ orderId: 'o1', customerId: 'c1', rating: 5, comment: '  Great service  ' })
    expect(r).toMatchObject({ ok: true })
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ rating: 5, comment: 'Great service', businessId: 'b1', customerId: 'c1', orderId: 'o1' }),
    }))
  })

  it('stores an empty/whitespace comment as null', async () => {
    mockOrderFindFirst.mockResolvedValue({ id: 'o1', businessId: 'b1', status: 'DELIVERED' })
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue({ id: 'fb-1', businessId: 'b1', orderId: 'o1', customerId: 'c1', rating: 3, comment: null, submittedAt: new Date() })
    const r = await submitOrderFeedback({ orderId: 'o1', customerId: 'c1', rating: 3, comment: '   ' })
    expect(r).toMatchObject({ ok: true, feedback: { rating: 3, comment: null } })
    expect(mockCreate.mock.calls[0][0].data.comment).toBeNull()
  })
})

describe('getOrderFeedback', () => {
  it('returns the stored row, or null when none', async () => {
    mockFindUnique.mockResolvedValue({ rating: 4, comment: 'Nice', submittedAt: new Date('2026-01-01') })
    const r = await getOrderFeedback('o1')
    expect(r).toMatchObject({ rating: 4, comment: 'Nice' })
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { orderId: 'o1' }, select: expect.anything() })

    mockFindUnique.mockResolvedValue(null)
    expect(await getOrderFeedback('o1')).toBeNull()
  })
})

describe('getFeedbackSummary', () => {
  it('computes average + per-star counts from submitted feedback, store-scoped', async () => {
    mockOrderFindMany.mockResolvedValue([
      { feedback: { rating: 5 } }, { feedback: { rating: 5 } }, { feedback: { rating: 4 } }, { feedback: { rating: 3 } },
    ])
    const s = await getFeedbackSummary('b1', 'store-1')
    expect(s.total).toBe(4)
    expect(s.average).toBe(4.25)
    expect(s.byRating).toEqual({ 1: 0, 2: 0, 3: 1, 4: 1, 5: 2 })
    // store scoping is applied through the order query
    expect(mockOrderFindMany.mock.calls[0][0].where).toMatchObject({ businessId: 'b1', storeId: 'store-1', feedback: { isNot: null } })
  })

  it('returns zeros when no feedback exists', async () => {
    mockOrderFindMany.mockResolvedValue([])
    const s = await getFeedbackSummary('b1')
    expect(s).toEqual({ average: 0, total: 0, byRating: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } })
  })
})
