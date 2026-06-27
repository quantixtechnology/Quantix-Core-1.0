import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    // Import the parent route module to get execution state
    const deployRoute = await import('../route')

    const state = deployRoute.executionState

    return NextResponse.json({
      moduleLoaded: true,
      handlerEntered: state.handlerEntered,
      handlerEnteredAt: state.handlerEnteredAt || null,
      lastStage: state.lastStage || null,
      lastError: state.lastError || null,
      lastRequestTime: state.lastRequestTime || null,
    })
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    return NextResponse.json(
      {
        moduleLoaded: false,
        handlerEntered: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}
