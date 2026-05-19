// ============================================================================
// GET /api/core/businesses/[businessId]/products/export?format=csv|xlsx
// Returns all products as a downloadable CSV or Excel file.
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import type { NextRequest } from 'next/server'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

const HEADERS = [
  'SKU', 'Product Name', 'Category', 'Variant', 'MRP', 'Selling Price',
  'Stock', 'Weight', 'Unit', 'Description', 'Veg', 'Featured', 'Image URL',
  'Tax', 'Barcode', 'Brand', 'HSN', 'Status',
]

export const GET = withMiddleware({ requireAuth: true })(
  async (req: NextRequest, ctx?: Ctx) => {
    try {
      const businessId = ((await ctx?.params)?.businessId) as string | undefined
      if (!businessId) return createErrorResponse('Missing businessId', 400)

      const { searchParams } = new URL(req.url)
      const format = searchParams.get('format') ?? 'csv'

      const products = await db.product.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { name: true } },
          variants: {
            where: { isDefault: true },
            select: { name: true, price: true, mrp: true },
            take: 1,
          },
          inventory: {
            select: { quantity: true },
            take: 1,
          },
        },
      })

      const rows = products.map(p => {
        const v    = p.variants[0]
        const inv  = p.inventory[0]
        let images: string[] = []
        try { images = JSON.parse(p.images) } catch { /* ignore */ }
        let meta: Record<string, unknown> = {}
        try { meta = JSON.parse(p.metadata) } catch { /* ignore */ }

        return [
          p.sku             ?? '',
          p.name,
          p.category?.name  ?? '',
          v?.name && v.name !== p.name ? v.name : '',
          v?.mrp            ?? '',
          v?.price          ?? '',
          inv?.quantity     ?? 0,
          '',
          p.unit            ?? '',
          p.description     ?? '',
          p.isVeg === true ? 'Yes' : p.isVeg === false ? 'No' : '',
          p.isFeatured ? 'Yes' : 'No',
          images[0]         ?? '',
          meta.tax          ?? '',
          p.barcode         ?? '',
          meta.brand        ?? '',
          meta.hsn          ?? '',
          p.status,
        ]
      })

      const allRows = [HEADERS, ...rows]

      if (format === 'xlsx') {
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.aoa_to_sheet(allRows)
        // Column widths
        ws['!cols'] = HEADERS.map((h, i) => ({ wch: i === 1 || i === 9 ? 30 : 14 }))
        XLSX.utils.book_append_sheet(wb, ws, 'Products')
        const buf   = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
        const bytes = Buffer.from(buf.buffer)
        return new NextResponse(bytes as unknown as BodyInit, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="products-export.xlsx"`,
          },
        })
      }

      // Default: CSV
      const csv = allRows.map(r =>
        r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
      ).join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="products-export.csv"`,
        },
      })
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Export failed',
        500,
      )
    }
  },
)
