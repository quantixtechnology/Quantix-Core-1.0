import { NextResponse } from "next/server"
import { generateBusinessCode } from "@/lib/laundry-codes"

export const runtime = "nodejs"

export async function GET() {
  try {
    const code = await generateBusinessCode()
    return NextResponse.json({ code })
  } catch (error) {
    console.error("Error generating next business code:", error)
    return NextResponse.json({ error: "Failed to generate business code" }, { status: 500 })
  }
}
