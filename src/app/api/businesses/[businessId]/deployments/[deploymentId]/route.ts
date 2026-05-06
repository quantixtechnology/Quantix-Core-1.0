import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string; deploymentId: string }> }
) {
  try {
    const { businessId, deploymentId } = await params;

    const deployment = await db.deployment.findFirst({
      where: { id: deploymentId, businessId },
    });

    if (!deployment) {
      return NextResponse.json(
        { success: false, error: 'Deployment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: deployment });
  } catch (error) {
    console.error('Get deployment error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch deployment' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; deploymentId: string }> }
) {
  try {
    const { businessId, deploymentId } = await params;
    const body = await request.json();

    const existing = await db.deployment.findFirst({
      where: { id: deploymentId, businessId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Deployment not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.status) updateData.status = body.status;
    if (body.healthStatus) updateData.healthStatus = body.healthStatus;
    if (body.buildUrl) updateData.buildUrl = body.buildUrl;
    if (body.liveUrl) updateData.liveUrl = body.liveUrl;
    if (body.version) updateData.version = body.version;
    if (body.deployedBy) updateData.deployedBy = body.deployedBy;
    if (body.notes) updateData.notes = body.notes;
    if (body.hostingConfig) updateData.hostingConfig = JSON.stringify(body.hostingConfig);

    if (body.status === 'LIVE') {
      updateData.deployedAt = new Date();
    }

    updateData.lastCheckedAt = new Date();

    const deployment = await db.deployment.update({
      where: { id: deploymentId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: deployment });
  } catch (error) {
    console.error('Update deployment error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update deployment' },
      { status: 500 }
    );
  }
}
