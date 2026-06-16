// ============================================================================
// QUANTIX CORE — Public Lead Capture Endpoint
// POST /api/public/leads  — Receive leads from quantixtechnology.in website
//
// No authentication required. Protected by:
//   - Cloudflare Turnstile CAPTCHA
//   - Honeypot field (_hp)
//   - Minimum form fill time (_t)
//   - IP-based rate limiting
//   - Duplicate phone detection
// ============================================================================

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { generateLeadId } from '@/lib/lead-id';

// ============================================================================
// CORS — this endpoint is called cross-origin from quantixtechnology.in
// ============================================================================

const ALLOWED_ORIGINS = [
  'https://quantixtechnology.in',
  'https://www.quantixtechnology.in',
];

function resolveOrigin(origin: string | null): string {
  if (origin && ALLOWED_ORIGINS.includes(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': resolveOrigin(origin),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function addCors(origin: string | null, headers: Record<string, string> = {}): Record<string, string> {
  return { ...corsHeaders(origin), ...headers };
}

// ============================================================================
// IP-BASED RATE LIMITING (in-memory)
// ============================================================================

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getRateLimitInfo(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count, resetAt: entry.resetAt };
}

if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
      if (now > entry.resetAt) rateLimitMap.delete(key);
    }
  }, RATE_LIMIT_WINDOW_MS);
}

// ============================================================================
// CLOUDFLARE TURNSTILE VERIFICATION
// ============================================================================

async function verifyTurnstileToken(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;

  const formData = new URLSearchParams();
  formData.append('secret', secret);
  formData.append('response', token);
  if (ip) formData.append('remoteip', ip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
  });

  const data = await res.json() as { success?: boolean };
  return data.success === true;
}

// ============================================================================
// HELPERS
// ============================================================================

function normalizePhone(phone: string): string {
  return phone.replace(/\s/g, '').replace(/^\+91/, '').replace(/^91/, '');
}

const VALID_BUSINESS_TYPES = [
  'GROCERY', 'FOOD_DELIVERY', 'LAUNDRY', 'CAR_WASH', 'PHARMACY',
  'HOME_SERVICES', 'ECOMMERCE', 'COSMETICS', 'MEAT_DELIVERY',
  'FURNITURE', 'DIRECTORY',
] as const;

// ============================================================================
// OPTIONS — CORS preflight
// ============================================================================

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new Response(null, { status: 204, headers: addCors(origin) });
}

// ============================================================================
// POST /api/public/leads
// ============================================================================

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');

  try {
    // ── Resolve client IP ──────────────────────────────────────────────
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';

    // ── Rate limiting ──────────────────────────────────────────────────
    const rateLimit = getRateLimitInfo(ip);
    if (!rateLimit.allowed) {
      return Response.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: addCors(origin, { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) }),
        },
      );
    }

    // ── Parse body ─────────────────────────────────────────────────────
    const body = await request.json();

    // ── Honeypot — silently succeed so bots don't know they're blocked ─
    if (body._hp) {
      return Response.json({ success: true, data: { message: "Thanks! We'll contact you within 24 hours." } }, { headers: addCors(origin) });
    }

    // ── Load-time check — submitted too fast => likely a bot ───────────
    if (body._t && Date.now() - body._t < 3000) {
      return Response.json({ success: true, data: { message: "Thanks! We'll contact you within 24 hours." } }, { headers: addCors(origin) });
    }

    // ── Validate fields ────────────────────────────────────────────────
    const { name, businessName, phone, businessType, city, captchaToken } = body;

    if (!name?.trim() || name.trim().length < 2) {
      return Response.json({ success: false, error: 'Please enter your full name' }, { status: 400, headers: addCors(origin) });
    }
    if (!businessName?.trim() || businessName.trim().length < 2) {
      return Response.json({ success: false, error: 'Please enter your business name' }, { status: 400, headers: addCors(origin) });
    }
    if (!phone) {
      return Response.json({ success: false, error: 'Please enter your phone number' }, { status: 400, headers: addCors(origin) });
    }
    const normalizedPhone = normalizePhone(phone);
    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
      return Response.json({ success: false, error: 'Please enter a valid 10-digit mobile number' }, { status: 400, headers: addCors(origin) });
    }
    if (!businessType || !VALID_BUSINESS_TYPES.includes(businessType)) {
      return Response.json({ success: false, error: 'Please select a valid business type' }, { status: 400, headers: addCors(origin) });
    }
    if (!city?.trim() || city.trim().length < 2) {
      return Response.json({ success: false, error: 'Please enter your city' }, { status: 400, headers: addCors(origin) });
    }

    // ── Turnstile verification ─────────────────────────────────────────
    if (!captchaToken || typeof captchaToken !== 'string') {
      return Response.json({ success: false, error: 'CAPTCHA verification failed. Please try again.' }, { status: 400, headers: addCors(origin) });
    }
    const captchaValid = await verifyTurnstileToken(captchaToken, ip);
    if (!captchaValid) {
      return Response.json({ success: false, error: 'CAPTCHA verification failed. Please try again.' }, { status: 400, headers: addCors(origin) });
    }

    // ── Duplicate phone detection ──────────────────────────────────────
    const existingLead = await db.lead.findFirst({
      where: { contactPhone: normalizedPhone },
      select: { id: true },
    });
    if (existingLead) {
      return Response.json({
        success: true,
        duplicate: true,
        message: 'You have already requested a demo. Our team will contact you shortly.',
      }, { headers: addCors(origin) });
    }

    // ── Create lead ────────────────────────────────────────────────────
    const leadId = await generateLeadId(db);

    await db.lead.create({
      data: {
        leadId,
        businessName: businessName.trim(),
        contactName: name.trim(),
        contactEmail: '',
        contactPhone: normalizedPhone,
        city: city.trim(),
        businessType,
        source: 'WEBSITE_INQUIRY',
        stage: 'LEAD',
        salesRepId: null,
        createdById: null,
      },
    });

    return Response.json({ success: true, data: { message: "Thanks! We'll contact you within 24 hours." } }, { headers: addCors(origin) });
  } catch (error) {
    console.error('[PUBLIC_LEADS] Error:', error);
    return Response.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500, headers: addCors(origin) },
    );
  }
}
