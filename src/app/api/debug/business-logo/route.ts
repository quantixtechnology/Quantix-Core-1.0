// ============================================================================
// GET /api/debug/business-logo?businessCode=BUS-xxx  OR  ?businessId=xxx
// Debug endpoint — check logo/favicon upload state for a business
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { join } from 'path';
import { db } from '@/lib/db';
import { UPLOAD_ROOT } from '@/lib/upload-root';
import { platformOnly } from "@/lib/platform-guard"

export async function GET(req: NextRequest) {
  // Platform staff only — diagnostics/administration, never tenant-reachable.
  const _denied = await platformOnly(req)
  if (_denied) return _denied
  const { searchParams } = new URL(req.url);
  const businessCode = searchParams.get('businessCode');
  const businessId = searchParams.get('businessId');

  if (!businessCode && !businessId) {
    return NextResponse.json(
      { success: false, error: 'Provide ?businessCode=BUS-xxx or ?businessId=...' },
      { status: 400 }
    );
  }

  try {
    const where = businessId ? { id: businessId } : { businessCode: businessCode! };
    const business = await db.business.findFirst({
      where,
      select: {
        id: true,
        name: true,
        businessCode: true,
        slug: true,
        logo: true,
        favicon: true,
      },
    });

    if (!business) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    const resolveFile = (dbValue: string | null) => {
      if (!dbValue) return { dbValue: null, absolutePath: null, exists: false, publicUrl: null };
      // dbValue is like /uploads/business/{id}/logos/logo-xxx.png
      const relativePath = dbValue.replace(/^\/uploads\//, '');
      const absolutePath = join(UPLOAD_ROOT, relativePath);
      return {
        dbValue,
        absolutePath,
        exists: existsSync(absolutePath),
        publicUrl: dbValue,
      };
    };

    return NextResponse.json({
      success: true,
      business: business.name,
      businessId: business.id,
      businessCode: business.businessCode,
      slug: business.slug,
      uploadRoot: UPLOAD_ROOT,
      logo: resolveFile(business.logo),
      favicon: resolveFile(business.favicon),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
