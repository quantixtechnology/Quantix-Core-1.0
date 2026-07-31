// ============================================================================
// Laundry Pickup/Delivery Verification — the single enforcement point for the
// customer-verification business rule:
//   · Pickup cannot complete without successful verification.
//   · Delivery cannot complete without successful verification.
// The method (OTP | NAME) is configured in Workflow Settings per business and
// SNAPSHOTTED onto the order (at creation for pickup, at READY_FOR_DELIVERY for
// delivery) so a mid-order settings change never applies retroactively. The
// pickup and delivery OTPs are independent, always-different values; each is
// cleared the moment it verifies successfully and is never reused.
//
// Best-effort generation: an OTP generation failure is logged and NEVER blocks
// the workflow — the business admin can regenerate from the order screen. No
// order may get stuck because of verification.
// ============================================================================
import { prisma } from "@/lib/prisma"
import { generateDeliveryOtp, verifyOtp } from "@/lib/core/delivery"

export type VerificationMethod = "OTP" | "NAME"

export const DEFAULT_VERIFICATION_METHOD: VerificationMethod = "OTP"

const isMethod = (v: string | null | undefined): v is VerificationMethod =>
  v === "OTP" || v === "NAME"

export interface OrderVerificationRow {
  id: string
  pickupOtp?: string | null
  deliveryOtp?: string | null
  pickupVerificationMethod?: string | null
  deliveryVerificationMethod?: string | null
  pickupVerifiedAt?: Date | null
}

// Resolve the business's configured verification methods (Workflow Settings).
// Falls back to OTP when unset or unreadable — never fails.
export async function getVerificationMethods(lbId: string): Promise<{ pickup: VerificationMethod; delivery: VerificationMethod }> {
  const row = await prisma.laundryWorkflowQualityConfig.findUnique({ where: { businessId: lbId } }).catch(() => null)
  return {
    pickup: isMethod(row?.pickupVerificationMethod) ? row!.pickupVerificationMethod : DEFAULT_VERIFICATION_METHOD,
    delivery: isMethod(row?.deliveryVerificationMethod) ? row!.deliveryVerificationMethod : DEFAULT_VERIFICATION_METHOD,
  }
}

function snapshotFor(methods: { pickup: VerificationMethod; delivery: VerificationMethod }, kind: "pickup" | "delivery"): VerificationMethod {
  return kind === "pickup" ? methods.pickup : methods.delivery
}

// Pickup and Delivery OTPs are INDEPENDENT and always different (a customer is
// never asked to share the same code twice). Avoid an accidental collision.
function freshOtp(differentFrom?: string | null): string {
  let otp = generateDeliveryOtp()
  while (differentFrom && otp === differentFrom) otp = generateDeliveryOtp()
  return otp
}

// Resolve the effective method for an order: its snapshot when present,
// otherwise the current business setting (legacy rows / safety net).
export function effectiveMethod(snapshot: string | null | undefined, configured: VerificationMethod): VerificationMethod {
  return isMethod(snapshot) ? snapshot : configured
}

// ── OTP generation (best-effort, never throws) ──────────────────────────────
// Initialise pickup verification at order creation (method snapshot + OTP).
export async function initPickupVerification(lbId: string, orderId: string): Promise<{ method: VerificationMethod; otp: string | null } | null> {
  try {
    const method = snapshotFor(await getVerificationMethods(lbId), "pickup")
    const otp = method === "OTP" ? generateDeliveryOtp() : null
    await prisma.laundryOrder.update({
      where: { id: orderId },
      data: { pickupVerificationMethod: method, pickupOtp: otp },
    })
    return { method, otp }
  } catch (e) {
    console.error("[laundry-verification] pickup verification init failed:", e)
    return null
  }
}

// Generate a fresh Delivery OTP + snapshot the method when an order becomes
// READY_FOR_DELIVERY. Idempotent: does NOT overwrite an existing delivery OTP
// (the delivery OTP is generated once, when the order first becomes ready).
export async function ensureDeliveryVerification(lbId: string, orderId: string): Promise<{ method: VerificationMethod; otp: string | null; generated: boolean }> {
  try {
    const order = await prisma.laundryOrder.findUnique({ where: { id: orderId }, select: { deliveryVerificationMethod: true, deliveryOtp: true, pickupOtp: true } })
    if (order?.deliveryVerificationMethod && order.deliveryOtp) {
      return { method: isMethod(order.deliveryVerificationMethod) ? order.deliveryVerificationMethod : DEFAULT_VERIFICATION_METHOD, otp: order.deliveryOtp, generated: false }
    }
    const method = snapshotFor(await getVerificationMethods(lbId), "delivery")
    const otp = method === "OTP" ? freshOtp(order?.pickupOtp) : null
    await prisma.laundryOrder.update({
      where: { id: orderId },
      data: { deliveryVerificationMethod: method, deliveryOtp: otp },
    })
    return { method, otp, generated: true }
  } catch (e) {
    console.error("[laundry-verification] delivery verification init failed:", e)
    return { method: DEFAULT_VERIFICATION_METHOD, otp: null, generated: false }
  }
}

