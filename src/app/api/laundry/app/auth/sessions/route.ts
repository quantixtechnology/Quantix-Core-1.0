// GET    /api/laundry/app/auth/sessions        — list this customer's devices (Phase 1)
// DELETE /api/laundry/app/auth/sessions         — logout (current session)
// DELETE /api/laundry/app/auth/sessions?id=…    — revoke a specific device
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveSession, bearerToken } from "@/lib/laundry-app-auth"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const sess = await resolveSession(bearerToken(request))
  if (!sess) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const rows = await prisma.laundryAppSession.findMany({ where: { customerId: sess.customerId }, orderBy: { lastSeenAt: "desc" }, select: { id: true, device: true, lastSeenAt: true, createdAt: true } })
  return NextResponse.json({ success: true, data: rows.map((r) => ({ ...r, current: r.id === sess.sessionId })) })
}

export async function DELETE(request: Request) {
  const sess = await resolveSession(bearerToken(request))
  if (!sess) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const id = new URL(request.url).searchParams.get("id")
  // Revoke a specific device (scoped to this customer) or the current session.
  await prisma.laundryAppSession.deleteMany({ where: { id: id || sess.sessionId, customerId: sess.customerId } })
  return NextResponse.json({ success: true })
}
