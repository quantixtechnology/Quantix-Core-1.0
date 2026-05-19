// ============================================================================
// QUANTIX CORE — Store Categories API
// GET /api/core/stores/{storeId}/categories
//
// Customer-facing. No auth required.
// Returns active top-level categories for the business that owns this store.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const GET = async (
  _req: Request,
  { params }: { params: Promise<{ storeId: string }> }
) => {
  try {
    const { storeId } = await params;

    const store = await db.store.findUnique({
      where: { id: storeId },
      select: { businessId: true, status: true },
    });

    if (!store || store.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Store not found' },
        { status: 404 }
      );
    }

    const categories = await db.category.findMany({
      where: {
        businessId: store.businessId,
        isActive: true,
        parentId: null,
      },
      include: {
        products: {
          where: { status: 'ACTIVE' },
          select: { id: true },
        },
        children: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            icon: true,
            color: true,
            sortOrder: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    const data = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      image: cat.image,
      icon: cat.icon,
      color: cat.color ?? '#10B981',
      sortOrder: cat.sortOrder,
      productCount: cat.products.length,
      children: cat.children.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        image: c.image,
        icon: c.icon,
        sortOrder: c.sortOrder,
      })),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load categories';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
};
