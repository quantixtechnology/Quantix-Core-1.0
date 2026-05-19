// ============================================================================
// GET /api/core/businesses/[businessId]/customers/export?format=csv|xlsx
// Returns all customers as a downloadable CSV or Excel file.
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import type { NextRequest } from 'next/server'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

const HEADERS = [
  'Customer Name', 'Phone', 'Email', 'Address', 'Area', 'Pincode',
  'City', 'State', 'Loyalty Tier', 'Wallet Balance', 'Notes',
  'GST', 'Tags', 'Status',
]

export const GET = withMiddleware({ requireAuth: true })(
  async (req: NextRequest, ctx?: Ctx) => {
    try {
      const businessId = ((await ctx?.params)?.businessId) as string | undefined
      if (!businessId) return createErrorResponse('Missing businessId', 400)

      const { searchParams } = new URL(req.url)
      const format = searchParams.get('format') ?? 'csv'

      const customers = await db.customer.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        include: {
          addresses: { where: { isDefault: true }, take: 1 },
        },
      })

      const rows = customers.map(c => {
        const addr = c.addresses[0]
        let meta: Record<string, unknown> = {}
        try { meta = JSON.parse(c.metadata) } catch { /* ignore */ }
        let tags: string[] = []
        try { tags = JSON.parse(c.tags) } catch { /* ignore */ }

        return [
          c.name,
          c.phone       ?? '',
          c.email       ?? '',
          addr?.addressLine1  ?? '',
          (meta.area as string) ?? addr?.addressLine2 ?? '',
          addr?.pincode        ?? '',
          addr?.city           ?? '',
          addr?.state          ?? '',
          c.loyaltyTier,
          (meta.walletBalance as number) ?? 0,
          c.notes,
          c.gstNumber   ?? '',
          tags.join(', '),
          c.isActive ? 'Active' : 'Inactive',
        ]
      })

      const allRows = [HEADERS, ...rows]

      if (format === 'xlsx') {
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.aoa_to_sheet(allRows)
        ws['!cols'] = HEADERS.map((_, i) => ({ wch: [0, 1, 2].includes(i) ? 22 : 14 }))
        XLSX.utils.book_append_sheet(wb, ws, 'Customers')
        const buf   = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
        const bytes = Buffer.from(buf.buffer)
        return new NextResponse(bytes as unknown as BodyInit, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="customers-export.xlsx"',
          },
        })
      }

      const csv = allRows.map(r =>
        r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
      ).join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="customers-export.csv"',
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
