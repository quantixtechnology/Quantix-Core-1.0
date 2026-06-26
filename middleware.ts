import { NextRequest, NextResponse } from 'next/server'
import { initializePlatform } from '@/lib/platform-init'

// Initialize platform on first request
// This runs before any API route or page handler
export async function middleware(request: NextRequest) {
  try {
    await initializePlatform()
  } catch (error) {
    console.error('[MIDDLEWARE] Platform initialization error:', error)
  }

  return NextResponse.next()
}

// Run middleware on all requests
export const config = {
  matcher: ['/:path*'],
}
