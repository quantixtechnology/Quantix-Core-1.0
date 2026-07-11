// POST /api/laundry/app/auth/logout — end the current session by revoking the
// platform access token (consistent with Quantix session handling).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bearerToken } from "@/lib/laundry-app-auth"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const token = bearerToken(request)
  if (token) await prisma.refreshToken.deleteMany({ where: { token } })
  return NextResponse.json({ success: true })
}
