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
      const { searchParams } = new URL(request.url);
      const includeInactive = searchParams.get('includeInactive') === 'true';
      const parentId = searchParams.get('parentId');

      const where: Record<string, unknown> = { businessId };
      if (!includeInactive) where.isActive = true;
      if (parentId) where.parentId = parentId;
      if (parentId === 'root') where.parentId = null;

      const categories = await db.category.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          _count: { select: { products: true, children: true } },
          parent: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json({ success: true, data: categories });
    } catch (error) {
      console.error('List categories error:', error);
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
      const { name, slug, description, image, icon, parentId, sortOrder, isActive } = body;

      if (!name || !slug) {
        return NextResponse.json({ success: false, error: 'Name and slug are required' }, { status: 400 });
      }

      const existing = await db.category.findUnique({ where: { businessId_slug: { businessId, slug } } });
      if (existing) {
        return NextResponse.json({ success: false, error: 'Category slug already exists' }, { status: 409 });
      }

      const category = await db.category.create({
        data: {
          businessId,
          name,
          slug,
          description,
          image,
          icon,
          parentId,
          sortOrder: sortOrder || 0,
          isActive: isActive !== undefined ? isActive : true,
        },
        include: {
          parent: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json(
        { success: true, data: category, message: 'Category created successfully' },
        { status: 201 }
      );
    } catch (error) {
      console.error('Create category error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
