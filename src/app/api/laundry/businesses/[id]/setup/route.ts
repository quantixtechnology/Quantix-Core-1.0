import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateStoreCode, generateProcessingCenterCode } from "@/lib/laundry-codes"
import { requireLaundryMember } from "@/lib/laundry-rbac"
import { ensureBusinessCode } from "@/lib/business-code"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

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

    // Read the canonical Business Code from the platform Business row — NOT from
    // LaundryBusiness, which may still carry a legacy LND-… code.
    const resolved = await resolveLaundryBusiness(id)
    const businessCode = resolved?.platformBusinessId
      ? await ensureBusinessCode(resolved.platformBusinessId)
      : null

    const storeCode = businessCode ? await generateStoreCode(businessCode) : "STORE-001"
    await prisma.laundryStore.create({
      data: {
        storeCode,
        laundryBusinessId: id,
        storeName: storeSetup?.storeName || "Main Store",
        address: storeSetup?.storeAddress || null,
      },
    })

    if (processingCenter?.centerName) {
      const centerCode = businessCode
        ? await generateProcessingCenterCode(businessCode)
        : `PC-${id.slice(0, 8)}`
      await prisma.laundryProcessingCenter.create({
        data: {
          centerCode,
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
