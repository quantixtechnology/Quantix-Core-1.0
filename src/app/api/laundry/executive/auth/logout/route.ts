// POST /api/laundry/executive/auth/logout — revoke the current access token.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bearerToken } from "@/lib/laundry-executive-auth"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const token = bearerToken(request)
    if (token) await prisma.refreshToken.deleteMany({ where: { token } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: true })
  }
}
