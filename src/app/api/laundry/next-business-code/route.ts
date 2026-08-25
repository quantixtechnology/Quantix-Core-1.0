// GET /api/laundry/next-business-code — preview the Business Code the next
// tenant will be issued.
//
// It previews the PLATFORM allocator's next number, because that is the code
// the create route will actually assign. It used to preview a laundry-only
// `LND-YYYYMM-NNNN`, which is not a Business Code and is no longer issued.
import { NextResponse } from "next/server"
import { allocateBusinessCode } from "@/lib/business-code"
import { prisma } from "@/lib/prisma"
import { platformOnly } from "@/lib/platform-guard"

export const runtime = "nodejs"

export async function GET(request: Request) {
  // Reads the platform-wide business count — platform administration, never
  // tenant-reachable.
  const denied = await platformOnly(request)
  if (denied) return denied
  try {
    const code = await allocateBusinessCode(prisma as never)
    return NextResponse.json({ code })
  } catch (error) {
    console.error("Error generating next business code:", error)
    return NextResponse.json({ error: "Failed to generate business code" }, { status: 500 })
  }
}
