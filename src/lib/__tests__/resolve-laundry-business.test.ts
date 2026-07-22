import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Tests for resolveLaundryBusiness() — business resolution, orphan repair,
// self-healing, duplicate prevention, and non-laundry blocking.
//
// RESOLUTION ORDER (from code):
//   1. Exact match by LaundryBusiness.id
//   2. Match by platformBusinessId (Open Workspace path)
//   3. Orphan repair: platform Business with matching name has an unlinked
//      LaundryBusiness (platformBusinessId IS NULL) → backfill the link
//   4. Only if nothing exists: create a brand-new LaundryBusiness.
// ============================================================================

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryBusiness: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    business: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/laundry-codes', () => ({
  generateBusinessCode: vi.fn(() => Promise.resolve('LND-202607-0001')),
}))

import { resolveLaundryBusiness } from '../laundry-business'
import { prisma } from '@/lib/prisma'

const mockLaundryFindFirst = prisma.laundryBusiness.findFirst as ReturnType<typeof vi.fn>
const mockBusinessFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>
const mockLaundryCreate = prisma.laundryBusiness.create as ReturnType<typeof vi.fn>
const mockLaundryUpdate = prisma.laundryBusiness.update as ReturnType<typeof vi.fn>

const LB_ID = 'lb-111'
const PLATFORM_ID = 'biz-aaa'
const ORPHAN_LB_ID = 'lb-orphan'

