// ============================================================================
// GET /api/admin/products/catalogs
// List all products with their feature catalogs
// Super Admin only
// ============================================================================

import { withMiddleware } from '@/lib/middleware'
import { db } from '@/lib/db'
import { getAllProductsWithCatalogs } from '@/lib/product-registry-init'

export const GET = withMiddleware({ permission: 'products:view' })(
  async (req, ctx) => {
    try {
      const productsWithCatalogs = await getAllProductsWithCatalogs()

      return new Response(
        JSON.stringify({
          success: true,
          data: productsWithCatalogs.map((p) => ({
            id: p.id,
            code: p.code,
            name: p.name,
            slug: p.slug,
            description: p.description,
            workspaceUrl: p.workspaceUrl,
            currentVersion: p.currentVersion,
            status: p.status,
            isEnabled: p.isEnabled,
            defaultStorageQuotaMB: p.defaultStorageQuotaMB,
            catalog: p.catalog,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          })),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    } catch (error) {
      console.error('Error fetching products with catalogs:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch products',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }
)
