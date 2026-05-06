import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withBusinessAccess } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;
  return withBusinessAccess(request, businessId, async () => {
    try {
      const business = await db.business.findUnique({
        where: { id: businessId },
        include: {
          _count: {
            select: {
              stores: true,
              customers: true,
              orders: true,
              products: true,
              deliveryPartners: true,
              businessUsers: true,
            },
          },
        },
      });

      if (!business) {
        return NextResponse.json(
          { success: false, error: 'Business not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: business });
    } catch (error) {
      console.error('Get business error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;
  return withBusinessAccess(request, businessId, async (_req, user) => {
    try {
      const bu = user.businessUsers.find(b => b.businessId === businessId);
      if (!bu || (bu.role !== 'SUPER_ADMIN' && bu.role !== 'BUSINESS_OWNER' && bu.role !== 'BUSINESS_ADMIN')) {
        return NextResponse.json(
          { success: false, error: 'Insufficient permissions' },
          { status: 403 }
        );
      }

      const body = await request.json();
      const allowedFields = [
        'name', 'description', 'domain', 'subdomain',
        'primaryColor', 'secondaryColor', 'logo', 'favicon',
        'address', 'city', 'state', 'pincode', 'country',
        'contactEmail', 'contactPhone', 'supportEmail', 'supportPhone',
        'gstNumber', 'panNumber', 'cinNumber',
        'defaultCurrency', 'defaultLocale', 'timezone',
        'status', 'settings', 'features',
      ];

      const data: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          data[field] = body[field];
        }
      }

      const business = await db.business.update({
        where: { id: businessId },
        data,
      });

      return NextResponse.json({
        success: true,
        data: business,
        message: 'Business updated successfully',
      });
    } catch (error) {
      console.error('Update business error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
