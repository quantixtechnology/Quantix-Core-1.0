// ============================================================================
// QUANTIX CORE — Business Modules API
// GET  /api/core/businesses/[businessId]/modules  — List business modules
// PUT  /api/core/businesses/[businessId]/modules  — Enable/disable module
// ============================================================================

import { NextResponse } from 'next/server';
import { getBusinessModules, enableModule, disableModule } from '@/lib/core/platform';
import type { ModuleKey, ModuleStatus } from '@/lib/core/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const modules = await getBusinessModules(businessId);

    return NextResponse.json({
      success: true,
      data: modules,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list modules';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const body = (await request.json()) as {
      moduleKey: ModuleKey;
      status: 'ENABLED' | 'DISABLED';
      config?: Record<string, unknown>;
    };

    if (!body.moduleKey || !body.status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: moduleKey, status' },
        { status: 400 }
      );
    }

    const validStatuses: ModuleStatus[] = ['ENABLED', 'DISABLED'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    if (body.status === 'ENABLED') {
      await enableModule(businessId, body.moduleKey, body.config);
    } else {
      await disableModule(businessId, body.moduleKey);
    }

    // Return updated modules list
    const modules = await getBusinessModules(businessId);

    return NextResponse.json({
      success: true,
      data: modules,
      message: `Module "${body.moduleKey}" ${body.status === 'ENABLED' ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update module';
    const status = message.includes('Unknown module') ? 400 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
