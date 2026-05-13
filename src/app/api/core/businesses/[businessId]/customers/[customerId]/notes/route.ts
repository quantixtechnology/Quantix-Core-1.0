// ============================================================================
// QUANTIX CORE — Customer Notes API
// GET  /api/core/businesses/[businessId]/customers/[customerId]/notes  — List notes
// POST /api/core/businesses/[businessId]/customers/[customerId]/notes  — Create note
// ============================================================================

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string; customerId: string }> }
) {
  try {
    const { businessId, customerId } = await params;

    // Verify customer belongs to business
    const customer = await db.customer.findFirst({
      where: { id: customerId, businessId },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    const notes = await db.customerNote.findMany({
      where: { customerId },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: notes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list notes';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string; customerId: string }> }
) {
  try {
    const { businessId, customerId } = await params;
    const body = (await request.json()) as {
      content: string;
      isPrivate?: boolean;
    };

    if (!body.content?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Note content is required' },
        { status: 400 }
      );
    }

    // Verify customer belongs to business
    const customer = await db.customer.findFirst({
      where: { id: customerId, businessId },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const note = await db.customerNote.create({
      data: {
        customerId,
        userId,
        content: body.content.trim(),
        isPrivate: body.isPrivate || false,
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
    });

    return NextResponse.json(
      { success: true, data: note, message: 'Note created successfully' },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create note';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}