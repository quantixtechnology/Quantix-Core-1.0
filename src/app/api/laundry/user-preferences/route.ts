// ============================================================================
// PER-STAFF UI PREFERENCES — GET / PUT / DELETE one key for the CALLER.
//
// The userId is taken from the authenticated session and NEVER from the request
// body or query, so one staff member cannot read or write another's preference
// even by crafting a request. The unique key is (businessId, userId, key).
//
// Display preferences only. Nothing here reads or writes an order, a status, a
// transition or any workflow state.
// ============================================================================
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryMember } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

/** Keys this endpoint will store. An unknown key is refused rather than kept. */
const ALLOWED_KEYS = new Set(["orders.filter"])
/** A saved filter is a handful of short strings; this is not a document store. */
const MAX_VALUE_BYTES = 2048

function resolve(request: Request) {
  const sp = new URL(request.url).searchParams
  return { businessId: sp.get("businessId"), key: sp.get("key") || "" }
}

export async function GET(request: Request) {
  try {
    const { businessId, key } = resolve(request)
    if (!ALLOWED_KEYS.has(key)) return NextResponse.json({ success: false, error: "Unknown preference key" }, { status: 400 })
    const guard = await requireLaundryMember(request, businessId)
    if (!guard.ok) return guard.res
    const row = await prisma.laundryUserPreference.findUnique({
      where: { businessId_userId_key: { businessId: guard.ctx.laundryBusinessId, userId: guard.ctx.userId, key } },
      select: { value: true, updatedAt: true },
    })
    if (!row) return NextResponse.json({ success: true, data: null })
    let parsed: unknown = null
    try { parsed = JSON.parse(row.value) } catch { parsed = null }
    return NextResponse.json({ success: true, data: parsed, updatedAt: row.updatedAt })
  } catch (e) {
    console.error("[laundry-user-preferences] GET", e)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { businessId, key } = resolve(request)
    if (!ALLOWED_KEYS.has(key)) return NextResponse.json({ success: false, error: "Unknown preference key" }, { status: 400 })
    const guard = await requireLaundryMember(request, businessId)
    if (!guard.ok) return guard.res
    const body = await request.json().catch(() => null)
    if (body === null || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "A preference value is required." }, { status: 400 })
    }
    const value = JSON.stringify(body)
    if (Buffer.byteLength(value, "utf8") > MAX_VALUE_BYTES) {
      return NextResponse.json({ success: false, error: "That preference is too large to save." }, { status: 413 })
    }
    const where = { businessId_userId_key: { businessId: guard.ctx.laundryBusinessId, userId: guard.ctx.userId, key } }
    await prisma.laundryUserPreference.upsert({
      where,
      update: { value },
      create: { businessId: guard.ctx.laundryBusinessId, userId: guard.ctx.userId, key, value },
    })
    return NextResponse.json({ success: true, data: body })
  } catch (e) {
    console.error("[laundry-user-preferences] PUT", e)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { businessId, key } = resolve(request)
    if (!ALLOWED_KEYS.has(key)) return NextResponse.json({ success: false, error: "Unknown preference key" }, { status: 400 })
    const guard = await requireLaundryMember(request, businessId)
    if (!guard.ok) return guard.res
    await prisma.laundryUserPreference.deleteMany({
      where: { businessId: guard.ctx.laundryBusinessId, userId: guard.ctx.userId, key },
    })
    return NextResponse.json({ success: true, data: null })
  } catch (e) {
    console.error("[laundry-user-preferences] DELETE", e)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
