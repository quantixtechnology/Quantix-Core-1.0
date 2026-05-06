import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');
    const categoryId = searchParams.get('categoryId');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const storeId = searchParams.get('storeId');

    const where: Record<string, unknown> = { businessId };
    if (categoryId) where.categoryId = categoryId;
    if (type) where.type = type;
    if (status) where.status = status;
    if (storeId) where.storeId = storeId;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          variants: { where: { isActive: true } },
          _count: { select: { orderItems: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.product.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: products,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get products error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
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
    const {
      name, slug, description, shortDesc, type, status, sku, barcode,
      categoryId, storeId, images, unit, unitQuantity, isVeg,
      isFeatured, isPopular, preparationTime, minOrderQty, maxOrderQty,
      tags, nutritionInfo, allergenInfo, sortOrder, metadata,
      variants,
    } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { success: false, error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    const product = await db.product.create({
      data: {
        businessId,
        name,
        slug,
        description,
        shortDesc,
        type: type || 'PHYSICAL',
        status: status || 'ACTIVE',
        sku,
        barcode,
        categoryId,
        storeId,
        images: images ? JSON.stringify(images) : '[]',
        unit,
        unitQuantity: unitQuantity ? parseFloat(String(unitQuantity)) : null,
        isVeg,
        isFeatured: isFeatured ?? false,
        isPopular: isPopular ?? false,
        preparationTime,
        minOrderQty: minOrderQty ? parseFloat(String(minOrderQty)) : 1,
        maxOrderQty: maxOrderQty ? parseFloat(String(maxOrderQty)) : 100,
        tags: tags ? JSON.stringify(tags) : '[]',
        nutritionInfo,
        allergenInfo,
        sortOrder: sortOrder ?? 0,
        metadata: metadata ? JSON.stringify(metadata) : '{}',
      },
    });

    // Create variants if provided
    if (variants && Array.isArray(variants)) {
      for (const variant of variants) {
        await db.productVariant.create({
          data: {
            productId: product.id,
            name: variant.name,
            sku: variant.sku,
            barcode: variant.barcode,
            price: parseFloat(String(variant.price)),
            mrp: parseFloat(String(variant.mrp)),
            costPrice: variant.costPrice ? parseFloat(String(variant.costPrice)) : null,
            discountPrice: variant.discountPrice ? parseFloat(String(variant.discountPrice)) : null,
            discountPercent: variant.discountPercent ? parseFloat(String(variant.discountPercent)) : null,
            stock: variant.stock ?? 0,
            minStock: variant.minStock ?? 0,
            isDefault: variant.isDefault ?? false,
            isActive: variant.isActive ?? true,
            attributes: variant.attributes ? JSON.stringify(variant.attributes) : '{}',
          },
        });
      }
    }

    const result = await db.product.findUnique({
      where: { id: product.id },
      include: { variants: true, category: true },
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create product' },
      { status: 500 }
    );
  }
}
