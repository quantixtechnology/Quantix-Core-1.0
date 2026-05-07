// ============================================================================
// Quantix Technology — Next.js Proxy (Security Headers)
// MANAGED PLATFORM
//
// Adds security headers to all responses.
// Next.js 16 uses "proxy" instead of "middleware".
// ============================================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ============================================================================
// SECURITY HEADERS
// ============================================================================

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// ============================================================================
// PROXY — Next.js 16 convention
// ============================================================================

export default function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // Apply security headers to all responses
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  return response;
}

// ============================================================================
// MATCHER — Apply to all routes except static assets
// ============================================================================

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
