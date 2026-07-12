import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get("businessId")
    const storeId = searchParams.get("storeId")
    const guard = await requireLaundryPermission(request, businessId, "laundry.settings.view")
    if (!guard.ok) return guard.res

    const where: Record<string, unknown> = {}
    if (businessId) where.businessId = businessId
    if (storeId) where.storeId = storeId

    const departments = await prisma.laundryDepartment.findMany({
      where,
      orderBy: { sequence: "asc" },
    })

    return NextResponse.json(departments)
  } catch (error) {
    console.error("Error fetching departments:", error)
    return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, storeId, code, name, enabled, sequence } = body

    if (!businessId || !code || !name) {
      return NextResponse.json({ error: "Business ID, code, and name are required" }, { status: 400 })
    }
    const guard = await requireLaundryPermission(request, businessId, "laundry.settings.edit")
    if (!guard.ok) return guard.res

    const department = await prisma.laundryDepartment.create({
      data: {
        businessId,
        storeId: storeId || null,
        code,
        name,
        enabled: enabled ?? true,
        sequence: sequence ?? 0,
      },
    })

    return NextResponse.json(department, { status: 201 })
  } catch (error) {
    console.error("Error creating department:", error)
    return NextResponse.json({ error: "Failed to create department" }, { status: 500 })
  }
}
