// ============================================================================
// QUANTIX CORE — Business Modules API
// GET  /api/core/businesses/[businessId]/modules  — List modules (auth required)
// PUT  /api/core/businesses/[businessId]/modules  — Enable/disable module (platform admin)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { getBusinessModules, enableModule, disableModule } from '@/lib/core/platform';
import type { ModuleKey, ModuleStatus } from '@/lib/core/types';

export const GET = withMiddleware({ requireAuth: true })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });

    const user = req.user!;
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    const modules = await getBusinessModules(businessId);
    return NextResponse.json({ success: true, data: modules });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list modules';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const PUT = withMiddleware({ requireAuth: true, requiredRoles: ['QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'] })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });

    const body = (await req.json()) as { moduleKey: ModuleKey; status: 'ENABLED' | 'DISABLED'; config?: Record<string, unknown> };

    if (!body.moduleKey || !body.status) {
      return NextResponse.json({ success: false, error: 'Missing required fields: moduleKey, status' }, { status: 400 });
    }

    const validStatuses: ModuleStatus[] = ['ENABLED', 'DISABLED'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    if (body.status === 'ENABLED') {
      await enableModule(businessId, body.moduleKey, body.config);
    } else {
      await disableModule(businessId, body.moduleKey);
    }

    const modules = await getBusinessModules(businessId);
    return NextResponse.json({
      success: true,
      data: modules,
      message: `Module "${body.moduleKey}" ${body.status === 'ENABLED' ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update module';
    return NextResponse.json({ success: false, error: message }, { status: message.includes('Unknown module') ? 400 : 500 });
  }
});
