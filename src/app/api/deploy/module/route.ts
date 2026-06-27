import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const MODULE_LOADED_AT = new Date().toISOString()

export async function GET() {
  try {
    // Attempt to import the parent route module
    // If this succeeds, the module is definitely loaded
    const deployRoute = await import('../route')

    return NextResponse.json({
      moduleLoaded: true,
      loadedAt: deployRoute.MODULE_LOADED_AT,
      diagnosticEndpointLoadedAt: MODULE_LOADED_AT,
      version: deployRoute.MODULE_VERSION || 'v1',
      routeVersion: 'v1',
    })
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    return NextResponse.json(
      {
        moduleLoaded: false,
        error: error.message,
        reason: 'Failed to import parent route module',
      },
      { status: 500 }
    )
  }
}
