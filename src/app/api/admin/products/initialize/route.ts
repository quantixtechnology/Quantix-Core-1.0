// ============================================================================
// POST /api/admin/products/initialize
// Initialize default products in the Product Registry
// ============================================================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { initializeProductRegistry } from '@/lib/product-registry-init'
import { logPlatformEvent } from '@/lib/platform-audit'

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

export const POST = withMiddleware({
  requireAuth: true,
  requiredPermission: 'products:create',
})(async (req: AuthenticatedRequest) => {
  try {
    const created = await initializeProductRegistry()

    logPlatformEvent({
      userId: req.user?.id,
      userName: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
      module: 'PRODUCTS',
      action: 'CREATE',
      description: `Product Registry initialized (${created} products created)`,
      severity: 'INFO',
      req,
    })

    return NextResponse.json({
      success: true,
      message: `Product Registry initialized. ${created} new products created.`,
      created,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to initialize products'
    return createErrorResponse(message, 500)
  }
})
