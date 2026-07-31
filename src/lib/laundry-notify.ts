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

// In-app ping when a Pickup OTP is generated (order created). In-app only —
// SMS/WhatsApp delivery of the code is a later phase. Best-effort + non-fatal.
export async function notifyPickupOtpGenerated(orderId: string, lbId: string, otp: string): Promise<void> {
  await notifyCustomerForOrder(orderId, lbId, {
    type: "ORDER_STATUS",
    title: "Pickup OTP generated",
    message: `Your Pickup OTP is ${otp}. Please share this OTP with our Pickup Executive when your order is collected.`,
  })
}

// In-app ping when a Delivery OTP is generated (order becomes READY_FOR_DELIVERY).
export async function notifyDeliveryOtpGenerated(orderId: string, lbId: string, otp: string): Promise<void> {
  await notifyCustomerForOrder(orderId, lbId, {
    type: "DELIVERY_UPDATE",
    title: "Delivery OTP generated",
    message: `Your Delivery OTP is ${otp}. Please provide this OTP to the Delivery Executive before accepting your order.`,
  })
}
