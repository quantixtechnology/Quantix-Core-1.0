// GET /api/assets/branding
// Public (no auth) — returns branding metadata the login page needs before
// the user is authenticated. Only safe, non-sensitive fields are exposed.

import { NextResponse } from 'next/server'
import { getPlatformSettings } from '@/lib/platform-settings'

export async function GET() {
  try {
    const s = await getPlatformSettings()
    return NextResponse.json(
      { loginScreenLogoUrl: s.loginScreenLogoUrl ?? null },
      { headers: { 'Cache-Control': 'public, max-age=60' } },
    )
  } catch {
    return NextResponse.json({ loginScreenLogoUrl: null })
  }
}
