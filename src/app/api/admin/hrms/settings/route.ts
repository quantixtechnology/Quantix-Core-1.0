import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

// Singleton settings — Quantix Internal HRMS has exactly one settings record
export const GET = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:view' })(
  async () => {
    try {
      const settings = await db.hrmsSettings.findFirst()
      return NextResponse.json({ success: true, data: settings ?? null })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)

export const PUT = withMiddleware({ requireAuth: true, requiredPermission: 'hrms:manage' })(
  async (req: NextRequest) => {
    try {
      const body = await req.json() as Record<string, unknown>

      const data = {
        companyName:                    body.companyName                    as string | undefined,
        registeredAddress:              body.registeredAddress              as string | undefined,
        pan:                            body.pan                            as string | undefined,
        gstNumber:                      body.gstNumber                      as string | undefined,
        cin:                            body.cin                            as string | undefined,
        website:                        body.website                        as string | undefined,
        companyPhone:                   body.companyPhone                   as string | undefined,
        companyEmail:                   body.companyEmail                   as string | undefined,
        hrContactName:                  body.hrContactName                  as string | undefined,
        hrContactEmail:                 body.hrContactEmail                 as string | undefined,
        hrContactMobile:                body.hrContactMobile                as string | undefined,
        authorizedSignatory:            body.authorizedSignatory            as string | undefined,
        authorizedSignatoryDesignation: body.authorizedSignatoryDesignation as string | undefined,
        signatureImage:                 body.signatureImage                 as string | undefined,
        stampImage:                     body.stampImage                     as string | undefined,
        logo:                           body.logo                           as string | undefined,
        primaryColor:                   body.primaryColor                   as string | undefined,
        secondaryColor:                 body.secondaryColor                 as string | undefined,
      }

      const existing = await db.hrmsSettings.findFirst()
      const settings = existing
        ? await db.hrmsSettings.update({ where: { id: existing.id }, data })
        : await db.hrmsSettings.create({ data })

      return NextResponse.json({ success: true, data: settings })
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : 'Failed', 500)
    }
  }
)
