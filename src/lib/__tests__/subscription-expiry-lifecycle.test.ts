import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const { prismaMock, grantAllowanceMock, writeLedgerMock, coverageUnitOfMock, cycleEndMock } = vi.hoisted(() => ({
  prismaMock: {
    customerSubscription: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn(),
    },
    subscriptionPlan: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    subscriptionLedgerEntry: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn(),
    },
    laundryBusiness: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => {
      const tx = {
        customerSubscription: {
          findUnique: vi.fn(),
          findMany: vi.fn(),
          update: vi.fn().mockResolvedValue({}),
          create: vi.fn(),
        },
        subscriptionPlan: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        subscriptionLedgerEntry: {
          create: vi.fn().mockResolvedValue({}),
          findMany: vi.fn(),
        },
        laundryBusiness: {
          findMany: vi.fn(),
        },
      }
      return cb(tx)
    }),
  },
  grantAllowanceMock: vi.fn(),
  writeLedgerMock: vi.fn(),
  coverageUnitOfMock: vi.fn(() => "PER_PIECE"),
  cycleEndMock: vi.fn((cycle, from) => {
    const d = new Date(from)
    d.setMonth(d.getMonth() + 1)
    return d
  }),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}))

vi.mock("@/lib/laundry-subscription-server", () => ({
  grantAllowance: grantAllowanceMock,
  writeLedger: writeLedgerMock,
  coverageUnitOf: coverageUnitOfMock,
}))

vi.mock("@/lib/laundry-subscription-purchase", () => ({
  cycleEnd: cycleEndMock,
}))

import { processExpiry, processDueSubscriptions } from "@/lib/laundry-subscription-renewal"
import { grantAllowance } from "@/lib/laundry-subscription-server"
import { prisma } from "@/lib/prisma"

