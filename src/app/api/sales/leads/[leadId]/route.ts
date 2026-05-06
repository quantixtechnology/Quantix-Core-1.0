import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      include: { salesRep: { select: { id: true, name: true, email: true } } },
    });

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: lead });
  } catch (error) {
    console.error('Get lead error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch lead' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const body = await request.json();

    const existing = await db.lead.findUnique({ where: { id: leadId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'businessName', 'contactName', 'contactEmail', 'contactPhone',
      'businessType', 'source', 'status', 'notes', 'salesRepId',
      'estimatedValue', 'convertedBusinessId', 'tags',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'estimatedValue') {
          updateData[field] = parseFloat(String(body[field]));
        } else if (field === 'tags') {
          updateData[field] = JSON.stringify(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    if (body.followUpDate !== undefined) {
      updateData.followUpDate = body.followUpDate ? new Date(body.followUpDate) : null;
    }

    updateData.lastContactedAt = new Date();

    const lead = await db.lead.update({
      where: { id: leadId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: lead });
  } catch (error) {
    console.error('Update lead error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update lead' },
      { status: 500 }
    );
  }
}
