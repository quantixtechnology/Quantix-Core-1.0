import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withBusinessAccess, validateBusinessExists } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async () => {
    try {
      const taxConfigs = await db.taxConfig.findMany({
        where: { businessId },
        orderBy: [{ isDefault: 'desc' }, { gstRate: 'asc' }],
      });

      return NextResponse.json({ success: true, data: taxConfigs });
    } catch (error) {
      console.error('List tax configs error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async (_req, user) => {
    try {
      const bu = user.businessUsers.find(b => b.businessId === businessId);
      if (!bu || (bu.role !== 'SUPER_ADMIN' && bu.role !== 'BUSINESS_OWNER' && bu.role !== 'BUSINESS_ADMIN')) {
        return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
      }

      const body = await request.json();
      const { name, taxType, gstRate, cgstRate, sgstRate, igstRate, cessRate, hsnCode, isActive, isDefault } = body;

      if (!name || !taxType || gstRate === undefined) {
        return NextResponse.json({ success: false, error: 'Name, taxType, and gstRate are required' }, { status: 400 });
      }

      // If setting as default, unset other defaults
      if (isDefault) {
        await db.taxConfig.updateMany({
          where: { businessId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const taxConfig = await db.taxConfig.create({
        data: {
          businessId,
          name,
          taxType,
          gstRate,
          cgstRate: cgstRate || 0,
          sgstRate: sgstRate || 0,
          igstRate: igstRate || 0,
          cessRate: cessRate || 0,
          hsnCode,
          isActive: isActive !== undefined ? isActive : true,
          isDefault: isDefault || false,
        },
      });

      return NextResponse.json(
        { success: true, data: taxConfig, message: 'Tax config created' },
        { status: 201 }
      );
    } catch (error) {
      console.error('Create tax config error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
