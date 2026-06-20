import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const business = await prisma.laundryBusiness.findUnique({
      where: { id },
      include: { stores: { orderBy: { createdAt: "desc" } } },
    })
    if (!business) {
      return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    }
    return NextResponse.json(business)
  } catch (error) {
    console.error("Error fetching laundry business:", error)
    return NextResponse.json({ error: "Failed to fetch laundry business" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      businessName, legalName, ownerName, mobile, email, gstNumber, logo, favicon, address,
       plan, status, transportEnabled, barcodeTaggingEnabled, ironingEnabled, homeDeliveryEnabled,
       multiStoreEnabled, multiProcessingEnabled, employeeManagementEnabled,
       membershipEnabled, loyaltyEnabled, whatsappIntegrationEnabled, smsIntegrationEnabled, advancedReportsEnabled,
       photoAuditEnabled, preServicePayment, postServicePayment, qrOrderLabels, barcodeGarmentTracking,
       defaultServiceRadius, defaultDailyCapacity,
    } = body

    const business = await prisma.laundryBusiness.update({
      where: { id },
      data: {
        ...(businessName !== undefined && { businessName }),
        ...(legalName !== undefined && { legalName: legalName || null }),
        ...(ownerName !== undefined && { ownerName }),
        ...(mobile !== undefined && { mobile }),
        ...(email !== undefined && { email: email || null }),
        ...(gstNumber !== undefined && { gstNumber: gstNumber || null }),
        ...(logo !== undefined && { logo: logo || null }),
        ...(favicon !== undefined && { favicon: favicon || null }),
        ...(address !== undefined && { address: address || null }),
        ...(plan !== undefined && { plan }),
        ...(status !== undefined && { status }),
        ...(transportEnabled !== undefined && { transportEnabled }),
        ...(barcodeTaggingEnabled !== undefined && { barcodeTaggingEnabled }),
        ...(ironingEnabled !== undefined && { ironingEnabled }),
        ...(homeDeliveryEnabled !== undefined && { homeDeliveryEnabled }),
        ...(multiStoreEnabled !== undefined && { multiStoreEnabled }),
        ...(multiProcessingEnabled !== undefined && { multiProcessingEnabled }),
        ...(employeeManagementEnabled !== undefined && { employeeManagementEnabled }),
        ...(membershipEnabled !== undefined && { membershipEnabled }),
        ...(loyaltyEnabled !== undefined && { loyaltyEnabled }),
        ...(whatsappIntegrationEnabled !== undefined && { whatsappIntegrationEnabled }),
        ...(smsIntegrationEnabled !== undefined && { smsIntegrationEnabled }),
        ...(advancedReportsEnabled !== undefined && { advancedReportsEnabled }),
        ...(photoAuditEnabled !== undefined && { photoAuditEnabled }),
        ...(preServicePayment !== undefined && { preServicePayment }),
        ...(postServicePayment !== undefined && { postServicePayment }),
        ...(qrOrderLabels !== undefined && { qrOrderLabels }),
        ...(barcodeGarmentTracking !== undefined && { barcodeGarmentTracking }),
        ...(defaultServiceRadius !== undefined && { defaultServiceRadius: defaultServiceRadius ? parseFloat(defaultServiceRadius) : null }),
        ...(defaultDailyCapacity !== undefined && { defaultDailyCapacity: defaultDailyCapacity ? parseFloat(defaultDailyCapacity) : null }),
      },
    })

    return NextResponse.json(business)
  } catch (error) {
    console.error("Error updating laundry business:", error)
    return NextResponse.json({ error: "Failed to update laundry business" }, { status: 500 })
  }
}
