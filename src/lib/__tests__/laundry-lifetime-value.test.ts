import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn(),
    },
    customerSubscription: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    subscriptionPurchase: {
      findMany: vi.fn(),
    },
    subscriptionPlan: {
      findUnique: vi.fn(),
    },
    subscriptionLedgerEntry: {
      create: vi.fn().mockResolvedValue({}),
    },
    laundryBusiness: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    laundryOrder: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    laundryPayment: {
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn(async (cb) => {
      const tx = {
        customer: {
          findUnique: vi.fn(),
          findMany: vi.fn(),
          update: vi.fn().mockResolvedValue({}),
        },
        customerSubscription: {
          findUnique: vi.fn(),
          findMany: vi.fn(),
          update: vi.fn().mockResolvedValue({}),
        },
        subscriptionPlan: {
          findUnique: vi.fn(),
        },
        subscriptionLedgerEntry: {
          create: vi.fn().mockResolvedValue({}),
        },
        laundryOrder: {
          findUnique: vi.fn(),
          findMany: vi.fn(),
          update: vi.fn().mockResolvedValue({}),
        },
        laundryPayment: {
          create: vi.fn().mockResolvedValue({}),
        },
      }
      return cb(tx)
    }),
  },
}))

vi.mock("@/lib/laundry-subscription", () => ({
  membershipState: vi.fn((sub) => {
    if (!sub) return "NONE"
    if (sub.status === "CANCELLED") return "CANCELLED"
    if (sub.status === "SUSPENDED") return "SUSPENDED"
    if (sub.status === "PAUSED") return "PAUSED"
    if (sub.status === "EXPIRED") return "EXPIRED"
    if (sub.status === "GRACE") return "GRACE"
    return "ACTIVE"
  }),
}))

vi.mock("@/lib/laundry-business", () => ({
  resolveLaundryBusiness: vi.fn().mockResolvedValue({ id: "biz-1", platformBusinessId: "platform-1" }),
}))

vi.mock("@/lib/laundry-rbac", () => ({
  requireLaundryPermission: vi.fn().mockResolvedValue({ ok: true }),
}))

import { GET } from "@/app/api/laundry/customers/route"
import { prisma } from "@/lib/prisma"

