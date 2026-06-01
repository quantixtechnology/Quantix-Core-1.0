// ============================================================================
// GET /api/admin/customers/email-as-name-report
//
// Returns customers where the name field is likely derived from the email
// address — the result of the old email-as-name fallback bug.
//
// Detection heuristics:
//   1. name contains "@"            → clearly an email stored as name
//   2. name === email.split("@")[0] → email username stored as name
//
// Read-only report — no data is modified.  Admin corrects records manually
// through the Customer Module.
//
// Auth: requires platform admin session.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withMiddleware } from '@/lib/middleware';

const PAGE_SIZE = 100;

export const GET = withMiddleware({ requireAuth: true })(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const page       = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const businessId = searchParams.get('businessId') ?? undefined;

  // ── Heuristic 1: name contains "@" (clearly an email/email-like string) ─
  const atSignWhere = {
    ...(businessId ? { businessId } : {}),
    name: { contains: '@' },
  };

  const [total, atSignRecords] = await Promise.all([
    db.customer.count({ where: atSignWhere }),
    db.customer.findMany({
      where: atSignWhere,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, businessId: true, name: true, email: true,
        phone: true, createdAt: true, source: true,
        business: { select: { name: true, slug: true } },
      },
    }),
  ]);

  // ── Heuristic 2: name === email.split("@")[0] (username-as-name) ─────────
  // Scan up to 500 records without "@" in name for username matches.
  const candidates = await db.customer.findMany({
    where: {
      ...(businessId ? { businessId } : {}),
      NOT: { name: { contains: '@' } },
      email: { not: null },
    },
    select: {
      id: true, businessId: true, name: true, email: true,
      phone: true, createdAt: true, source: true,
      business: { select: { name: true, slug: true } },
    },
    take: 2000,
    orderBy: { createdAt: 'desc' },
  });

  const usernameMatches = candidates.filter(c => {
    if (!c.email) return false;
    const username = c.email.split('@')[0];
    return c.name === username;
  });

  // Merge, deduplicate, sort newest-first
  const atSignIds = new Set(atSignRecords.map(r => r.id));
  const merged = [
    ...atSignRecords.map(r => ({ ...r, reason: 'name_contains_at_sign'  })),
    ...usernameMatches
      .filter(r => !atSignIds.has(r.id))
      .map(r => ({ ...r, reason: 'name_is_email_username' })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({
    success: true,
    data: merged,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      totalAtSign:       total,
      totalUsernameMatch: usernameMatches.length,
      totalAffected:     atSignRecords.length + usernameMatches.filter(r => !atSignIds.has(r.id)).length,
    },
    note: 'Read-only. Correct records manually via Customer Module → Edit Customer.',
  });
});
