// ============================================================================
// QUANTIX API v1 — Standard response helpers
// ============================================================================
import { NextResponse } from 'next/server';

export function ok<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  return NextResponse.json({ success: true, data, ...(meta ? { meta } : {}) }, { status });
}

export function created<T>(data: T, message?: string) {
  return NextResponse.json({ success: true, data, message: message ?? 'Created' }, { status: 201 });
}

export function err(message: string, status = 400, code?: string) {
  return NextResponse.json({ success: false, error: message, ...(code ? { code } : {}) }, { status });
}

export function serverErr(e: unknown) {
  const msg = e instanceof Error ? e.message : 'Internal server error';
  console.error('[v1 API]', msg, e);
  return NextResponse.json({ success: false, error: msg }, { status: 500 });
}
