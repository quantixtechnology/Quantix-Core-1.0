// ============================================================================
// GET /api/admin/config/health
// Production configuration health check
// Used for deployment validation
// ============================================================================

import { NextResponse } from 'next/server'
import { getProductionChecklist, validateProductionConfig } from '@/lib/config-validator'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Get configuration validation
    const configValidation = validateProductionConfig()
    const checklist = getProductionChecklist()

    // Check database connectivity
    let databaseHealthy = false
    try {
      await db.business.count()
      databaseHealthy = true
    } catch (error) {
      console.error('Database health check failed:', error)
    }

    // Check product registry
    const productCount = await db.platformProduct.count()
    const planCount = await db.productPlan.count()

    return NextResponse.json({
      success: configValidation.valid && databaseHealthy && productCount > 0,
      status: configValidation.valid && databaseHealthy ? 'READY' : 'INCOMPLETE',
      timestamp: new Date().toISOString(),
      configuration: {
        valid: configValidation.valid,
        errors: configValidation.errors,
        warnings: configValidation.warnings,
      },
      checklist: checklist.checklist,
      database: {
        healthy: databaseHealthy,
        message: databaseHealthy ? 'Connected' : 'Connection failed',
      },
      productRegistry: {
        products: productCount,
        plans: planCount,
        ready: productCount >= 2 && planCount > 0,
      },
      deployment: {
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[admin/config/health] Error:', error)
    return NextResponse.json(
      {
        success: false,
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Health check failed',
      },
      { status: 500 }
    )
  }
}
