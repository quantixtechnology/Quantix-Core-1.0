// POST /api/laundry/store-admin/auth/logout — invalidate the current token.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bearerToken } from "@/lib/laundry-store-admin-auth"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const token = bearerToken(request)
    if (token) await prisma.refreshToken.deleteMany({ where: { token } }).catch(() => {})
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: true })
  }
}
