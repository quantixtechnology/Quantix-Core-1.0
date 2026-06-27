// ============================================================================
// GET /api/admin/businesses/[businessId] — Get business details
// PATCH /api/admin/businesses/[businessId] — Update business information
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { db } from '@/lib/db'

interface RouteContext {
  params?: Promise<{ businessId: string }>
}

/**
 * GET /api/admin/businesses/[businessId]
 * Retrieve business details with full lifecycle info
 */
export const GET = withMiddleware({ requireAuth: true })(
  async (req, ctx: RouteContext) => {
    try {
      const params = await ctx.params
      const businessId = params?.businessId

      if (!businessId) {
        return NextResponse.json(
          { success: false, error: 'Business ID required' },
          { status: 400 }
        )
      }

      const business = await db.business.findUnique({
        where: { id: businessId },
        include: {
          platformWorkspace: {
            select: { id: true, status: true, createdAt: true },
          },
        },
      })

      if (!business) {
        return NextResponse.json(
          { success: false, error: 'Business not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        data: business,
      })
    } catch (error) {
      console.error('[businesses GET] Error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch business' },
        { status: 500 }
      )
    }
  }
)

/**
 * PATCH /api/admin/businesses/[businessId]
 * Update business information
 */
export const PATCH = withMiddleware({ requireAuth: true, requiredPermission: 'businesses:update' })(
  async (req, ctx: RouteContext) => {
    try {
      const params = await ctx.params
      const businessId = params?.businessId

      if (!businessId) {
        return NextResponse.json(
          { success: false, error: 'Business ID required' },
          { status: 400 }
        )
      }

      const body = await req.json()

      // Fields that can be updated
      const updateData: any = {}

      if (body.name !== undefined) updateData.name = body.name
      if (body.contactEmail !== undefined) updateData.contactEmail = body.contactEmail
      if (body.contactPhone !== undefined) updateData.contactPhone = body.contactPhone
      if (body.address !== undefined) updateData.address = body.address
      if (body.city !== undefined) updateData.city = body.city
      if (body.state !== undefined) updateData.state = body.state
      if (body.pincode !== undefined) updateData.pincode = body.pincode
      if (body.country !== undefined) updateData.country = body.country

      // Slug can only be updated if not already used elsewhere
      if (body.slug !== undefined && body.slug !== body.currentSlug) {
        const existingSlug = await db.business.findFirst({
          where: {
            slug: body.slug,
            NOT: { id: businessId },
          },
        })

        if (existingSlug) {
          return NextResponse.json(
            { success: false, error: 'Slug already in use', field: 'slug' },
            { status: 409 }
          )
        }

        updateData.slug = body.slug
      }

      const updated = await db.business.update({
        where: { id: businessId },
        data: updateData,
      })

      return NextResponse.json({
        success: true,
        data: updated,
      })
    } catch (error) {
      console.error('[businesses PATCH] Error:', error)

      let errorMsg = 'Failed to update business'
      let statusCode = 500

      if ((error as any).code === 'P2002') {
        errorMsg = 'Slug already in use'
        statusCode = 409
      }

      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: statusCode }
      )
    }
  }
)