// Regenerate a verification OTP (Business Admin manual recovery path). Only for
// OTP-method orders; NAME orders have nothing to regenerate.
export async function regenerateOtp(lbId: string, orderId: string, kind: "pickup" | "delivery"): Promise<{ ok: true; otp: string } | { ok: false; error: string }> {
  try {
    const order = await prisma.laundryOrder.findUnique({ where: { id: orderId }, select: { pickupVerificationMethod: true, deliveryVerificationMethod: true, pickupOtp: true, deliveryOtp: true } })
    const method = kind === "pickup" ? order?.pickupVerificationMethod : order?.deliveryVerificationMethod
    if (isMethod(method) && method !== "OTP") {
      return { ok: false, error: `This order uses ${method} verification — no OTP to regenerate.` }
    }
    const differentFrom = kind === "pickup" ? order?.deliveryOtp : order?.pickupOtp
    const otp = freshOtp(differentFrom)
    await prisma.laundryOrder.update({
      where: { id: orderId },
      data: kind === "pickup" ? { pickupOtp: otp, pickupVerificationMethod: "OTP" } : { deliveryOtp: otp, deliveryVerificationMethod: "OTP" },
    })
    return { ok: true, otp }
  } catch (e) {
    console.error("[laundry-verification] OTP regenerate failed:", e)
    return { ok: false, error: "Could not regenerate the OTP. Please try again." }
  }
}

// ── Verification enforcement ────────────────────────────────────────────────
export type VerificationResult =
  | { ok: true; method: VerificationMethod }
  | { ok: false; status: number; error: string }

// Pickup verification. NAME = identity confirmed by the executive (recorded so
// PICKUP_COMPLETED can be gated on it). OTP = must match the stored pickup OTP.
export async function verifyPickup(
  lbId: string,
  order: OrderVerificationRow,
  provided: string | null,
  actorName: string | null,
): Promise<VerificationResult> {
  const method = effectiveMethod(order.pickupVerificationMethod, (await getVerificationMethods(lbId)).pickup)
  if (method === "NAME") {
    await prisma.laundryOrder.update({
      where: { id: order.id },
      data: { pickupVerifiedAt: new Date(), pickupVerifiedBy: actorName },
    }).catch(() => null)
    return { ok: true, method }
  }
  // OTP — expiry on successful use (cleared, never reused).
  if (!order.pickupOtp) {
    return { ok: false, status: 409, error: "Pickup OTP is not available — please ask the store to regenerate it." }
  }
  if (!provided || !verifyOtp(order.pickupOtp, String(provided).trim())) {
    return { ok: false, status: 400, error: "Invalid Pickup OTP." }
  }
  await prisma.laundryOrder.update({
    where: { id: order.id },
    data: { pickupOtp: null, pickupVerifiedAt: new Date(), pickupVerifiedBy: actorName },
  }).catch(() => null)
  return { ok: true, method }
}

// Delivery verification — enforced BEFORE markOrderDelivered. OTP must match the
// stored delivery OTP (cleared on success); NAME requires an explicit
// name-confirmation. The method is checked so a completion can never switch to
// a weaker method than the order is configured for.
export async function verifyDelivery(
  lbId: string,
  order: OrderVerificationRow,
  providedMethod: string | null,
  provided: string | null,
): Promise<VerificationResult> {
  const method = effectiveMethod(order.deliveryVerificationMethod, (await getVerificationMethods(lbId)).delivery)
  if (method === "NAME") {
    if (providedMethod !== "NAME") {
      return { ok: false, status: 400, error: "This order uses Name verification — confirm the customer name instead." }
    }
    return { ok: true, method }
  }
  if (providedMethod !== "OTP") {
    return { ok: false, status: 400, error: "This order uses OTP verification — enter the delivery OTP." }
  }
  if (!order.deliveryOtp) {
    return { ok: false, status: 409, error: "Delivery OTP is not available — please ask the store to regenerate it." }
  }
  if (!provided || !verifyOtp(order.deliveryOtp, String(provided).trim())) {
    return { ok: false, status: 400, error: "Invalid delivery OTP." }
  }
  await prisma.laundryOrder.update({
    where: { id: order.id },
    data: { deliveryOtp: null },
  }).catch(() => null)
  return { ok: true, method }
}
