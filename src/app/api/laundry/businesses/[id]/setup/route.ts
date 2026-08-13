import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateStoreCode } from "@/lib/laundry-codes"
import { requireLaundryMember } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    // Tenant isolation: a businessId in the URL is not authorization.
    const _guard = await requireLaundryMember(request, id)
    if (!_guard.ok) return _guard.res
    const body = await request.json()
    const { businessInfo, storeSetup, services, pricing, processingCenter } = body

    await prisma.laundryBusiness.update({
      where: { id },
      data: {
        businessName: businessInfo?.laundryName || undefined,
        gstNumber: businessInfo?.gstNumber || undefined,
        mobile: businessInfo?.contactNumber || undefined,
        email: businessInfo?.email || undefined,
        address: businessInfo?.businessAddress || undefined,
        status: "ACTIVE",
      },
    })

    const business = await prisma.laundryBusiness.findUnique({ where: { id }, select: { businessCode: true } })
    const storeCode = business ? await generateStoreCode(business.businessCode) : "STORE-001"
    await prisma.laundryStore.create({
      data: {
        storeCode,
        laundryBusinessId: id,
        storeName: storeSetup?.storeName || "Main Store",
        address: storeSetup?.storeAddress || null,
      },
    })

    if (processingCenter?.centerName) {
      await prisma.laundryProcessingCenter.create({
        data: {
          centerCode: `PC-${business?.businessCode || "001"}`,
          businessId: id,
          centerName: processingCenter.centerName,
          address: processingCenter.centerAddress || null,
          dailyCapacityKg: processingCenter.dailyCapacity ? parseFloat(processingCenter.dailyCapacity) : null,
        },
      })
    }

    return NextResponse.json({ success: true, message: "Workspace activated" })
  } catch (error) {
    console.error("Error setting up laundry workspace:", error)
    return NextResponse.json({ error: "Failed to set up workspace" }, { status: 500 })
  }
}
