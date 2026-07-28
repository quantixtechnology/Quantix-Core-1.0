import { NextResponse } from "next/server"
import { SCREEN_MODULES, LEVEL_LABELS } from "@/lib/laundry-rbac-registry"

export const runtime = "nodejs"
export async function GET() {
  return NextResponse.json({ success: true, data: { modules: SCREEN_MODULES, levels: LEVEL_LABELS } })
}