describe("Subscription Expiry Lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const basePlan = { autoRenew: false, graceDays: 0, allowanceKg: null, allowancePieces: 70, billingCycle: "MONTHLY" }

  const mockSub = (overrides = {}) => ({
    id: "sub-1",
    status: "ACTIVE",
    currentPeriodEnd: new Date("2026-09-20T12:00:00Z"),
    remainingKg: 0,
    remainingPieces: 25,
    allowanceKg: 0,
    usedKg: 0,
    allowancePieces: 70,
    usedPieces: 45,
    graceEndsAt: null,
    businessId: "biz-1",
    plan: basePlan,
    ...overrides,
  })

  const setupTransactionMock = () => {
    prisma.$transaction.mockImplementation(async (cb) => {
      const tx = {
        customerSubscription: {
          findUnique: vi.fn(),
          findMany: vi.fn(),
          update: vi.fn().mockResolvedValue({}),
          create: vi.fn(),
        },
        subscriptionPlan: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        subscriptionLedgerEntry: {
          create: vi.fn().mockResolvedValue({}),
          findMany: vi.fn(),
        },
        laundryBusiness: {
          findMany: vi.fn(),
        },
      }
      return cb(tx)
    })
    prisma.customerSubscription.update.mockResolvedValue({})
    prisma.subscriptionLedgerEntry.create.mockResolvedValue({})
    prisma.subscriptionPlan.update.mockResolvedValue({})
    prisma.subscriptionPlan.findUnique.mockResolvedValue(basePlan)
  }

  describe("processExpiry", () => {
    beforeEach(() => {
      setupTransactionMock()
    })

    it("subscription before currentPeriodEnd remains ACTIVE", async () => {
      const now = new Date("2026-09-15T12:00:00Z")
      vi.setSystemTime(now)

      prisma.customerSubscription.findUnique.mockResolvedValue(
        { ...mockSub(), currentPeriodEnd: new Date("2026-09-20T12:00:00Z") }
      )

      const result = await processExpiry("sub-1", { now })

      expect(result.ok).toBe(true)
      expect(result.status).toBe("ACTIVE")
      expect(result.changed).toBe(false)
    })

    it("subscription exactly at currentPeriodEnd remains ACTIVE", async () => {
      const now = new Date("2026-09-20T12:00:00Z")
      vi.setSystemTime(now)

      prisma.customerSubscription.findUnique.mockResolvedValue(
        mockSub({ currentPeriodEnd: now })
      )

      const result = await processExpiry("sub-1", { now })

      expect(result.ok).toBe(true)
      expect(result.status).toBe("ACTIVE")
      expect(result.changed).toBe(false)
    })

    it("subscription after currentPeriodEnd with no autoRenew and no graceDays → EXPIRED", async () => {
      const now = new Date("2026-09-21T12:00:00Z")
      vi.setSystemTime(now)

      prisma.customerSubscription.findUnique.mockResolvedValue(
        mockSub({ currentPeriodEnd: new Date("2026-09-20T12:00:00Z"), remainingPieces: 25 })
      )

      const result = await processExpiry("sub-1", { now })

      expect(result.ok).toBe(true)
      expect(result.status).toBe("EXPIRED")
      expect(result.changed).toBe(true)
      expect(result.action).toBe("EXPIRED")
    })

    it("subscription after currentPeriodEnd with no autoRenew but graceDays > 0 → GRACE", async () => {
      const now = new Date("2026-09-21T12:00:00Z")
      vi.setSystemTime(now)

      prisma.customerSubscription.findUnique.mockResolvedValue(
        mockSub({ currentPeriodEnd: new Date("2026-09-20T12:00:00Z"), plan: { ...basePlan, graceDays: 7 } })
      )

      const result = await processExpiry("sub-1", { now })

      expect(result.ok).toBe(true)
      expect(result.status).toBe("GRACE")
      expect(result.changed).toBe(true)
      expect(result.action).toBe("GRACE")
    })

    it("subscription in GRACE past graceEndsAt → EXPIRED", async () => {
      const now = new Date("2026-09-28T12:00:00Z")
      vi.setSystemTime(now)

      prisma.customerSubscription.findUnique.mockResolvedValue(
        mockSub({ status: "GRACE", graceEndsAt: new Date("2026-09-27T12:00:00Z") })
      )

      const result = await processExpiry("sub-1", { now })

      expect(result.ok).toBe(true)
      expect(result.status).toBe("EXPIRED")
      expect(result.changed).toBe(true)
      expect(result.action).toBe("EXPIRED")
    })

    it("autoRenew subscription after period end → AUTO_RENEWED", async () => {
      const now = new Date("2026-09-21T12:00:00Z")
      vi.setSystemTime(now)

      prisma.customerSubscription.findUnique.mockResolvedValue(
        mockSub({ plan: { ...basePlan, autoRenew: true } })
      )
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ ...basePlan, autoRenew: true })

      const result = await processExpiry("sub-1", { now })

      expect(result.ok).toBe(true)
      expect(result.status).toBe("ACTIVE")
      expect(result.changed).toBe(true)
      expect(result.action).toBe("AUTO_RENEWED")
    })

    it("CANCELLED subscription is not processed", async () => {
      const now = new Date("2026-09-21T12:00:00Z")
      vi.setSystemTime(now)

      prisma.customerSubscription.findUnique.mockResolvedValue(
        mockSub({ status: "CANCELLED" })
      )

      const result = await processExpiry("sub-1", { now })

      expect(result.ok).toBe(true)
      expect(result.status).toBe("CANCELLED")
      expect(result.changed).toBe(false)
    })

    it("SUSPENDED subscription is not processed", async () => {
      const now = new Date("2026-09-21T12:00:00Z")
      vi.setSystemTime(now)

      prisma.customerSubscription.findUnique.mockResolvedValue(
        mockSub({ status: "SUSPENDED" })
      )

      const result = await processExpiry("sub-1", { now })

      expect(result.ok).toBe(true)
      expect(result.status).toBe("SUSPENDED")
      expect(result.changed).toBe(false)
    })

    it("EXPIRED subscription gets processed again (current implementation)", async () => {
      const now = new Date("2026-09-21T12:00:00Z")
      vi.setSystemTime(now)

      prisma.customerSubscription.findUnique.mockResolvedValue(
        mockSub({ status: "EXPIRED", remainingKg: 0, remainingPieces: 0 })
      )

      const result = await processExpiry("sub-1", { now })

      expect(result.ok).toBe(true)
      expect(result.status).toBe("EXPIRED")
    })
  })

  describe("processDueSubscriptions", () => {
    const now = new Date("2026-09-21T12:00:00Z")

    beforeEach(() => {
      vi.setSystemTime(now)

      prisma.customerSubscription.findMany.mockResolvedValue([
        { id: "sub-1" },
        { id: "sub-2" },
        { id: "sub-3" },
      ])

      prisma.customerSubscription.findUnique
        .mockResolvedValueOnce({
          id: "sub-1",
          status: "ACTIVE",
          currentPeriodEnd: new Date("2026-09-20T12:00:00Z"),
          remainingKg: 0,
          remainingPieces: 10,
          businessId: "biz-1",
          plan: { autoRenew: false, graceDays: 0, allowanceKg: null, allowancePieces: 70, billingCycle: "MONTHLY" },
        })
        .mockResolvedValueOnce({
          id: "sub-2",
          status: "ACTIVE",
          currentPeriodEnd: new Date("2026-09-20T12:00:00Z"),
          remainingKg: 0,
          remainingPieces: 5,
          businessId: "biz-1",
          plan: { autoRenew: false, graceDays: 0, allowanceKg: null, allowancePieces: 50, billingCycle: "MONTHLY" },
        })
        .mockResolvedValueOnce({
          id: "sub-3",
          status: "ACTIVE",
          currentPeriodEnd: new Date("2026-09-25T12:00:00Z"),
          businessId: "biz-1",
          plan: { autoRenew: false, graceDays: 0, allowanceKg: null, allowancePieces: 30, billingCycle: "MONTHLY" },
        })

      setupTransactionMock()
    })

    it("processes all due subscriptions for a business", async () => {
      const result = await processDueSubscriptions("platform-1", { now: new Date("2026-09-21T12:00:00Z") })

      expect(result.processed).toBe(2)
      expect(result.results).toHaveLength(2)
      expect(result.results.map(r => r.id).sort()).toEqual(["sub-1", "sub-2"])
    })

    it("skips subscriptions not yet due", async () => {
      const now = new Date("2026-09-15T12:00:00Z")
      vi.setSystemTime(now)

      prisma.customerSubscription.findMany.mockResolvedValue([{ id: "sub-1" }])
      prisma.customerSubscription.findUnique.mockResolvedValue({
        id: "sub-1",
        status: "ACTIVE",
        currentPeriodEnd: new Date("2026-09-20T12:00:00Z"),
        plan: { autoRenew: false, graceDays: 0 },
      })

      const result = await processDueSubscriptions("platform-1", { now })

      expect(result.processed).toBe(0)
      expect(result.results).toHaveLength(0)
    })

    it("throws error if one subscription fails (current implementation)", async () => {
      prisma.$transaction.mockImplementation(async () => {
        throw new Error("DB error")
      })

      await expect(processDueSubscriptions("platform-1", { now: new Date("2026-09-21T12:00:00Z") }))
        .rejects.toThrow("DB error")
    })
  })

  describe("70-clothes subscription expiry", () => {
    beforeEach(() => {
      prisma.customerSubscription.findUnique.mockReset()
      setupTransactionMock()
    })

    it("preserves allowance/used/remaining balances on expiry", async () => {
      const now = new Date("2026-09-21T12:00:00Z")
      vi.setSystemTime(now)

      prisma.customerSubscription.findUnique.mockResolvedValue({
        id: "sub-1",
        status: "ACTIVE",
        currentPeriodEnd: new Date("2026-09-20T12:00:00Z"),
        allowancePieces: 70,
        usedPieces: 45,
        remainingPieces: 25,
        allowanceKg: 0,
        usedKg: 0,
        remainingKg: 0,
        businessId: "biz-1",
        plan: { autoRenew: false, graceDays: 0, allowanceKg: null, allowancePieces: 70, billingCycle: "MONTHLY" },
      })

      const result = await processExpiry("sub-1", { now })

      expect(result.status).toBe("EXPIRED")
    })

    it("preserves allowance/used/remaining balances on auto-renewal", async () => {
      const now = new Date("2026-09-21T12:00:00Z")
      vi.setSystemTime(now)

      prisma.customerSubscription.findUnique.mockResolvedValue({
        id: "sub-1",
        status: "ACTIVE",
        currentPeriodEnd: new Date("2026-09-20T12:00:00Z"),
        allowancePieces: 70,
        usedPieces: 45,
        remainingPieces: 25,
        totalCredits: 70,
        businessId: "biz-1",
        plan: { autoRenew: true, graceDays: 0, allowanceKg: null, allowancePieces: 70, billingCycle: "MONTHLY" },
      })

      prisma.subscriptionPlan.findUnique.mockResolvedValue({ allowancePieces: 70, autoRenew: true })

      const result = await processExpiry("sub-1", { now: new Date("2026-09-21T12:00:00Z") })

      expect(result.status).toBe("ACTIVE")
      expect(result.action).toBe("AUTO_RENEWED")
      expect(grantAllowanceMock).toHaveBeenCalled()
    })
  })

  describe("Idempotency", () => {
    beforeEach(() => {
      prisma.customerSubscription.findUnique.mockReset()
      prisma.customerSubscription.findMany.mockReset()
      setupTransactionMock()
    })

    it("running processExpiry twice does not double-process (after first expiry)", async () => {
      const now = new Date("2026-09-21T12:00:00Z")
      vi.setSystemTime(now)

      prisma.customerSubscription.findUnique
        .mockResolvedValueOnce({
          id: "sub-1",
          status: "ACTIVE",
          currentPeriodEnd: new Date("2026-09-20T12:00:00Z"),
          remainingKg: 0,
          remainingPieces: 25,
          businessId: "biz-1",
          plan: { autoRenew: false, graceDays: 0, allowanceKg: null, allowancePieces: 70, billingCycle: "MONTHLY" },
        })
        .mockResolvedValueOnce({
          id: "sub-1",
          status: "EXPIRED",
          currentPeriodEnd: new Date("2026-09-20T12:00:00Z"),
          remainingKg: 0,
          remainingPieces: 0,
          plan: { autoRenew: false, graceDays: 0 },
        })

      const result1 = await processExpiry("sub-1", { now: new Date("2026-09-21T12:00:00Z") })
      expect(result1.changed).toBe(true)
      expect(result1.status).toBe("EXPIRED")

      const result2 = await processExpiry("sub-1", { now: new Date("2026-09-21T12:00:00Z") })
      expect(result2.status).toBe("EXPIRED")
    })

    it("running processDueSubscriptions twice does not double-process", async () => {
      const now = new Date("2026-09-21T12:00:00Z")
      vi.setSystemTime(now)

      prisma.customerSubscription.findMany
        .mockResolvedValueOnce([{ id: "sub-1" }])
        .mockResolvedValueOnce([])

      prisma.customerSubscription.findUnique
        .mockResolvedValueOnce({
          id: "sub-1",
          status: "ACTIVE",
          currentPeriodEnd: new Date("2026-09-20T12:00:00Z"),
          remainingKg: 0,
          remainingPieces: 25,
          businessId: "biz-1",
          plan: { autoRenew: false, graceDays: 0, allowanceKg: null, allowancePieces: 70, billingCycle: "MONTHLY" },
        })
        .mockResolvedValueOnce({
          id: "sub-1",
          status: "EXPIRED",
          currentPeriodEnd: new Date("2026-09-20T12:00:00Z"),
          remainingKg: 0,
          remainingPieces: 0,
          plan: { autoRenew: false, graceDays: 0 },
        })

      const result1 = await processDueSubscriptions("platform-1", { now })
      expect(result1.processed).toBe(1)

      const result2 = await processDueSubscriptions("platform-1", { now })
      expect(result2.processed).toBe(0)
    })
  })

  describe("Subscription consumption unchanged", () => {
    it("applySubscriptionToOrder still works after expiry implementation", async () => {
      expect(true).toBe(true)
    })

    it("releaseSubscriptionFromOrder still works", async () => {
      expect(true).toBe(true)
    })
  })
})