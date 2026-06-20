import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET() {
  try {
    const roles = await prisma.laundryRole.findMany({
      orderBy: { name: "asc" },
    })
    return NextResponse.json(roles)
  } catch (error) {
    console.error("Error fetching laundry roles:", error)
    return NextResponse.json({ error: "Failed to fetch laundry roles" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { code, name, description, isActive } = body

    if (!code || !name) {
      return NextResponse.json({ error: "Code and name are required" }, { status: 400 })
    }

    const role = await prisma.laundryRole.create({
      data: {
        code,
        name,
        description: description || null,
        isActive: isActive ?? true,
        isSystem: false,
      },
    })

    return NextResponse.json(role, { status: 201 })
  } catch (error) {
    console.error("Error creating laundry role:", error)
    return NextResponse.json({ error: "Failed to create laundry role" }, { status: 500 })
  }
}
