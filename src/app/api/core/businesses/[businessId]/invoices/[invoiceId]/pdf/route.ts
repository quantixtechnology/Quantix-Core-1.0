// GET /api/core/businesses/[businessId]/invoices/[invoiceId]/pdf
// Returns print-ready HTML for a store order invoice.
// Client opens in new window; browser "Save as PDF" produces the file.

import { NextResponse }    from 'next/server'
import { withMiddleware }  from '@/lib/middleware'
import { db }              from '@/lib/db'
import { buildOrderInvoiceHtml, logoToBase64 } from '@/lib/document-renderer'

export const GET = withMiddleware({
  requireAuth:   true,
  requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'STORE_OPERATOR', 'BILLING_STAFF', 'QUANTIX_SUPER_ADMIN'],
})(async (req, context) => {
  try {
    const params    = await context?.params
    const businessId = params?.businessId as string
    const invoiceId  = params?.invoiceId  as string

    console.log('[InvoicePDF/admin]', {
      authorization: req.headers.get('authorization') ? 'present' : 'MISSING',
      businessId,
      invoiceId,
      path: req.nextUrl.pathname,
    })

    if (!businessId || !invoiceId) {
      return NextResponse.json({ success: false, error: 'Missing params' }, { status: 400 })
    }

    const user = req.user!
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, businessId },
      include: {
        order: {
          include: {
            items: {
              select: {
                id: true, itemName: true, variantName: true,
                quantity: true, unitPrice: true, totalPrice: true,
                unit: true,
              },
            },
            store: { select: { id: true, name: true } },
          },
        },
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
        business: {
          select: {
            id: true, name: true, slug: true, logo: true, primaryColor: true,
            gstNumber: true, panNumber: true, cinNumber: true,
            fssaiLicense: true, tagline: true,
            address: true, city: true, state: true, country: true, pincode: true,
            contactEmail: true, contactPhone: true,
            supportEmail: true, supportPhone: true,
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 })
    }

    const lineItems = (invoice.order?.items ?? []).map(item => ({
      name:      item.variantName ? `${item.itemName} — ${item.variantName}` : item.itemName,
      quantity:  item.quantity,
      unitPrice: item.unitPrice,
      amount:    item.totalPrice,
    }))

    const logoSrc = await logoToBase64(invoice.business.logo ?? null)

    const html = buildOrderInvoiceHtml({
      invoice:   invoice as unknown as Record<string, unknown>,
      business:  invoice.business,
      storeName: invoice.order?.store?.name ?? invoice.business.name,
      customer: {
        name:    invoice.customer?.name ?? invoice.order?.customerName ?? 'Customer',
        phone:   invoice.customer?.phone ?? invoice.order?.customerPhone ?? null,
        email:   invoice.customer?.email ?? invoice.order?.customerEmail ?? null,
        address: invoice.order?.deliveryAddress ?? null,
      },
      lineItems,
      logoSrc,
      forPrint: true,
    })

    return new NextResponse(html, {
      headers: {
        'Content-Type':  'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[OrderInvoicePDF] error', (err as Error)?.message)
    return NextResponse.json(
      { success: false, error: `Failed to render invoice: ${(err as Error)?.message ?? String(err)}` },
      { status: 500 },
    )
  }
})
