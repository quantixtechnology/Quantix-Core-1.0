// Customer notifications for laundry field events. Reuses the platform
// notification system (Notification table via sendNotification) — no new
// notification framework. Best-effort + non-fatal: a notification failure must
// never block an operational action. The order timeline (LaundryOrderEvent) is
// the authoritative record; these are the customer-facing pings.
import { prisma } from "@/lib/prisma"
import { sendNotification, type NotificationType } from "@/lib/core/notification"

export async function notifyCustomerForOrder(
  orderId: string,
  lbId: string,
  n: { type: NotificationType; title: string; message: string },
): Promise<void> {
  try {
    const order = await prisma.laundryOrder.findFirst({ where: { id: orderId, businessId: lbId }, select: { customerId: true } })
    if (!order?.customerId) return
    const customer = await prisma.customer.findUnique({ where: { id: order.customerId }, select: { userId: true, businessId: true } })
    if (!customer?.userId) return
    await sendNotification({
      businessId: customer.businessId,
      userId: customer.userId,
      type: n.type,
      channel: "IN_APP",
      title: n.title,
      message: n.message,
      data: { orderId },
    })
  } catch {
    // non-fatal
  }
}
