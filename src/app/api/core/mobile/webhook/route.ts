// ============================================================================
// QUANTIX CORE — Mobile CI Webhook Receiver
// POST /api/core/mobile/webhook
//   Receives build completion events from GitHub Actions (via the
//   mobile-provision service or directly from the tenant CI workflow).
//
//   Payload:
//     { slug, status, apkUrl?, aabUrl? }
//
//   Authenticated by MOBILE_WEBHOOK_SECRET header.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { handleMobileWebhook } from '@/lib/mobile-provision';

const WEBHOOK_SECRET = process.env.MOBILE_WEBHOOK_SECRET ?? '';

export async function POST(req: NextRequest) {
  try {
    // Verify shared secret (simple bearer check — not HMAC; mobile-provision
    // service handles the GitHub HMAC verification before forwarding to Core)
    const authHeader = req.headers.get('x-webhook-secret') ?? '';
    if (WEBHOOK_SECRET && authHeader !== WEBHOOK_SECRET) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as {
      slug?: string;
      status?: string;
      apkUrl?: string;
      aabUrl?: string;
    };

    if (!body.slug || !body.status) {
      return NextResponse.json(
        { success: false, error: 'slug and status are required' },
        { status: 400 },
      );
    }

    await handleMobileWebhook({
      slug: body.slug,
      status: body.status,
      apkUrl: body.apkUrl,
      aabUrl: body.aabUrl,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    const status = message.includes('No business found') ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
