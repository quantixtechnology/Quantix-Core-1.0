import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get("businessId")
    const storeId = searchParams.get("storeId")
    const departmentId = searchParams.get("departmentId")
    const roleId = searchParams.get("roleId")

    const where: Record<string, unknown> = {}
    if (businessId) where.businessId = businessId
    if (storeId) where.storeId = storeId
    if (departmentId) where.departmentId = departmentId
    if (roleId) where.roleId = roleId

    const assignments = await prisma.laundryUserAssignment.findMany({
      where,
      include: {
        store: { select: { id: true, storeName: true, storeCode: true } },
        department: { select: { id: true, name: true, code: true } },
        role: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(assignments)
  } catch (error) {
    console.error("Error fetching assignments:", error)
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, storeId, departmentId, roleId, userId, active } = body

    if (!businessId || !roleId) {
      return NextResponse.json({ error: "Business ID and Role ID are required" }, { status: 400 })
    }

    const assignment = await prisma.laundryUserAssignment.create({
      data: {
        businessId,
        storeId: storeId || null,
        departmentId: departmentId || null,
        roleId,
        userId: userId || null,
        active: active ?? true,
      },
      include: {
        store: { select: { id: true, storeName: true, storeCode: true } },
        department: { select: { id: true, name: true, code: true } },
        role: { select: { id: true, name: true, code: true } },
      },
    })

    return NextResponse.json(assignment, { status: 201 })
  } catch (error) {
    console.error("Error creating assignment:", error)
    return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 })
  }
}
