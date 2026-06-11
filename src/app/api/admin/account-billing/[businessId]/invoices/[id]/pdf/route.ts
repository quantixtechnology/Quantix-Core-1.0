// GET /api/admin/account-billing/[businessId]/invoices/[id]/pdf
// Returns a print-ready HTML invoice.
// Client opens the HTML in a new window; browser "Save as PDF" produces the file.
// No Puppeteer / Chromium / Linux system dependencies required.

import { db }             from '@/lib/db'
import { NextResponse }   from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { getPlatformSettings, invoiceLogoUrl as resolveInvoiceLogoUrl } from '@/lib/platform-settings'
import { buildInvoiceHtml, logoToBase64 } from '@/lib/document-renderer'
import type { NextRequest } from 'next/server'

export const GET = withMiddleware({
  requireAuth:        true,
  requiredPermission: 'subscriptions:view',
})(async (req: NextRequest, context) => {
  const params     = await context?.params
  const businessId = params?.businessId as string
  const id         = params?.id         as string

  const tag = `[PDF] invoice=${id} business=${businessId}`

  try {
    // ── 1. Load invoice ──────────────────────────────────────────────────────
    console.log(`${tag} step=db_query`)
    const invoice = await db.billingInvoice.findFirst({
      where:   { id, businessId },
      include: {
        payments: {
          where:   { status: 'COMPLETED' },
          orderBy: { paidAt: 'desc' },
          select:  { id: true, amount: true, paidAt: true, paymentMode: true, transactionId: true, status: true },
        },
        account: {
          include: {
            business: {
              select: {
                name: true, contactEmail: true, contactPhone: true,
                address: true, city: true, state: true, pincode: true,
                gstNumber: true,
              },
            },
          },
        },
      },
    })

    if (!invoice) {
      console.log(`${tag} step=not_found`)
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 })
    }
    console.log(`${tag} step=invoice_loaded invoiceNumber=${invoice.invoiceNumber} status=${invoice.status}`)

    // ── 2. Platform settings ─────────────────────────────────────────────────
    const business = invoice.account.business
    const ps       = await getPlatformSettings()
    console.log(`${tag} step=platform_settings_ok companyName=${ps.companyName}`)

    // ── 3. Line items ────────────────────────────────────────────────────────
    let lineItems: { name: string; description?: string | null; quantity: number; unitPrice: number; amount: number }[] = []
    try {
      lineItems = JSON.parse(invoice.lineItems as string)
      console.log(`${tag} step=line_items_parsed count=${lineItems.length}`)
    } catch {
      const items = await db.billingInvoiceItem.findMany({ where: { invoiceId: id } })
      lineItems = items.map(i => ({
        name:        i.name,
        description: i.description,
        quantity:    i.quantity,
        unitPrice:   i.unitPrice,
        amount:      i.amount,
      }))
      console.log(`${tag} step=line_items_db count=${lineItems.length}`)
    }

    // ── 4. Logo ──────────────────────────────────────────────────────────────
    const logoUrl = resolveInvoiceLogoUrl(ps)
    const logoSrc = await logoToBase64(logoUrl)
    console.log(`${tag} step=logo_resolved src=${logoSrc ? 'base64' : 'null'}`)

    // ── 5. Render HTML ───────────────────────────────────────────────────────
    const html = buildInvoiceHtml({
      invoice:  invoice as unknown as Record<string, unknown>,
      business: business as unknown as Record<string, unknown>,
      ps,
      lineItems,
      payments: invoice.payments as unknown as { amount: number; paidAt: string; paymentMode: string | null; transactionId: string | null; status: string }[],
      logoSrc,
      forPrint: true,
    })
    console.log(`${tag} step=html_built length=${html.length}`)

    // ── 6. Audit (non-blocking) ──────────────────────────────────────────────
    const performedById   = req.headers.get('x-user-id')   ?? null
    const performedByName = req.headers.get('x-user-name') ?? null
    db.billingAudit.create({
      data: {
        accountId:       invoice.accountId,
        businessId,
        action:          'INVOICE_DOWNLOADED',
        entityType:      'INVOICE',
        entityId:        id,
        description:     `Invoice ${invoice.invoiceNumber} opened for PDF download`,
        performedById,
        performedByName,
      },
    }).catch(() => {})

    console.log(`${tag} step=done invoiceNumber=${invoice.invoiceNumber}`)

    return new NextResponse(html, {
      headers: {
        'Content-Type':  'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error(`${tag} step=error`, {
      error: (err as Error)?.message ?? String(err),
      stack: (err as Error)?.stack,
    })
    return NextResponse.json(
      { success: false, error: `Failed to render invoice: ${(err as Error)?.message ?? String(err)}` },
      { status: 500 }
    )
  }
})
