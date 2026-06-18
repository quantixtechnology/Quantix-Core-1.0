import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'
import { generateGarmentBarcode } from '@/lib/barcode'
import type { NextRequest } from 'next/server'

const GARMENT_TYPES = [
  "Shirt", "Pant", "T-Shirt", "Kurta", "Blazer",
  "Bedsheet", "Blanket", "Curtain", "Saree", "Other",
]

export const GET = withMiddleware({ requireAuth: true })(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')
    const barcode = searchParams.get('barcode')

    if (barcode) {
      const item = await db.garmentItem.findUnique({
        where: { barcode },
        include: { order: { select: { orderNumber: true, customerName: true, status: true } } },
      })
      if (!item) return createErrorResponse('Garment not found', 404)
      return NextResponse.json({ success: true, data: item })
    }

    if (!orderId) return createErrorResponse('orderId or barcode required', 400)
    const items = await db.garmentItem.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ success: true, data: items })
  } catch (error) {
    return createErrorResponse(error instanceof Error ? error.message : 'Failed to fetch garments', 500)
  }
})

export const POST = withMiddleware({ requireAuth: true })(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const { orderId, businessId, items } = body as {
      orderId: string
      businessId: string
      items: Array<{ itemName: string; quantity: number; weight?: number }>
    }

    if (!orderId || !businessId || !items?.length) {
      return createErrorResponse('orderId, businessId, and items are required', 400)
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true, businessId: true },
    })
    if (!order) return createErrorResponse('Order not found', 404)
    if (order.businessId !== businessId) return createErrorResponse('Order does not belong to this business', 403)

    let sequence = 0
    const existingCount = await db.garmentItem.count({ where: { orderId } })
    sequence = existingCount

    const garments: Array<{
      orderId: string
      businessId: string
      itemName: string
      quantity: number
      weight: number | null
      barcode: string
      status: string
    }> = []
    for (const item of items) {
      if (!GARMENT_TYPES.includes(item.itemName)) continue
      const count = Math.max(1, item.quantity || 1)
      for (let i = 0; i < count; i++) {
        sequence++
        const barcode = generateGarmentBarcode(order.orderNumber, item.itemName, sequence)
        garments.push({
          orderId,
          businessId,
          itemName: item.itemName,
          quantity: 1,
          weight: item.weight || null,
          barcode,
          status: 'RECEIVED',
        })
      }
    }

    if (garments.length === 0) return createErrorResponse('No valid garment items provided', 400)

    await db.garmentItem.createMany({ data: garments })
    const created = await db.garmentItem.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    return createErrorResponse(error instanceof Error ? error.message : 'Failed to create garments', 500)
  }
})

export const PATCH = withMiddleware({ requireAuth: true })(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const { id, status, photoPickup, photoProcessing, photoQc, photoDelivery, notes } = body

    if (!id) return createErrorResponse('Garment item id is required', 400)

    const updateData: Record<string, unknown> = {}
    if (status) updateData.status = status
    if (photoPickup !== undefined) updateData.photoPickup = photoPickup
    if (photoProcessing !== undefined) updateData.photoProcessing = photoProcessing
    if (photoQc !== undefined) updateData.photoQc = photoQc
    if (photoDelivery !== undefined) updateData.photoDelivery = photoDelivery
    if (notes !== undefined) updateData.notes = notes

    if (Object.keys(updateData).length === 0) return createErrorResponse('No fields to update', 400)

    const updated = await db.garmentItem.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return createErrorResponse(error instanceof Error ? error.message : 'Failed to update garment', 500)
  }
})
