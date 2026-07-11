// GET /api/laundry/rbac/catalog — the module→screen→action permission catalog
// (the source of truth the Role Editor renders). Static; no auth needed.
import { NextResponse } from "next/server"
import { RBAC_CATALOG } from "@/lib/laundry-rbac-catalog"

export const runtime = "nodejs"
export async function GET() {
  return NextResponse.json({ success: true, data: RBAC_CATALOG })
}