describe('resolveLaundryBusiness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Step 1 & 2: Direct match ──────────────────────────────────────────────

  it('1. returns null for null/undefined input', async () => {
    expect(await resolveLaundryBusiness(null)).toBeNull()
    expect(await resolveLaundryBusiness(undefined)).toBeNull()
    expect(mockLaundryFindFirst).not.toHaveBeenCalled()
  })

  it('2. matches existing LaundryBusiness by its own id', async () => {
    mockLaundryFindFirst.mockResolvedValueOnce({ id: LB_ID, platformBusinessId: PLATFORM_ID })

    const result = await resolveLaundryBusiness(LB_ID)

    expect(result).toEqual({ id: LB_ID, platformBusinessId: PLATFORM_ID })
    expect(mockLaundryFindFirst).toHaveBeenCalledWith({
      where: { OR: [{ id: LB_ID }, { platformBusinessId: LB_ID }] },
      select: { id: true, platformBusinessId: true },
    })
    expect(mockBusinessFindUnique).not.toHaveBeenCalled()
    expect(mockLaundryCreate).not.toHaveBeenCalled()
  })

  it('3. matches existing LaundryBusiness by platformBusinessId (Open Workspace)', async () => {
    mockLaundryFindFirst.mockResolvedValueOnce({ id: LB_ID, platformBusinessId: PLATFORM_ID })

    const result = await resolveLaundryBusiness(PLATFORM_ID)

    expect(result).toEqual({ id: LB_ID, platformBusinessId: PLATFORM_ID })
    expect(mockLaundryFindFirst).toHaveBeenCalledWith({
      where: { OR: [{ id: PLATFORM_ID }, { platformBusinessId: PLATFORM_ID }] },
      select: { id: true, platformBusinessId: true },
    })
  })

  // ── Step 3: Orphan repair ─────────────────────────────────────────────────

  it('4. orphan repair: backfills platformBusinessId when name matches orphan', async () => {
    // OR lookup → null (orphan has null platformBusinessId)
    mockLaundryFindFirst.mockResolvedValueOnce(null)
    // Business lookup → found
    mockBusinessFindUnique.mockResolvedValueOnce({
      id: PLATFORM_ID,
      name: 'VASTRASUDHA LAUNDRY',
      businessCode: 'VSL',
      contactPhone: '',
      contactEmail: null,
      productCode: 'LAUNDRY',
    })
    // Orphan lookup → found by name match
    mockLaundryFindFirst.mockResolvedValueOnce({ id: ORPHAN_LB_ID })
    // Update → success
    mockLaundryUpdate.mockResolvedValueOnce({ id: ORPHAN_LB_ID, platformBusinessId: PLATFORM_ID })

    const result = await resolveLaundryBusiness(PLATFORM_ID)

    expect(result).toEqual({ id: ORPHAN_LB_ID, platformBusinessId: PLATFORM_ID })
    // Orphan was found by businessName + null platformBusinessId
    expect(mockLaundryFindFirst).toHaveBeenNthCalledWith(2, {
      where: { businessName: 'VASTRASUDHA LAUNDRY', platformBusinessId: null },
      select: { id: true },
    })
    // Backfilled the link
    expect(mockLaundryUpdate).toHaveBeenCalledWith({
      where: { id: ORPHAN_LB_ID },
      data: { platformBusinessId: PLATFORM_ID },
    })
    // Did NOT create a new record
    expect(mockLaundryCreate).not.toHaveBeenCalled()
  })

  it('5. orphan repair: passes through to create when name does not match any orphan', async () => {
    // OR lookup → null
    mockLaundryFindFirst.mockResolvedValueOnce(null)
    // Business lookup → found
    mockBusinessFindUnique.mockResolvedValueOnce({
      id: PLATFORM_ID,
      name: 'Brand New Laundry',
      businessCode: 'BNL',
      contactPhone: '',
      contactEmail: null,
      productCode: null,
    })
    // Orphan lookup → null (no orphan with this name)
    mockLaundryFindFirst.mockResolvedValueOnce(null)
    // Create → new record
    mockLaundryCreate.mockResolvedValueOnce({ id: LB_ID, platformBusinessId: PLATFORM_ID })

    const result = await resolveLaundryBusiness(PLATFORM_ID)

    expect(result).toEqual({ id: LB_ID, platformBusinessId: PLATFORM_ID })
    expect(mockLaundryUpdate).not.toHaveBeenCalled()
    expect(mockLaundryCreate).toHaveBeenCalledTimes(1)
  })

  // ── Step 4: Create new ────────────────────────────────────────────────────

  it('6. creates new LaundryBusiness when platform Business has LAUNDRY productCode and no orphan', async () => {
    mockLaundryFindFirst.mockResolvedValueOnce(null) // OR lookup → null
    mockBusinessFindUnique.mockResolvedValueOnce({
      id: PLATFORM_ID,
      name: 'Test Laundry',
      businessCode: 'TST',
      contactPhone: '9999999999',
      contactEmail: 'test@test.com',
      productCode: 'LAUNDRY',
    })
    mockLaundryFindFirst.mockResolvedValueOnce(null) // orphan lookup → null
    mockLaundryCreate.mockResolvedValueOnce({ id: LB_ID, platformBusinessId: PLATFORM_ID })

    const result = await resolveLaundryBusiness(PLATFORM_ID)

    expect(result).toEqual({ id: LB_ID, platformBusinessId: PLATFORM_ID })
    expect(mockLaundryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessName: 'Test Laundry',
        platformBusinessId: PLATFORM_ID,
        status: 'ACTIVE',
      }),
      select: { id: true, platformBusinessId: true },
    })
  })

  it('7. creates new LaundryBusiness when productCode is null (unclassified) and no orphan', async () => {
    mockLaundryFindFirst.mockResolvedValueOnce(null) // OR lookup
    mockBusinessFindUnique.mockResolvedValueOnce({
      id: PLATFORM_ID,
      name: 'Unclassified Biz',
      businessCode: 'UNC',
      contactPhone: '',
      contactEmail: null,
      productCode: null,
    })
    mockLaundryFindFirst.mockResolvedValueOnce(null) // orphan lookup
    mockLaundryCreate.mockResolvedValueOnce({ id: LB_ID, platformBusinessId: PLATFORM_ID })

    const result = await resolveLaundryBusiness(PLATFORM_ID)

    expect(result).toEqual({ id: LB_ID, platformBusinessId: PLATFORM_ID })
    expect(mockLaundryCreate).toHaveBeenCalled()
  })

  it('8. blocks non-laundry productCode (e.g. COMMERCE, PHARMACY)', async () => {
    mockLaundryFindFirst.mockResolvedValueOnce(null) // OR lookup
    mockBusinessFindUnique.mockResolvedValueOnce({
      id: PLATFORM_ID,
      name: 'E-Commerce Shop',
      businessCode: 'ECOMM',
      contactPhone: '',
      contactEmail: null,
      productCode: 'COMMERCE',
    })

    const result = await resolveLaundryBusiness(PLATFORM_ID)

    expect(result).toBeNull()
    expect(mockLaundryCreate).not.toHaveBeenCalled()
  })

  it('9. no duplicate LaundryBusiness created when one already exists with same platformBusinessId (race)', async () => {
    mockLaundryFindFirst.mockResolvedValueOnce(null) // OR lookup → null
    mockBusinessFindUnique.mockResolvedValueOnce({
      id: PLATFORM_ID,
      name: 'Test',
      businessCode: 'TST',
      contactPhone: '',
      contactEmail: null,
      productCode: 'LAUNDRY',
    })
    mockLaundryFindFirst.mockResolvedValueOnce(null) // orphan lookup → null
    // Create throws (unique constraint — concurrent request)
    mockLaundryCreate.mockRejectedValueOnce(new Error('Unique constraint'))
    // Retry finds the concurrent record
    mockLaundryFindFirst.mockResolvedValueOnce({ id: LB_ID, platformBusinessId: PLATFORM_ID })

    const result = await resolveLaundryBusiness(PLATFORM_ID)

    expect(result).toEqual({ id: LB_ID, platformBusinessId: PLATFORM_ID })
    expect(mockLaundryCreate).toHaveBeenCalledTimes(1)
    // findFirst called: OR lookup, orphan lookup, retry = 3 times
    expect(mockLaundryFindFirst).toHaveBeenCalledTimes(3)
  })

  it('10. returns null when platform Business does not exist', async () => {
    mockLaundryFindFirst.mockResolvedValueOnce(null) // OR lookup
    mockBusinessFindUnique.mockResolvedValueOnce(null)

    const result = await resolveLaundryBusiness('nonexistent-id')

    expect(result).toBeNull()
    expect(mockLaundryCreate).not.toHaveBeenCalled()
  })

  it('11. returns null when create fails and no raced record found', async () => {
    mockLaundryFindFirst.mockResolvedValueOnce(null) // OR lookup
    mockBusinessFindUnique.mockResolvedValueOnce({
      id: PLATFORM_ID,
      name: 'Test',
      businessCode: 'TST',
      contactPhone: '',
      contactEmail: null,
      productCode: null,
    })
    mockLaundryFindFirst.mockResolvedValueOnce(null) // orphan lookup
    mockLaundryCreate.mockRejectedValueOnce(new Error('DB error'))
    mockLaundryFindFirst.mockResolvedValueOnce(null) // retry also fails

    const result = await resolveLaundryBusiness(PLATFORM_ID)

    expect(result).toBeNull()
  })

  // ── Edge cases ────────────────────────────────────────────────────────────

  it('12. returns null when Business has no name (empty string) — skips orphan repair, creates new', async () => {
    mockLaundryFindFirst.mockResolvedValueOnce(null) // OR lookup
    mockBusinessFindUnique.mockResolvedValueOnce({
      id: PLATFORM_ID,
      name: '',
      businessCode: '',
      contactPhone: '',
      contactEmail: null,
      productCode: 'LAUNDRY',
    })
    // orphan lookup skipped because business.name is falsy
    mockLaundryCreate.mockResolvedValueOnce({ id: LB_ID, platformBusinessId: PLATFORM_ID })

    const result = await resolveLaundryBusiness(PLATFORM_ID)

    expect(result).toEqual({ id: LB_ID, platformBusinessId: PLATFORM_ID })
    expect(mockLaundryFindFirst).toHaveBeenCalledTimes(1) // only OR lookup, no orphan lookup
    expect(mockLaundryCreate).toHaveBeenCalledTimes(1)
  })
})
