// GET /api/core/storefront/orders/[orderId]/invoice/pdf
// Customer-facing PDF for a store order invoice.
// Validates order belongs to the requesting customer before rendering.

import { NextResponse }  from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { db }             from '@/lib/db'
import { buildOrderInvoiceHtml, logoToBase64 } from '@/lib/document-renderer'

export const GET = withMiddleware({
  requireAuth:   true,
  requiredRoles: ['CUSTOMER', 'CLIENT_OWNER', 'STORE_MANAGER'],
})(async (req, context) => {
  try {
    const params  = await context?.params
    const orderId = params?.orderId as string
    if (!orderId) return NextResponse.json({ success: false, error: 'orderId required' }, { status: 400 })

    const user       = req.user!
    const businessId = user.businessId!

    // For CUSTOMER role: verify order belongs to them
    let customerId: string | undefined
    if (!user.isPlatformAdmin && user.role === 'CUSTOMER') {
      const customer = await db.customer.findFirst({
        where: { userId: user.id, businessId },
        select: { id: true },
      })
      if (!customer) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
      customerId = customer.id
    }

    const invoice = await db.invoice.findUnique({
      where: { orderId },
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
            gstNumber: true, panNumber: true,
            address: true, city: true, state: true, pincode: true,
            contactEmail: true, contactPhone: true,
          },
        },
      },
    })

    if (!invoice) return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 })

    // Verify this invoice belongs to the right business
    if (!user.isPlatformAdmin && invoice.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    // For customers: verify they own this order
    if (customerId && invoice.customerId !== customerId) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
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
    console.error('[CustomerOrderInvoicePDF] error', (err as Error)?.message)
    return NextResponse.json(
      { success: false, error: `Failed to render invoice: ${(err as Error)?.message ?? String(err)}` },
      { status: 500 },
    )
  }
})
