import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;

    const domain = await db.domainMapping.findUnique({ where: { businessId } });

    if (!domain) {
      return NextResponse.json(
        { success: false, error: 'No domain mapping found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: domain });
  } catch (error) {
    console.error('Get domain error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch domain' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const body = await request.json();
    const { domain, subdomain, isPrimary, dnsProvider, dnsConfig, notes } = body;

    if (!domain) {
      return NextResponse.json(
        { success: false, error: 'Domain is required' },
        { status: 400 }
      );
    }

    const existing = await db.domainMapping.findUnique({ where: { businessId } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Domain mapping already exists for this business' },
        { status: 409 }
      );
    }

    const domainMapping = await db.domainMapping.create({
      data: {
        platformId: 'platform_1',
        businessId,
        domain,
        subdomain,
        isPrimary: isPrimary ?? true,
        dnsProvider,
        dnsConfig: dnsConfig ? JSON.stringify(dnsConfig) : '{}',
        notes,
        status: 'PENDING_DNS',
      },
    });

    return NextResponse.json({ success: true, data: domainMapping }, { status: 201 });
  } catch (error) {
    console.error('Create domain error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create domain mapping' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const body = await request.json();

    const existing = await db.domainMapping.findUnique({ where: { businessId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'No domain mapping found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'domain', 'subdomain', 'isPrimary', 'sslStatus', 'dnsProvider', 'notes',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    if (body.dnsConfig) updateData.dnsConfig = JSON.stringify(body.dnsConfig);
    if (body.status) updateData.status = body.status;
    if (body.sslExpiryDate) updateData.sslExpiryDate = new Date(body.sslExpiryDate);

    if (body.configuredBy) {
      updateData.configuredBy = body.configuredBy;
      updateData.configuredAt = new Date();
    }

    if (body.deployedAt) updateData.deployedAt = new Date(body.deployedAt);

    const domain = await db.domainMapping.update({
      where: { businessId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: domain });
  } catch (error) {
    console.error('Update domain error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update domain mapping' },
      { status: 500 }
    );
  }
}
