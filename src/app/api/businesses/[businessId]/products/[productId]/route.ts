import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withBusinessAccess, validateBusinessExists } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; productId: string }> }
) {
  const { businessId, productId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async () => {
    try {
      const product = await db.product.findFirst({
        where: { id: productId, businessId },
        include: {
          category: { select: { id: true, name: true, icon: true } },
          variants: { orderBy: { isDefault: 'desc' } },
          inventory: { include: { store: { select: { id: true, name: true } } } },
        },
      });

      if (!product) {
        return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: product });
    } catch (error) {
      console.error('Get product error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; productId: string }> }
) {
  const { businessId, productId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async (_req, user) => {
    try {
      const bu = user.businessUsers.find(b => b.businessId === businessId);
      if (!bu || (bu.role !== 'SUPER_ADMIN' && bu.role !== 'BUSINESS_OWNER' && bu.role !== 'BUSINESS_ADMIN' && bu.role !== 'STORE_MANAGER')) {
        return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
      }

      const product = await db.product.findFirst({ where: { id: productId, businessId } });
      if (!product) {
        return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
      }

      const body = await request.json();
      const allowedFields = [
        'name', 'description', 'shortDesc', 'categoryId',
        'type', 'status', 'sku', 'barcode', 'images', 'unit', 'unitQuantity',
        'isVeg', 'isFeatured', 'isPopular', 'preparationTime',
        'minOrderQty', 'maxOrderQty', 'tags', 'nutritionInfo', 'allergenInfo',
        'sortOrder', 'metadata',
      ];

      const data: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          if (['images', 'tags', 'metadata', 'nutritionInfo', 'allergenInfo'].includes(field)) {
            data[field] = JSON.stringify(body[field]);
          } else {
            data[field] = body[field];
          }
        }
      }

      const updated = await db.product.update({
        where: { id: productId },
        data,
        include: { category: { select: { id: true, name: true } }, variants: true },
      });

      return NextResponse.json({ success: true, data: updated, message: 'Product updated successfully' });
    } catch (error) {
      console.error('Update product error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; productId: string }> }
) {
  const { businessId, productId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async (_req, user) => {
    try {
      const bu = user.businessUsers.find(b => b.businessId === businessId);
      if (!bu || (bu.role !== 'SUPER_ADMIN' && bu.role !== 'BUSINESS_OWNER')) {
        return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
      }

      const product = await db.product.findFirst({ where: { id: productId, businessId } });
      if (!product) {
        return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
      }

      await db.product.update({ where: { id: productId }, data: { status: 'ARCHIVED' } });
      return NextResponse.json({ success: true, message: 'Product archived successfully' });
    } catch (error) {
      console.error('Delete product error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
