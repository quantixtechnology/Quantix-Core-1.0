import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string; productId: string }> }
) {
  try {
    const { businessId, productId } = await params;

    const product = await db.product.findFirst({
      where: { id: productId, businessId },
      include: {
        category: true,
        variants: { where: { isActive: true } },
        inventory: { include: { store: { select: { id: true, name: true } } } },
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    console.error('Get product error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; productId: string }> }
) {
  try {
    const { businessId, productId } = await params;
    const body = await request.json();

    const existing = await db.product.findFirst({ where: { id: productId, businessId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const stringFields = [
      'name', 'description', 'shortDesc', 'type', 'status', 'sku', 'barcode',
      'unit', 'nutritionInfo', 'allergenInfo', 'categoryId', 'storeId',
    ];
    for (const field of stringFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    const floatFields = ['unitQuantity', 'minOrderQty', 'maxOrderQty'];
    for (const field of floatFields) {
      if (body[field] !== undefined) updateData[field] = parseFloat(String(body[field]));
    }

    const intFields = ['preparationTime', 'sortOrder'];
    for (const field of intFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    const booleanFields = ['isVeg', 'isFeatured', 'isPopular'];
    for (const field of booleanFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    const jsonFields: Record<string, string> = { images: 'images', tags: 'tags', metadata: 'metadata' };
    for (const [key, prismaKey] of Object.entries(jsonFields)) {
      if (body[key] !== undefined) updateData[prismaKey] = JSON.stringify(body[key]);
    }

    const product = await db.product.update({
      where: { id: productId },
      data: updateData,
      include: { variants: true },
    });

    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    console.error('Update product error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string; productId: string }> }
) {
  try {
    const { businessId, productId } = await params;

    const existing = await db.product.findFirst({ where: { id: productId, businessId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    await db.product.delete({ where: { id: productId } });

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
