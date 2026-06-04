// ============================================================================
// QUANTIX CORE — Storefront Categories API
// GET /api/core/storefront/categories — Public category listing (no auth)
//
// Category creation/editing is handled exclusively by:
// POST/PATCH/DELETE /api/core/businesses/[businessId]/categories
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveImageUrl } from '@/lib/image-url';
import type { Prisma } from '@prisma/client';
import { resolveTenantFromHostname } from '@/lib/tenant-resolver';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = await resolveTenantFromHostname(request) || searchParams.get('businessId');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const productStatus = searchParams.get('productStatus') || 'ACTIVE';

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      );
    }

    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { id: true, status: true },
    });

    if (!business || (business.status !== 'ACTIVE' && business.status !== 'ONBOARDING')) {
      return NextResponse.json(
        { success: false, error: 'Business not found or not active' },
        { status: 404 }
      );
    }

    const catWhere: Prisma.CategoryWhereInput = { businessId };
    if (!includeInactive) catWhere.isActive = true;

    const productWhere: Prisma.ProductWhereInput | undefined =
      productStatus === 'ALL' ? undefined : { status: productStatus as Prisma.EnumProductStatusFilter };

    const categories = await db.category.findMany({
      where: catWhere,
      include: {
        products: {
          where: productWhere,
          select: { id: true },
        },
        children: {
          where: includeInactive ? undefined : { isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            icon: true,
            color: true,
            sortOrder: true,
            isActive: true,
            workflowType: true,
            products: {
              where: productWhere,
              select: { id: true },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    const storefrontCategories = categories
      .filter((cat) => !cat.parentId)
      .map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        image: resolveImageUrl(category.image),
        icon: category.icon,
        color: category.color ?? '#10B981',
        sortOrder: category.sortOrder,
        isActive: category.isActive,
        workflow: category.workflowType,
        workflowType: category.workflowType,
        productCount: category.products.length,
        children: category.children.map((child) => ({
          id: child.id,
          name: child.name,
          slug: child.slug,
          image: resolveImageUrl(child.image),
          icon: child.icon,
          color: child.color ?? '#10B981',
          sortOrder: child.sortOrder,
          isActive: child.isActive,
          workflow: child.workflowType,
          productCount: child.products.length,
        })),
      }));

    return NextResponse.json({
      success: true,
      data: storefrontCategories,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list storefront categories';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
