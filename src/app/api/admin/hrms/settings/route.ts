import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:view' })(
  async (_req: NextRequest) => {
    try {
      const settings = await db.hrmsSettings.findFirst()
      return NextResponse.json({ success: true, data: settings })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)

export const PUT = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:manage' })(
  async (req: NextRequest) => {
    try {
      const body = await req.json() as {
        businessId: string
        companyName?: string
        logo?: string
        registeredAddress?: string
        hrContact?: string
        authorizedSignatory?: string
        signatureImage?: string
        pan?: string
        gstNumber?: string
      }

      if (!body.businessId) return createErrorResponse('businessId required', 400)

      const settings = await db.hrmsSettings.upsert({
        where: { businessId: body.businessId },
        update: {
          companyName: body.companyName,
          logo: body.logo,
          registeredAddress: body.registeredAddress,
          hrContact: body.hrContact,
          authorizedSignatory: body.authorizedSignatory,
          signatureImage: body.signatureImage,
          pan: body.pan,
          gstNumber: body.gstNumber,
        },
        create: {
          businessId: body.businessId,
          companyName: body.companyName,
          logo: body.logo,
          registeredAddress: body.registeredAddress,
          hrContact: body.hrContact,
          authorizedSignatory: body.authorizedSignatory,
          signatureImage: body.signatureImage,
          pan: body.pan,
          gstNumber: body.gstNumber,
        },
      })

      return NextResponse.json({ success: true, data: settings })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
