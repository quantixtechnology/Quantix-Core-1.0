// ============================================================================
// POST /api/core/businesses/[businessId]/products/import
// Bulk-import products from a pre-parsed row payload.
// Auto-creates missing categories.  Creates product + default variant +
// inventory (resolved to first active store if no storeId provided).
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

interface ImportRow {
  name?: string
  sku?: string
  category?: string
  variant?: string
  mrp?: number | string
  price?: number | string
  stock?: number | string
  weight?: string
  unit?: string
  description?: string
  veg?: boolean | string
  featured?: boolean | string
  imageUrl?: string
  tax?: number | string
  barcode?: string
  brand?: string
  hsn?: string
  status?: string
}

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN'],
})(async (req: NextRequest, ctx?: Ctx) => {
  try {
    const businessId = ((await ctx?.params)?.businessId) as string | undefined
    if (!businessId) return createErrorResponse('Missing businessId', 400)

    const body = await req.json() as { rows: ImportRow[]; storeId?: string }
    const rows = body.rows ?? []

    if (!Array.isArray(rows) || rows.length === 0) {
      return createErrorResponse('No rows to import', 400)
    }

    // Resolve storeId: use provided, or find the first active store for this business
    let resolvedStoreId: string | null = body.storeId ?? null
    if (!resolvedStoreId) {
      const store = await db.store.findFirst({
        where: { businessId, status: 'ACTIVE' },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      })
      resolvedStoreId = store?.id ?? null
    }

    // Category cache keyed by lowercase normalised name
    const categoryCache: Record<string, string> = {}

    async function getOrCreateCategory(name: string): Promise<string> {
      const normalised = name.trim().toLowerCase()
      if (categoryCache[normalised]) return categoryCache[normalised]

      const existing = await db.category.findFirst({
        where: { businessId, name: name.trim() },
        select: { id: true },
      })
      if (existing) {
        categoryCache[normalised] = existing.id
        return existing.id
      }

      // Also check lowercase match to avoid case-diff duplicates
      const existingLower = await db.category.findFirst({
        where: { businessId, slug: normalised.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 60) },
        select: { id: true },
      })
      if (existingLower) {
        categoryCache[normalised] = existingLower.id
        return existingLower.id
      }

      const baseSlug = normalised.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 60)
      const cat = await db.category.create({
        data: {
          businessId: businessId!,
          name: name.trim(),
          slug: `${baseSlug}-${Date.now()}`,
          isActive: true,
        },
        select: { id: true },
      })
      categoryCache[normalised] = cat.id
      return cat.id
    }

    type RowResult = { row: number; status: 'created' | 'skipped' | 'error'; name?: string; reason?: string }
    const results: RowResult[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const productName = String(row.name ?? '').trim()

      if (!productName) {
        results.push({ row: i + 1, status: 'skipped', reason: 'Missing product name' })
        continue
      }

      try {
        // Category
        let categoryId: string | null = null
        if (row.category && String(row.category).trim()) {
          categoryId = await getOrCreateCategory(String(row.category).trim())
        }

        // Slug (deduplicated)
        const baseSlug = productName
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .slice(0, 60)
        const slugConflict = await db.product.findFirst({ where: { businessId, slug: baseSlug } })
        const slug = slugConflict ? `${baseSlug}-${Date.now()}` : baseSlug

        const price = Number(row.price) || 0
        const mrp = Number(row.mrp) || price
        const stock = Number(row.stock) || 0

        const vegRaw = row.veg !== undefined ? String(row.veg).toLowerCase() : ''
        const isVeg = vegRaw === 'yes' || vegRaw === 'true' || vegRaw === '1'
          ? true
          : vegRaw === 'no' || vegRaw === 'false' || vegRaw === '0'
            ? false
            : null

        const featuredRaw = row.featured !== undefined ? String(row.featured).toLowerCase() : ''
        const isFeatured = featuredRaw === 'yes' || featuredRaw === 'true' || featuredRaw === '1'

        const metaObj: Record<string, string | number> = {}
        if (row.brand)  metaObj.brand = String(row.brand)
        if (row.hsn)    metaObj.hsn   = String(row.hsn)
        if (row.tax)    metaObj.tax   = Number(row.tax)

        const product = await db.$transaction(async (tx) => {
          const p = await tx.product.create({
            data: {
              businessId,
              storeId:     resolvedStoreId,
              categoryId,
              name:        productName,
              slug,
              description: row.description ? String(row.description) : null,
              sku:         row.sku         ? String(row.sku)         : null,
              barcode:     row.barcode     ? String(row.barcode)     : null,
              unit:        row.unit        ? String(row.unit)        : null,
              isVeg,
              isFeatured,
              status:      String(row.status ?? '').toLowerCase() === 'inactive' ? 'INACTIVE' : 'ACTIVE',
              images:      row.imageUrl ? JSON.stringify([String(row.imageUrl)]) : '[]',
              tags:        '[]',
              metadata:    JSON.stringify(metaObj),
              variants: {
                create: {
                  name:      row.variant?.trim() ? String(row.variant).trim() : productName,
                  sku:       row.sku             ? String(row.sku)            : null,
                  barcode:   row.barcode         ? String(row.barcode)        : null,
                  price,
                  mrp,
                  isDefault: true,
                  isActive:  true,
                  attributes: '{}',
                },
              },
            },
            include: { variants: { select: { id: true } } },
          })

          if (resolvedStoreId) {
            const variantId = (p as typeof p & { variants: Array<{ id: string }> }).variants[0]?.id
            if (variantId) {
              await tx.inventory.create({
                data: {
                  businessId,
                  storeId:   resolvedStoreId,
                  productId: p.id,
                  variantId,
                  quantity:  stock,
                  minStock:  5,
                  maxStock:  1000,
                  status:    stock > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
                },
              })
            }
          }

          return p
        })

        void product
        results.push({ row: i + 1, status: 'created', name: productName })
      } catch (err) {
        results.push({
          row: i + 1,
          status: 'error',
          name: productName,
          reason: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    const created = results.filter(r => r.status === 'created').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const errors  = results.filter(r => r.status === 'error').length

    return NextResponse.json({
      success: true,
      results,
      summary: { total: rows.length, created, skipped, errors },
    })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Import failed',
      500,
    )
  }
})