describe("Laundry Customers API - Lifetime Value", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockRequest = (params: { businessId?: string; subscription?: string; q?: string; includeArchived?: string } = {}) => {
    const url = new URL("http://localhost/api/laundry/customers")
    if (params.businessId) url.searchParams.set("businessId", params.businessId)
    if (params.subscription) url.searchParams.set("subscription", params.subscription)
    if (params.q) url.searchParams.set("q", params.q)
    if (params.includeArchived) url.searchParams.set("includeArchived", params.includeArchived)
    return new Request(url.toString(), {
      headers: { authorization: "Bearer test-token" },
    })
  }

  const setupMocks = () => {
    prisma.customer.findMany.mockResolvedValue([
      { id: "cust-1", name: "John Doe", phone: "9999999999", email: "john@test.com", customerCode: "CUST001", loyaltyTier: "SILVER", walletBalance: 0, totalOrders: 5, totalSpent: 70, status: "ACTIVE", isActive: true, lastOrderAt: new Date(), createdAt: new Date() },
      { id: "cust-2", name: "Jane Smith", phone: "8888888888", email: "jane@test.com", customerCode: "CUST002", loyaltyTier: "BRONZE", walletBalance: 0, totalOrders: 2, totalSpent: 150, status: "ACTIVE", isActive: true, lastOrderAt: new Date(), createdAt: new Date() },
    ])
    prisma.laundryOrder.findMany.mockResolvedValue([
      { customerId: "cust-1", amountPaid: 70, grandTotal: 70, status: "DELIVERED", paymentStatus: "PAID" },
      { customerId: "cust-2", amountPaid: 150, grandTotal: 150, status: "DELIVERED", paymentStatus: "PAID" },
    ])
    prisma.customer.count
      .mockResolvedValueOnce(2) // total
      .mockResolvedValueOnce(2) // activeCustomers
      .mockResolvedValueOnce(1) // activeMemberships
      .mockResolvedValueOnce(0) // expiredMemberships
      .mockResolvedValueOnce(0) // cancelledMemberships
      .mockResolvedValueOnce(0) // pausedMemberships
      .mockResolvedValueOnce(0) // suspendedMemberships
      .mockResolvedValueOnce(1) // noSubscriptionCustomers
    prisma.customerSubscription.findMany
      .mockResolvedValueOnce([{ customerId: "cust-1" }]) // active subs
      .mockResolvedValueOnce([]) // expired subs
      .mockResolvedValueOnce([]) // cancelled subs
      .mockResolvedValueOnce([]) // paused subs
      .mockResolvedValueOnce([]) // suspended subs
      .mockResolvedValueOnce([{ customerId: "cust-1" }]) // for noSubscriptionCustomers
    prisma.subscriptionPurchase.findMany.mockResolvedValue([
      { customerId: "cust-1", amountPaid: 499 },
    ])
    prisma.customerSubscription.findMany.mockResolvedValue([
      {
        customerId: "cust-1",
        status: "ACTIVE",
        currentPeriodEnd: new Date("2026-12-31"),
        graceEndsAt: null,
        plan: { name: "70 Cloth Plan", autoRenew: true, graceDays: 7, allowanceKg: null, allowancePieces: 70 },
        usedKg: 0,
        usedPieces: 28,
        remainingKg: 0,
        remainingPieces: 42,
        allowanceKg: 0,
        allowancePieces: 70,
      },
    ])
  }

  it("includes subscription purchases in Lifetime Value", async () => {
    setupMocks()

    const response = await GET( mockRequest({ businessId: "biz-1" }) )
    const data = await response.json()

    expect(response.ok).toBe(true)
    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(2)

    const cust1 = data.data.find((c) => c.id === "cust-1")
    const cust2 = data.data.find((c) => c.id === "cust-2")

    expect(cust1.lifetimeValue).toBe(569) // 70 (totalSpent) + 499 (subscription)
    expect(cust2.lifetimeValue).toBe(150) // 150 (totalSpent) + 0 (no subscription)
  })

  it("shows 0 for customer with no orders and no subscription", async () => {
    prisma.customer.findMany.mockResolvedValue([
      { id: "cust-3", name: "New Customer", phone: "7777777777", email: "new@test.com", customerCode: "CUST003", loyaltyTier: "BRONZE", walletBalance: 0, totalOrders: 0, totalSpent: 0, status: "ACTIVE", isActive: true, lastOrderAt: null, createdAt: new Date() },
    ])
    prisma.laundryOrder.findMany.mockResolvedValue([])
    prisma.customer.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
    prisma.customerSubscription.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ customerId: "cust-3" }])
    prisma.subscriptionPurchase.findMany.mockResolvedValue([])
    prisma.customerSubscription.findMany.mockResolvedValue([])

    const response = await GET( mockRequest({ businessId: "biz-1" }) )
    const data = await response.json()

    expect(data.data[0].lifetimeValue).toBe(0)
  })

  it("accumulates multiple Laundry orders correctly", async () => {
    prisma.customer.findMany.mockResolvedValue([
      { id: "cust-4", name: "Multi Order Customer", phone: "6666666666", email: "multi@test.com", customerCode: "CUST004", loyaltyTier: "GOLD", walletBalance: 0, totalOrders: 3, totalSpent: 210, status: "ACTIVE", isActive: true, lastOrderAt: new Date(), createdAt: new Date() },
    ])
    prisma.laundryOrder.findMany.mockResolvedValue([
      { customerId: "cust-4", amountPaid: 70, grandTotal: 70, status: "DELIVERED", paymentStatus: "PAID" },
      { customerId: "cust-4", amountPaid: 70, grandTotal: 70, status: "DELIVERED", paymentStatus: "PAID" },
      { customerId: "cust-4", amountPaid: 70, grandTotal: 70, status: "DELIVERED", paymentStatus: "PAID" },
    ])
    prisma.customer.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
    prisma.customerSubscription.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ customerId: "cust-4" }])
    prisma.subscriptionPurchase.findMany.mockResolvedValue([])
    prisma.customerSubscription.findMany.mockResolvedValue([])

    const response = await GET( mockRequest({ businessId: "biz-1" }) )
    const data = await response.json()

    expect(data.data[0].lifetimeValue).toBe(210)
  })

  it("combines Laundry orders and subscription purchase", async () => {
    prisma.customer.findMany.mockResolvedValue([
      { id: "cust-5", name: "Hybrid Customer", phone: "5555555555", email: "hybrid@test.com", customerCode: "CUST005", loyaltyTier: "PLATINUM", walletBalance: 0, totalOrders: 2, totalSpent: 200, status: "ACTIVE", isActive: true, lastOrderAt: new Date(), createdAt: new Date() },
    ])
    prisma.customer.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
    prisma.customerSubscription.findMany
      .mockResolvedValueOnce([{ customerId: "cust-5" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    prisma.subscriptionPurchase.findMany.mockResolvedValue([
      { customerId: "cust-5", amountPaid: 499 },
      { customerId: "cust-5", amountPaid: 499 }, // two subscription purchases
    ])
    prisma.laundryOrder.findMany.mockResolvedValue([
      { customerId: "cust-5", amountPaid: 200, grandTotal: 200, status: "DELIVERED", paymentStatus: "PAID" },
    ])
    prisma.customerSubscription.findMany.mockResolvedValue([
      {
        customerId: "cust-5",
        status: "ACTIVE",
        currentPeriodEnd: new Date("2026-12-31"),
        graceEndsAt: null,
        plan: { name: "70 Cloth Plan", autoRenew: true, graceDays: 7, allowanceKg: null, allowancePieces: 70 },
        usedKg: 0,
        usedPieces: 14,
        remainingKg: 0,
        remainingPieces: 56,
        allowanceKg: 0,
        allowancePieces: 70,
      },
    ])

    const response = await GET( mockRequest({ businessId: "biz-1" }) )
    const data = await response.json()

    expect(data.data[0].lifetimeValue).toBe(1198) // 200 (orders) + 998 (2 subscriptions)
  })

  it("does not double count subscription in totalSpent", async () => {
    prisma.customer.findMany.mockResolvedValue([
      { id: "cust-6", name: "Customer", phone: "4444444444", email: "test@test.com", customerCode: "CUST006", loyaltyTier: "SILVER", walletBalance: 0, totalOrders: 1, totalSpent: 499, status: "ACTIVE", isActive: true, lastOrderAt: new Date(), createdAt: new Date() },
    ])
    prisma.customer.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
    prisma.customerSubscription.findMany
      .mockResolvedValueOnce([{ customerId: "cust-6" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    prisma.subscriptionPurchase.findMany.mockResolvedValue([
      { customerId: "cust-6", amountPaid: 499 },
    ])
    prisma.laundryOrder.findMany.mockResolvedValue([
      { customerId: "cust-6", amountPaid: 499, grandTotal: 499, status: "DELIVERED", paymentStatus: "PAID" },
    ])
    prisma.customerSubscription.findMany.mockResolvedValue([
      {
        customerId: "cust-6",
        status: "ACTIVE",
        currentPeriodEnd: new Date("2026-12-31"),
        graceEndsAt: null,
        plan: { name: "70 Cloth Plan", autoRenew: true, graceDays: 7, allowanceKg: null, allowancePieces: 70 },
        usedKg: 0,
        usedPieces: 0,
        remainingKg: 0,
        remainingPieces: 70,
        allowanceKg: 0,
        allowancePieces: 70,
      },
    ])

    const response = await GET( mockRequest({ businessId: "biz-1" }) )
    const data = await response.json()

    // totalSpent should NOT include subscription amount
    // lifetimeValue = totalSpent (499) + subscriptionSpent (499) = 998
    expect(data.data[0].lifetimeValue).toBe(998)
  })
})