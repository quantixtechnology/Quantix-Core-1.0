// ============================================================================
// Route: GET /api/admin/leads
// Returns leads for the admin panel with sales rep info
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'leads:view',
})(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    // Filters
    const stageParam = searchParams.get('stage');
    const sourceParam = searchParams.get('source');
    const businessTypeParam = searchParams.get('businessType');
    const salesRepId = searchParams.get('salesRepId');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};

    if (stageParam) {
      where.stage = { in: stageParam.split(',') };
    }

    if (sourceParam) {
      where.source = { in: sourceParam.split(',') };
    }

    if (businessTypeParam) {
      where.businessType = { in: businessTypeParam.split(',') };
    }

    if (salesRepId === 'null') {
      where.salesRepId = null;   // unassigned leads only
    } else if (salesRepId) {
      where.salesRepId = salesRepId;
    }

    if (search) {
      where.OR = [
        { businessName: { contains: search } },
        { contactName: { contains: search } },
        { contactEmail: { contains: search } },
        { contactPhone: { contains: search } },
      ];
    }

    const [leads, total] = await Promise.all([
      db.lead.findMany({
        where,
        skip,
        take: limit,
        include: {
          salesRep: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.lead.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: leads,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('[admin/leads] Error:', error);
    return NextResponse.json(
      { success: false, error: `Failed to fetch leads: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
});
