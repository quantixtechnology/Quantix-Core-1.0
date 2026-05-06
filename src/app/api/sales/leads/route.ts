import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const source = searchParams.get('source');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (source) where.source = source;
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
        include: { salesRep: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.lead.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: leads,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get leads error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      businessName, contactName, contactEmail, contactPhone,
      businessType, source, notes, followUpDate, estimatedValue,
      salesRepId, tags,
    } = body;

    if (!businessName || !contactName || !contactEmail || !contactPhone || !businessType) {
      return NextResponse.json(
        { success: false, error: 'businessName, contactName, contactEmail, contactPhone, businessType are required' },
        { status: 400 }
      );
    }

    const lead = await db.lead.create({
      data: {
        platformId: 'platform_1',
        businessName,
        contactName,
        contactEmail,
        contactPhone,
        businessType,
        source: source || 'META_ADS',
        notes,
        followUpDate: followUpDate ? new Date(followUpDate) : undefined,
        estimatedValue: estimatedValue ? parseFloat(String(estimatedValue)) : undefined,
        salesRepId,
        tags: tags ? JSON.stringify(tags) : '[]',
      },
    });

    return NextResponse.json({ success: true, data: lead }, { status: 201 });
  } catch (error) {
    console.error('Create lead error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create lead' },
      { status: 500 }
    );
  }
}
