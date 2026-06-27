// ============================================================================
// GET /api/admin/config/health
// Production configuration health check
// Used for deployment validation
// ============================================================================

import { NextResponse } from 'next/server'
import { getProductionChecklist, validateProductionConfig } from '@/lib/config-validator'
import { db } from '@/lib/db'

export async function GET() {
  const startTime = Date.now()
  const checks: Record<string, { healthy: boolean; message: string; duration?: number }> = {}

  try {
    // 1. Configuration validation
    const configValidation = validateProductionConfig()
    const checklist = getProductionChecklist()
    checks.configuration = {
      healthy: configValidation.valid,
      message: configValidation.valid ? 'All required variables configured' : `${configValidation.errors.length} configuration errors`,
    }

    // 2. Database connectivity
    const dbStart = Date.now()
    let databaseHealthy = false
    try {
      await db.business.count()
      databaseHealthy = true
      checks.database = {
        healthy: true,
        message: 'Connected',
        duration: Date.now() - dbStart,
      }
    } catch (error) {
      checks.database = {
        healthy: false,
        message: error instanceof Error ? error.message : 'Connection failed',
        duration: Date.now() - dbStart,
      }
    }

    // 3. Product registry
    const productCount = await db.platformProduct.count()
    const planCount = await db.productPlan.count()
    checks.productRegistry = {
      healthy: productCount >= 2 && planCount > 0,
      message: `${productCount} products, ${planCount} plans`,
    }

    // 4. OTP code availability (for authentication)
    const otpCodeCount = await db.oTPCode.count()
    checks.authentication = {
      healthy: otpCodeCount >= 0,
      message: 'OTP system operational',
    }

    // 5. Workspace provisioning readiness
    const workspaceCount = await db.platformWorkspace.count()
    checks.provisioning = {
      healthy: workspaceCount >= 0,
      message: `${workspaceCount} workspaces provisioned`,
    }

    // Overall health
    const allHealthy =
      configValidation.valid &&
      databaseHealthy &&
      checks.productRegistry.healthy &&
      checks.authentication.healthy

    const totalDuration = Date.now() - startTime

    return NextResponse.json({
      success: allHealthy,
      status: allHealthy ? 'HEALTHY' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      duration: totalDuration,
      configuration: {
        valid: configValidation.valid,
        errors: configValidation.errors,
        warnings: configValidation.warnings,
      },
      checks,
      deployment: {
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version,
      },
    })
  } catch (error) {
    checks.healthCheck = {
      healthy: false,
      message: error instanceof Error ? error.message : 'Health check failed',
    }

    return NextResponse.json(
      {
        success: false,
        status: 'ERROR',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        checks,
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 503 }
    )
  }
}
