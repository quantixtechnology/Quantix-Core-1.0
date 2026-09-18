import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the external deps of the Customer Detail route. resolveLaundryBusiness,
// requireLaundryPermission return their happy path; membershipState and the
// customer-create helpers are only imported (never used by GET) but must exist.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    customerSubscription: {
      findFirst: vi.fn(),
    },
    subscriptionPurchase: {
      findMany: vi.fn(),
    },
    laundryOrder: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/laundry-subscription", () => ({
  membershipState: vi.fn(() => "NONE"),
}))

vi.mock("@/lib/laundry-business", () => ({
  resolveLaundryBusiness: vi.fn().mockResolvedValue({ id: "biz-1", platformBusinessId: "platform-1" }),
}))

vi.mock("@/lib/laundry-rbac", () => ({
  requireLaundryPermission: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock("@/lib/laundry-customer-create", () => ({
  findCustomerByEmail: vi.fn(),
  validateIndianMobile: vi.fn(() => null),
}))

import { GET } from "@/app/api/laundry/customers/[id]/route"
import { prisma } from "@/lib/prisma"

// The route calls the REAL customerStats() — which sums LaundryOrder.amountPaid
// over non-CANCELLED orders and never touches grandTotal/balanceDue — so the
// business rule is exercised end to end, not re-implemented in a mock.
const buildCustomer = (overrides: Record<string, unknown> = {}) => ({
  id: "cust-1",
  name: "John Doe",
  phone: null,
  email: "john@test.com",
  businessId: "platform-1",
  customerSourceId: null,
  loyaltyTier: "SILVER",
  walletBalance: 0,
  totalOrders: 5,
  totalSpent: 70,
  status: "ACTIVE",
  isActive: true,
  customerCode: "CUST001",
  createdAt: new Date(),
  metadata: "",
  tags: "",
  addresses: [],
  ...overrides,
})

const orderRow = (overrides: Record<string, unknown> = {}) => ({
  id: "ord-1",
  orderNumber: "ORD-1",
  status: "DELIVERED",
  paymentStatus: "PAID",
  grandTotal: 80,
  amountPaid: 80,
  balanceDue: 0,
  subscriptionCoveredAmount: 0,
  createdAt: new Date(),
  ...overrides,
})

const subPurchase = (overrides: Record<string, unknown> = {}) => ({
  id: "sub-1",
  amountPaid: 499,
  ...overrides,
})

const callDetail = async () => {
  const url = new URL("http://localhost/api/laundry/customers/cust-1?businessId=biz-1")
  const req = new Request(url.toString(), { headers: { authorization: "Bearer test-token" } })
  const res = await GET(req, { params: Promise.resolve({ id: "cust-1" }) })
  return res.json()
}

describe("Laundry Customers Detail API - Lifetime Value", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.customer.findFirst as any).mockResolvedValue(buildCustomer())
    ;(prisma.customer.findUnique as any).mockResolvedValue({ createdAt: new Date(), loyaltyTier: "SILVER", phone: null, businessId: "platform-1" })
    ;(prisma.customerSubscription.findFirst as any).mockResolvedValue(null)
  })

  it("A. ₹499 subscription paid + ₹80 order paid → ₹579", async () => {
    ;(prisma.laundryOrder.findMany as any).mockResolvedValue([orderRow()])
    ;(prisma.subscriptionPurchase.findMany as any).mockResolvedValue([subPurchase()])

    const j = await callDetail()
    expect(j.success).toBe(true)
    expect(j.data.lifetimeValue).toBe(579)
  })

  it("B. ₹540 billed + ₹70 paid + ₹470 pending → ₹70 (pending must NOT count)", async () => {
    ;(prisma.laundryOrder.findMany as any).mockResolvedValue([
      orderRow({ grandTotal: 540, amountPaid: 70, balanceDue: 470, paymentStatus: "PARTIAL" }),
    ])
    ;(prisma.subscriptionPurchase.findMany as any).mockResolvedValue([])

    const j = await callDetail()
    expect(j.data.lifetimeValue).toBe(70)
  })

  it("C. ₹499 subscription paid only → ₹499", async () => {
    ;(prisma.laundryOrder.findMany as any).mockResolvedValue([])
    ;(prisma.subscriptionPurchase.findMany as any).mockResolvedValue([subPurchase()])

    const j = await callDetail()
    expect(j.data.lifetimeValue).toBe(499)
  })

  it("D. ₹80 order paid only → ₹80", async () => {
    ;(prisma.laundryOrder.findMany as any).mockResolvedValue([orderRow()])
    ;(prisma.subscriptionPurchase.findMany as any).mockResolvedValue([])

    const j = await callDetail()
    expect(j.data.lifetimeValue).toBe(80)
  })

  it("E. Cancelled order must not contribute", async () => {
    ;(prisma.laundryOrder.findMany as any).mockResolvedValue([
      orderRow({ status: "CANCELLED", amountPaid: 1000, paymentStatus: "CANCELLED" }),
      orderRow({ id: "ord-2", orderNumber: "ORD-2", amountPaid: 80 }),
    ])
    ;(prisma.subscriptionPurchase.findMany as any).mockResolvedValue([])

    const j = await callDetail()
    expect(j.data.lifetimeValue).toBe(80)
  })

  it("F. Customer with no payments → ₹0", async () => {
    ;(prisma.laundryOrder.findMany as any).mockResolvedValue([])
    ;(prisma.subscriptionPurchase.findMany as any).mockResolvedValue([])

    const j = await callDetail()
    expect(j.data.lifetimeValue).toBe(0)
  })

  it("G. Multiple normal orders → sums actual amountPaid", async () => {
    ;(prisma.laundryOrder.findMany as any).mockResolvedValue([
      orderRow({ id: "ord-1" }),
      orderRow({ id: "ord-2", orderNumber: "ORD-2" }),
      orderRow({ id: "ord-3", orderNumber: "ORD-3" }),
    ])
    ;(prisma.subscriptionPurchase.findMany as any).mockResolvedValue([])

    const j = await callDetail()
    expect(j.data.lifetimeValue).toBe(240)
  })

  it("H. Multiple subscription purchases → sums actual amountPaid (ACTIVATED rule)", async () => {
    ;(prisma.laundryOrder.findMany as any).mockResolvedValue([])
    ;(prisma.subscriptionPurchase.findMany as any).mockResolvedValue([
      subPurchase(),
      subPurchase({ id: "sub-2" }),
      subPurchase({ id: "sub-3", amountPaid: 80 }),
    ])

    const j = await callDetail()
    expect(j.data.lifetimeValue).toBe(1078)
  })
})