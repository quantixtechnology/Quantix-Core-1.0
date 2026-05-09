// ============================================================================
// QUANTIX CORE — Storefront Categories API
// GET /api/core/storefront/categories — Public category listing
//
// No auth required
// Returns categories with product counts
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId') || request.headers.get('x-business-id');

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      );
    }

    // Verify business exists
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

    // Get categories with product counts
    const categories = await db.category.findMany({
      where: {
        businessId,
        isActive: true,
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
            sortOrder: true,
            products: {
              where: { status: 'ACTIVE' },
              select: { id: true },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Transform for customer-facing response
    const storefrontCategories = categories
      .filter((cat) => !cat.parentId) // Only top-level categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        image: category.image,
        icon: category.icon,
        sortOrder: category.sortOrder,
        productCount: category.products.length,
        children: category.children.map((child) => ({
          id: child.id,
          name: child.name,
          slug: child.slug,
          image: child.image,
          icon: child.icon,
          sortOrder: child.sortOrder,
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
