// ============================================================================
// QUANTIX CORE — Customer Notes API
// GET  /api/core/businesses/[businessId]/customers/[customerId]/notes  (auth)
// POST /api/core/businesses/[businessId]/customers/[customerId]/notes  (CLIENT_OWNER+)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

export const GET = withMiddleware({ requireAuth: true })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    const customerId = params?.customerId as string;

    const user = req.user!;
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }

    const customer = await db.customer.findFirst({ where: { id: customerId, businessId } });
    if (!customer) return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });

    const notes = await db.customerNote.findMany({
      where: { customerId },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: notes });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list notes';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const POST = withMiddleware({ requireAuth: true, requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'SUPPORT_STAFF', 'QUANTIX_SUPER_ADMIN'] })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    const customerId = params?.customerId as string;

    const user = req.user!;
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }

    const body = (await req.json()) as { content: string; isPrivate?: boolean };
    if (!body.content?.trim()) {
      return NextResponse.json({ success: false, error: 'Note content is required' }, { status: 400 });
    }

    const customer = await db.customer.findFirst({ where: { id: customerId, businessId } });
    if (!customer) return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });

    const note = await db.customerNote.create({
      data: { customerId, userId: user.id, content: body.content.trim(), isPrivate: body.isPrivate || false },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });

    return NextResponse.json({ success: true, data: note, message: 'Note created successfully' }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create note';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
