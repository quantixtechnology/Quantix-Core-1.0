import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withBusinessAccess, parsePagination, paginatedResponse, validateBusinessExists } from '@/lib/api-utils';

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
      const { page, limit, skip, search } = parsePagination(request);
      const { searchParams } = new URL(request.url);
      const categoryId = searchParams.get('categoryId');
      const status = searchParams.get('status');
      const type = searchParams.get('type');
      const isFeatured = searchParams.get('isFeatured');

      const where: Record<string, unknown> = { businessId };
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { sku: { contains: search } },
          { description: { contains: search } },
        ];
      }
      if (categoryId) where.categoryId = categoryId;
      if (status) where.status = status;
      else where.status = 'ACTIVE';
      if (type) where.type = type;
      if (isFeatured === 'true') where.isFeatured = true;

      const [products, total] = await Promise.all([
        db.product.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
          include: {
            category: { select: { id: true, name: true, icon: true } },
            variants: { where: { isActive: true }, orderBy: { isDefault: 'desc' } },
            _count: { select: { orderItems: true, inventory: true } },
          },
        }),
        db.product.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: paginatedResponse(products, total, page, limit),
      });
    } catch (error) {
      console.error('List products error:', error);
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
      if (!bu || (bu.role !== 'SUPER_ADMIN' && bu.role !== 'BUSINESS_OWNER' && bu.role !== 'BUSINESS_ADMIN' && bu.role !== 'STORE_MANAGER')) {
        return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
      }

      const body = await request.json();
      const {
        name, slug, description, shortDesc, categoryId,
        type, status, sku, barcode, images, unit, unitQuantity,
        isVeg, isFeatured, isPopular, preparationTime,
        minOrderQty, maxOrderQty, tags, nutritionInfo, allergenInfo,
        sortOrder, metadata,
        variants,
      } = body;

      if (!name || !slug) {
        return NextResponse.json({ success: false, error: 'Name and slug are required' }, { status: 400 });
      }

      const existing = await db.product.findUnique({ where: { businessId_slug: { businessId, slug } } });
      if (existing) {
        return NextResponse.json({ success: false, error: 'Product slug already exists' }, { status: 409 });
      }

      const product = await db.product.create({
        data: {
          businessId,
          name,
          slug,
          description,
          shortDesc,
          categoryId,
          type: type || 'PHYSICAL',
          status: status || 'ACTIVE',
          sku,
          barcode,
          images: images ? JSON.stringify(images) : '[]',
          unit,
          unitQuantity,
          isVeg,
          isFeatured: isFeatured || false,
          isPopular: isPopular || false,
          preparationTime,
          minOrderQty: minOrderQty || 1,
          maxOrderQty: maxOrderQty || 100,
          tags: tags ? JSON.stringify(tags) : '[]',
          nutritionInfo: nutritionInfo ? JSON.stringify(nutritionInfo) : null,
          allergenInfo: allergenInfo ? JSON.stringify(allergenInfo) : null,
          sortOrder: sortOrder || 0,
          metadata: metadata ? JSON.stringify(metadata) : '{}',
          variants: variants ? {
            create: variants.map((v: Record<string, unknown>) => ({
              name: v.name as string,
              sku: v.sku as string | null,
              barcode: v.barcode as string | null,
              price: v.price as number,
              mrp: v.mrp as number,
              costPrice: v.costPrice as number | null,
              discountPrice: v.discountPrice as number | null,
              discountPercent: v.discountPercent as number | null,
              stock: (v.stock as number) || 0,
              minStock: (v.minStock as number) || 0,
              isDefault: (v.isDefault as boolean) || false,
              isActive: true,
              attributes: v.attributes ? JSON.stringify(v.attributes) : '{}',
            })),
          } : undefined,
        },
        include: {
          category: { select: { id: true, name: true } },
          variants: true,
        },
      });

      return NextResponse.json(
        { success: true, data: product, message: 'Product created successfully' },
        { status: 201 }
      );
    } catch (error) {
      console.error('Create product error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
