// GET /api/laundry/app/me — the signed-in customer's profile + addresses +
// live statistics + active subscription summary (Phases 2/4/8).
// PUT /api/laundry/app/me — edit profile + communication preferences (Phase 2).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveSession, bearerToken } from "@/lib/laundry-app-auth"
import { parseMeta, parseTags, mergeMeta, customerStats, type CommPrefs } from "@/lib/laundry-customer"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const sess = await resolveSession(request)
  if (!sess) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const c = await prisma.customer.findUnique({ where: { id: sess.customerId }, include: { addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] } } })
  if (!c) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
  const meta = parseMeta(c.metadata)
  const [stats, sub] = await Promise.all([
    customerStats(c.id),
    prisma.customerSubscription.findFirst({ where: { customerId: c.id, status: { in: ["ACTIVE", "GRACE"] } }, include: { plan: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
  ])
  return NextResponse.json({ success: true, data: {
    id: c.id, name: c.name, phone: c.phone, email: c.email, avatar: c.avatar, gender: c.gender, dateOfBirth: c.dateOfBirth,
    gstNumber: c.gstNumber, customerCode: c.customerCode, loyaltyTier: c.loyaltyTier, walletBalance: c.walletBalance,
    alternateMobile: meta.alternateMobile || null, anniversary: meta.anniversary || null, company: meta.company || null,
    comm: meta.comm || {}, tags: parseTags(c.tags), addresses: c.addresses, stats,
    subscription: sub ? { id: sub.id, planName: sub.plan.name, status: sub.status, remainingKg: sub.remainingKg, remainingPieces: sub.remainingPieces, expiry: sub.currentPeriodEnd } : null,
  } })
}

export async function PUT(request: Request) {
  const sess = await resolveSession(request)
  if (!sess) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await request.json().catch(() => ({}))
  const c = await prisma.customer.findUnique({ where: { id: sess.customerId }, select: { metadata: true } })
  if (!c) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

  const metaPatch: Record<string, unknown> = {}
  if (b.alternateMobile !== undefined) metaPatch.alternateMobile = b.alternateMobile || ""
  if (b.anniversary !== undefined) metaPatch.anniversary = b.anniversary || ""
  if (b.company !== undefined) metaPatch.company = b.company || ""
  if (b.comm !== undefined && b.comm && typeof b.comm === "object") metaPatch.comm = b.comm as CommPrefs
  const metadata = Object.keys(metaPatch).length ? mergeMeta(c.metadata, metaPatch) : undefined

  await prisma.customer.update({ where: { id: sess.customerId }, data: {
    ...(b.name !== undefined && { name: b.name }),
    ...(b.email !== undefined && { email: b.email || null }),
    ...(b.gender !== undefined && { gender: b.gender || null }),
    ...(b.dateOfBirth !== undefined && { dateOfBirth: b.dateOfBirth ? new Date(b.dateOfBirth) : null }),
    ...(b.avatar !== undefined && { avatar: b.avatar || null }),
    ...(b.gstNumber !== undefined && { gstNumber: b.gstNumber || null }),
    ...(metadata !== undefined && { metadata }),
  } })
  return NextResponse.json({ success: true })
}
