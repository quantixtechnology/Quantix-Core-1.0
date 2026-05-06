import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { businessId };
    if (type) where.type = type;
    if (status) where.status = status;

    const deployments = await db.deployment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: deployments });
  } catch (error) {
    console.error('Get deployments error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch deployments' },
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
    const { type, environment, hostingProvider, hostingConfig, version, notes } = body;

    if (!type) {
      return NextResponse.json(
        { success: false, error: 'Deployment type is required' },
        { status: 400 }
      );
    }

    const deployment = await db.deployment.create({
      data: {
        platformId: 'platform_1',
        businessId,
        type,
        environment: environment || 'production',
        hostingProvider: hostingProvider || 'replit',
        hostingConfig: hostingConfig ? JSON.stringify(hostingConfig) : '{}',
        version,
        notes,
        status: 'PENDING',
      },
    });

    return NextResponse.json({ success: true, data: deployment }, { status: 201 });
  } catch (error) {
    console.error('Create deployment error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create deployment' },
      { status: 500 }
    );
  }
}
