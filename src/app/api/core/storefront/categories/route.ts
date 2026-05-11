// ============================================================================
// QUANTIX CORE — Storefront Categories API
// GET /api/core/storefront/categories — Public category listing
// POST /api/core/storefront/categories — Create category (admin)
//
// No auth required
// Returns categories with product counts
// Pass includeInactive=true to include inactive categories (admin use)
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId') || request.headers.get('x-business-id');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const productStatus = searchParams.get('productStatus') || 'ACTIVE'; // Status of products to count

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

    // Build where clause
    const catWhere: Record<string, unknown> = { businessId };
    if (!includeInactive) {
      catWhere.isActive = true;
    }

    // Get categories with product counts
    const categories = await db.category.findMany({
      where: catWhere,
      include: {
        products: {
          where: productStatus === 'ALL' ? {} : { status: productStatus },
          select: { id: true },
        },
        children: {
          where: includeInactive ? {} : { isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            icon: true,
            sortOrder: true,
            isActive: true,
            workflowType: true,
            products: {
              where: productStatus === 'ALL' ? {} : { status: productStatus },
              select: { id: true },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Transform for response
    const storefrontCategories = categories
      .filter((cat) => !cat.parentId) // Only top-level categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        image: category.image,
        icon: category.icon,
        color: category.image || '#10B981', // Use image field or default color
        sortOrder: category.sortOrder,
        isActive: category.isActive,
        workflow: category.workflowType,
        productCount: category.products.length,
        children: category.children.map((child) => ({
          id: child.id,
          name: child.name,
          slug: child.slug,
          image: child.image,
          icon: child.icon,
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

// ============================================================================
// POST — Create a new category (admin)
// ============================================================================
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      );
    }

    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'Category name is required' },
        { status: 400 }
      );
    }

    // Verify business exists
    const business = await db.business.findUnique({
      where: { id: body.businessId },
    });
    if (!business) {
      return NextResponse.json(
        { success: false, error: 'Business not found' },
        { status: 404 }
      );
    }

    // Generate slug if not provided
    const slug = body.slug || body.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60);

    // Get the max sortOrder for this business's categories
    const maxSortCategory = await db.category.findFirst({
      where: { businessId: body.businessId, parentId: null },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const category = await db.category.create({
      data: {
        businessId: body.businessId,
        name: body.name,
        slug,
        description: body.description || null,
        image: body.image || body.icon || null,
        icon: body.icon || null,
        parentId: body.parentId || null,
        workflowType: body.workflowType || 'ECOMMERCE',
        sortOrder: body.sortOrder ?? (maxSortCategory?.sortOrder ?? 0) + 1,
        isActive: body.isActive !== false,
      },
    });

    return NextResponse.json({
      success: true,
      data: category,
      message: 'Category created successfully',
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create category';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
