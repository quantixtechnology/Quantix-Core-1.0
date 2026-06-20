import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await prisma.laundryStagePermission.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Stage permission not found" }, { status: 404 })
    }

    await prisma.laundryStagePermission.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting stage permission:", error)
    return NextResponse.json({ error: "Failed to delete stage permission" }, { status: 500 })
  }
}
