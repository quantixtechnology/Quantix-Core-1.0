// GET /api/laundry/executive/me — current executive profile (from the session).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveExecutive, bearerToken } from "@/lib/laundry-executive-auth"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const session = await resolveExecutive(bearerToken(request))
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const e = await prisma.laundryDeliveryExecutive.findUnique({ where: { id: session.executiveId }, include: { store: { select: { storeName: true } } } })
    if (!e) return NextResponse.json({ error: "Executive not found" }, { status: 404 })
    return NextResponse.json({
      success: true,
      data: {
        id: e.id, name: e.name, employeeCode: e.employeeCode, mobile: e.mobile,
        storeId: e.storeId, storeName: e.store?.storeName ?? null,
        vehicleType: e.vehicleType, vehicleNumber: e.vehicleNumber, photo: e.photo,
        availability: e.availability,
        // Assignment permission — the app hides Reject when this is false. The
        // respond endpoint re-checks it; this is for rendering, not security.
        canReject: e.canReject,
      },
    })
  } catch (e) {
    console.error("[executive-me] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
